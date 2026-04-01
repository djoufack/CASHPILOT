function roundToCents(value) {
  const numeric = Number(value || 0);
  return Math.round(numeric * 100) / 100;
}

function normalizeIsoDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate, days = 0) {
  const normalized = normalizeIsoDate(isoDate);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map((value) => Number(value || 0));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
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

export function buildClosingWorkflow({
  periodEnd,
  status = 'draft',
  unpostedDepreciationAfter = 0,
  journalGap = 0,
} = {}) {
  const remainingDepreciation = Number(unpostedDepreciationAfter || 0);
  const currentJournalGap = roundToCents(Number(journalGap || 0));
  const resolvedStatus = String(status || 'draft');

  const j5Completed = remainingDepreciation === 0;
  const j10Completed = j5Completed && currentJournalGap <= 0.01;
  const j15Completed = j10Completed && resolvedStatus === 'closed';

  const milestones = [
    {
      key: 'j5',
      code: 'J+5',
      targetDate: addDays(periodEnd, 5),
      completed: j5Completed,
      titleKey: 'accounting.closingAssistant.milestones.j5.title',
      defaultTitle: 'J+5 - Dotations comptabilisees',
      descriptionKey: 'accounting.closingAssistant.milestones.j5.description',
      defaultDescription: 'Toutes les dotations de la periode doivent etre comptabilisees.',
    },
    {
      key: 'j10',
      code: 'J+10',
      targetDate: addDays(periodEnd, 10),
      completed: j10Completed,
      titleKey: 'accounting.closingAssistant.milestones.j10.title',
      defaultTitle: 'J+10 - Equilibre des journaux',
      descriptionKey: 'accounting.closingAssistant.milestones.j10.description',
      defaultDescription: 'Verifier que le journal est equilibre en debit / credit.',
    },
    {
      key: 'j15',
      code: 'J+15',
      targetDate: addDays(periodEnd, 15),
      completed: j15Completed,
      titleKey: 'accounting.closingAssistant.milestones.j15.title',
      defaultTitle: 'J+15 - Cloture validee',
      descriptionKey: 'accounting.closingAssistant.milestones.j15.description',
      defaultDescription: 'Finaliser et valider la cloture de periode.',
    },
  ];

  const completedCount = milestones.filter((milestone) => milestone.completed).length;
  const totalCount = milestones.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  let nextAction = {
    key: 'monitor_next_period',
    severity: 'success',
    descriptionKey: 'accounting.closingAssistant.nextActions.monitor_next_period',
    defaultDescription: 'Cloture terminee. Vous pouvez preparer la periode suivante.',
  };

  if (!j5Completed) {
    nextAction = {
      key: 'post_depreciation',
      severity: 'warning',
      descriptionKey: 'accounting.closingAssistant.nextActions.post_depreciation',
      defaultDescription: 'Comptabiliser les dotations restantes avant J+5 ({{count}} ligne(s) non comptabilisee(s)).',
      metadata: { count: remainingDepreciation },
    };
  } else if (!j10Completed) {
    nextAction = {
      key: 'resolve_journal_gap',
      severity: 'warning',
      descriptionKey: 'accounting.closingAssistant.nextActions.resolve_journal_gap',
      defaultDescription: 'Resoudre l ecart de journal avant J+10 (ecart courant: {{value}}).',
      metadata: { value: currentJournalGap },
    };
  } else if (!j15Completed) {
    nextAction = {
      key: 'finalize_closing_validation',
      severity: 'warning',
      descriptionKey: 'accounting.closingAssistant.nextActions.finalize_closing_validation',
      defaultDescription: 'Valider la cloture de periode et historiser la decision avant J+15.',
    };
  }

  return {
    milestones,
    progress: {
      completed: completedCount,
      total: totalCount,
      percent: progressPercent,
    },
    nextAction,
  };
}

export function buildClosingChecklist({
  periodStart,
  periodEnd,
  unpostedDepreciationBefore = 0,
  unpostedDepreciationAfter = 0,
  depreciationEntriesGenerated = 0,
  status = 'draft',
  journalSummary = { totalDebit: 0, totalCredit: 0, gap: 0, balanced: true },
}) {
  const workflow = buildClosingWorkflow({
    periodEnd,
    status,
    unpostedDepreciationAfter,
    journalGap: journalSummary?.gap,
  });

  return {
    periodStart,
    periodEnd,
    unpostedDepreciationBefore: Number(unpostedDepreciationBefore || 0),
    unpostedDepreciationAfter: Number(unpostedDepreciationAfter || 0),
    depreciationEntriesGenerated: Number(depreciationEntriesGenerated || 0),
    journal: {
      totalDebit: roundToCents(journalSummary.totalDebit),
      totalCredit: roundToCents(journalSummary.totalCredit),
      gap: roundToCents(journalSummary.gap),
      balanced: Boolean(journalSummary.balanced),
    },
    workflow,
    computedAt: new Date().toISOString(),
  };
}

export function toPeriodKey(year, month) {
  return Number(year || 0) * 100 + Number(month || 0);
}
