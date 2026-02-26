/**
 * DELETE /api/v1/companies/[id]/data
 *
 * Tenant-isolated data reset (DANGER ZONE).
 * Deletes ALL business data for a company while preserving:
 *   - Company record & settings
 *   - CompanyMember records
 *   - User accounts & UserSettings
 *   - GLAccount chart of accounts (structural)
 *
 * Only the company OWNER may perform this action.
 * Requires confirmCompanyName in the request body to prevent accidental resets.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';
import { badRequest, forbidden, notFound, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: companyId } = await context.params;
    const { user, error } = await requireAuth(request);
    if (error) return error;

    // Verify the authenticated user belongs to this company
    if (!user!.companies.includes(companyId)) {
      return forbidden('Cannot reset data for another company');
    }

    // Only OWNER can reset data
    const member = await prisma.companyMember.findFirst({
      where: { companyId, userId: user!.sub },
    });
    if (!member || member.role !== 'OWNER') {
      return forbidden('Only the company owner can reset all data');
    }

    // Require confirmation text in body
    const body = await request.json().catch(() => ({}));
    if (!body.confirmCompanyName) {
      return badRequest('Must provide confirmCompanyName to confirm reset');
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return notFound('Company not found');
    if (body.confirmCompanyName !== company.businessName) {
      return badRequest('Company name confirmation does not match');
    }

    // Delete ALL business data in dependency order within a transaction.
    // Child records (those with foreign keys to parents) must be deleted first.
    // PRESERVE: Company, CompanyMember, User, UserSettings, GLAccount (structural)
    await prisma.$transaction(async (tx) => {
      // ── POS: Return items, then returns ──
      await tx.posReturnItem.deleteMany({
        where: { return: { companyId } },
      });
      await tx.posReturn.deleteMany({ where: { companyId } });

      // ── POS: Payments, order items, then orders ──
      await tx.posPayment.deleteMany({
        where: { order: { companyId } },
      });
      await tx.posOrderItem.deleteMany({
        where: { order: { companyId } },
      });
      await tx.posOrder.deleteMany({ where: { companyId } });

      // ── POS: Cash drawer counts, cash movements, then sessions ──
      await tx.cashDrawerCount.deleteMany({
        where: { session: { companyId } },
      });
      await tx.cashMovement.deleteMany({
        where: { session: { companyId } },
      });

      // ── POS: End-of-day reports (before business days) ──
      await tx.endOfDayReport.deleteMany({ where: { companyId } });

      // ── POS: Sessions (before business days & terminals) ──
      await tx.posSession.deleteMany({ where: { companyId } });

      // ── POS: Business days ──
      await tx.businessDay.deleteMany({ where: { companyId } });

      // ── POS: Terminals ──
      await tx.posTerminal.deleteMany({ where: { companyId } });

      // ── POS: Settings ──
      await tx.posSettings.deleteMany({ where: { companyId } });

      // ── Parking slips ──
      await tx.parkingSlip.deleteMany({ where: { companyId } });

      // ── Invoice children: items, payments, credit notes ──
      await tx.invoiceItem.deleteMany({
        where: { invoice: { companyId } },
      });
      await tx.payment.deleteMany({
        where: { invoice: { companyId } },
      });
      await tx.creditNote.deleteMany({ where: { companyId } });

      // ── Recurring invoices ──
      await tx.recurringInvoice.deleteMany({ where: { companyId } });

      // ── Invoices (after children removed) ──
      await tx.invoice.deleteMany({ where: { companyId } });

      // ── Quotation items, then quotations ──
      await tx.quotationItem.deleteMany({
        where: { quotation: { companyId } },
      });
      await tx.quotation.deleteMany({ where: { companyId } });

      // ── Customer PO items, then customer POs ──
      await tx.customerPOItem.deleteMany({
        where: { customerPO: { companyId } },
      });
      await tx.customerPurchaseOrder.deleteMany({ where: { companyId } });

      // ── Payroll: entries first, then runs ──
      await tx.payrollEntry.deleteMany({
        where: { payrollRun: { companyId } },
      });
      await tx.payrollRun.deleteMany({ where: { companyId } });

      // ── Payroll: Leave balances, loan deductions ──
      await tx.leaveBalance.deleteMany({ where: { companyId } });
      await tx.loanDeduction.deleteMany({ where: { companyId } });

      // ── Statutory remittances ──
      await tx.statutoryRemittance.deleteMany({ where: { companyId } });

      // ── Pension plans (after employees cleared of pensionPlanId) ──
      // Note: Employees reference pensionPlan, so we need to clear the FK first
      await tx.employee.updateMany({
        where: { companyId, pensionPlanId: { not: null } },
        data: { pensionPlanId: null },
      });
      await tx.pensionPlan.deleteMany({ where: { companyId } });

      // ── Expenses ──
      await tx.expense.deleteMany({ where: { companyId } });

      // ── Accounting: Journal lines, then journal entries ──
      await tx.journalLine.deleteMany({
        where: { journalEntry: { companyId } },
      });
      await tx.journalEntry.deleteMany({ where: { companyId } });

      // ── Accounting: Account balances, accounting periods ──
      await tx.accountBalance.deleteMany({ where: { companyId } });
      await tx.accountingPeriod.deleteMany({ where: { companyId } });

      // ── Budgets: lines first, then budgets ──
      await tx.budgetLine.deleteMany({
        where: { budget: { companyId } },
      });
      await tx.budget.deleteMany({ where: { companyId } });

      // ── Fixed assets: depreciation entries, depreciation runs, disposals, then assets ──
      await tx.fixedAssetDepreciationEntry.deleteMany({
        where: { asset: { companyId } },
      });
      await tx.depreciationRun.deleteMany({ where: { companyId } });
      await tx.fixedAssetDisposal.deleteMany({ where: { companyId } });
      await tx.fixedAsset.deleteMany({ where: { companyId } });
      await tx.assetCategory.deleteMany({ where: { companyId } });

      // ── Banking: Reconciliation adjustments, then reconciliations ──
      await tx.reconciliationAdjustment.deleteMany({
        where: { reconciliation: { bankAccount: { companyId } } },
      });
      await tx.bankReconciliation.deleteMany({
        where: { bankAccount: { companyId } },
      });

      // ── Banking: Transactions, import batches, then bank accounts ──
      await tx.bankTransaction.deleteMany({
        where: { bankAccount: { companyId } },
      });
      await tx.importBatch.deleteMany({
        where: { bankAccount: { companyId } },
      });

      // ── FX: Revaluations (depends on bank accounts) ──
      await tx.revaluationEntry.deleteMany({ where: { companyId } });

      // ── Bank accounts ──
      await tx.bankAccount.deleteMany({ where: { companyId } });

      // ── FX: Gain/Loss ──
      await tx.fxGainLoss.deleteMany({ where: { companyId } });

      // ── Withholding tax: transactions and certificates ──
      await tx.withholdingTaxTransaction.deleteMany({ where: { companyId } });
      await tx.withholdingTaxCertificate.deleteMany({ where: { companyId } });

      // ── Stock: Count items, then counts ──
      await tx.stockCountItem.deleteMany({
        where: { stockCount: { companyId } },
      });
      await tx.stockCount.deleteMany({ where: { companyId } });

      // ── Stock: Transfer items, then transfers ──
      await tx.stockTransferItem.deleteMany({
        where: { transfer: { companyId } },
      });
      await tx.stockTransfer.deleteMany({ where: { companyId } });

      // ── Stock movements ──
      await tx.stockMovement.deleteMany({ where: { companyId } });

      // ── Warehouses ──
      await tx.warehouse.deleteMany({ where: { companyId } });

      // ── Purchase orders: GRN items, GRNs, PO items, then POs ──
      await tx.goodsReceivedNoteItem.deleteMany({
        where: { goodsReceivedNote: { companyId } },
      });
      await tx.goodsReceivedNote.deleteMany({ where: { companyId } });
      await tx.purchaseOrderItem.deleteMany({
        where: { purchaseOrder: { companyId } },
      });
      await tx.purchaseOrder.deleteMany({ where: { companyId } });

      // ── Core entities: Products, Customers, Employees ──
      await tx.product.deleteMany({ where: { companyId } });
      await tx.customer.deleteMany({ where: { companyId } });
      await tx.employee.deleteMany({ where: { companyId } });

      // ── Documents ──
      await tx.document.deleteMany({ where: { companyId } });

      // ── Notifications ──
      await tx.notification.deleteMany({ where: { companyId } });

      // ── Audit logs ──
      await tx.auditLog.deleteMany({ where: { companyId } });

      // ── Pending invites ──
      await tx.pendingInvite.deleteMany({ where: { companyId } });

      // ── Referral codes and redemptions scoped to this company ──
      await tx.referralRedemption.deleteMany({
        where: { redeemedByCompanyId: companyId },
      });
      await tx.referralCode.deleteMany({ where: { companyId } });
    });

    return NextResponse.json({
      success: true,
      message:
        'All business data has been reset. Company profile, user accounts, and chart of accounts preserved.',
    });
  } catch (err) {
    console.error('Data reset error:', err);
    return internalError(err instanceof Error ? err.message : 'Failed to reset company data');
  }
}
