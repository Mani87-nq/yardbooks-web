/**
 * Bank Statement CSV Parser
 *
 * Parses CSV bank statements from Jamaican banks.
 * Supports NCB, Scotiabank Jamaica, JMMB, and generic CSV format.
 *
 * Jamaican banks typically export CSV with columns like:
 * Date, Description, Debit, Credit, Balance
 * or
 * Transaction Date, Details, Withdrawals, Deposits, Running Balance
 */

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;        // Positive = credit/deposit, Negative = debit/withdrawal
  balance?: number;
  reference?: string;
  type: 'DEBIT' | 'CREDIT';
}

export interface ParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  bankName?: string;
  accountNumber?: string;
  error?: string;
}

/**
 * Detects bank format from CSV header row
 */
function detectBankFormat(headers: string[]): string {
  const headerStr = headers.join(',').toLowerCase();

  if (headerStr.includes('ncb') || headerStr.includes('national commercial bank')) {
    return 'NCB';
  }
  if (headerStr.includes('scotiabank') || headerStr.includes('scotia')) {
    return 'SCOTIABANK';
  }
  if (headerStr.includes('jmmb')) {
    return 'JMMB';
  }
  if (headerStr.includes('sagicor')) {
    return 'SAGICOR';
  }
  return 'GENERIC';
}

/**
 * Parses a date string in common Jamaican bank formats
 */
function parseDate(dateStr: string): Date | null {
  const cleaned = dateStr.trim();

  // Try DD/MM/YYYY (common in Jamaica)
  const ddmmyyyy = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try YYYY-MM-DD (ISO)
  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(cleaned);
  }

  // Try MM/DD/YYYY
  const mmddyyyy = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  }

  // Try natural language: "23 Feb 2026"
  const natural = Date.parse(cleaned);
  if (!isNaN(natural)) return new Date(natural);

  return null;
}

/**
 * Parses a monetary amount string, handling JMD formatting
 */
function parseAmount(amountStr: string): number {
  if (!amountStr || amountStr.trim() === '' || amountStr.trim() === '-') return 0;
  // Remove currency symbols, commas, spaces
  const cleaned = amountStr.replace(/[J$,\s]/g, '').replace(/\((.+)\)/, '-$1');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Splits a CSV line respecting quoted fields
 */
function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Main CSV parser. Accepts raw CSV text and returns parsed transactions.
 */
export function parseBankCSV(csvText: string): ParseResult {
  try {
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      return { success: false, transactions: [], error: 'CSV must have at least a header row and one data row' };
    }

    const headers = splitCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
    const bankName = detectBankFormat(headers);

    // Find column indices
    const dateIdx = headers.findIndex((h) =>
      h.includes('date') || h.includes('posted') || h.includes('trans')
    );
    const descIdx = headers.findIndex((h) =>
      h.includes('description') || h.includes('details') || h.includes('narration') || h.includes('particular')
    );
    const debitIdx = headers.findIndex((h) =>
      h.includes('debit') || h.includes('withdrawal') || h.includes('dr')
    );
    const creditIdx = headers.findIndex((h) =>
      h.includes('credit') || h.includes('deposit') || h.includes('cr')
    );
    const amountIdx = headers.findIndex((h) =>
      h === 'amount' || h === 'value'
    );
    const balanceIdx = headers.findIndex((h) =>
      h.includes('balance') || h.includes('running')
    );
    const refIdx = headers.findIndex((h) =>
      h.includes('reference') || h.includes('ref') || h.includes('cheque')
    );

    if (dateIdx === -1) {
      return { success: false, transactions: [], error: 'Could not find a Date column in CSV' };
    }
    if (descIdx === -1 && amountIdx === -1 && debitIdx === -1) {
      return { success: false, transactions: [], error: 'Could not find Description or Amount columns' };
    }

    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const fields = splitCSVLine(lines[i]);
      if (fields.length < 2) continue;

      const date = parseDate(fields[dateIdx] ?? '');
      if (!date) continue; // Skip rows without valid dates

      const description = fields[descIdx] ?? '';

      let amount: number;
      let type: 'DEBIT' | 'CREDIT';

      if (amountIdx !== -1) {
        // Single amount column (negative = debit, positive = credit)
        amount = parseAmount(fields[amountIdx]);
        type = amount < 0 ? 'DEBIT' : 'CREDIT';
      } else {
        // Separate debit/credit columns
        const debit = debitIdx !== -1 ? parseAmount(fields[debitIdx]) : 0;
        const credit = creditIdx !== -1 ? parseAmount(fields[creditIdx]) : 0;
        if (debit > 0) {
          amount = -debit;
          type = 'DEBIT';
        } else {
          amount = credit;
          type = 'CREDIT';
        }
      }

      if (amount === 0) continue; // Skip zero-amount rows

      const balance = balanceIdx !== -1 ? parseAmount(fields[balanceIdx]) : undefined;
      const reference = refIdx !== -1 ? fields[refIdx] : undefined;

      transactions.push({ date, description, amount, balance, reference, type });
    }

    return {
      success: true,
      transactions,
      bankName: bankName !== 'GENERIC' ? bankName : undefined,
    };
  } catch (error) {
    return {
      success: false,
      transactions: [],
      error: error instanceof Error ? error.message : 'Failed to parse CSV',
    };
  }
}
