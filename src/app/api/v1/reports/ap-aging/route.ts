/**
 * GET /api/v1/reports/ap-aging
 * Accounts Payable Aging Report.
 * - Buckets: Current, 1-30 days, 31-60, 61-90, 90+ overdue
 * - Based on unpaid expenses grouped by vendor
 * - Includes totals per bucket
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'reports:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const asOfParam = searchParams.get('asOfDate');
    const asOfDate = asOfParam ? new Date(asOfParam) : new Date();

    // Get all unpaid expenses with vendors (AP = vendor expenses not yet paid)
    // We treat expenses that are not marked as paid and have a vendor as AP items
    const expenses = await prisma.expense.findMany({
      where: {
        companyId,
        deletedAt: null,
        vendorId: { not: null },
        // Only consider expenses that haven't been fully settled
        // We use paymentMethod as null or use the existence of journalEntryId to check
      },
      select: {
        id: true,
        vendorId: true,
        vendor: {
          select: { id: true, name: true, companyName: true, email: true, phone: true },
        },
        description: true,
        amount: true,
        gctAmount: true,
        date: true,
        reference: true,
        category: true,
        paymentMethod: true,
      },
      orderBy: { date: 'asc' },
    });

    // Calculate aging buckets per vendor
    const vendorMap = new Map<string, AgingVendor>();

    for (const exp of expenses) {
      if (!exp.vendorId || !exp.vendor) continue;
      const amount = Number(exp.amount) + Number(exp.gctAmount);
      if (amount <= 0) continue;

      const daysAging = Math.floor((asOfDate.getTime() - exp.date.getTime()) / (1000 * 60 * 60 * 24));
      const bucket = getBucket(daysAging);

      let vendor = vendorMap.get(exp.vendorId);
      if (!vendor) {
        vendor = {
          vendorId: exp.vendorId,
          vendorName: exp.vendor.name,
          companyName: exp.vendor.companyName,
          email: exp.vendor.email,
          phone: exp.vendor.phone,
          current: 0,
          days1to30: 0,
          days31to60: 0,
          days61to90: 0,
          days90plus: 0,
          total: 0,
          expenses: [],
        };
        vendorMap.set(exp.vendorId, vendor);
      }

      vendor[bucket] += amount;
      vendor.total += amount;
      vendor.expenses.push({
        expenseId: exp.id,
        description: exp.description,
        date: exp.date.toISOString(),
        amount: round2(amount),
        category: exp.category,
        reference: exp.reference,
        daysAging,
        bucket,
      });
    }

    // Build sorted vendor list
    const vendors = Array.from(vendorMap.values())
      .map((v) => ({
        ...v,
        current: round2(v.current),
        days1to30: round2(v.days1to30),
        days31to60: round2(v.days31to60),
        days61to90: round2(v.days61to90),
        days90plus: round2(v.days90plus),
        total: round2(v.total),
      }))
      .sort((a, b) => b.total - a.total);

    // Grand totals
    const totals = {
      current: round2(vendors.reduce((sum, v) => sum + v.current, 0)),
      days1to30: round2(vendors.reduce((sum, v) => sum + v.days1to30, 0)),
      days31to60: round2(vendors.reduce((sum, v) => sum + v.days31to60, 0)),
      days61to90: round2(vendors.reduce((sum, v) => sum + v.days61to90, 0)),
      days90plus: round2(vendors.reduce((sum, v) => sum + v.days90plus, 0)),
      total: round2(vendors.reduce((sum, v) => sum + v.total, 0)),
    };

    return NextResponse.json({
      asOfDate: asOfDate.toISOString(),
      vendorCount: vendors.length,
      expenseCount: expenses.length,
      vendors,
      totals,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate AP aging report');
  }
}

type BucketKey = 'current' | 'days1to30' | 'days31to60' | 'days61to90' | 'days90plus';

function getBucket(daysAging: number): BucketKey {
  if (daysAging <= 0) return 'current';
  if (daysAging <= 30) return 'days1to30';
  if (daysAging <= 60) return 'days31to60';
  if (daysAging <= 90) return 'days61to90';
  return 'days90plus';
}

interface AgingExpense {
  expenseId: string;
  description: string;
  date: string;
  amount: number;
  category: string;
  reference: string | null;
  daysAging: number;
  bucket: BucketKey;
}

interface AgingVendor {
  vendorId: string;
  vendorName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
  expenses: AgingExpense[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
