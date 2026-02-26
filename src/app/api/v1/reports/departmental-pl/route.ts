/**
 * GET /api/v1/reports/departmental-pl — Departmental Profit & Loss
 *
 * Breaks down the Profit & Loss by department/cost centre.
 * Revenue is allocated to departments based on journal entry descriptions
 * or source documents. Payroll expenses are assigned by Employee.department.
 * Other expenses fall into "Unallocated" unless tagged.
 *
 * Query params:
 *   startDate — Start of reporting period (required)
 *   endDate   — End of reporting period (required)
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

interface DeptData {
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  otherExpenses: number;
  payrollCost: number;
  accounts: Map<string, { accountNumber: string; name: string; type: string; subType: string | null; balance: number }>;
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'reports:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return badRequest('startDate and endDate are required');
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return badRequest('Invalid date format');
    }
    endDate.setHours(23, 59, 59, 999);

    // ── 1. Get all departments from employees ──
    const employees = await prisma.employee.findMany({
      where: { companyId: companyId! },
      select: { id: true, department: true },
    });

    const departments = new Set<string>();
    const employeeDeptMap = new Map<string, string>();
    for (const emp of employees) {
      const dept = emp.department || 'Unallocated';
      departments.add(dept);
      employeeDeptMap.set(emp.id, dept);
    }
    departments.add('Unallocated'); // Always include

    // ── 2. Get payroll entries with department info ──
    const payrollEntries = await prisma.payrollEntry.findMany({
      where: {
        payrollRun: {
          companyId: companyId!,
          payDate: { gte: startDate, lte: endDate },
          status: { in: ['APPROVED', 'PAID'] },
        },
      },
      select: {
        employeeId: true,
        grossPay: true,
        employerNis: true,
        employerNht: true,
        employerEducationTax: true,
        heartContribution: true,
      },
    });

    // ── 3. Allocate payroll by department ──
    const deptPayroll = new Map<string, number>();
    for (const entry of payrollEntries) {
      const dept = employeeDeptMap.get(entry.employeeId) || 'Unallocated';
      const totalCost = Number(entry.grossPay)
        + Number(entry.employerNis || 0)
        + Number(entry.employerNht || 0)
        + Number(entry.employerEducationTax || 0)
        + Number(entry.heartContribution || 0);
      deptPayroll.set(dept, (deptPayroll.get(dept) || 0) + totalCost);
    }

    // ── 4. Get all journal lines for P&L accounts ──
    const journalLines = await prisma.journalLine.findMany({
      where: {
        journalEntry: {
          companyId: companyId!,
          date: { gte: startDate, lte: endDate },
          status: 'POSTED',
        },
        account: {
          type: { in: ['INCOME', 'EXPENSE'] },
        },
      },
      include: {
        account: {
          select: {
            id: true,
            accountNumber: true,
            name: true,
            type: true,
            subType: true,
          },
        },
        journalEntry: {
          select: {
            description: true,
            sourceModule: true,
            sourceDocumentId: true,
          },
        },
      },
    });

    // ── 5. Try to extract department from journal entry context ──
    // Payroll entries are department-tagged via employee lookup
    // Other entries go to 'Unallocated' unless description contains a known department
    const deptData = new Map<string, DeptData>();

    function getOrCreate(dept: string): DeptData {
      if (!deptData.has(dept)) {
        deptData.set(dept, {
          revenue: 0,
          cogs: 0,
          operatingExpenses: 0,
          otherExpenses: 0,
          payrollCost: 0,
          accounts: new Map(),
        });
      }
      return deptData.get(dept)!;
    }

    // Initialize departments
    for (const dept of departments) {
      getOrCreate(dept);
    }

    // Assign payroll costs
    for (const [dept, cost] of deptPayroll) {
      const data = getOrCreate(dept);
      data.payrollCost = cost;
    }

    // Parse journal lines — allocate to departments
    const knownDepts = Array.from(departments).filter(d => d !== 'Unallocated');

    for (const line of journalLines) {
      const acctNum = line.account.accountNumber;
      const acctType = line.account.type;
      const subType = line.account.subType;

      // Skip salary/payroll accounts — already accounted via payrollEntries
      if (acctNum === '6110' || acctNum === '6120') continue;

      // Calculate line balance
      let lineBalance: number;
      if (acctType === 'INCOME') {
        lineBalance = Number(line.creditAmount) - Number(line.debitAmount);
      } else {
        lineBalance = Number(line.debitAmount) - Number(line.creditAmount);
      }

      // Try to match department from journal entry description
      let assignedDept = 'Unallocated';
      const desc = (line.journalEntry.description || '').toLowerCase();
      for (const dept of knownDepts) {
        if (desc.includes(dept.toLowerCase())) {
          assignedDept = dept;
          break;
        }
      }

      const data = getOrCreate(assignedDept);

      // Accumulate into account breakdown
      const acctKey = line.account.id;
      const existing = data.accounts.get(acctKey) ?? {
        accountNumber: line.account.accountNumber,
        name: line.account.name,
        type: acctType,
        subType,
        balance: 0,
      };
      existing.balance += lineBalance;
      data.accounts.set(acctKey, existing);

      // Categorize
      if (acctType === 'INCOME') {
        data.revenue += lineBalance;
      } else if (subType === 'COGS') {
        data.cogs += lineBalance;
      } else if (subType === 'OTHER') {
        data.otherExpenses += lineBalance;
      } else {
        data.operatingExpenses += lineBalance;
      }
    }

    // ── 6. Build response ──
    const departmentReports = Array.from(deptData.entries())
      .map(([dept, data]) => {
        const totalExpenses = data.cogs + data.operatingExpenses + data.otherExpenses + data.payrollCost;
        const grossProfit = data.revenue - data.cogs;
        const operatingIncome = grossProfit - data.operatingExpenses - data.payrollCost;
        const netIncome = data.revenue - totalExpenses;

        return {
          department: dept,
          revenue: round2(data.revenue),
          cogs: round2(data.cogs),
          grossProfit: round2(grossProfit),
          grossMargin: data.revenue > 0 ? round2((grossProfit / data.revenue) * 100) : 0,
          payrollCost: round2(data.payrollCost),
          operatingExpenses: round2(data.operatingExpenses),
          operatingIncome: round2(operatingIncome),
          otherExpenses: round2(data.otherExpenses),
          netIncome: round2(netIncome),
          netMargin: data.revenue > 0 ? round2((netIncome / data.revenue) * 100) : 0,
          accounts: Array.from(data.accounts.values())
            .filter(a => Math.abs(a.balance) >= 0.01)
            .map(a => ({ ...a, balance: round2(a.balance) }))
            .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)),
        };
      })
      .sort((a, b) => b.revenue - a.revenue); // Highest revenue dept first

    // Company-wide totals
    const companyTotals = {
      revenue: round2(departmentReports.reduce((s, d) => s + d.revenue, 0)),
      cogs: round2(departmentReports.reduce((s, d) => s + d.cogs, 0)),
      grossProfit: round2(departmentReports.reduce((s, d) => s + d.grossProfit, 0)),
      payrollCost: round2(departmentReports.reduce((s, d) => s + d.payrollCost, 0)),
      operatingExpenses: round2(departmentReports.reduce((s, d) => s + d.operatingExpenses, 0)),
      operatingIncome: round2(departmentReports.reduce((s, d) => s + d.operatingIncome, 0)),
      otherExpenses: round2(departmentReports.reduce((s, d) => s + d.otherExpenses, 0)),
      netIncome: round2(departmentReports.reduce((s, d) => s + d.netIncome, 0)),
    };

    return NextResponse.json({
      report: 'Departmental Profit & Loss',
      period: { startDate: startDateStr, endDate: endDateStr },
      currency: 'JMD',
      departments: departmentReports,
      companyTotals,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate departmental P&L');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
