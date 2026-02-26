/**
 * Bank Transaction Auto-Matcher
 *
 * Matches bank statement transactions against book-side documents
 * (invoices/payments, expenses, journal entries) using multiple signals:
 *
 * 1. Exact amount match (primary)
 * 2. Date proximity (within 5 days)
 * 3. Description similarity (fuzzy text matching)
 * 4. Reference number matching
 *
 * Returns matches with confidence scores (HIGH/MEDIUM/LOW).
 * All matches are SUGGESTIONS — user must confirm before applying.
 */

export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface BookDocument {
  id: string;
  type: 'payment' | 'expense' | 'journal';
  amount: number;
  date: Date;
  description: string;
  reference?: string;
}

export interface MatchResult {
  bankTransactionId: string;
  bankAmount: number;
  bankDate: Date;
  bankDescription: string;
  match: {
    documentType: string;
    documentId: string;
    amount: number;
    date: string;
    description: string;
    reference?: string;
    confidence: MatchConfidence;
    confidenceScore: number;
    matchReasons: string[];
  } | null;
  alternateMatches: {
    documentType: string;
    documentId: string;
    amount: number;
    date: string;
    description: string;
    confidence: MatchConfidence;
    confidenceScore: number;
  }[];
}

interface BankTransaction {
  id: string;
  amount: number;
  date: Date;
  description: string;
  reference?: string | null;
}

/**
 * Run auto-matching for a set of bank transactions against book documents.
 */
export function autoMatch(
  bankTransactions: BankTransaction[],
  bookDocuments: BookDocument[],
  options: {
    maxDateDiffDays?: number;    // default 5
    minConfidenceScore?: number; // default 40, out of 100
  } = {},
): MatchResult[] {
  const maxDateDiffDays = options.maxDateDiffDays ?? 5;
  const minScore = options.minConfidenceScore ?? 40;

  const results: MatchResult[] = [];
  const usedDocIds = new Set<string>(); // Prevent double-matching

  // Sort bank transactions by amount descending (match large amounts first)
  const sortedTxns = [...bankTransactions].sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
  );

  for (const txn of sortedTxns) {
    const candidates: {
      doc: BookDocument;
      score: number;
      reasons: string[];
    }[] = [];

    for (const doc of bookDocuments) {
      if (usedDocIds.has(doc.id)) continue;

      // Sign check: deposits match payments, withdrawals match expenses
      const txnIsDeposit = txn.amount > 0;
      const docIsIncome = doc.type === 'payment';
      if (txnIsDeposit !== docIsIncome && doc.type !== 'journal') continue;

      const { score, reasons } = calculateMatchScore(txn, doc, maxDateDiffDays);

      if (score >= minScore) {
        candidates.push({ doc, score, reasons });
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    const bestMatch = candidates[0] || null;
    const alternates = candidates.slice(1, 4); // Up to 3 alternates

    if (bestMatch) {
      usedDocIds.add(bestMatch.doc.id); // Reserve this document
    }

    results.push({
      bankTransactionId: txn.id,
      bankAmount: txn.amount,
      bankDate: txn.date,
      bankDescription: txn.description,
      match: bestMatch
        ? {
            documentType: bestMatch.doc.type,
            documentId: bestMatch.doc.id,
            amount: bestMatch.doc.amount,
            date: bestMatch.doc.date.toISOString().split('T')[0],
            description: bestMatch.doc.description,
            reference: bestMatch.doc.reference,
            confidence: scoreToConfidence(bestMatch.score),
            confidenceScore: bestMatch.score,
            matchReasons: bestMatch.reasons,
          }
        : null,
      alternateMatches: alternates.map((a) => ({
        documentType: a.doc.type,
        documentId: a.doc.id,
        amount: a.doc.amount,
        date: a.doc.date.toISOString().split('T')[0],
        description: a.doc.description,
        confidence: scoreToConfidence(a.score),
        confidenceScore: a.score,
      })),
    });
  }

  return results;
}

/**
 * Calculate match score (0–100) between a bank transaction and a book document.
 */
function calculateMatchScore(
  txn: BankTransaction,
  doc: BookDocument,
  maxDateDiffDays: number,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // ── 1. Amount matching (0–50 points) ──
  const txnAmt = Math.abs(txn.amount);
  const docAmt = Math.abs(doc.amount);
  const amountDiff = Math.abs(txnAmt - docAmt);
  const amountPct = txnAmt > 0 ? amountDiff / txnAmt : 1;

  if (amountDiff < 0.01) {
    score += 50;
    reasons.push('Exact amount match');
  } else if (amountPct < 0.01) {
    score += 40;
    reasons.push('Amount within 1%');
  } else if (amountPct < 0.05) {
    score += 20;
    reasons.push('Amount within 5%');
  }

  // ── 2. Date proximity (0–25 points) ──
  const dateDiffMs = Math.abs(txn.date.getTime() - doc.date.getTime());
  const dateDiffDays = dateDiffMs / (1000 * 60 * 60 * 24);

  if (dateDiffDays > maxDateDiffDays) {
    // Too far apart — reduce score significantly
    score = Math.max(0, score - 20);
  } else if (dateDiffDays <= 0.5) {
    score += 25;
    reasons.push('Same day');
  } else if (dateDiffDays <= 1) {
    score += 22;
    reasons.push('Within 1 day');
  } else if (dateDiffDays <= 3) {
    score += 15;
    reasons.push(`Within ${Math.ceil(dateDiffDays)} days`);
  } else {
    score += Math.max(0, Math.round(10 - dateDiffDays));
    reasons.push(`Within ${Math.ceil(dateDiffDays)} days`);
  }

  // ── 3. Reference matching (0–15 points) ──
  if (txn.reference && doc.reference) {
    const txnRef = txn.reference.toLowerCase().trim();
    const docRef = doc.reference.toLowerCase().trim();
    if (txnRef === docRef) {
      score += 15;
      reasons.push('Reference number match');
    } else if (txnRef.includes(docRef) || docRef.includes(txnRef)) {
      score += 10;
      reasons.push('Partial reference match');
    }
  }

  // ── 4. Description similarity (0–10 points) ──
  const similarity = stringSimilarity(txn.description, doc.description);
  if (similarity > 0.7) {
    score += 10;
    reasons.push('Strong description match');
  } else if (similarity > 0.4) {
    score += 5;
    reasons.push('Partial description match');
  }

  return { score: Math.min(100, score), reasons };
}

/**
 * Simple string similarity using word overlap (Jaccard coefficient).
 * Returns 0–1 where 1 = identical.
 */
function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const wordsA = new Set(
    a.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2)
  );
  const wordsB = new Set(
    b.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2)
  );

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Convert numeric score to confidence level
 */
function scoreToConfidence(score: number): MatchConfidence {
  if (score >= 75) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

/**
 * Summary statistics for a batch of match results
 */
export function matchSummary(results: MatchResult[]): {
  total: number;
  matched: number;
  unmatched: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  matchRate: number;
} {
  const matched = results.filter((r) => r.match !== null);
  const high = matched.filter((r) => r.match!.confidence === 'HIGH').length;
  const medium = matched.filter((r) => r.match!.confidence === 'MEDIUM').length;
  const low = matched.filter((r) => r.match!.confidence === 'LOW').length;

  return {
    total: results.length,
    matched: matched.length,
    unmatched: results.length - matched.length,
    highConfidence: high,
    mediumConfidence: medium,
    lowConfidence: low,
    matchRate: results.length > 0
      ? Math.round((matched.length / results.length) * 100) : 0,
  };
}
