/**
 * POST /api/v1/customers/[id]/statement/email
 * Sends a customer statement summary via email.
 * Requires startDate and endDate in the request body.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
import { sendEmail } from '@/lib/email/service';
import { customerStatementEmail } from '@/lib/email/templates';

type RouteContext = { params: Promise<{ id: string }> };

const sendStatementSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  to: z.string().email().optional(), // Override customer email if provided
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'invoices:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = sendStatementSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid parameters. Provide startDate and endDate.');

    const { startDate, endDate, to } = parsed.data;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return badRequest('Invalid date format');
    }

    // Get customer
    const customer = await prisma.customer.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
    });
    if (!customer) return notFound('Customer not found');

    const recipientEmail = to || customer.email;
    if (!recipientEmail) {
      return badRequest(`No email address on file for ${customer.name}. Please update the customer record or provide an email.`);
    }

    // Get company info
    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: {
        businessName: true,
        tradingName: true,
        currency: true,
        email: true,
        logoUrl: true,
      },
    });
    const companyName = company?.tradingName || company?.businessName || 'YaadBooks';
    const currency = company?.currency || 'JMD';

    // Calculate statement summary
    const invoicesInPeriod = await prisma.invoice.findMany({
      where: {
        customerId: id,
        companyId: companyId!,
        deletedAt: null,
        issueDate: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      select: { total: true },
    });

    const paymentsInPeriod = await prisma.payment.findMany({
      where: {
        invoice: { customerId: id, companyId: companyId! },
        date: { gte: start, lte: end },
      },
      select: { amount: true },
    });

    // Opening balance
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

    const openingBalance = round2(
      Number(invoicesBeforePeriod._sum.total ?? 0) - Number(paymentsBeforePeriod._sum.amount ?? 0)
    );

    const totalInvoiced = round2(invoicesInPeriod.reduce((sum, i) => sum + Number(i.total), 0));
    const totalPayments = round2(paymentsInPeriod.reduce((sum, p) => sum + Number(p.amount), 0));
    const closingBalance = round2(openingBalance + totalInvoiced - totalPayments);
    const transactionCount = invoicesInPeriod.length + paymentsInPeriod.length;

    // Format dates for the email
    const formatOpts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const periodStart = start.toLocaleDateString('en-JM', formatOpts);
    const periodEnd = end.toLocaleDateString('en-JM', formatOpts);

    // Generate and send the email
    const emailContent = customerStatementEmail({
      customerName: customer.name,
      companyName,
      companyLogoUrl: company?.logoUrl || undefined,
      periodStart,
      periodEnd,
      openingBalance,
      closingBalance,
      totalInvoiced,
      totalPayments,
      currency,
      transactionCount,
    });

    const result = await sendEmail({
      to: recipientEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      replyTo: company?.email || user!.email,
    });

    if (!result.success) {
      return internalError(`Email delivery failed: ${result.error}`);
    }

    return NextResponse.json({
      message: `Statement emailed to ${recipientEmail}`,
      messageId: result.messageId,
      summary: {
        customerName: customer.name,
        email: recipientEmail,
        period: `${periodStart} - ${periodEnd}`,
        openingBalance,
        totalInvoiced,
        totalPayments,
        closingBalance,
        transactionCount,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to email statement');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
