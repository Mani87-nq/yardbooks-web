/**
 * OFX/QFX Bank Statement Parser
 *
 * Parses Open Financial Exchange (OFX/QFX) files exported by
 * Jamaican banks (NCB, JMMB, Sagicor, First Global).
 *
 * OFX is an SGML-based format used by most banking software:
 *   <STMTTRN>
 *     <TRNTYPE>DEBIT
 *     <DTPOSTED>20260215120000
 *     <TRNAMT>-15000.00
 *     <FITID>2026021500001
 *     <NAME>POS PURCHASE PROGRESSIVE GROCE
 *     <MEMO>KINGSTON JM
 *   </STMTTRN>
 */

import type { ParsedTransaction, ParseResult } from './csv-parser';

/**
 * Parse OFX date format: YYYYMMDDHHMMSS or YYYYMMDD
 */
function parseOFXDate(dateStr: string): Date | null {
  const cleaned = dateStr.trim().replace(/\[.*\]/, ''); // Remove timezone info like [0:-5:EST]

  if (cleaned.length >= 8) {
    const year = parseInt(cleaned.substring(0, 4));
    const month = parseInt(cleaned.substring(4, 6)) - 1;
    const day = parseInt(cleaned.substring(6, 8));

    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }

  return null;
}

/**
 * Extract the text content of an OFX tag.
 * OFX doesn't always use closing tags, so we handle both:
 *   <TAG>value         (no closing tag — value ends at next < or newline)
 *   <TAG>value</TAG>   (with closing tag)
 */
function extractTag(block: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([^<\\n\\r]+)`, 'i');
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Detect bank name from OFX content
 */
function detectBank(content: string): string | undefined {
  const org = extractTag(content, 'ORG');
  if (!org) return undefined;

  const orgLower = org.toLowerCase();
  if (orgLower.includes('ncb') || orgLower.includes('national commercial')) return 'NCB';
  if (orgLower.includes('scotia')) return 'SCOTIABANK';
  if (orgLower.includes('jmmb')) return 'JMMB';
  if (orgLower.includes('sagicor')) return 'SAGICOR';
  if (orgLower.includes('first global') || orgLower.includes('fgb')) return 'FIRST_GLOBAL';
  return org;
}

/**
 * Main OFX/QFX parser. Accepts raw OFX text and returns parsed transactions.
 *
 * Handles:
 * - SGML-style OFX (v1.x) — most common from Jamaican banks
 * - XML-style OFX (v2.x) — newer format
 * - Both credit card (CCSTMTRS) and bank (STMTRS) statements
 */
export function parseOFX(ofxText: string): ParseResult {
  try {
    if (!ofxText || ofxText.trim().length === 0) {
      return { success: false, transactions: [], error: 'Empty OFX file' };
    }

    // Check if this looks like OFX
    if (!ofxText.includes('<OFX>') && !ofxText.includes('<ofx>') &&
        !ofxText.includes('OFXHEADER') && !ofxText.includes('<?OFX')) {
      return { success: false, transactions: [], error: 'File does not appear to be in OFX/QFX format' };
    }

    const bankName = detectBank(ofxText);

    // Extract account number
    const acctId = extractTag(ofxText, 'ACCTID');

    // Find all STMTTRN blocks (transactions)
    const transactions: ParsedTransaction[] = [];
    const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTTRNLIST>))/gi;

    let match: RegExpExecArray | null;
    while ((match = trnRegex.exec(ofxText)) !== null) {
      const block = match[1];

      // Parse date
      const dtPosted = extractTag(block, 'DTPOSTED');
      const date = dtPosted ? parseOFXDate(dtPosted) : null;
      if (!date) continue;

      // Parse amount
      const amountStr = extractTag(block, 'TRNAMT');
      if (!amountStr) continue;
      const amount = parseFloat(amountStr.replace(/[,\s]/g, ''));
      if (isNaN(amount) || amount === 0) continue;

      // Parse description — use NAME, fall back to MEMO
      const name = extractTag(block, 'NAME') || '';
      const memo = extractTag(block, 'MEMO') || '';
      const description = name || memo || 'Unknown';

      // Parse reference / FITID (Financial Institution Transaction ID)
      const fitId = extractTag(block, 'FITID');
      const checkNum = extractTag(block, 'CHECKNUM');
      const refNum = extractTag(block, 'REFNUM');
      const reference = fitId || checkNum || refNum || undefined;

      // Transaction type
      const trnType = extractTag(block, 'TRNTYPE') || '';
      const type: 'DEBIT' | 'CREDIT' = amount < 0 ? 'DEBIT' : 'CREDIT';

      transactions.push({
        date,
        description: `${description}${memo && name ? ` - ${memo}` : ''}`.trim(),
        amount, // OFX amounts are already signed (negative = debit)
        reference,
        type,
      });
    }

    if (transactions.length === 0) {
      return {
        success: false,
        transactions: [],
        error: 'No valid transactions found in OFX file. Ensure the file contains STMTTRN entries.',
      };
    }

    // Sort by date ascending
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      success: true,
      transactions,
      bankName,
      accountNumber: acctId || undefined,
    };
  } catch (error) {
    return {
      success: false,
      transactions: [],
      error: error instanceof Error ? error.message : 'Failed to parse OFX file',
    };
  }
}

/**
 * Detect if a file is OFX/QFX format based on content or filename
 */
export function isOFXFormat(filename: string, content?: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'ofx' || ext === 'qfx') return true;

  if (content) {
    const header = content.substring(0, 500).toLowerCase();
    return header.includes('ofxheader') || header.includes('<ofx>') || header.includes('<?ofx');
  }

  return false;
}
