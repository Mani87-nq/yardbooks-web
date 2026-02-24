/**
 * GET/POST /api/v1/invoices/reminders
 * Payment reminders for overdue invoices.
 * - GET: List overdue invoices with reminder status
 * - POST: Send/schedule reminders for overdue invoices
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { sendEmail } from '@/lib/email/service';
import { paymentReminderEmail } from '@/lib/email/templates';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'invoices:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const now = new Date();

    // Get all overdue invoices
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        companyId: companyId!,
        deletedAt: null,
        status: { in: ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE'] },
        balance: { gt: 0 },
        dueDate: { lt: now },
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        total: true,
        amountPaid: true,
        balance: true,
        issueDate: true,
        dueDate: true,
        status: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Categorize by overdue severity
    const categorized = overdueInvoices.map((inv) => {
      const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      let severity: 'mild' | 'moderate' | 'severe' | 'critical';
      let suggestedAction: string;

      if (daysOverdue <= 7) {
        severity = 'mild';
        suggestedAction = 'Friendly reminder email';
      } else if (daysOverdue <= 30) {
        severity = 'moderate';
        suggestedAction = 'Follow-up email with urgency';
      } else if (daysOverdue <= 60) {
        severity = 'severe';
        suggestedAction = 'Phone call + formal letter';
      } else {
        severity = 'critical';
        suggestedAction = 'Final notice - consider collections';
      }

      return {
        ...inv,
        total: Number(inv.total),
        amountPaid: Number(inv.amountPaid),
        balance: Number(inv.balance),
        daysOverdue,
        severity,
        suggestedAction,
      };
    });

    // Summary stats
    const totalOverdue = categorized.reduce((sum, i) => sum + i.balance, 0);
    const mildCount = categorized.filter((i) => i.severity === 'mild').length;
    const moderateCount = categorized.filter((i) => i.severity === 'moderate').length;
    const severeCount = categorized.filter((i) => i.severity === 'severe').length;
    const criticalCount = categorized.filter((i) => i.severity === 'critical').length;

    return NextResponse.json({
      overdueCount: categorized.length,
      totalOverdue: round2(totalOverdue),
      summary: { mild: mildCount, moderate: moderateCount, severe: severeCount, critical: criticalCount },
      invoices: categorized,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list overdue invoices');
  }
}

const sendReminderSchema = z.object({
  invoiceIds: z.array(z.string()).min(1),
  message: z.string().optional(),
  // In a real implementation, this would trigger actual emails
  // For now, we log the reminder intent and return a preview
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'invoices:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = sendReminderSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const { invoiceIds, message } = parsed.data;

    // Get the invoices with company info for email template
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        companyId: companyId!,
        deletedAt: null,
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        company: { select: { businessName: true, tradingName: true, currency: true } },
      },
    });

    if (invoices.length === 0) {
      return badRequest('No valid invoices found');
    }

    // Update invoice statuses to OVERDUE if not already
    await prisma.invoice.updateMany({
      where: {
        id: { in: invoiceIds },
        status: { in: ['SENT', 'VIEWED'] },
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });

    // Send reminder emails for each invoice
    const reminders = [];
    for (const inv of invoices) {
      const daysOverdue = Math.max(0, Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const customerEmail = inv.customer.email;
      const companyName = inv.company.tradingName || inv.company.businessName;
      const currency = inv.company.currency || 'JMD';

      let emailSent = false;
      let emailError: string | undefined;

      if (customerEmail) {
        // Determine severity based on days overdue
        const severity: 'mild' | 'moderate' | 'severe' =
          daysOverdue <= 30 ? 'mild' : daysOverdue <= 60 ? 'moderate' : 'severe';

        const emailContent = paymentReminderEmail({
          customerName: inv.customer.name,
          invoiceNumber: inv.invoiceNumber,
          amount: Number(inv.balance),
          currency,
          dueDate: inv.dueDate.toLocaleDateString('en-JM', { year: 'numeric', month: 'long', day: 'numeric' }),
          daysOverdue,
          companyName,
          severity,
        });

        const result = await sendEmail({
          to: customerEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          replyTo: user!.email,
        });

        emailSent = result.success;
        if (!result.success) {
          emailError = result.error;
        }
      }

      reminders.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer.name,
        customerEmail,
        balance: Number(inv.balance),
        daysOverdue,
        reminderSent: emailSent,
        skippedReason: !customerEmail ? 'No email address on file' : emailError ? `Email failed: ${emailError}` : undefined,
        message: message || generateDefaultMessage(inv.invoiceNumber, Number(inv.balance), daysOverdue),
      });
    }

    return NextResponse.json({
      sent: reminders.filter((r) => r.reminderSent).length,
      skipped: reminders.filter((r) => !r.reminderSent).length,
      reminders,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to send reminders');
  }
}

function generateDefaultMessage(invoiceNumber: string, balance: number, daysOverdue: number): string {
  if (daysOverdue <= 0) {
    return `This is a friendly reminder that invoice ${invoiceNumber} with a balance of $${balance.toFixed(2)} is due today. We would appreciate prompt payment.`;
  }
  if (daysOverdue <= 14) {
    return `This is a reminder that invoice ${invoiceNumber} with a balance of $${balance.toFixed(2)} is now ${daysOverdue} days overdue. Please arrange payment at your earliest convenience.`;
  }
  return `Invoice ${invoiceNumber} with a balance of $${balance.toFixed(2)} is now ${daysOverdue} days past due. Please arrange immediate payment to avoid further action.`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
