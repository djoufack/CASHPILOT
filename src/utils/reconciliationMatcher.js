
/**
 * Reconciliation Matcher — Auto-matching algorithm for bank reconciliation
 * Pure functions, no side-effects.
 */

// ============================================================================
// TRANSACTION NORMALIZATION
// ============================================================================

/**
 * Normalize all transaction sources into a uniform format for matching.
 * - Paid invoices → positive amount (money received)
 * - Expenses → negative amount (money spent)
 * - Paid supplier invoices → negative amount (money spent)
 */
export function normalizeTransactions(invoices = [], expenses = [], supplierInvoices = []) {
  const all = [];

  // Paid invoices → money IN (positive)
  invoices
    .filter(inv => inv.status === 'paid')
    .forEach(inv => {
      all.push({
        id: inv.id,
        source_type: 'invoice',
        date: inv.date,
        amount: parseFloat(inv.total_ttc) || parseFloat(inv.total_ht) || 0,
        description: `Facture ${inv.invoice_number || ''}`.trim(),
        reference: inv.invoice_number || null,
        clientName: inv.client?.company_name || inv.client?.contact_name || null
      });
    });

  // Expenses → money OUT (negative)
  expenses.forEach(exp => {
    const amount = parseFloat(exp.amount) || 0;
    all.push({
      id: exp.id,
      source_type: 'expense',
      date: exp.date ? (typeof exp.date === 'string' ? exp.date.split('T')[0] : new Date(exp.date).toISOString().split('T')[0]) : null,
      amount: -Math.abs(amount),
      description: exp.description || exp.category || 'Dépense',
      reference: null,
      category: exp.category
    });
  });

  // Paid supplier invoices → money OUT (negative)
  supplierInvoices
    .filter(si => si.payment_status === 'paid')
    .forEach(si => {
      const total = parseFloat(si.total_amount || si.amount || 0);
      const vat = parseFloat(si.vat_amount || 0);
      all.push({
        id: si.id,
        source_type: 'supplier_invoice',
        date: si.invoice_date || si.created_at?.split('T')[0],
        amount: -Math.abs(total + vat),
        description: `Fournisseur ${si.invoice_number || ''}`.trim(),
        reference: si.invoice_number || null
      });
    });

  return all;
}

// ============================================================================
// SCORING ENGINE
// ============================================================================

/**
 * Compute a match score between a bank line and a transaction (0-100).
 *
 * Criteria:
 * - Amount match (50 pts): exact ±0.01 = 50, ±1% = 40, ±5% = 20
 * - Date proximity (30 pts): same day = 30, ±1d = 25, ±3d = 20, ±7d = 10
 * - Reference match (20 pts): invoice number found = 20, partial = 10
 */
export function computeMatchScore(bankLine, transaction) {
  let score = 0;

  // ---- Amount score (50 pts) ----
  const bankAmt = Math.abs(bankLine.amount);
  const txnAmt = Math.abs(transaction.amount);

  if (bankAmt === 0 && txnAmt === 0) {
    score += 50;
  } else if (txnAmt > 0) {
    const diff = Math.abs(bankAmt - txnAmt);
    const pct = diff / txnAmt;

    if (diff <= 0.01) score += 50;
    else if (pct <= 0.01) score += 40;
    else if (pct <= 0.05) score += 20;
    // else 0
  }

  // ---- Direction check ----
  // Bank line and transaction must have same sign direction
  const bankSign = bankLine.amount >= 0 ? 1 : -1;
  const txnSign = transaction.amount >= 0 ? 1 : -1;
  if (bankSign !== txnSign) {
    return 0; // Opposite direction = no match possible
  }

  // ---- Date score (30 pts) ----
  if (bankLine.date && transaction.date) {
    const bankDate = new Date(bankLine.date);
    const txnDate = new Date(transaction.date);
    const daysDiff = Math.abs((bankDate - txnDate) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 0.5) score += 30;
    else if (daysDiff <= 1.5) score += 25;
    else if (daysDiff <= 3.5) score += 20;
    else if (daysDiff <= 7.5) score += 10;
    // else 0
  }

  // ---- Reference score (20 pts) ----
  if (transaction.reference && bankLine.description) {
    const ref = transaction.reference.toLowerCase().replace(/[^a-z0-9]/g, '');
    const desc = bankLine.description.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (ref.length >= 3 && desc.includes(ref)) {
      score += 20;
    } else if (ref.length >= 3) {
      // Check partial match (at least 70% of reference chars found in description)
      const matchChars = ref.split('').filter(c => desc.includes(c)).length;
      if (matchChars / ref.length > 0.7) {
        score += 10;
      }
    }
  }

  // Bonus: client name match
  if (transaction.clientName && bankLine.description) {
    const name = transaction.clientName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const desc = bankLine.description.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (name.length >= 3 && desc.includes(name)) {
      score += 5; // Small bonus, capped at 100
    }
  }

  return Math.min(score, 100);
}

// ============================================================================
// AUTO-MATCHING ALGORITHM
// ============================================================================

/**
 * Auto-match bank statement lines with normalized transactions.
 * Uses greedy matching: assigns best match first, removes from pool.
 *
 * @param {Array} bankLines - Parsed bank statement lines
 * @param {Array} transactions - Normalized transactions from normalizeTransactions()
 * @returns {Array} Match results for each bank line
 */
export function autoMatchLines(bankLines, transactions) {
  const usedTransactions = new Set();
  const results = [];

  // Sort bank lines by date for consistent processing
  const sortedLines = [...bankLines].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Phase 1: Compute all scores
  const allScores = [];
  for (const bankLine of sortedLines) {
    for (const txn of transactions) {
      const score = computeMatchScore(bankLine, txn);
      if (score >= 50) { // Only consider candidates above threshold
        allScores.push({
          bankLineId: bankLine.id,
          transactionId: txn.id,
          score,
          bankLine,
          transaction: txn
        });
      }
    }
  }

  // Phase 2: Sort by score descending and greedily assign
  allScores.sort((a, b) => b.score - a.score);

  const matchedBankLines = new Map();

  for (const candidate of allScores) {
    if (matchedBankLines.has(candidate.bankLineId)) continue;
    if (usedTransactions.has(candidate.transactionId)) continue;

    if (candidate.score >= 70) {
      // Auto-match (high confidence)
      matchedBankLines.set(candidate.bankLineId, {
        bankLineId: candidate.bankLineId,
        matched: true,
        autoMatched: true,
        matchedSourceType: candidate.transaction.source_type,
        matchedSourceId: candidate.transaction.id,
        confidence: candidate.score / 100,
        transaction: candidate.transaction
      });
      usedTransactions.add(candidate.transactionId);
    } else if (candidate.score >= 50) {
      // Suggestion (needs user confirmation)
      if (!matchedBankLines.has(candidate.bankLineId)) {
        matchedBankLines.set(candidate.bankLineId, {
          bankLineId: candidate.bankLineId,
          matched: false,
          autoMatched: false,
          suggestedSourceType: candidate.transaction.source_type,
          suggestedSourceId: candidate.transaction.id,
          confidence: candidate.score / 100,
          transaction: candidate.transaction
        });
      }
    }
  }

  // Build results for all bank lines
  for (const bankLine of sortedLines) {
    const match = matchedBankLines.get(bankLine.id);
    results.push(match || {
      bankLineId: bankLine.id,
      matched: false,
      autoMatched: false,
      confidence: 0,
      transaction: null
    });
  }

  return results;
}

// ============================================================================
// RECONCILIATION SUMMARY
// ============================================================================

/**
 * Compute reconciliation statistics from bank statement lines.
 */
export function getReconciliationSummary(lines = []) {
  const total = lines.length;
  const matched = lines.filter(l => l.reconciliation_status === 'matched');
  const unmatched = lines.filter(l => l.reconciliation_status === 'unmatched');
  const ignored = lines.filter(l => l.reconciliation_status === 'ignored');

  const totalCredits = lines.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0);
  const totalDebits = lines.filter(l => l.amount < 0).reduce((s, l) => s + l.amount, 0);

  const matchedCredits = matched.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0);
  const matchedDebits = matched.filter(l => l.amount < 0).reduce((s, l) => s + l.amount, 0);

  const unmatchedCredits = unmatched.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0);
  const unmatchedDebits = unmatched.filter(l => l.amount < 0).reduce((s, l) => s + l.amount, 0);

  return {
    totalLines: total,
    matchedLines: matched.length,
    unmatchedLines: unmatched.length,
    ignoredLines: ignored.length,
    matchRate: total > 0 ? Math.round((matched.length / total) * 1000) / 10 : 0,
    totalCredits: Math.round(totalCredits * 100) / 100,
    totalDebits: Math.round(totalDebits * 100) / 100,
    matchedCredits: Math.round(matchedCredits * 100) / 100,
    matchedDebits: Math.round(matchedDebits * 100) / 100,
    unmatchedCredits: Math.round(unmatchedCredits * 100) / 100,
    unmatchedDebits: Math.round(unmatchedDebits * 100) / 100,
    difference: Math.round((unmatchedCredits + unmatchedDebits) * 100) / 100
  };
}

/**
 * Search for matching transactions for a specific bank line.
 * Returns candidates sorted by score.
 */
export function searchMatches(bankLine, transactions, options = {}) {
  const { amountTolerance = 0.1, dateTolerance = 7, textFilter = '' } = options;

  let candidates = transactions;

  // Filter by text if provided
  if (textFilter) {
    const filter = textFilter.toLowerCase();
    candidates = candidates.filter(t =>
      (t.description || '').toLowerCase().includes(filter) ||
      (t.reference || '').toLowerCase().includes(filter)
    );
  }

  // Score and filter candidates
  return candidates
    .map(txn => ({
      ...txn,
      score: computeMatchScore(bankLine, txn)
    }))
    .filter(txn => txn.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}
