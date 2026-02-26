/**
 * POST /api/v1/company/import
 *
 * Import data from a JSON backup file into the authenticated user's company.
 * Accepts multipart/form-data with a single `file` field containing the JSON backup.
 *
 * Supports importing:
 *   - customers
 *   - products
 *   - invoices (with items)
 *   - expenses
 *   - employees
 *
 * Each record is re-created with a new ID, scoped to the current company.
 * Timestamps (createdAt, updatedAt) and foreign IDs are stripped to avoid conflicts.
 *
 * Only OWNER or ADMIN roles can import data.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, forbidden, internalError } from '@/lib/api-error';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Only OWNER or ADMIN can import
    const member = await prisma.companyMember.findFirst({
      where: { companyId: companyId!, userId: user!.sub },
    });
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      return forbidden('Only company owner or admin can import data');
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('No file provided');

    // Validate file size (max 50 MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return badRequest('File size exceeds 50 MB limit');
    }

    let data: Record<string, unknown>;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch {
      return badRequest('Invalid JSON file');
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return badRequest('Invalid backup file format: expected a JSON object');
    }

    const results: Record<string, number> = {};
    const errors: Record<string, string> = {};
    const cid = companyId!;

    // ── Helper to strip system fields and override companyId ──
    function sanitize(record: Record<string, unknown>): Record<string, unknown> {
      const {
        id: _id,
        companyId: _companyId,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        deletedAt: _deletedAt,
        ...rest
      } = record;
      return rest;
    }

    // ── Import customers ──
    if (Array.isArray(data.customers) && data.customers.length > 0) {
      try {
        let count = 0;
        for (const raw of data.customers) {
          if (!raw || typeof raw !== 'object') continue;
          const c = sanitize(raw as Record<string, unknown>);
          // Skip if no name
          if (!c.name) continue;

          // Strip relation fields that would cause errors
          delete c.invoices;
          delete c.quotations;
          delete c.expenses;
          delete c.customerPOs;
          delete c.recurringInvoices;
          delete c.creditNotes;
          delete c.whtTransactions;
          delete c.whtCertificates;
          // Strip computed/relational IDs
          delete c.createdBy;

          await prisma.customer.create({
            data: {
              ...c,
              companyId: cid,
              createdBy: user!.sub,
            } as Parameters<typeof prisma.customer.create>[0]['data'],
          });
          count++;
        }
        results.customers = count;
      } catch (err) {
        errors.customers = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    // ── Import products ──
    if (Array.isArray(data.products) && data.products.length > 0) {
      try {
        let count = 0;
        for (const raw of data.products) {
          if (!raw || typeof raw !== 'object') continue;
          const p = sanitize(raw as Record<string, unknown>);
          // Skip if no name or sku
          if (!p.name || !p.sku) continue;

          // Strip relation/computed fields
          delete p.invoiceItems;
          delete p.quotationItems;
          delete p.stockCountItems;
          delete p.stockTransferItems;
          delete p.purchaseOrderItems;
          delete p.grnItems;
          delete p.stockMovements;
          delete p.createdBy;
          // Strip UOM relation IDs that may not exist
          delete p.baseUOMId;
          delete p.purchaseUOMId;
          delete p.salesUOMId;

          await prisma.product.create({
            data: {
              ...p,
              companyId: cid,
              createdBy: user!.sub,
            } as Parameters<typeof prisma.product.create>[0]['data'],
          });
          count++;
        }
        results.products = count;
      } catch (err) {
        errors.products = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    // ── Import employees ──
    if (Array.isArray(data.employees) && data.employees.length > 0) {
      try {
        let count = 0;
        for (const raw of data.employees) {
          if (!raw || typeof raw !== 'object') continue;
          const e = sanitize(raw as Record<string, unknown>);
          // Require essential fields
          if (!e.firstName || !e.lastName || !e.employeeNumber) continue;

          // Strip relation fields
          delete e.payrollEntries;
          delete e.leaveBalances;
          delete e.loanDeductions;
          delete e.createdBy;
          delete e.pensionPlanId;
          delete e.pensionPlan;

          await prisma.employee.create({
            data: {
              ...e,
              companyId: cid,
              createdBy: user!.sub,
            } as Parameters<typeof prisma.employee.create>[0]['data'],
          });
          count++;
        }
        results.employees = count;
      } catch (err) {
        errors.employees = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    // ── Import expenses ──
    if (Array.isArray(data.expenses) && data.expenses.length > 0) {
      try {
        let count = 0;
        for (const raw of data.expenses) {
          if (!raw || typeof raw !== 'object') continue;
          const e = sanitize(raw as Record<string, unknown>);
          if (!e.description || !e.amount) continue;

          // Strip relation/FK fields
          delete e.vendor;
          delete e.vendorId;
          delete e.journalEntry;
          delete e.journalEntryId;
          delete e.createdBy;
          // Ensure date is a valid Date
          if (e.date && typeof e.date === 'string') {
            e.date = new Date(e.date);
          }

          await prisma.expense.create({
            data: {
              ...e,
              companyId: cid,
              createdBy: user!.sub,
            } as Parameters<typeof prisma.expense.create>[0]['data'],
          });
          count++;
        }
        results.expenses = count;
      } catch (err) {
        errors.expenses = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    // ── Import invoices (with line items) ──
    if (Array.isArray(data.invoices) && data.invoices.length > 0) {
      try {
        let count = 0;
        for (const raw of data.invoices) {
          if (!raw || typeof raw !== 'object') continue;
          const inv = sanitize(raw as Record<string, unknown>);
          if (!inv.invoiceNumber) continue;

          // Extract items before stripping
          const rawItems = Array.isArray(inv.items) ? inv.items : [];
          delete inv.items;

          // Strip relation fields
          delete inv.customer;
          delete inv.customerId;
          delete inv.customerPO;
          delete inv.customerPOId;
          delete inv.journalEntry;
          delete inv.journalEntryId;
          delete inv.payments;
          delete inv.creditNotes;
          delete inv.createdBy;

          // Parse date strings
          if (inv.issueDate && typeof inv.issueDate === 'string') {
            inv.issueDate = new Date(inv.issueDate);
          }
          if (inv.dueDate && typeof inv.dueDate === 'string') {
            inv.dueDate = new Date(inv.dueDate);
          }
          if (inv.paidDate && typeof inv.paidDate === 'string') {
            inv.paidDate = new Date(inv.paidDate);
          }

          // Build items create data
          const itemsData = rawItems
            .filter(
              (item: unknown): item is Record<string, unknown> =>
                item !== null && typeof item === 'object'
            )
            .map((item: Record<string, unknown>) => {
              const {
                id: _id,
                invoiceId: _invoiceId,
                product: _product,
                productId: _productId,
                ...rest
              } = item;
              return rest;
            });

          await prisma.invoice.create({
            data: {
              ...inv,
              companyId: cid,
              createdBy: user!.sub,
              // Use a placeholder customer -- invoices need a customerId
              // but the original IDs won't exist in the new company.
              // Set status to DRAFT so user can assign the correct customer.
              status: 'DRAFT',
              ...(itemsData.length > 0
                ? {
                    items: {
                      createMany: {
                        data: itemsData as any,
                      },
                    },
                  }
                : {}),
            } as Parameters<typeof prisma.invoice.create>[0]['data'],
          });
          count++;
        }
        results.invoices = count;
      } catch (err) {
        errors.invoices = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    const hasErrors = Object.keys(errors).length > 0;
    const totalImported = Object.values(results).reduce((sum, n) => sum + n, 0);

    return NextResponse.json({
      success: !hasErrors || totalImported > 0,
      message: hasErrors
        ? `Import completed with some errors. ${totalImported} records imported.`
        : `Data imported successfully. ${totalImported} records imported.`,
      imported: results,
      ...(hasErrors ? { errors } : {}),
    });
  } catch (err) {
    console.error('Import error:', err);
    return internalError(err instanceof Error ? err.message : 'Failed to import data');
  }
}
