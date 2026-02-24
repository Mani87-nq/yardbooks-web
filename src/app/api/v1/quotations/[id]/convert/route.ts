/**
 * POST /api/v1/quotations/[id]/convert
 * Converts an accepted quotation into a new invoice.
 * - Copies customer, items, amounts, dates, and notes from the quotation
 * - Marks the quotation as CONVERTED
 * - Returns the newly created invoice
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'invoices:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Fetch the quotation with its items and customer
    const quotation = await prisma.quotation.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      include: {
        items: true,
        customer: { select: { id: true, name: true } },
      },
    });

    if (!quotation) return notFound('Quotation not found');

    if (quotation.status !== 'ACCEPTED') {
      return badRequest('Only accepted quotations can be converted to invoices');
    }

    if (quotation.convertedToInvoice) {
      return badRequest('This quotation has already been converted to an invoice');
    }

    // Generate invoice number
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await prisma.invoice.count({
      where: { companyId: companyId!, createdAt: { gte: new Date(`${year}-01-01`) } },
    });
    const invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;

    // Calculate GCT amount (use taxAmount from quotation as gctAmount)
    const subtotal = Number(quotation.subtotal);
    const gctAmount = Number(quotation.taxAmount ?? quotation.gctAmount ?? 0);
    const discount = Number(quotation.discount ?? 0);
    const total = Number(quotation.total);

    // Use a transaction to atomically create the invoice and update the quotation
    const invoice = await prisma.$transaction(async (tx: any) => {
      // Create the invoice from quotation data
      const inv = await tx.invoice.create({
        data: {
          companyId: companyId!,
          invoiceNumber,
          customerId: quotation.customerId,
          subtotal,
          gctAmount,
          discount,
          total,
          balance: total,
          status: 'DRAFT',
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          notes: quotation.notes,
          terms: quotation.terms,
          createdBy: user!.sub,
          items: {
            create: quotation.items.map((item) => ({
              productId: item.productId || null,
              description: item.productName,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              gctRate: 'STANDARD' as const,
              gctAmount: Number(item.total) * 0.15,
              total: Number(item.total),
            })),
          },
        },
        include: {
          items: true,
          customer: { select: { id: true, name: true } },
        },
      });

      // Update quotation status to CONVERTED
      await tx.quotation.update({
        where: { id },
        data: {
          status: 'CONVERTED',
          convertedToInvoice: true,
          convertedToInvoiceId: inv.id,
        },
      });

      return inv;
    });

    return NextResponse.json({
      message: 'Quotation converted to invoice successfully',
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoice,
    }, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to convert quotation to invoice');
  }
}
