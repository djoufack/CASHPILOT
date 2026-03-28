type FinancialSummary = {
  totalRevenue: number;
  totalExpenses: number;
  netResult: number;
  totalPaid: number;
  unpaidTotal: number;
  overdueCount: number;
  clientCount: number;
  invoiceCount: number;
};

type FinancialContextLike = {
  companyId?: string | null;
  companyName?: string | null;
  summary: FinancialSummary;
};

type HealthScoreLike = {
  score: number;
  factors?: Record<string, unknown>;
};

type SourceEvidenceCalculation = {
  metric: keyof FinancialSummary;
  value: number;
  source_tables: string[];
  formula: string;
};

export type CfoSourceEvidence = {
  type: 'source_evidence';
  company_id: string | null;
  company_name: string;
  tables_used: string[];
  metrics: FinancialSummary & { healthScore: number };
  calculations: SourceEvidenceCalculation[];
  generated_at: string;
};

const TABLES_USED = ['company', 'clients', 'expenses', 'invoices', 'payments'];

export function buildCfoSourceEvidence(
  financialContext: FinancialContextLike,
  healthScore: HealthScoreLike,
  generatedAt = new Date().toISOString()
): CfoSourceEvidence {
  const { summary } = financialContext;

  return {
    type: 'source_evidence',
    company_id: financialContext.companyId || null,
    company_name: financialContext.companyName || 'Entreprise',
    tables_used: [...TABLES_USED],
    metrics: {
      totalRevenue: summary.totalRevenue,
      totalExpenses: summary.totalExpenses,
      netResult: summary.netResult,
      totalPaid: summary.totalPaid,
      unpaidTotal: summary.unpaidTotal,
      overdueCount: summary.overdueCount,
      clientCount: summary.clientCount,
      invoiceCount: summary.invoiceCount,
      healthScore: healthScore.score,
    },
    calculations: [
      {
        metric: 'totalRevenue',
        value: summary.totalRevenue,
        source_tables: ['invoices'],
        formula: 'Somme de invoices.total_ttc pour les factures au statut paid, sent ou overdue',
      },
      {
        metric: 'totalExpenses',
        value: summary.totalExpenses,
        source_tables: ['expenses'],
        formula: 'Somme de expenses.amount',
      },
      {
        metric: 'netResult',
        value: summary.netResult,
        source_tables: ['invoices', 'expenses'],
        formula: 'totalRevenue - totalExpenses',
      },
      {
        metric: 'totalPaid',
        value: summary.totalPaid,
        source_tables: ['payments'],
        formula: 'Somme de payments.amount',
      },
      {
        metric: 'unpaidTotal',
        value: summary.unpaidTotal,
        source_tables: ['invoices'],
        formula: 'Somme de invoices.balance_due, ou total_ttc si balance_due est vide, pour les factures non payees',
      },
      {
        metric: 'overdueCount',
        value: summary.overdueCount,
        source_tables: ['invoices'],
        formula: "Nombre de factures avec due_date anterieure a aujourd'hui et payment_status different de paid",
      },
      {
        metric: 'clientCount',
        value: summary.clientCount,
        source_tables: ['clients'],
        formula: 'Nombre de clients disponibles',
      },
      {
        metric: 'invoiceCount',
        value: summary.invoiceCount,
        source_tables: ['invoices'],
        formula: 'Nombre de factures disponibles',
      },
    ],
    generated_at: generatedAt,
  };
}
