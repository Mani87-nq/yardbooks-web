/**
 * GET  /api/v1/pos/business-days — List business days (paginated, filterable)
 * POST /api/v1/pos/business-days — Open a new business day
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

const VALID_STATUSES = ['SCHEDULED', 'OPEN', 'CLOSING_SOON', 'CLOSED', 'FORCE_CLOSED'] as const;

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'pos:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const statusParam = searchParams.get('status');
    const status = statusParam && VALID_STATUSES.includes(statusParam as any)
      ? statusParam
      : undefined;
    const date = searchParams.get('date') ?? undefined;

    const where = {
      companyId: companyId!,
      ...(status ? { status: status as any } : {}),
      ...(date ? { date } : {}),
    };

    const days = await prisma.businessDay.findMany({
      where,
      include: {
        sessions: {
          select: {
            id: true,
            terminalName: true,
            cashierName: true,
            status: true,
            totalSales: true,
            netSales: true,
            openedAt: true,
            closedAt: true,
          },
        },
        eodReport: { select: { id: true, reportNumber: true, approved: true } },
        _count: { select: { sessions: true } },
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { date: 'desc' },
    });

    const hasMore = days.length > limit;
    const data = hasMore ? days.slice(0, limit) : days;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list business days');
  }
}

const openDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  scheduledOpen: z.string().optional(),
  scheduledClose: z.string().optional(),
  openingNotes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'pos:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = openDaySchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Check if a day already exists for this date
    const existing = await prisma.businessDay.findUnique({
      where: { companyId_date: { companyId: companyId!, date: parsed.data.date } },
    });
    if (existing) {
      if (existing.status === 'OPEN') {
        return badRequest('Business day is already open for this date.');
      }
      if (['CLOSED', 'FORCE_CLOSED'].includes(existing.status)) {
        return badRequest('Business day has already been closed for this date.');
      }
    }

    // Look up store hours from POS settings for the scheduled times
    let scheduledOpen = parsed.data.scheduledOpen;
    let scheduledClose = parsed.data.scheduledClose;

    if (!scheduledOpen || !scheduledClose) {
      const settings = await prisma.posSettings.findFirst({
        where: { companyId: companyId! },
        select: { storeHours: true },
      });
      if (settings?.storeHours) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayOfWeek = days[new Date(parsed.data.date + 'T12:00:00').getDay()];
        const hours = (settings.storeHours as any)?.[dayOfWeek];
        if (hours && !hours.isClosed) {
          scheduledOpen = scheduledOpen ?? hours.open;
          scheduledClose = scheduledClose ?? hours.close;
        }
      }
    }

    const day = await prisma.businessDay.upsert({
      where: { companyId_date: { companyId: companyId!, date: parsed.data.date } },
      update: {
        status: 'OPEN',
        actualOpenTime: new Date(),
        openedBy: user!.sub,
        openingNotes: parsed.data.openingNotes ?? null,
        scheduledOpen: scheduledOpen ?? null,
        scheduledClose: scheduledClose ?? null,
      },
      create: {
        companyId: companyId!,
        date: parsed.data.date,
        status: 'OPEN',
        scheduledOpen: scheduledOpen ?? null,
        scheduledClose: scheduledClose ?? null,
        actualOpenTime: new Date(),
        openedBy: user!.sub,
        openingNotes: parsed.data.openingNotes ?? null,
      },
      include: {
        sessions: {
          select: {
            id: true,
            terminalName: true,
            cashierName: true,
            status: true,
            totalSales: true,
          },
        },
        _count: { select: { sessions: true } },
      },
    });

    return NextResponse.json(day, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to open business day');
  }
}
