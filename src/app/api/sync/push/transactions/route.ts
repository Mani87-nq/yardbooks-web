/**
 * POST /api/sync/push/transactions
 *
 * Receives offline POS transactions from the client and persists them.
 * Part of the offline-first sync protocol.
 *
 * Offline transactions represent REAL SALES that happened — they are
 * always accepted (never rejected for business logic reasons), but
 * flagged for review if anomalies are detected.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'pos:create');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const {
      orderNumber,
      employeeId,
      items,
      payments,
      subtotal,
      discountAmount,
      gctAmount,
      total,
      customerId,
      customerName,
      notes,
      timestamp,
    } = body;

    if (!orderNumber || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Missing required fields: orderNumber, items' },
        { status: 400 }
      );
    }

    // Idempotency check: if this orderNumber was already synced, return the existing record
    const existing = await prisma.posOrder.findFirst({
      where: { companyId: companyId!, orderNumber: String(orderNumber) },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({
        serverTransactionId: existing.id,
        duplicate: true,
      });
    }

    // Calculate derived totals
    const itemCount = items.reduce(
      (sum: number, i: Record<string, unknown>) => sum + (Number(i.quantity) || 1),
      0
    );
    const taxableAmount = Number(subtotal) - Number(discountAmount || 0);
    const amountPaid = (payments || []).reduce(
      (sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0),
      0
    );
    const amountDue = Number(total) - amountPaid;

    // Create the POS order from offline data
    const order = await prisma.posOrder.create({
      data: {
        companyId: companyId!,
        orderNumber: String(orderNumber),
        status: 'COMPLETED',
        subtotal: Number(subtotal) || 0,
        orderDiscountAmount: Number(discountAmount) || 0,
        taxableAmount: taxableAmount > 0 ? taxableAmount : 0,
        exemptAmount: 0,
        gctRate: 0.15,
        gctAmount: Number(gctAmount) || 0,
        total: Number(total) || 0,
        itemCount,
        amountPaid,
        amountDue: amountDue > 0 ? amountDue : 0,
        changeGiven: amountDue < 0 ? Math.abs(amountDue) : 0,
        customerId: customerId || null,
        customerName: customerName || 'Walk-in Customer',
        notes: notes || null,
        createdBy: employeeId || user!.sub,
        isOfflineOrder: true,
        syncedAt: new Date(),
        completedAt: timestamp ? new Date(timestamp) : new Date(),
        items: {
          create: items.map((item: Record<string, unknown>, idx: number) => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.unitPrice) || 0;
            const disc = Number(item.discount) || 0;
            const lineSubtotal = qty * price;
            const lineTotalBeforeTax = lineSubtotal - disc;
            const itemGctRate = Number(item.gctRate) || 0.15;
            const itemGctAmount = Number(item.gctAmount) || lineTotalBeforeTax * itemGctRate;
            const lineTotal = lineTotalBeforeTax + itemGctAmount;

            return {
              lineNumber: idx + 1,
              productId: (item.productId as string) || null,
              name: (item.name as string) || 'Unknown Item',
              quantity: qty,
              uomCode: (item.uomCode as string) || 'EA',
              unitPrice: price,
              lineSubtotal,
              discountAmount: disc,
              lineTotalBeforeTax,
              gctRate: itemGctRate,
              gctAmount: itemGctAmount,
              lineTotal,
              notes: (item.notes as string) || null,
            };
          }),
        },
        payments: {
          create: (payments || []).map((p: Record<string, unknown>) => ({
            method: (p.method as string) || 'CASH',
            amount: Number(p.amount) || 0,
            status: 'COMPLETED',
            reference: (p.reference as string) || null,
            amountTendered: Number(p.amountTendered || p.amount) || 0,
            changeGiven: Number(p.changeGiven) || 0,
          } as any)),
        },
      },
      select: { id: true },
    });

    // Flag if the employee was deactivated while offline
    if (employeeId) {
      const employee = await prisma.employeeProfile.findFirst({
        where: { id: employeeId, companyId: companyId! },
        select: { isActive: true },
      });
      if (employee && !employee.isActive) {
        console.warn(
          `[OFFLINE-SYNC] Deactivated employee ${employeeId} processed offline sale ${order.id}. Flagged for review.`
        );
      }
    }

    return NextResponse.json({
      serverTransactionId: order.id,
      duplicate: false,
    });
  } catch (error) {
    console.error('[SYNC] Transaction push error:', error);
    return NextResponse.json(
      { error: 'Failed to sync transaction' },
      { status: 500 }
    );
  }
}
