/**
 * GET /api/v1/tax-calendar
 * Tax filing deadline calendar.
 * Shows all Jamaica tax deadlines with notification levels.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { generateTaxDeadlines, getDeadlinesNeedingNotification } from '@/lib/tax/deadline-service';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'tax:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const fiscalYear = parseInt(searchParams.get('fiscalYear') ?? '');
    const filter = searchParams.get('filter'); // 'upcoming' | 'overdue' | 'due_soon' | 'all'

    if (!fiscalYear) {
      return badRequest('fiscalYear is required');
    }

    const now = new Date();
    const deadlines = generateTaxDeadlines(fiscalYear, now);

    // Apply filter
    let filtered = deadlines;
    if (filter && filter !== 'all') {
      if (filter === 'upcoming') {
        filtered = deadlines.filter((d) => d.daysUntilDue > 0);
      } else if (filter === 'overdue') {
        filtered = deadlines.filter((d) => d.status === 'overdue');
      } else if (filter === 'due_soon') {
        filtered = deadlines.filter((d) => d.status === 'due_soon' || d.status === 'due_today');
      }
    }

    // Get deadlines needing notification today
    const needsNotification = getDeadlinesNeedingNotification(deadlines);

    // Summary
    const overdueCount = deadlines.filter((d) => d.status === 'overdue').length;
    const dueSoonCount = deadlines.filter((d) => d.status === 'due_soon' || d.status === 'due_today').length;
    const upcomingCount = deadlines.filter((d) => d.status === 'upcoming').length;

    return NextResponse.json({
      fiscalYear,
      generatedAt: now.toISOString(),
      summary: {
        total: deadlines.length,
        overdue: overdueCount,
        dueSoon: dueSoonCount,
        upcoming: upcomingCount,
      },
      deadlines: filtered.map((d) => ({
        ...d,
        dueDate: d.dueDate.toISOString(),
      })),
      notifications: needsNotification.map((d) => ({
        ...d,
        dueDate: d.dueDate.toISOString(),
      })),
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate tax calendar');
  }
}
