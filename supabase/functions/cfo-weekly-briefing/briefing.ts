import { buildCfoSourceEvidence } from '../cfo-agent/sourceEvidence.ts';
import { formatMoney } from '../cfo-agent/context.ts';
import { computeCfoHealthScore } from '../cfo-agent/insights.ts';

export type WeeklyBriefingContext = {
  companyId: string;
  companyName: string;
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netResult: number;
    totalPaid: number;
    unpaidTotal: number;
    overdueCount: number;
    clientCount: number;
    invoiceCount: number;
  };
  workingCapitalKpis?: {
    dso: number | null;
    dpo: number | null;
    dio: number | null;
    ccc: number | null;
  } | null;
  topClientsByRevenue: Array<{
    client_name?: string | null;
    revenue_ttc?: number | null;
    unpaid_ttc?: number | null;
  }>;
  overdueInvoices: Array<{
    invoice_number?: string | null;
    balance_due?: number | string | null;
  }>;
};

export const getUtcWeekStart = (date = new Date()) => {
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = current.getUTCDay();
  const offset = (day + 6) % 7;
  current.setUTCDate(current.getUTCDate() - offset);
  current.setUTCHours(0, 0, 0, 0);
  return current;
};

const formatWeekLabel = (date: Date) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(date);

export const buildWeeklyBriefing = (context: WeeklyBriefingContext, generatedAt = new Date()) => {
  const weekStart = getUtcWeekStart(generatedAt);
  const weekStartKey = weekStart.toISOString().slice(0, 10);
  const healthScore = computeCfoHealthScore(context.summary);
  const topClient = context.topClientsByRevenue[0] || null;
  const dso = context.workingCapitalKpis?.dso ?? null;
  const dpo = context.workingCapitalKpis?.dpo ?? null;
  const dio = context.workingCapitalKpis?.dio ?? null;
  const ccc = context.workingCapitalKpis?.ccc ?? null;
  const hasWorkingCapitalMetrics = [dso, dpo, dio, ccc].some((metric) => typeof metric === 'number');
  const sourceEvidence = buildCfoSourceEvidence(
    {
      companyId: context.companyId,
      companyName: context.companyName,
      summary: context.summary,
    },
    healthScore,
    generatedAt.toISOString()
  );

  const highlights = [
    `${context.summary.totalRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR de CA sur la semaine`,
    `${context.summary.overdueCount} facture(s) en retard, ${context.summary.unpaidTotal.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} EUR à recouvrer`,
  ];

  if (topClient?.client_name) {
    highlights.push(
      `Client prioritaire: ${topClient.client_name} (${formatMoney(Number(topClient.revenue_ttc || 0))} de CA, ${formatMoney(
        Number(topClient.unpaid_ttc || 0)
      )} encore dus)`
    );
  }
  if (hasWorkingCapitalMetrics) {
    highlights.push(
      `Cycle cash: DSO ${dso ?? 'N/A'} j | DIO ${dio ?? 'N/A'} j | DPO ${dpo ?? 'N/A'} j | CCC ${ccc ?? 'N/A'} j`
    );
  }

  const recommendedActions = [];
  if (context.summary.overdueCount > 0) {
    recommendedActions.push(`Relancer ${context.summary.overdueCount} facture(s) en retard cette semaine.`);
  }
  if (context.summary.unpaidTotal > 0) {
    recommendedActions.push(
      `Réduire l'encours client de ${context.summary.unpaidTotal.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} EUR.`
    );
  }
  if (topClient?.client_name) {
    recommendedActions.push(`Sécuriser le compte ${topClient.client_name} pour protéger le CA récurrent.`);
  }
  if (typeof dso === 'number' && dso > 45) {
    recommendedActions.push(`Plan recouvrement ciblé pour ramener le DSO sous 45 jours.`);
  }
  if (typeof dio === 'number' && dio > 60) {
    recommendedActions.push(`Réduire les stocks lents pour faire baisser le DIO sous 60 jours.`);
  }
  if (typeof dpo === 'number' && dpo < 30) {
    recommendedActions.push(`Renégocier les conditions fournisseurs pour rapprocher le DPO de 45 jours.`);
  }
  if (typeof ccc === 'number' && ccc > 30) {
    recommendedActions.push(`Lancer un plan cash inter-modules pour réduire le CCC sous 30 jours.`);
  }

  const briefingText = [
    `Briefing hebdomadaire CFO - ${context.companyName}`,
    `Semaine du ${formatWeekLabel(weekStart)}`,
    `Score de santé: ${healthScore.score}/100`,
    `CA total: ${formatMoney(context.summary.totalRevenue)}`,
    `Dépenses: ${formatMoney(context.summary.totalExpenses)}`,
    `Résultat net: ${formatMoney(context.summary.netResult)}`,
    `Encours clients: ${formatMoney(context.summary.unpaidTotal)}`,
    `Factures en retard: ${context.summary.overdueCount}`,
    `DSO: ${dso ?? 'N/A'} j`,
    `DPO: ${dpo ?? 'N/A'} j`,
    `DIO: ${dio ?? 'N/A'} j`,
    `CCC: ${ccc ?? 'N/A'} j`,
    '',
    'Points clés:',
    ...highlights.map((line) => `- ${line}`),
    '',
    'Actions recommandées:',
    ...recommendedActions.map((line) => `- ${line}`),
  ].join('\n');

  return {
    company_id: context.companyId,
    company_name: context.companyName,
    week_start: weekStartKey,
    generated_at: generatedAt.toISOString(),
    briefing_text: briefingText,
    briefing_json: {
      week_start: weekStartKey,
      generated_at: generatedAt.toISOString(),
      summary: {
        ...context.summary,
        dso,
        dpo,
        dio,
        ccc,
        health_score: healthScore.score,
        factors: healthScore.factors,
      },
      highlights,
      recommended_actions: recommendedActions,
      source_evidence: sourceEvidence,
      top_clients: context.topClientsByRevenue.map((client) => ({
        client_name: client.client_name || 'Client inconnu',
        revenue_ttc: Number(client.revenue_ttc || 0),
        unpaid_ttc: Number(client.unpaid_ttc || 0),
      })),
      overdue_invoices: context.overdueInvoices.map((invoice) => ({
        invoice_number: invoice.invoice_number || null,
        balance_due: Number(invoice.balance_due || 0),
      })),
    },
  };
};
