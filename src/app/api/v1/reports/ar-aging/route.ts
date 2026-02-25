/**
 * GET /api/v1/reports/ar-aging
 * Accounts Receivable Aging Report.
 * - Buckets: Current, 1-30 days, 31-60, 61-90, 90+ overdue
 * - Calculated from invoice due dates vs current date
 * - Grouped by customer
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

    // Get all outstanding invoices (not fully paid, not cancelled, not deleted)
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE'] },
        balance: { gt: 0 },
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        customer: {
          select: { id: true, name: true, companyName: true, email: true, phone: true },
        },
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        balance: true,
        status: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Calculate aging buckets per customer
    const customerMap = new Map<string, AgingCustomer>();

    for (const inv of invoices) {
      const balance = Number(inv.balance);
      if (balance <= 0) continue;

      const daysOverdue = Math.floor((asOfDate.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const bucket = getBucket(daysOverdue);

      let customer = customerMap.get(inv.customerId);
      if (!customer) {
        customer = {
          customerId: inv.customerId,
          customerName: inv.customer.name,
          companyName: inv.customer.companyName,
          email: inv.customer.email,
          phone: inv.customer.phone,
          current: 0,
          days1to30: 0,
          days31to60: 0,
          days61to90: 0,
          days90plus: 0,
          total: 0,
          invoices: [],
        };
        customerMap.set(inv.customerId, customer);
      }

      customer[bucket] += balance;
      customer.total += balance;
      customer.invoices.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate.toISOString(),
        dueDate: inv.dueDate.toISOString(),
        total: round2(Number(inv.total)),
        amountPaid: round2(Number(inv.amountPaid)),
        balance: round2(balance),
        daysOverdue: Math.max(0, daysOverdue),
        bucket,
        status: inv.status,
      });
    }

    // Build sorted customer list
    const customers = Array.from(customerMap.values())
      .map((c) => ({
        ...c,
        current: round2(c.current),
        days1to30: round2(c.days1to30),
        days31to60: round2(c.days31to60),
        days61to90: round2(c.days61to90),
        days90plus: round2(c.days90plus),
        total: round2(c.total),
      }))
      .sort((a, b) => b.total - a.total);

    // Calculate grand totals
    const totals = {
      current: round2(customers.reduce((sum, c) => sum + Number(c.current || 0), 0)),
      days1to30: round2(customers.reduce((sum, c) => sum + Number(c.days1to30 || 0), 0)),
      days31to60: round2(customers.reduce((sum, c) => sum + Number(c.days31to60 || 0), 0)),
      days61to90: round2(customers.reduce((sum, c) => sum + Number(c.days61to90 || 0), 0)),
      days90plus: round2(customers.reduce((sum, c) => sum + Number(c.days90plus || 0), 0)),
      total: round2(customers.reduce((sum, c) => sum + Number(c.total || 0), 0)),
    };

    return NextResponse.json({
      asOfDate: asOfDate.toISOString(),
      customerCount: customers.length,
      invoiceCount: invoices.length,
      customers,
      totals,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate AR aging report');
  }
}

type BucketKey = 'current' | 'days1to30' | 'days31to60' | 'days61to90' | 'days90plus';

function getBucket(daysOverdue: number): BucketKey {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'days1to30';
  if (daysOverdue <= 60) return 'days31to60';
  if (daysOverdue <= 90) return 'days61to90';
  return 'days90plus';
}

interface AgingInvoice {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balance: number;
  daysOverdue: number;
  bucket: BucketKey;
  status: string;
}

interface AgingCustomer {
  customerId: string;
  customerName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
  invoices: AgingInvoice[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
