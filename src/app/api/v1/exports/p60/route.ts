/**
 * GET /api/v1/exports/p60 — Generate P60 (Annual Earnings Certificate)
 *
 * P60 is the annual certificate showing total earnings and deductions
 * for an active employee during a Jamaica fiscal year (April 1 - March 31).
 *
 * Query params:
 *   - employeeId: required
 *   - taxYear: fiscal year start (e.g., 2026 = April 2026 - March 2027)
 *
 * Returns JSON data + optional HTML rendering for print/email.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const taxYearStr = searchParams.get('taxYear');
    const format = searchParams.get('format') ?? 'json'; // 'json' or 'html'

    if (!employeeId) return badRequest('employeeId is required');
    if (!taxYearStr) return badRequest('taxYear is required (e.g., 2026)');

    const taxYear = parseInt(taxYearStr);
    if (isNaN(taxYear) || taxYear < 2020 || taxYear > 2100) {
      return badRequest('Invalid taxYear');
    }

    // Jamaica fiscal year: April 1 of taxYear to March 31 of taxYear+1
    const fiscalYearStart = new Date(taxYear, 3, 1); // April 1
    const fiscalYearEnd = new Date(taxYear + 1, 2, 31); // March 31

    // Get employee
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: companyId!, deletedAt: null },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        trnNumber: true,
        nisNumber: true,
        hireDate: true,
        position: true,
        department: true,
      },
    });

    if (!employee) return notFound('Employee not found');

    // Get company
    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: {
        businessName: true,
        trnNumber: true,
        addressStreet: true,
        addressCity: true,
        addressParish: true,
      },
    });

    // Get all payroll entries for this employee in the fiscal year
    const entries = await prisma.payrollEntry.findMany({
      where: {
        employeeId,
        payrollRun: {
          companyId: companyId!,
          periodStart: { gte: fiscalYearStart },
          periodEnd: { lte: fiscalYearEnd },
          status: { in: ['APPROVED', 'PAID'] },
        },
      },
      include: {
        payrollRun: {
          select: { periodStart: true, periodEnd: true, payDate: true },
        },
      },
      orderBy: { payrollRun: { periodStart: 'asc' } },
    });

    if (entries.length === 0) {
      return badRequest('No payroll data found for this employee in the specified fiscal year');
    }

    // Aggregate totals
    const totals = {
      grossPay: 0,
      basicSalary: 0,
      overtime: 0,
      bonus: 0,
      commission: 0,
      allowances: 0,
      paye: 0,
      nis: 0,
      nht: 0,
      educationTax: 0,
      otherDeductions: 0,
      totalDeductions: 0,
      netPay: 0,
      employerNis: 0,
      employerNht: 0,
      employerEducationTax: 0,
      heartContribution: 0,
      totalEmployerContributions: 0,
    };

    for (const entry of entries) {
      totals.grossPay += Number(entry.grossPay);
      totals.basicSalary += Number(entry.basicSalary);
      totals.overtime += Number(entry.overtime);
      totals.bonus += Number(entry.bonus);
      totals.commission += Number(entry.commission);
      totals.allowances += Number(entry.allowances);
      totals.paye += Number(entry.paye);
      totals.nis += Number(entry.nis);
      totals.nht += Number(entry.nht);
      totals.educationTax += Number(entry.educationTax);
      totals.otherDeductions += Number(entry.otherDeductions);
      totals.totalDeductions += Number(entry.totalDeductions);
      totals.netPay += Number(entry.netPay);
      totals.employerNis += Number(entry.employerNis);
      totals.employerNht += Number(entry.employerNht);
      totals.employerEducationTax += Number(entry.employerEducationTax);
      totals.heartContribution += Number(entry.heartContribution);
      totals.totalEmployerContributions += Number(entry.totalEmployerContributions);
    }

    // Round all totals
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
      totals[key] = Math.round(totals[key] * 100) / 100;
    }

    const p60Data = {
      certificate: 'P60',
      fiscalYear: `${taxYear}/${taxYear + 1}`,
      fiscalYearStart: fiscalYearStart.toISOString().split('T')[0],
      fiscalYearEnd: fiscalYearEnd.toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
      employer: {
        name: company?.businessName ?? '',
        trn: company?.trnNumber ?? '',
        address: [company?.addressStreet, company?.addressCity, company?.addressParish].filter(Boolean).join(', '),
      },
      employee: {
        name: `${employee.firstName} ${employee.lastName}`,
        employeeNumber: employee.employeeNumber,
        trn: employee.trnNumber,
        nisNumber: employee.nisNumber,
        position: employee.position,
        department: employee.department,
        hireDate: employee.hireDate.toISOString().split('T')[0],
      },
      periodsIncluded: entries.length,
      earnings: {
        basicSalary: totals.basicSalary,
        overtime: totals.overtime,
        bonus: totals.bonus,
        commission: totals.commission,
        allowances: totals.allowances,
        totalGross: totals.grossPay,
      },
      employeeDeductions: {
        paye: totals.paye,
        nis: totals.nis,
        nht: totals.nht,
        educationTax: totals.educationTax,
        otherDeductions: totals.otherDeductions,
        totalDeductions: totals.totalDeductions,
      },
      employerContributions: {
        nis: totals.employerNis,
        nht: totals.employerNht,
        educationTax: totals.employerEducationTax,
        heartNta: totals.heartContribution,
        totalEmployerContributions: totals.totalEmployerContributions,
      },
      netPay: totals.netPay,
    };

    if (format === 'html') {
      const html = generateP60Html(p60Data);
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return NextResponse.json(p60Data);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate P60');
  }
}

// ─── HTML Generator ──────────────────────────────────────────────

function generateP60Html(data: any): string {
  const fc = (n: number) => `J$${n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>P60 - ${data.employee.name} - FY ${data.fiscalYear}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
    .header { text-align: center; border-bottom: 3px solid #059669; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { margin: 0; color: #059669; font-size: 24px; }
    .header h2 { margin: 5px 0; color: #666; font-size: 16px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: bold; color: #059669; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 20px; }
    .info-row { display: flex; justify-content: space-between; padding: 3px 0; }
    .info-label { color: #666; font-size: 13px; }
    .info-value { font-weight: 600; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
    th { background: #f8f8f8; font-weight: 600; color: #444; }
    td.amount { text-align: right; font-family: monospace; }
    .total-row { font-weight: bold; border-top: 2px solid #333; }
    .total-row td { padding-top: 10px; }
    .footer { text-align: center; color: #999; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
    .net-pay { text-align: center; background: #ecfdf5; padding: 15px; border-radius: 8px; margin-top: 20px; }
    .net-pay .label { color: #059669; font-size: 14px; font-weight: 600; }
    .net-pay .amount { font-size: 28px; font-weight: bold; color: #047857; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>P60 — End of Year Certificate</h1>
    <h2>Fiscal Year: ${data.fiscalYear} (April ${data.fiscalYear.split('/')[0]} - March ${data.fiscalYear.split('/')[1]})</h2>
  </div>

  <div class="section">
    <div class="section-title">Employer Details</div>
    <div class="info-grid">
      <div class="info-row"><span class="info-label">Company:</span><span class="info-value">${data.employer.name}</span></div>
      <div class="info-row"><span class="info-label">TRN:</span><span class="info-value">${data.employer.trn}</span></div>
      <div class="info-row"><span class="info-label">Address:</span><span class="info-value">${data.employer.address}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Employee Details</div>
    <div class="info-grid">
      <div class="info-row"><span class="info-label">Name:</span><span class="info-value">${data.employee.name}</span></div>
      <div class="info-row"><span class="info-label">Employee #:</span><span class="info-value">${data.employee.employeeNumber}</span></div>
      <div class="info-row"><span class="info-label">TRN:</span><span class="info-value">${data.employee.trn}</span></div>
      <div class="info-row"><span class="info-label">NIS:</span><span class="info-value">${data.employee.nisNumber}</span></div>
      <div class="info-row"><span class="info-label">Position:</span><span class="info-value">${data.employee.position}</span></div>
      <div class="info-row"><span class="info-label">Hire Date:</span><span class="info-value">${data.employee.hireDate}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Earnings</div>
    <table>
      <tr><td>Basic Salary</td><td class="amount">${fc(data.earnings.basicSalary)}</td></tr>
      ${data.earnings.overtime > 0 ? `<tr><td>Overtime</td><td class="amount">${fc(data.earnings.overtime)}</td></tr>` : ''}
      ${data.earnings.bonus > 0 ? `<tr><td>Bonus</td><td class="amount">${fc(data.earnings.bonus)}</td></tr>` : ''}
      ${data.earnings.commission > 0 ? `<tr><td>Commission</td><td class="amount">${fc(data.earnings.commission)}</td></tr>` : ''}
      ${data.earnings.allowances > 0 ? `<tr><td>Allowances</td><td class="amount">${fc(data.earnings.allowances)}</td></tr>` : ''}
      <tr class="total-row"><td>Total Gross Emoluments</td><td class="amount">${fc(data.earnings.totalGross)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Employee Deductions</div>
    <table>
      <tr><td>PAYE (Income Tax)</td><td class="amount">${fc(data.employeeDeductions.paye)}</td></tr>
      <tr><td>NIS (National Insurance)</td><td class="amount">${fc(data.employeeDeductions.nis)}</td></tr>
      <tr><td>NHT (National Housing Trust)</td><td class="amount">${fc(data.employeeDeductions.nht)}</td></tr>
      <tr><td>Education Tax</td><td class="amount">${fc(data.employeeDeductions.educationTax)}</td></tr>
      ${data.employeeDeductions.otherDeductions > 0 ? `<tr><td>Other Deductions</td><td class="amount">${fc(data.employeeDeductions.otherDeductions)}</td></tr>` : ''}
      <tr class="total-row"><td>Total Deductions</td><td class="amount">${fc(data.employeeDeductions.totalDeductions)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Employer Contributions</div>
    <table>
      <tr><td>NIS (Employer)</td><td class="amount">${fc(data.employerContributions.nis)}</td></tr>
      <tr><td>NHT (Employer)</td><td class="amount">${fc(data.employerContributions.nht)}</td></tr>
      <tr><td>Education Tax (Employer)</td><td class="amount">${fc(data.employerContributions.educationTax)}</td></tr>
      <tr><td>HEART/NTA</td><td class="amount">${fc(data.employerContributions.heartNta)}</td></tr>
      <tr class="total-row"><td>Total Employer Contributions</td><td class="amount">${fc(data.employerContributions.totalEmployerContributions)}</td></tr>
    </table>
  </div>

  <div class="net-pay">
    <div class="label">Total Net Pay for Fiscal Year ${data.fiscalYear}</div>
    <div class="amount">${fc(data.netPay)}</div>
    <div style="font-size: 12px; color: #666; margin-top: 5px;">(${data.periodsIncluded} pay periods)</div>
  </div>

  <div class="footer">
    <p>This certificate is generated by YaadBooks and is for the purpose of annual tax filing.</p>
    <p>Generated on: ${new Date().toLocaleDateString('en-JM', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>
</body>
</html>`;
}
