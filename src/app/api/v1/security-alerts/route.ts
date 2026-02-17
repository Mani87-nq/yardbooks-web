/**
 * GET /api/v1/security-alerts
 *
 * List recent security alerts from AuditLog where action = 'SECURITY_ALERT'.
 * Requires 'audit:read' permission.
 * Supports date range filtering via startDate / endDate query params.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'audit:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const severity = searchParams.get('severity'); // LOW | MEDIUM | HIGH | CRITICAL
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

    const where: Record<string, unknown> = {
      companyId: companyId!,
      action: 'SECURITY_ALERT',
    };

    // Date range filter
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.createdAt = dateFilter;
    }

    // Severity filter via newValues JSON path
    // Severity is stored inside newValues.severity
    if (severity) {
      where.newValues = {
        path: ['severity'],
        equals: severity.toUpperCase(),
      };
    }

    const entries = await prisma.auditLog.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        companyId: true,
        userId: true,
        action: true,
        entityType: true,
        entityId: true,
        newValues: true,
        notes: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    });

    const hasMore = entries.length > limit;
    const data = hasMore ? entries.slice(0, limit) : entries;

    // Reshape for convenience: pull severity / type / description out of newValues
    const alerts = data.map((entry) => {
      const newValues =
        entry.newValues && typeof entry.newValues === 'object' && !Array.isArray(entry.newValues)
          ? (entry.newValues as Record<string, unknown>)
          : {};

      return {
        id: entry.id,
        companyId: entry.companyId,
        userId: entry.userId,
        type: newValues.type ?? null,
        severity: newValues.severity ?? null,
        description: newValues.description ?? entry.notes ?? null,
        metadata: newValues.metadata ?? {},
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        createdAt: entry.createdAt,
      };
    });

    return NextResponse.json({
      data: alerts,
      pagination: {
        nextCursor: hasMore ? data[data.length - 1].id : null,
        hasMore,
        limit,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list security alerts');
  }
}
