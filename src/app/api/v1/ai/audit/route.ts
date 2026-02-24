/**
 * POST /api/v1/ai/audit — AI-powered financial compliance audit
 * Fetches comprehensive business data and sends to Claude for analysis.
 * Returns structured audit findings for Jamaica tax & accounting compliance.
 */
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'reports:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        findings: [],
        error: 'AI features require an Anthropic API key. Please add ANTHROPIC_API_KEY to your environment variables.',
      });
    }

    // Fetch comprehensive business data
    const [
      company,
      invoices,
      expenses,
      glAccounts,
      journalEntries,
      bankAccounts,
      bankTransactions,
      customers,
      products,
      employees,
      payrollRuns,
      fixedAssets,
      accountingPeriods,
    ] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId! },
        select: {
          businessName: true,
          businessType: true,
          trnNumber: true,
          gctNumber: true,
          gctRegistered: true,
          fiscalYearEnd: true,
          industry: true,
          currency: true,
        },
      }),
      prisma.invoice.findMany({
        where: { companyId: companyId!, deletedAt: null },
        select: {
          invoiceNumber: true,
          status: true,
          total: true,
          gctAmount: true,
          dueDate: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.expense.findMany({
        where: { companyId: companyId!, deletedAt: null },
        select: {
          description: true,
          amount: true,
          category: true,
          date: true,
          receiptUrl: true,
          notes: true,
          gctAmount: true,
        },
        orderBy: { date: 'desc' },
        take: 200,
      }),
      prisma.gLAccount.findMany({
        where: { companyId: companyId! },
        select: { code: true, name: true, type: true, subType: true, currentBalance: true, isActive: true },
      }),
      prisma.journalEntry.findMany({
        where: { companyId: companyId! },
        select: {
          entryNumber: true,
          status: true,
          totalDebits: true,
          totalCredits: true,
          date: true,
          sourceModule: true,
          lines: { select: { debitAmount: true, creditAmount: true, account: { select: { code: true, name: true } } } },
        },
        orderBy: { date: 'desc' },
        take: 100,
      }),
      prisma.bankAccount.findMany({
        where: { companyId: companyId! },
        select: { accountName: true, accountType: true, currentBalance: true, currency: true },
      }),
      prisma.bankTransaction.aggregate({
        where: { bankAccount: { companyId: companyId! } },
        _count: true,
      }).then(async (agg) => {
        const reconciled = await prisma.bankTransaction.count({
          where: { bankAccount: { companyId: companyId! }, isReconciled: true },
        });
        return { total: agg._count, reconciled };
      }),
      prisma.customer.findMany({
        where: { companyId: companyId!, deletedAt: null },
        select: { name: true, type: true, trnNumber: true, balance: true },
        take: 100,
      }),
      prisma.product.findMany({
        where: { companyId: companyId!, deletedAt: null },
        select: { name: true, quantity: true, reorderLevel: true, unitPrice: true, costPrice: true },
      }),
      prisma.employee.findMany({
        where: { companyId: companyId! },
        select: { firstName: true, lastName: true, nisNumber: true, trnNumber: true, isActive: true, baseSalary: true },
      }),
      prisma.payrollRun.findMany({
        where: { companyId: companyId! },
        select: { periodStart: true, periodEnd: true, status: true, totalGross: true, totalNet: true, totalDeductions: true },
        orderBy: { periodEnd: 'desc' },
        take: 12,
      }),
      prisma.fixedAsset.findMany({
        where: { companyId: companyId! },
        select: { name: true, purchaseCost: true, bookNetBookValue: true, status: true },
      }),
      prisma.accountingPeriod.findMany({
        where: { companyId: companyId! },
        select: { fiscalYear: true, periodNumber: true, periodType: true, startDate: true, endDate: true, status: true },
        orderBy: { startDate: 'desc' },
        take: 12,
      }),
    ]);

    // Build the data summary for Claude
    const unbalancedEntries = journalEntries.filter(je => Number(je.totalDebits) !== Number(je.totalCredits));
    const overdueInvoices = invoices.filter(i => i.status === 'SENT' || i.status === 'OVERDUE');
    const documentedExpenses = expenses.filter(e => e.receiptUrl || e.notes);
    const negativeStockProducts = products.filter(p => Number(p.quantity ?? 0) < 0);
    const activeEmployees = employees.filter(e => e.isActive);
    const employeesWithNIS = employees.filter(e => e.nisNumber);
    const employeesWithTRN = employees.filter(e => e.trnNumber);

    const businessDataSummary = `
BUSINESS: ${company?.businessName || 'Unknown'}
Type: ${company?.businessType || 'Unknown'}
TRN: ${company?.trnNumber || 'NOT REGISTERED'}
GCT Number: ${company?.gctNumber || 'NOT REGISTERED'}
GCT Registered: ${company?.gctRegistered ? 'Yes' : 'No'}
Fiscal Year End: Month ${company?.fiscalYearEnd || 3}
Currency: ${company?.currency || 'JMD'}
Industry: ${company?.industry || 'Not specified'}

INVOICES (last 200):
- Total: ${invoices.length}
- By status: ${JSON.stringify(invoices.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {} as Record<string, number>))}
- Total revenue: J$${invoices.reduce((sum, i) => sum + Number(i.total), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
- Total GCT collected: J$${invoices.reduce((sum, i) => sum + Number(i.gctAmount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
- Overdue/Outstanding: ${overdueInvoices.length} (J$${overdueInvoices.reduce((sum, i) => sum + Number(i.total), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })})

EXPENSES (last 200):
- Total: ${expenses.length}
- Total amount: J$${expenses.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
- With documentation (receipt or notes): ${documentedExpenses.length}/${expenses.length} (${expenses.length > 0 ? Math.round(documentedExpenses.length / expenses.length * 100) : 0}%)
- GCT on expenses: J$${expenses.reduce((sum, e) => sum + Number(e.gctAmount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
- By category: ${JSON.stringify(expenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + 1; return acc; }, {} as Record<string, number>))}

GL ACCOUNTS:
- Total: ${glAccounts.length}
- By type: ${JSON.stringify(glAccounts.reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {} as Record<string, number>))}
- Active: ${glAccounts.filter(a => a.isActive).length}

JOURNAL ENTRIES (last 100):
- Total: ${journalEntries.length}
- By status: ${JSON.stringify(journalEntries.reduce((acc, j) => { acc[j.status] = (acc[j.status] || 0) + 1; return acc; }, {} as Record<string, number>))}
- Unbalanced entries (debits != credits): ${unbalancedEntries.length}
${unbalancedEntries.length > 0 ? '- Unbalanced: ' + unbalancedEntries.slice(0, 5).map(j => `${j.entryNumber}: D=${j.totalDebits} C=${j.totalCredits}`).join(', ') : ''}

BANK ACCOUNTS:
${bankAccounts.map(b => `- ${b.accountName} (${b.accountType}): ${b.currency} ${Number(b.currentBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}`).join('\n')}
- Transactions: ${bankTransactions.total} total, ${bankTransactions.reconciled} reconciled (${bankTransactions.total > 0 ? Math.round(bankTransactions.reconciled / bankTransactions.total * 100) : 0}%)

CUSTOMERS:
- Total: ${customers.length}
- Types: ${JSON.stringify(customers.reduce((acc, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc; }, {} as Record<string, number>))}
- With TRN: ${customers.filter(c => c.trnNumber).length}/${customers.length}
- Total receivables: J$${customers.reduce((sum, c) => sum + Number(c.balance || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}

PRODUCTS/INVENTORY:
- Total: ${products.length}
- Negative stock: ${negativeStockProducts.length}${negativeStockProducts.length > 0 ? ' (' + negativeStockProducts.map(p => p.name).join(', ') + ')' : ''}
- Total inventory value: J$${products.reduce((sum, p) => sum + (Number(p.unitPrice) * Number(p.quantity || 0)), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}

EMPLOYEES:
- Total: ${employees.length} (Active: ${activeEmployees.length})
- With NIS: ${employeesWithNIS.length}/${employees.length}
- With TRN: ${employeesWithTRN.length}/${employees.length}
- Total monthly base salary: J$${activeEmployees.reduce((sum, e) => sum + Number(e.baseSalary || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}

PAYROLL RUNS (last 12):
- Total: ${payrollRuns.length}
${payrollRuns.slice(0, 3).map(p => `- ${p.status}: Gross J$${Number(p.totalGross).toLocaleString('en-US', { minimumFractionDigits: 2 })}, Deductions J$${Number(p.totalDeductions).toLocaleString('en-US', { minimumFractionDigits: 2 })}, Net J$${Number(p.totalNet).toLocaleString('en-US', { minimumFractionDigits: 2 })}`).join('\n')}

FIXED ASSETS:
- Total: ${fixedAssets.length}
- Total purchase cost: J$${fixedAssets.reduce((sum, a) => sum + Number(a.purchaseCost || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
- Total net book value: J$${fixedAssets.reduce((sum, a) => sum + Number(a.bookNetBookValue || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}

ACCOUNTING PERIODS (last 12):
${accountingPeriods.map(p => `- FY${p.fiscalYear} P${p.periodNumber} (${p.periodType}): ${p.status}`).join('\n')}
`;

    const systemPrompt = `You are a Jamaica financial compliance auditor AI. You analyze business data and produce structured audit findings.

Given the business data below, perform a comprehensive compliance audit covering:
1. GCT Compliance (registration, rates, filing)
2. Payroll & Statutory (PAYE, NIS, NHT, Education Tax)
3. Income Tax (TRN, expense documentation, capital allowances)
4. Accounting Standards (double-entry, bank reconciliation, period closing)
5. Inventory Management (negative stock, valuation)

Return ONLY a valid JSON array of audit findings. Each finding must have:
{
  "category": "GCT Compliance" | "Payroll & Statutory" | "Income Tax" | "Accounting Standards" | "Inventory Management",
  "name": "Short name of the check",
  "status": "pass" | "warning" | "fail",
  "description": "What was checked",
  "details": "Specific findings from the data",
  "recommendation": "What to do (only if status is warning or fail)",
  "impact": "low" | "medium" | "high" | "critical"
}

Rules:
- Analyze the ACTUAL data provided — do not invent issues
- A "pass" means the data shows compliance
- A "warning" means potential issues or incomplete data
- A "fail" means clear non-compliance found in the data
- Be specific with numbers from the data
- Jamaica GCT standard rate is 15%, filed by 14th of following month
- NIS employer 3%, employee 3% (capped)
- NHT employer 3%, employee 2%
- Education Tax employer 3.5%, employee 2.25% (Note: rates changed from 2%)
- PAYE has annual threshold of J$1,500,096
- All businesses need TRN; GCT registration required if annual revenue > J$10M
- Include 12-18 checks across all categories
- Return ONLY the JSON array, no markdown, no explanation`;

    const client = new Anthropic({ apiKey });

    const completion = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: businessDataSummary }],
    });

    const responseText = completion.content[0].type === 'text' ? completion.content[0].text : '[]';

    // Parse the JSON response
    let findings: Array<{
      category: string;
      name: string;
      status: 'pass' | 'warning' | 'fail';
      description: string;
      details: string;
      recommendation?: string;
      impact: string;
    }>;

    try {
      // Try to extract JSON from the response (handle potential markdown wrapping)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      findings = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (parseError) {
      console.error('[AI Audit] Failed to parse response:', parseError);
      findings = [];
    }

    return NextResponse.json({ findings });
  } catch (error) {
    console.error('[AI Audit] Error:', error);
    return internalError(error instanceof Error ? error.message : 'AI audit failed');
  }
}
