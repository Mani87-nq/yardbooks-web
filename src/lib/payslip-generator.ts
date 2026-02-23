/**
 * Payslip generation library.
 * Builds payslip data from PayrollRun + PayrollEntry records and renders
 * professional HTML that can be converted to PDF or emailed.
 */
import prisma from '@/lib/db';
import { Decimal } from 'decimal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayslipData {
  companyName: string;
  companyAddress?: string;
  companyTrn?: string;

  employeeName: string;
  employeeId: string;
  employeeNumber: string;
  position?: string;
  trn?: string;
  nisNumber?: string;

  payPeriod: string; // e.g. "January 1 - January 31, 2026"
  payDate: string;

  // Earnings
  earnings: Array<{ description: string; amount: number }>;
  totalEarnings: number;

  // Employee deductions
  deductions: Array<{ description: string; amount: number }>;
  totalDeductions: number;

  // Employer contributions
  employerContributions: Array<{ description: string; amount: number }>;
  totalEmployerContributions: number;

  netPay: number;

  // Year-to-date totals
  ytdGross: number;
  ytdDeductions: number;
  ytdNet: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a Prisma Decimal (or any Decimal-like value) to a JS number. */
function d(value: unknown): number {
  if (value instanceof Decimal) return value.toNumber();
  if (typeof value === 'number') return value;
  return new Decimal(String(value)).toNumber();
}

/** Format a number as JMD currency string for display inside HTML. */
function fmt(amount: number): string {
  return new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: 'JMD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format a Date to a human-readable date string. */
function fmtDate(date: Date): string {
  return date.toLocaleDateString('en-JM', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Build a human-readable address string from Company address fields.
 */
function buildAddress(company: {
  addressStreet?: string | null;
  addressCity?: string | null;
  addressParish?: string | null;
  addressCountry?: string | null;
}): string | undefined {
  const parts = [
    company.addressStreet,
    company.addressCity,
    company.addressParish,
    company.addressCountry,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Determine the fiscal year start date from a given date and the company's
 * fiscal year end month.  The fiscal year ends on the last day of
 * `fiscalYearEndMonth`.  For example if fiscalYearEndMonth = 3 (March), the
 * fiscal year runs April 1 -> March 31.
 */
function fiscalYearStart(referenceDate: Date, fiscalYearEndMonth: number): Date {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1; // 1-indexed

  // The fiscal year starts on the 1st of the month *after* the end month.
  const startMonth = (fiscalYearEndMonth % 12) + 1; // 1-indexed

  if (startMonth <= month) {
    // We are in the current fiscal year that started this calendar year
    return new Date(year, startMonth - 1, 1);
  }
  // The fiscal year started last calendar year
  return new Date(year - 1, startMonth - 1, 1);
}

// ---------------------------------------------------------------------------
// Data builder
// ---------------------------------------------------------------------------

/**
 * Fetch all necessary data and build a `PayslipData` object for a single
 * employee within a payroll run.
 *
 * Returns `null` if the payroll run or employee entry cannot be found, or if
 * the payroll run does not belong to the given company.
 */
export async function buildPayslipData(
  payrollRunId: string,
  employeeId: string,
  companyId: string,
): Promise<PayslipData | null> {
  // Fetch payroll run with the specific entry for this employee
  const payrollRun = await prisma.payrollRun.findFirst({
    where: { id: payrollRunId, companyId },
    include: {
      company: true,
      entries: {
        where: { employeeId },
        include: { employee: true },
      },
    },
  });

  if (!payrollRun) return null;

  const entry = payrollRun.entries[0];
  if (!entry) return null;

  const { company } = payrollRun;
  const { employee } = entry;

  // --- Earnings ---
  const earnings: PayslipData['earnings'] = [];

  const basicSalary = d(entry.basicSalary);
  if (basicSalary > 0) earnings.push({ description: 'Basic Salary', amount: basicSalary });

  const overtime = d(entry.overtime);
  if (overtime > 0) earnings.push({ description: 'Overtime', amount: overtime });

  const bonus = d(entry.bonus);
  if (bonus > 0) earnings.push({ description: 'Bonus', amount: bonus });

  const commission = d(entry.commission);
  if (commission > 0) earnings.push({ description: 'Commission', amount: commission });

  const allowances = d(entry.allowances);
  if (allowances > 0) earnings.push({ description: 'Allowances', amount: allowances });

  const totalEarnings = d(entry.grossPay);

  // --- Employee Deductions ---
  const deductions: PayslipData['deductions'] = [];

  const paye = d(entry.paye);
  if (paye > 0) deductions.push({ description: 'PAYE (Income Tax)', amount: paye });

  const nis = d(entry.nis);
  if (nis > 0) deductions.push({ description: 'NIS (National Insurance)', amount: nis });

  const nht = d(entry.nht);
  if (nht > 0) deductions.push({ description: 'NHT (National Housing Trust)', amount: nht });

  const educationTax = d(entry.educationTax);
  if (educationTax > 0) deductions.push({ description: 'Education Tax', amount: educationTax });

  const otherDeductions = d(entry.otherDeductions);
  if (otherDeductions > 0) deductions.push({ description: 'Other Deductions', amount: otherDeductions });

  const totalDeductions = d(entry.totalDeductions);

  // --- Employer Contributions ---
  const employerContributions: PayslipData['employerContributions'] = [];

  const employerNis = d(entry.employerNis);
  if (employerNis > 0) employerContributions.push({ description: 'Employer NIS', amount: employerNis });

  const employerNht = d(entry.employerNht);
  if (employerNht > 0) employerContributions.push({ description: 'Employer NHT', amount: employerNht });

  const employerEducationTax = d(entry.employerEducationTax);
  if (employerEducationTax > 0) employerContributions.push({ description: 'Employer Education Tax', amount: employerEducationTax });

  const heartContribution = d(entry.heartContribution);
  if (heartContribution > 0) employerContributions.push({ description: 'HEART/NTA Contribution', amount: heartContribution });

  const totalEmployerContributions = d(entry.totalEmployerContributions);

  // --- YTD calculation ---
  const fyStart = fiscalYearStart(payrollRun.payDate, company.fiscalYearEnd);

  const ytdEntries = await prisma.payrollEntry.findMany({
    where: {
      employeeId,
      payrollRun: {
        companyId,
        payDate: { gte: fyStart, lte: payrollRun.payDate },
        status: { in: ['APPROVED', 'PAID'] },
      },
    },
    select: {
      grossPay: true,
      totalDeductions: true,
      netPay: true,
    },
  });

  let ytdGross = 0;
  let ytdDeductions = 0;
  let ytdNet = 0;
  for (const e of ytdEntries) {
    ytdGross += d(e.grossPay);
    ytdDeductions += d(e.totalDeductions);
    ytdNet += d(e.netPay);
  }

  // --- Build result ---
  return {
    companyName: company.tradingName ?? company.businessName,
    companyAddress: buildAddress(company),
    companyTrn: company.trnNumber ?? undefined,

    employeeName: `${employee.firstName} ${employee.lastName}`,
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    position: employee.position ?? undefined,
    trn: employee.trnNumber ?? undefined,
    nisNumber: employee.nisNumber ?? undefined,

    payPeriod: `${fmtDate(payrollRun.periodStart)} - ${fmtDate(payrollRun.periodEnd)}`,
    payDate: fmtDate(payrollRun.payDate),

    earnings,
    totalEarnings,

    deductions,
    totalDeductions,

    employerContributions,
    totalEmployerContributions,

    netPay: d(entry.netPay),

    ytdGross,
    ytdDeductions,
    ytdNet,
  };
}

// ---------------------------------------------------------------------------
// HTML renderer
// ---------------------------------------------------------------------------

/**
 * Generate a professional HTML payslip from the given data.
 * Uses inline CSS for maximum compatibility with PDF renderers and email
 * clients.
 */
export function generatePayslipHtml(data: PayslipData): string {
  const earningsRows = data.earnings
    .map(
      (e) => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${e.description}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(e.amount)}</td>
        </tr>`,
    )
    .join('');

  const deductionRows = data.deductions
    .map(
      (d) => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${d.description}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(d.amount)}</td>
        </tr>`,
    )
    .join('');

  const employerRows = data.employerContributions
    .map(
      (c) => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${c.description}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(c.amount)}</td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payslip - ${data.employeeName}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">
  <div style="max-width:720px;margin:24px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#1976D2;color:#ffffff;padding:24px 32px;">
      <h1 style="margin:0 0 4px 0;font-size:22px;font-weight:700;">${data.companyName}</h1>
      ${data.companyAddress ? `<p style="margin:0;font-size:13px;opacity:0.9;">${data.companyAddress}</p>` : ''}
      ${data.companyTrn ? `<p style="margin:4px 0 0 0;font-size:13px;opacity:0.9;">TRN: ${data.companyTrn}</p>` : ''}
    </div>

    <!-- Title bar -->
    <div style="background:#1565C0;color:#ffffff;padding:10px 32px;font-size:16px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
      Payslip
    </div>

    <!-- Employee & Pay Period info -->
    <div style="padding:20px 32px;display:flex;flex-wrap:wrap;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:50%;vertical-align:top;padding-bottom:16px;">
            <p style="margin:0 0 2px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Employee Name</p>
            <p style="margin:0;font-weight:600;">${data.employeeName}</p>
          </td>
          <td style="width:50%;vertical-align:top;padding-bottom:16px;">
            <p style="margin:0 0 2px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Employee No.</p>
            <p style="margin:0;font-weight:600;">${data.employeeNumber}</p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding-bottom:16px;">
            <p style="margin:0 0 2px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Position</p>
            <p style="margin:0;font-weight:600;">${data.position ?? 'N/A'}</p>
          </td>
          <td style="vertical-align:top;padding-bottom:16px;">
            <p style="margin:0 0 2px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">TRN</p>
            <p style="margin:0;font-weight:600;">${data.trn ?? 'N/A'}</p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding-bottom:16px;">
            <p style="margin:0 0 2px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">NIS Number</p>
            <p style="margin:0;font-weight:600;">${data.nisNumber ?? 'N/A'}</p>
          </td>
          <td style="vertical-align:top;padding-bottom:16px;">
            <p style="margin:0 0 2px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Pay Date</p>
            <p style="margin:0;font-weight:600;">${data.payDate}</p>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="vertical-align:top;">
            <p style="margin:0 0 2px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Pay Period</p>
            <p style="margin:0;font-weight:600;">${data.payPeriod}</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Divider -->
    <hr style="margin:0 32px;border:none;border-top:1px solid #e5e7eb;" />

    <!-- Earnings -->
    <div style="padding:20px 32px;">
      <h2 style="margin:0 0 12px 0;font-size:15px;font-weight:700;color:#1976D2;text-transform:uppercase;letter-spacing:0.5px;">Earnings</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Description</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${earningsRows}
        </tbody>
        <tfoot>
          <tr style="background:#f0f9ff;">
            <td style="padding:8px 12px;font-weight:700;">Total Earnings</td>
            <td style="padding:8px 12px;text-align:right;font-weight:700;">${fmt(data.totalEarnings)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Deductions -->
    <div style="padding:0 32px 20px 32px;">
      <h2 style="margin:0 0 12px 0;font-size:15px;font-weight:700;color:#d32f2f;text-transform:uppercase;letter-spacing:0.5px;">Employee Deductions</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Description</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${deductionRows}
        </tbody>
        <tfoot>
          <tr style="background:#fef2f2;">
            <td style="padding:8px 12px;font-weight:700;">Total Deductions</td>
            <td style="padding:8px 12px;text-align:right;font-weight:700;">${fmt(data.totalDeductions)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Net Pay -->
    <div style="margin:0 32px;padding:16px 20px;background:#e8f5e9;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:18px;font-weight:700;color:#2e7d32;">NET PAY</td>
          <td style="font-size:22px;font-weight:700;color:#2e7d32;text-align:right;">${fmt(data.netPay)}</td>
        </tr>
      </table>
    </div>

    <!-- Employer Contributions -->
    <div style="padding:20px 32px;">
      <h2 style="margin:0 0 12px 0;font-size:15px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Employer Contributions</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Description</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${employerRows}
        </tbody>
        <tfoot>
          <tr style="background:#f9fafb;">
            <td style="padding:8px 12px;font-weight:700;">Total Employer Contributions</td>
            <td style="padding:8px 12px;text-align:right;font-weight:700;">${fmt(data.totalEmployerContributions)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Divider -->
    <hr style="margin:0 32px;border:none;border-top:1px solid #e5e7eb;" />

    <!-- YTD Totals -->
    <div style="padding:20px 32px;">
      <h2 style="margin:0 0 12px 0;font-size:15px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Year-to-Date Totals</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">&nbsp;</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">YTD Gross Earnings</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(data.ytdGross)}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">YTD Deductions</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(data.ytdDeductions)}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:8px 12px;font-weight:700;">YTD Net Pay</td>
            <td style="padding:8px 12px;text-align:right;font-weight:700;">${fmt(data.ytdNet)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#9ca3af;">
      <p style="margin:0;">This is a computer-generated payslip. If you have any queries, please contact your payroll department.</p>
      <p style="margin:4px 0 0 0;">Generated by YaadBooks</p>
    </div>

  </div>
</body>
</html>`;
}
