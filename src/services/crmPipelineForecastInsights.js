const STAGE_WEIGHTS = {
  draft: 0.2,
  sent: 0.45,
  pending: 0.6,
  open: 0.5,
  accepted: 0.9,
  approved: 0.9,
  signed: 1,
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(toNumber(value) * factor) / factor;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const computeFreshnessFactor = (quote, now) => {
  const createdAt = safeDate(quote?.created_at);
  if (!createdAt) return 1;
  const ageDays = Math.max(0, (now.getTime() - createdAt.getTime()) / DAY_MS);
  if (ageDays <= 14) return 1.05;
  if (ageDays <= 30) return 1;
  if (ageDays <= 60) return 0.9;
  return 0.75;
};

const computeExpiryFactor = (quote, now) => {
  const validUntil = safeDate(quote?.valid_until);
  if (!validUntil) return 1;
  const remainingDays = (validUntil.getTime() - now.getTime()) / DAY_MS;
  if (remainingDays >= 30) return 1.05;
  if (remainingDays >= 10) return 1;
  if (remainingDays >= 0) return 0.85;
  return 0.55;
};

export function buildCrmPipelineForecastInsights(quotes, options = {}) {
  const now = safeDate(options?.now) || new Date();
  const opportunities = (quotes || []).filter((quote) => {
    const status = String(quote?.status || '').toLowerCase();
    return ['draft', 'sent', 'pending', 'open', 'accepted', 'approved', 'signed'].includes(status);
  });

  if (opportunities.length === 0) {
    return {
      summary: {
        opportunities: 0,
        openPipeline: 0,
        weightedPipeline: 0,
        conservativeForecast: 0,
        baseForecast: 0,
        aggressiveForecast: 0,
        concentrationRiskPct: 0,
        confidence: 'low',
      },
      rows: [],
    };
  }

  const rows = opportunities.map((quote) => {
    const status = String(quote?.status || '').toLowerCase();
    const amount = toNumber(quote?.total_ttc || quote?.total_ht || 0);
    const stageWeight = STAGE_WEIGHTS[status] ?? 0.35;
    const freshnessFactor = computeFreshnessFactor(quote, now);
    const expiryFactor = computeExpiryFactor(quote, now);
    const weightedProbability = clamp(stageWeight * freshnessFactor * expiryFactor, 0.05, 1);
    const weightedAmount = amount * weightedProbability;

    return {
      id: quote?.id,
      quoteNumber: quote?.quote_number || quote?.number || quote?.id || 'n/a',
      clientId: quote?.client_id || null,
      status,
      amount: round(amount, 2),
      weightedProbability: round(weightedProbability * 100, 1),
      weightedAmount: round(weightedAmount, 2),
      freshnessFactor: round(freshnessFactor, 2),
      expiryFactor: round(expiryFactor, 2),
    };
  });

  const openPipeline = rows.reduce((sum, row) => sum + row.amount, 0);
  const weightedPipeline = rows.reduce((sum, row) => sum + row.weightedAmount, 0);
  const conservativeForecast = weightedPipeline * 0.85;
  const baseForecast = weightedPipeline;
  const aggressiveForecast = Math.min(openPipeline, weightedPipeline * 1.15);

  const byClient = new Map();
  rows.forEach((row) => {
    const key = row.clientId || row.id || 'unknown';
    byClient.set(key, (byClient.get(key) || 0) + row.weightedAmount);
  });
  const biggestClient = Math.max(...byClient.values());
  const concentrationRiskPct = weightedPipeline > 0 ? (biggestClient / weightedPipeline) * 100 : 0;

  const confidence =
    weightedPipeline <= 0 ? 'low' : concentrationRiskPct <= 35 ? 'high' : concentrationRiskPct <= 60 ? 'medium' : 'low';

  return {
    summary: {
      opportunities: rows.length,
      openPipeline: round(openPipeline, 2),
      weightedPipeline: round(weightedPipeline, 2),
      conservativeForecast: round(conservativeForecast, 2),
      baseForecast: round(baseForecast, 2),
      aggressiveForecast: round(aggressiveForecast, 2),
      concentrationRiskPct: round(concentrationRiskPct, 1),
      confidence,
    },
    rows: rows.sort((a, b) => b.weightedAmount - a.weightedAmount).slice(0, 10),
  };
}
