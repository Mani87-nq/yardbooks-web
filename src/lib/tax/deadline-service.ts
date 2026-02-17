/**
 * Jamaica Tax Filing Deadline Service
 *
 * Tracks all major Jamaica tax filing deadlines:
 * - P2A: February 15
 * - IT01: March 15
 * - SO2: March 31
 * - S01: 14th monthly
 * - GCT 4A: 30 days after period end
 * - Quarterly estimated tax: Mar 15, Jun 15, Sep 15, Dec 15
 *
 * Notification schedule:
 * - 14 days before: Email reminder
 * - 7 days before: In-app + email
 * - 3 days before: Urgent notification
 * - Day of: Final reminder
 * - 1 day after: Penalty warning
 */

export interface TaxDeadline {
  id: string;
  name: string;
  formType: string;
  dueDate: Date;
  description: string;
  status: 'upcoming' | 'due_soon' | 'due_today' | 'overdue' | 'completed';
  daysUntilDue: number;
  notificationLevel: 'info' | 'warning' | 'urgent' | 'critical';
  penaltyInfo?: string;
}

/**
 * Generate all tax deadlines for a given fiscal year.
 * Jamaica fiscal year: April 1 to March 31
 */
export function generateTaxDeadlines(fiscalYear: number, asOfDate: Date = new Date()): TaxDeadline[] {
  const deadlines: TaxDeadline[] = [];

  // S01 Monthly Returns — 14th of each following month
  for (let month = 0; month < 12; month++) {
    // Fiscal year starts in April (month 3)
    const payrollMonth = new Date(fiscalYear - 1, 3 + month, 1);
    const dueDate = new Date(payrollMonth.getFullYear(), payrollMonth.getMonth() + 1, 14);

    deadlines.push({
      id: `s01-${payrollMonth.getFullYear()}-${String(payrollMonth.getMonth() + 1).padStart(2, '0')}`,
      name: `S01 Payroll Return - ${formatMonth(payrollMonth)}`,
      formType: 'S01',
      dueDate,
      description: `Monthly payroll tax return for ${formatMonth(payrollMonth)}`,
      ...getDeadlineStatus(dueDate, asOfDate),
      penaltyInfo: 'Late filing penalty: $5,000 per month + interest',
    });
  }

  // GCT 4A — Due 30 days after each period
  // Assume monthly filing
  for (let month = 0; month < 12; month++) {
    const periodMonth = new Date(fiscalYear - 1, 3 + month, 1);
    const periodEnd = new Date(periodMonth.getFullYear(), periodMonth.getMonth() + 1, 0);
    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDate.getDate() + 30);

    deadlines.push({
      id: `gct4a-${periodMonth.getFullYear()}-${String(periodMonth.getMonth() + 1).padStart(2, '0')}`,
      name: `GCT 4A Return - ${formatMonth(periodMonth)}`,
      formType: 'GCT-4A',
      dueDate,
      description: `GCT return for ${formatMonth(periodMonth)}`,
      ...getDeadlineStatus(dueDate, asOfDate),
      penaltyInfo: 'Late payment: 50% surcharge + 1.5% monthly interest',
    });
  }

  // P2A Employee Statements — February 15
  deadlines.push({
    id: `p2a-${fiscalYear}`,
    name: `P2A Employee Statements - FY ${fiscalYear}`,
    formType: 'P2A',
    dueDate: new Date(fiscalYear, 1, 15),
    description: 'Annual employee earning statements',
    ...getDeadlineStatus(new Date(fiscalYear, 1, 15), asOfDate),
    penaltyInfo: 'Penalty for late issuance to employees',
  });

  // IT01 Corporate Income Tax — March 15
  deadlines.push({
    id: `it01-${fiscalYear}`,
    name: `IT01 Corporate Income Tax - FY ${fiscalYear}`,
    formType: 'IT01',
    dueDate: new Date(fiscalYear, 2, 15),
    description: 'Annual corporate income tax return',
    ...getDeadlineStatus(new Date(fiscalYear, 2, 15), asOfDate),
    penaltyInfo: 'Late filing: $5,000/month. Late payment: 50% surcharge + interest',
  });

  // SO2 Annual Payroll Return — March 31
  deadlines.push({
    id: `so2-${fiscalYear}`,
    name: `SO2 Annual Payroll Return - FY ${fiscalYear}`,
    formType: 'SO2',
    dueDate: new Date(fiscalYear, 2, 31),
    description: 'Annual consolidated payroll tax return',
    ...getDeadlineStatus(new Date(fiscalYear, 2, 31), asOfDate),
    penaltyInfo: 'Late filing penalty applies',
  });

  // Quarterly Estimated Tax — Mar 15, Jun 15, Sep 15, Dec 15
  const quarterDates = [
    { month: 2, day: 15, quarter: 'Q4' },
    { month: 5, day: 15, quarter: 'Q1' },
    { month: 8, day: 15, quarter: 'Q2' },
    { month: 11, day: 15, quarter: 'Q3' },
  ];

  for (const q of quarterDates) {
    const dueDate = new Date(
      q.quarter === 'Q4' ? fiscalYear : fiscalYear - 1,
      q.month,
      q.day
    );

    deadlines.push({
      id: `est-tax-${q.quarter}-${fiscalYear}`,
      name: `Estimated Tax Payment - ${q.quarter} FY ${fiscalYear}`,
      formType: 'EST-TAX',
      dueDate,
      description: `Quarterly estimated income tax payment (${q.quarter})`,
      ...getDeadlineStatus(dueDate, asOfDate),
      penaltyInfo: 'Interest on underpayment',
    });
  }

  // Sort by due date
  deadlines.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  return deadlines;
}

function getDeadlineStatus(dueDate: Date, asOfDate: Date): Pick<TaxDeadline, 'status' | 'daysUntilDue' | 'notificationLevel'> {
  const diffMs = dueDate.getTime() - asOfDate.getTime();
  const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let status: TaxDeadline['status'];
  let notificationLevel: TaxDeadline['notificationLevel'];

  if (daysUntilDue < -1) {
    status = 'overdue';
    notificationLevel = 'critical';
  } else if (daysUntilDue <= 0) {
    status = 'due_today';
    notificationLevel = 'critical';
  } else if (daysUntilDue <= 3) {
    status = 'due_soon';
    notificationLevel = 'urgent';
  } else if (daysUntilDue <= 7) {
    status = 'due_soon';
    notificationLevel = 'warning';
  } else {
    status = 'upcoming';
    notificationLevel = 'info';
  }

  return { status, daysUntilDue, notificationLevel };
}

function formatMonth(date: Date): string {
  return date.toLocaleString('en-JM', { month: 'long', year: 'numeric' });
}

/**
 * Get deadlines that need notifications sent today.
 */
export function getDeadlinesNeedingNotification(deadlines: TaxDeadline[]): TaxDeadline[] {
  const NOTIFICATION_DAYS = [14, 7, 3, 0, -1];
  return deadlines.filter((d) => NOTIFICATION_DAYS.includes(d.daysUntilDue));
}
