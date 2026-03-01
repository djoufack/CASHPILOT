/**
 * Multi-zone tax calculation engine for CashPilot's Pilotage Ecosystem.
 * Supports France, Belgium, and OHADA zone tax systems.
 *
 * Pure calculation module — no imports, no side effects.
 */

// ---------------------------------------------------------------------------
// Tax configuration per region
// ---------------------------------------------------------------------------

const TAX_CONFIGS = {
  france: {
    label: 'France',
    corporateRate: 0.25,
    pmeRate: 0.15,
    pmeThreshold: 42_500,
    rdCreditRate: 0.30,
    rdCreditCap: 100_000_000,
    rdCreditRateAboveCap: 0.05,
    rdDescription: 'CIR — Credit Impot Recherche (30% jusqu\'a 100M, puis 5%)',
    hasIMF: false,
    imfRate: null,
    descriptions: {
      pme: 'PME : 15% sur les premiers 42 500 EUR, puis 25%',
      standard: 'Taux normal : 25%',
    },
  },
  belgium: {
    label: 'Belgique',
    corporateRate: 0.25,
    pmeRate: 0.20,
    pmeThreshold: 100_000,
    rdCreditRate: 0.15,
    rdCreditCap: null,
    rdCreditRateAboveCap: null,
    rdDescription: 'Deduction fiscale R&D de 15%',
    hasIMF: false,
    imfRate: null,
    descriptions: {
      pme: 'PME : 20% sur les premiers 100 000 EUR, puis 25%',
      standard: 'Taux normal : 25%',
    },
  },
  ohada: {
    label: 'Zone OHADA',
    corporateRate: 0.30,
    pmeRate: null,
    pmeThreshold: null,
    rdCreditRate: 0.10,
    rdCreditCap: null,
    rdCreditRateAboveCap: null,
    rdDescription: 'Code des Investissements — credit general de 10%',
    hasIMF: true,
    imfRate: 0.005,
    descriptions: {
      pme: null,
      standard: 'Taux normal : 30% (defaut zone OHADA)',
    },
  },
};

// ---------------------------------------------------------------------------
// getTaxConfig
// ---------------------------------------------------------------------------

/**
 * Get tax configuration for a region.
 * Returns the rates, thresholds, and descriptions for the given region.
 *
 * @param {string} region - 'france' | 'belgium' | 'ohada'
 * @returns {Object} Tax configuration object
 */
export function getTaxConfig(region = 'france') {
  const key = (region || 'france').toLowerCase();
  const config = TAX_CONFIGS[key];
  if (!config) {
    throw new Error(`Region inconnue : "${region}". Regions supportees : france, belgium, ohada`);
  }
  return { ...config };
}

// ---------------------------------------------------------------------------
// calculateIS — Corporate Income Tax (Impot sur les Societes)
// ---------------------------------------------------------------------------

/**
 * Calculate corporate income tax (IS — Impot sur les Societes).
 *
 * @param {number} preTaxIncome - Resultat Comptable Avant Impot (RCAI)
 * @param {string} region - 'france' | 'belgium' | 'ohada'
 * @param {boolean} isSmallBusiness - PME status for reduced rates
 * @returns {{ taxDue: number, effectiveRate: number, theoreticalRate: number, details: Array }}
 */
export function calculateIS(preTaxIncome, region = 'france', isSmallBusiness = true) {
  const income = Number(preTaxIncome) || 0;
  const config = getTaxConfig(region);
  const details = [];

  // No tax due on negative or zero income
  if (income <= 0) {
    return {
      taxDue: 0,
      effectiveRate: 0,
      theoreticalRate: config.corporateRate,
      details: [{ description: 'Resultat negatif ou nul — aucun IS du', amount: 0 }],
    };
  }

  let taxDue = 0;

  const key = (region || 'france').toLowerCase();

  if (key === 'ohada') {
    // OHADA: flat 30%, no PME bracket
    taxDue = income * config.corporateRate;
    details.push({
      description: config.descriptions.standard,
      base: income,
      rate: config.corporateRate,
      amount: taxDue,
    });
  } else if (isSmallBusiness && config.pmeRate !== null && config.pmeThreshold !== null) {
    // PME bracket + standard rate on remainder
    const bracketBase = Math.min(income, config.pmeThreshold);
    const bracketTax = bracketBase * config.pmeRate;
    details.push({
      description: `Tranche PME (${(config.pmeRate * 100).toFixed(0)}%)`,
      base: bracketBase,
      rate: config.pmeRate,
      amount: bracketTax,
    });

    const remainder = income - bracketBase;
    let remainderTax = 0;
    if (remainder > 0) {
      remainderTax = remainder * config.corporateRate;
      details.push({
        description: `Tranche normale (${(config.corporateRate * 100).toFixed(0)}%)`,
        base: remainder,
        rate: config.corporateRate,
        amount: remainderTax,
      });
    }

    taxDue = bracketTax + remainderTax;
  } else {
    // Standard flat rate
    taxDue = income * config.corporateRate;
    details.push({
      description: config.descriptions.standard,
      base: income,
      rate: config.corporateRate,
      amount: taxDue,
    });
  }

  const effectiveRate = calculateEffectiveTaxRate(taxDue, income);

  return {
    taxDue: roundCents(taxDue),
    effectiveRate,
    theoreticalRate: config.corporateRate,
    details,
  };
}

// ---------------------------------------------------------------------------
// calculateIMF — Minimum Flat Tax (OHADA)
// ---------------------------------------------------------------------------

/**
 * Calculate minimum flat tax (OHADA specific — Impot Minimum Forfaitaire).
 *
 * @param {number} revenue - Chiffre d'affaires
 * @param {number} rate - IMF rate (default 0.5%)
 * @returns {number} The IMF amount
 */
export function calculateIMF(revenue, rate = 0.005) {
  const rev = Number(revenue) || 0;
  const r = Number(rate) || 0.005;
  if (rev <= 0) return 0;
  return roundCents(rev * r);
}

// ---------------------------------------------------------------------------
// calculateTaxCredits — R&D Tax Credits
// ---------------------------------------------------------------------------

/**
 * Calculate R&D tax credits.
 *
 * @param {number} rdExpenses - Total R&D expenses
 * @param {string} region - 'france' | 'belgium' | 'ohada'
 * @returns {{ creditAmount: number, creditRate: number, description: string }}
 */
export function calculateTaxCredits(rdExpenses, region = 'france') {
  const expenses = Number(rdExpenses) || 0;
  const config = getTaxConfig(region);

  if (expenses <= 0) {
    return {
      creditAmount: 0,
      creditRate: config.rdCreditRate,
      description: config.rdDescription,
    };
  }

  let creditAmount = 0;
  const key = (region || 'france').toLowerCase();

  if (key === 'france' && config.rdCreditCap !== null) {
    // France: 30% up to 100M, then 5% above
    const baseExpenses = Math.min(expenses, config.rdCreditCap);
    creditAmount = baseExpenses * config.rdCreditRate;

    const excessExpenses = expenses - baseExpenses;
    if (excessExpenses > 0) {
      creditAmount += excessExpenses * config.rdCreditRateAboveCap;
    }
  } else {
    // Belgium & OHADA: flat rate
    creditAmount = expenses * config.rdCreditRate;
  }

  return {
    creditAmount: roundCents(creditAmount),
    creditRate: config.rdCreditRate,
    description: config.rdDescription,
  };
}

// ---------------------------------------------------------------------------
// calculateEffectiveTaxRate
// ---------------------------------------------------------------------------

/**
 * Calculate effective tax rate.
 *
 * @param {number} taxDue - Amount of tax due
 * @param {number} preTaxIncome - Pre-tax income (RCAI)
 * @returns {number} Effective rate as a decimal (0–1), or 0 when income <= 0
 */
export function calculateEffectiveTaxRate(taxDue, preTaxIncome) {
  const income = Number(preTaxIncome) || 0;
  const tax = Number(taxDue) || 0;
  if (income <= 0 || tax <= 0) return 0;
  return roundRate(tax / income);
}

// ---------------------------------------------------------------------------
// buildTaxSynthesis — Complete tax synthesis for a zone
// ---------------------------------------------------------------------------

/**
 * Build complete tax synthesis for a zone.
 *
 * @param {Object} params
 * @param {number} params.preTaxIncome - Resultat Comptable Avant Impot
 * @param {number} params.revenue - Chiffre d'affaires (needed for OHADA IMF)
 * @param {number} params.rdExpenses - Total R&D expenses
 * @param {string} params.region - 'france' | 'belgium' | 'ohada'
 * @param {boolean} params.isSmallBusiness - PME status
 * @returns {Object} Complete tax synthesis
 */
export function buildTaxSynthesis(params = {}) {
  const {
    preTaxIncome = 0,
    revenue = 0,
    rdExpenses = 0,
    region = 'france',
    isSmallBusiness = true,
  } = params;

  const config = getTaxConfig(region);
  const is = calculateIS(preTaxIncome, region, isSmallBusiness);
  const credits = calculateTaxCredits(rdExpenses, region);

  // Net tax after credits (cannot go below zero)
  const netTaxAfterCredits = Math.max(0, roundCents(is.taxDue - credits.creditAmount));

  // OHADA: apply IMF floor
  let imf = null;
  let finalTaxDue = netTaxAfterCredits;

  if (config.hasIMF) {
    const imfAmount = calculateIMF(revenue, config.imfRate);
    imf = {
      amount: imfAmount,
      rate: config.imfRate,
      revenue: Number(revenue) || 0,
      description: 'Impot Minimum Forfaitaire (IMF) — plancher fiscal OHADA',
    };
    // The company always pays at least the IMF
    finalTaxDue = Math.max(netTaxAfterCredits, imfAmount);
  }

  const effectiveRate = calculateEffectiveTaxRate(finalTaxDue, preTaxIncome);

  return {
    region: config.label,
    regionKey: (region || 'france').toLowerCase(),
    preTaxIncome: Number(preTaxIncome) || 0,
    revenue: Number(revenue) || 0,
    is,
    credits,
    netTaxAfterCredits,
    imf,
    finalTaxDue: roundCents(finalTaxDue),
    effectiveRate,
    summary: buildSummaryText({
      config,
      is,
      credits,
      netTaxAfterCredits,
      imf,
      finalTaxDue,
      effectiveRate,
      preTaxIncome,
    }),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Round to two decimal places (cents).
 * @param {number} value
 * @returns {number}
 */
function roundCents(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Round a rate to six decimal places.
 * @param {number} value
 * @returns {number}
 */
function roundRate(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Build a human-readable summary text for a tax synthesis.
 * @param {Object} data
 * @returns {string}
 */
function buildSummaryText({ config, is, credits, netTaxAfterCredits, imf, finalTaxDue, effectiveRate, preTaxIncome }) {
  const lines = [];
  const income = Number(preTaxIncome) || 0;

  lines.push(`Zone fiscale : ${config.label}`);
  lines.push(`Resultat avant impot : ${formatEUR(income)}`);
  lines.push(`IS brut : ${formatEUR(is.taxDue)} (taux theorique ${(is.theoreticalRate * 100).toFixed(0)}%)`);

  if (credits.creditAmount > 0) {
    lines.push(`Credit R&D : -${formatEUR(credits.creditAmount)} (${credits.description})`);
    lines.push(`IS net apres credits : ${formatEUR(netTaxAfterCredits)}`);
  }

  if (imf) {
    lines.push(`IMF (plancher) : ${formatEUR(imf.amount)} (${(imf.rate * 100).toFixed(1)}% du CA)`);
    if (imf.amount > netTaxAfterCredits) {
      lines.push(`L'IMF s'applique car superieur a l'IS net.`);
    }
  }

  lines.push(`Impot final du : ${formatEUR(finalTaxDue)}`);
  lines.push(`Taux effectif : ${(effectiveRate * 100).toFixed(2)}%`);

  return lines.join('\n');
}

/**
 * Format a number as EUR for display.
 * @param {number} value
 * @returns {string}
 */
function formatEUR(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}
