/**
 * GET /api/v1/customers/[id]/statement
 * Generate a customer statement.
 * - Lists all invoices, payments, and credit notes for a date range
 * - Running balance calculation
 * - Supports JSON and CSV output
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'invoices:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format'); // 'json' or 'csv'

    if (!startDate || !endDate) {
      return badRequest('startDate and endDate query parameters are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return badRequest('Invalid date format');
    }

    // Get customer
    const customer = await prisma.customer.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
    });
    if (!customer) return notFound('Customer not found');

    // Get company info for letterhead
    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: {
        businessName: true,
        tradingName: true,
        phone: true,
        email: true,
        addressStreet: true,
        addressCity: true,
        addressParish: true,
      },
    });

    // Get invoices in the date range
    const invoices = await prisma.invoice.findMany({
      where: {
        customerId: id,
        companyId: companyId!,
        deletedAt: null,
        issueDate: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        dueDate: true,
        total: true,
        status: true,
      },
      orderBy: { issueDate: 'asc' },
    });

    // Get payments in the date range
    const payments = await prisma.payment.findMany({
      where: {
        invoice: { customerId: id, companyId: companyId! },
        date: { gte: start, lte: end },
      },
      select: {
        id: true,
        invoiceId: true,
        amount: true,
        paymentMethod: true,
        reference: true,
        date: true,
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { date: 'asc' },
    });

    // Get credit notes in the date range
    const creditNotes = await prisma.creditNote.findMany({
      where: {
        customerId: id,
        companyId: companyId!,
        issueDate: { gte: start, lte: end },
        status: { not: 'VOID' },
      },
      select: {
        id: true,
        creditNoteNumber: true,
        total: true,
        issueDate: true,
        status: true,
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { issueDate: 'asc' },
    });

    // Calculate opening balance (balance before the start date)
    const invoicesBeforePeriod = await prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        customerId: id,
        companyId: companyId!,
        deletedAt: null,
        issueDate: { lt: start },
        status: { not: 'CANCELLED' },
      },
    });

    const paymentsBeforePeriod = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        invoice: { customerId: id, companyId: companyId! },
        date: { lt: start },
      },
    });

    const creditsBeforePeriod = await prisma.creditNote.aggregate({
      _sum: { total: true },
      where: {
        customerId: id,
        companyId: companyId!,
        issueDate: { lt: start },
        status: { in: ['APPROVED', 'APPLIED'] },
      },
    });

    const openingBalance = round2(
      Number(invoicesBeforePeriod._sum.total ?? 0) -
      Number(paymentsBeforePeriod._sum.amount ?? 0) -
      Number(creditsBeforePeriod._sum.total ?? 0)
    );

    // Build statement lines sorted chronologically
    type StatementLine = {
      date: string;
      type: string;
      reference: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    };

    const lines: StatementLine[] = [];
    let runningBalance = openingBalance;

    // Merge all transactions chronologically
    type RawEvent = { date: Date; type: string; ref: string; desc: string; debit: number; credit: number };
    const events: RawEvent[] = [];

    for (const inv of invoices) {
      events.push({
        date: inv.issueDate,
        type: 'Invoice',
        ref: inv.invoiceNumber,
        desc: `Invoice ${inv.invoiceNumber}`,
        debit: round2(Number(inv.total)),
        credit: 0,
      });
    }

    for (const pmt of payments) {
      events.push({
        date: pmt.date,
        type: 'Payment',
        ref: pmt.reference || pmt.invoice.invoiceNumber,
        desc: `Payment for ${pmt.invoice.invoiceNumber}`,
        debit: 0,
        credit: round2(Number(pmt.amount)),
      });
    }

    for (const cn of creditNotes) {
      events.push({
        date: cn.issueDate,
        type: 'Credit Note',
        ref: cn.creditNoteNumber,
        desc: `Credit Note against ${cn.invoice.invoiceNumber}`,
        debit: 0,
        credit: round2(Number(cn.total)),
      });
    }

    // Sort by date
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const event of events) {
      runningBalance += event.debit - event.credit;
      lines.push({
        date: event.date.toISOString(),
        type: event.type,
        reference: event.ref,
        description: event.desc,
        debit: event.debit,
        credit: event.credit,
        balance: round2(runningBalance),
      });
    }

    const closingBalance = round2(runningBalance);

    // CSV export
    if (format === 'csv') {
      const csvLines: string[] = [
        'Date,Type,Reference,Description,Debit,Credit,Balance',
        `,,,,,,Opening Balance: ${openingBalance}`,
      ];
      for (const line of lines) {
        csvLines.push(
          `${line.date.split('T')[0]},${line.type},${csvEscape(line.reference)},${csvEscape(line.description)},${line.debit || ''},${line.credit || ''},${line.balance}`
        );
      }
      csvLines.push(`,,,,,,Closing Balance: ${closingBalance}`);

      return new NextResponse(csvLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="statement-${customer.name.replace(/\s+/g, '-')}-${startDate}-${endDate}.csv"`,
        },
      });
    }

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        companyName: customer.companyName,
        email: customer.email,
        address: [customer.addressStreet, customer.addressCity, customer.addressParish].filter(Boolean).join(', '),
      },
      company: company,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      openingBalance,
      lines,
      closingBalance,
      summary: {
        totalInvoiced: round2(invoices.reduce((sum, i) => sum + Number(i.total), 0)),
        totalPayments: round2(payments.reduce((sum, p) => sum + Number(p.amount), 0)),
        totalCredits: round2(creditNotes.reduce((sum, c) => sum + Number(c.total), 0)),
        transactionCount: lines.length,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate customer statement');
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
