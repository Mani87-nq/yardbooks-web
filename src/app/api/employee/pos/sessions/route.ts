/**
 * GET  /api/employee/pos/sessions — List sessions (filterable by status/terminalId)
 * POST /api/employee/pos/sessions — Open a new session with opening cash
 *
 * Terminal-auth wrapper: cashierId comes from terminal JWT employee.sub.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { badRequest, internalError } from '@/lib/api-error';

const VALID_SESSION_STATUSES = ['OPEN', 'SUSPENDED', 'CLOSED'] as const;

export async function GET(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const statusParam = searchParams.get('status');
    const status = statusParam && VALID_SESSION_STATUSES.includes(statusParam as any)
      ? statusParam
      : undefined;
    if (statusParam && !status) {
      return badRequest('Invalid session status');
    }
    const terminalId = searchParams.get('terminalId') ?? undefined;

    const where = {
      companyId: companyId!,
      ...(status ? { status: status as any } : {}),
      ...(terminalId ? { terminalId } : {}),
    };

    const sessions = await prisma.posSession.findMany({
      where,
      include: {
        terminal: { select: { id: true, name: true, location: true } },
        _count: { select: { orders: true } },
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { openedAt: 'desc' },
    });

    const hasMore = sessions.length > limit;
    const data = hasMore ? sessions.slice(0, limit) : sessions;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list sessions');
  }
}

const createSessionSchema = z.object({
  terminalId: z.string().min(1),
  openingCash: z.number().min(0),
});

export async function POST(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Verify terminal exists and belongs to company
    const terminal = await prisma.posTerminal.findFirst({
      where: { id: parsed.data.terminalId, companyId: companyId!, isActive: true },
    });
    if (!terminal) {
      return badRequest('Terminal not found or inactive');
    }

    // Check for existing open session on this terminal
    const existingSession = await prisma.posSession.findFirst({
      where: { terminalId: parsed.data.terminalId, status: 'OPEN' },
    });
    if (existingSession) {
      return badRequest('Terminal already has an open session. Close it before opening a new one.');
    }

    // Build cashier name from terminal JWT
    const cashierName = `${employee!.firstName} ${employee!.lastName}`;

    const session = await prisma.$transaction(async (tx) => {
      const newSession = await tx.posSession.create({
        data: {
          companyId: companyId!,
          terminalId: parsed.data.terminalId,
          terminalName: terminal.name,
          cashierName,
          cashierId: employee!.sub,
          openingCash: parsed.data.openingCash,
          expectedCash: parsed.data.openingCash,
          status: 'OPEN',
        },
        include: {
          terminal: { select: { id: true, name: true, location: true } },
        },
      });

      // Update terminal's current session
      await tx.posTerminal.update({
        where: { id: parsed.data.terminalId },
        data: { currentSessionId: newSession.id, isOnline: true, lastSeen: new Date() },
      });

      // Record opening cash movement
      await tx.cashMovement.create({
        data: {
          sessionId: newSession.id,
          type: 'OPENING_FLOAT',
          amount: parsed.data.openingCash,
          performedBy: employee!.sub,
          reason: 'Opening float',
        },
      });

      return newSession;
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create session');
  }
}
