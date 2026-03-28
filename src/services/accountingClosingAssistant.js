function roundToCents(value) {
  const numeric = Number(value || 0);
  return Math.round(numeric * 100) / 100;
}

export function computeJournalGap(entries = []) {
  const totals = (entries || []).reduce(
    (acc, entry) => {
      acc.totalDebit += Number(entry?.debit || 0);
      acc.totalCredit += Number(entry?.credit || 0);
      return acc;
    },
    { totalDebit: 0, totalCredit: 0 }
  );

  const totalDebit = roundToCents(totals.totalDebit);
  const totalCredit = roundToCents(totals.totalCredit);
  const gap = roundToCents(Math.abs(totalDebit - totalCredit));

  return {
    totalDebit,
    totalCredit,
    gap,
    balanced: gap <= 0.01,
  };
}

export function determineClosingStatus({ journalGap = 0, unpostedDepreciationAfter = 0 } = {}) {
  if (Number(unpostedDepreciationAfter || 0) > 0) {
    return 'blocked';
  }

  return Number(journalGap || 0) <= 0.01 ? 'closed' : 'blocked';
}

export function buildClosingChecklist({
  periodStart,
  periodEnd,
  unpostedDepreciationBefore = 0,
  depreciationEntriesGenerated = 0,
  journalSummary = { totalDebit: 0, totalCredit: 0, gap: 0, balanced: true },
}) {
  return {
    periodStart,
    periodEnd,
    unpostedDepreciationBefore: Number(unpostedDepreciationBefore || 0),
    depreciationEntriesGenerated: Number(depreciationEntriesGenerated || 0),
    journal: {
      totalDebit: roundToCents(journalSummary.totalDebit),
      totalCredit: roundToCents(journalSummary.totalCredit),
      gap: roundToCents(journalSummary.gap),
      balanced: Boolean(journalSummary.balanced),
    },
    computedAt: new Date().toISOString(),
  };
}

export function toPeriodKey(year, month) {
  return Number(year || 0) * 100 + Number(month || 0);
}
