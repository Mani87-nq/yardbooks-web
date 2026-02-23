/**
 * GET /api/v1/export?type=invoices|customers|expenses|products|all&format=csv|json
 * Export company data as CSV or JSON.
 * Requires authentication and company scope.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

const EXPORT_TYPES = ['invoices', 'customers', 'expenses', 'products', 'all'] as const;
type ExportType = (typeof EXPORT_TYPES)[number];

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'reports:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const exportType = (searchParams.get('type') ?? 'all') as ExportType;
    const format = searchParams.get('format') ?? 'csv';

    if (!EXPORT_TYPES.includes(exportType)) {
      return badRequest(`Invalid export type. Must be one of: ${EXPORT_TYPES.join(', ')}`);
    }
    if (format !== 'csv' && format !== 'json') {
      return badRequest('Invalid format. Must be csv or json.');
    }

    const data: Record<string, unknown[]> = {};

    // Fetch requested data
    if (exportType === 'customers' || exportType === 'all') {
      data.customers = await prisma.customer.findMany({
        where: { companyId: companyId!, deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          trnNumber: true,
          addressStreet: true,
          addressCity: true,
          addressParish: true,
          addressCountry: true,
          creditLimit: true,
          balance: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      });
    }

    if (exportType === 'invoices' || exportType === 'all') {
      data.invoices = await prisma.invoice.findMany({
        where: { companyId: companyId!, deletedAt: null },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          issueDate: true,
          dueDate: true,
          subtotal: true,
          gctAmount: true,
          discount: true,
          total: true,
          balance: true,
          notes: true,
          customer: { select: { name: true, email: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (exportType === 'expenses' || exportType === 'all') {
      data.expenses = await prisma.expense.findMany({
        where: { companyId: companyId!, deletedAt: null },
        select: {
          id: true,
          category: true,
          description: true,
          amount: true,
          gctAmount: true,
          gctClaimable: true,
          date: true,
          paymentMethod: true,
          reference: true,
          notes: true,
          vendor: { select: { name: true } },
          createdAt: true,
        },
        orderBy: { date: 'desc' },
      });
    }

    if (exportType === 'products' || exportType === 'all') {
      data.products = await prisma.product.findMany({
        where: { companyId: companyId!, deletedAt: null },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          unitPrice: true,
          costPrice: true,
          quantity: true,
          reorderLevel: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      });
    }

    if (format === 'json') {
      const filename = `yaadbooks-export-${exportType}-${new Date().toISOString().slice(0, 10)}.json`;
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // CSV format
    const csvParts: string[] = [];

    for (const [tableName, rows] of Object.entries(data)) {
      if (rows.length === 0) continue;

      csvParts.push(`\n# ${tableName.toUpperCase()}\n`);

      // Flatten nested objects for CSV
      const flatRows = rows.map((row) => flattenObject(row as Record<string, unknown>));
      const headers = [...new Set(flatRows.flatMap((r) => Object.keys(r)))];

      // Header row
      csvParts.push(headers.map(escapeCSV).join(','));

      // Data rows
      for (const row of flatRows) {
        csvParts.push(
          headers.map((h) => escapeCSV(String(row[h] ?? ''))).join(',')
        );
      }
    }

    const csvContent = csvParts.join('\n');
    const filename = `yaadbooks-export-${exportType}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Export failed');
  }
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}_${key}` : key;

    if (value === null || value === undefined) {
      result[fullKey] = '';
    } else if (value instanceof Date) {
      result[fullKey] = value.toISOString();
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }

  return result;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
