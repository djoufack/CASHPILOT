export type CfoHealthScoreFactors = Record<string, { value: number; impact: number; label: string }>;

export type CfoFinancialSummary = {
  totalRevenue: number;
  totalExpenses: number;
  netResult: number;
  totalPaid: number;
  unpaidTotal: number;
  overdueCount: number;
  clientCount: number;
  invoiceCount: number;
};

export type CfoHealthScore = {
  score: number;
  factors: CfoHealthScoreFactors;
};

export const computeCfoHealthScore = (summary: CfoFinancialSummary): CfoHealthScore => {
  let score = 50;
  const factors: CfoHealthScoreFactors = {};

  const margin =
    summary.totalRevenue > 0 ? ((summary.totalRevenue - summary.totalExpenses) / summary.totalRevenue) * 100 : 0;
  const profitImpact = Math.min(20, Math.max(-20, margin * 0.5));
  score += profitImpact;
  factors.profitability = {
    value: Math.round(margin * 10) / 10,
    impact: Math.round(profitImpact),
    label: 'Marge nette (%)',
  };

  const collectionRate = summary.totalRevenue > 0 ? (summary.totalPaid / summary.totalRevenue) * 100 : 0;
  const collectionImpact = Math.min(15, Math.max(-10, (collectionRate - 50) * 0.3));
  score += collectionImpact;
  factors.collection = {
    value: Math.round(collectionRate * 10) / 10,
    impact: Math.round(collectionImpact),
    label: 'Taux encaissement (%)',
  };

  const overdueRatio = summary.invoiceCount > 0 ? (summary.overdueCount / summary.invoiceCount) * 100 : 0;
  const overdueImpact = Math.max(-20, -overdueRatio * 0.5);
  score += overdueImpact;
  factors.overdue = { value: summary.overdueCount, impact: Math.round(overdueImpact), label: 'Factures en retard' };

  const diversImpact = Math.min(10, summary.clientCount * 1.5);
  score += diversImpact;
  factors.diversification = {
    value: summary.clientCount,
    impact: Math.round(diversImpact),
    label: 'Diversification clients',
  };

  const cashImpact = summary.netResult >= 0 ? 5 : -5;
  score += cashImpact;
  factors.cashPosition = { value: summary.netResult, impact: cashImpact, label: 'Position nette' };

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    factors,
  };
};
