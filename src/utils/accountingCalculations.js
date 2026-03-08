/**
 * Accounting Calculations — minimal utilities kept on frontend
 *
 * All heavy accounting logic now lives in PostgreSQL SQL functions.
 * This file only keeps:
 *   - filterByPeriod (generic date filter, used by financialMetrics.js & scripts)
 *   - estimateTax / DEFAULT_TAX_BRACKETS (pure bracket calc, used by TaxEstimation.jsx & hooks)
 */

// ============================================================================
// PERIOD FILTERING
// ============================================================================

export function filterByPeriod(items, startDate, endDate, dateField = 'date') {
  if (!items || !startDate || !endDate) return items || [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return items.filter(item => {
    const d = new Date(item[dateField]);
    return d >= start && d <= end;
  });
}

// ============================================================================
// TAX ESTIMATION
// ============================================================================

/**
 * Default French corporate tax brackets (IS)
 */
export const DEFAULT_TAX_BRACKETS = [
  { min: 0, max: 42500, rate: 0.15, label: 'Taux réduit PME (15%)' },
  { min: 42500, max: Infinity, rate: 0.25, label: 'Taux normal (25%)' }
];

export function estimateTax(netIncome, brackets = DEFAULT_TAX_BRACKETS) {
  if (netIncome <= 0) return { totalTax: 0, effectiveRate: 0, details: [], quarterlyPayment: 0 };

  let remaining = netIncome;
  let totalTax = 0;
  const details = [];

  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const taxableInBracket = Math.min(remaining, (bracket.max === Infinity ? remaining : bracket.max - bracket.min));
    const tax = taxableInBracket * bracket.rate;
    details.push({
      ...bracket,
      taxableAmount: taxableInBracket,
      tax
    });
    totalTax += tax;
    remaining -= taxableInBracket;
  }

  return {
    totalTax,
    effectiveRate: netIncome > 0 ? totalTax / netIncome : 0,
    details,
    quarterlyPayment: totalTax / 4
  };
}
