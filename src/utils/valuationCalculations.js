// ============================================================================
// valuationCalculations.js
// Company valuation calculation engine for CashPilot's Pilotage Ecosystem
// Supports: EBITDA multiples method & simplified DCF method
// ============================================================================

// ---------------------------------------------------------------------------
// Sector EBITDA multiples database
// ---------------------------------------------------------------------------
const SECTOR_MULTIPLES = {
  france: {
    saas:         { low: 8,   mid: 12,  high: 18  },
    industry:     { low: 4,   mid: 6,   high: 8   },
    retail:       { low: 3,   mid: 5,   high: 7   },
    construction: { low: 3,   mid: 4.5, high: 6   },
    b2b_services: { low: 5,   mid: 7,   high: 10  },
  },
  belgium: {
    saas:         { low: 7,   mid: 11,  high: 16  },
    industry:     { low: 4,   mid: 5.5, high: 7.5 },
    retail:       { low: 3,   mid: 4.5, high: 6.5 },
    construction: { low: 2.5, mid: 4,   high: 5.5 },
    b2b_services: { low: 4.5, mid: 6.5, high: 9   },
  },
  ohada: {
    saas:         { low: 5,   mid: 8,   high: 12  },
    industry:     { low: 3,   mid: 4.5, high: 6   },
    retail:       { low: 2,   mid: 3.5, high: 5   },
    construction: { low: 2,   mid: 3,   high: 4.5 },
    b2b_services: { low: 3,   mid: 5,   high: 7   },
  },
};

// ---------------------------------------------------------------------------
// WACC parameters by region
// ---------------------------------------------------------------------------
const WACC_PARAMS = {
  france: {
    riskFreeRate: 0.03,
    equityPremium: 0.055,
    beta: 1.0,
    description: 'France (zone euro) - Taux sans risque OAT 10 ans',
  },
  belgium: {
    riskFreeRate: 0.028,
    equityPremium: 0.05,
    beta: 1.0,
    description: 'Belgique (zone euro) - OLO 10 ans',
  },
  ohada: {
    riskFreeRate: 0.05,
    equityPremium: 0.10,
    beta: 1.2,
    description: 'Zone OHADA - Prime de risque pays elevee',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a value is a finite number.
 * @param {*} val
 * @returns {boolean}
 */
function isValidNumber(val) {
  return typeof val === 'number' && Number.isFinite(val);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get sector-specific EBITDA multiples by sector and region.
 *
 * @param {string} sector - 'saas' | 'industry' | 'retail' | 'construction' | 'b2b_services'
 * @param {string} region - 'france' | 'belgium' | 'ohada'
 * @returns {{ low: number, mid: number, high: number }}
 */
export function getSectorMultiples(sector, region) {
  const regionData = SECTOR_MULTIPLES[region];
  if (!regionData) {
    return { low: 0, mid: 0, high: 0 };
  }
  const multiples = regionData[sector];
  if (!multiples) {
    return { low: 0, mid: 0, high: 0 };
  }
  return { ...multiples };
}

/**
 * Get WACC (Weighted Average Cost of Capital) by region.
 *
 * France:  risk-free 3.0%, premium 5.5%, beta 1.0 -> WACC ~8.5%
 * Belgium: risk-free 2.8%, premium 5.0%, beta 1.0 -> WACC ~7.8%
 * OHADA:   risk-free 5.0%, premium 10.0%, beta 1.2 -> WACC ~17.0%
 *
 * @param {string} region - 'france' | 'belgium' | 'ohada'
 * @returns {{ riskFreeRate: number, equityPremium: number, beta: number, wacc: number, description: string }}
 */
export function getWACCByRegion(region) {
  const params = WACC_PARAMS[region];
  if (!params) {
    return {
      riskFreeRate: 0,
      equityPremium: 0,
      beta: 0,
      wacc: 0,
      description: '',
    };
  }

  const { riskFreeRate, equityPremium, beta, description } = params;
  // CAPM: WACC = riskFreeRate + beta * equityPremium
  const wacc = riskFreeRate + beta * equityPremium;

  return {
    riskFreeRate,
    equityPremium,
    beta,
    wacc: Math.round(wacc * 10000) / 10000, // 4 decimal precision
    description,
  };
}

/**
 * Calculate enterprise value using the EBITDA multiples method.
 *
 * @param {number} ebitda - Annual EBITDA
 * @param {string} sector - Sector key
 * @param {string} region - Region key
 * @returns {{ lowValue: number, midValue: number, highValue: number, multiple: { low: number, mid: number, high: number } }}
 */
export function calculateMultiplesValuation(ebitda, sector, region) {
  const empty = {
    lowValue: 0,
    midValue: 0,
    highValue: 0,
    multiple: { low: 0, mid: 0, high: 0 },
  };

  if (!isValidNumber(ebitda) || ebitda <= 0) {
    return empty;
  }

  const multiple = getSectorMultiples(sector, region);
  if (multiple.low === 0 && multiple.mid === 0 && multiple.high === 0) {
    return empty;
  }

  return {
    lowValue: Math.round(ebitda * multiple.low),
    midValue: Math.round(ebitda * multiple.mid),
    highValue: Math.round(ebitda * multiple.high),
    multiple,
  };
}

/**
 * Calculate enterprise value using the simplified DCF (Discounted Cash Flow) method.
 *
 * Method:
 *  1. Project FCF for N years using the growth rate
 *  2. Calculate terminal value = FCF_n * (1 + g) / (wacc - g)   (Gordon Growth Model)
 *  3. Discount all cash flows to present value
 *  4. Sum = enterprise value
 *
 * @param {number} freeCashFlow - Current year FCF
 * @param {number} wacc - WACC as decimal (e.g. 0.085 for 8.5%)
 * @param {number} [growthRate=0.02] - Terminal growth rate as decimal
 * @param {number} [years=5] - Projection period
 * @returns {{ dcfValue: number, terminalValue: number, presentValueCashFlows: number, projections: Array<{ year: number, fcf: number, discountFactor: number, presentValue: number }> }}
 */
export function calculateDCFValuation(freeCashFlow, wacc, growthRate = 0.02, years = 5) {
  const empty = {
    dcfValue: 0,
    terminalValue: 0,
    presentValueCashFlows: 0,
    projections: [],
  };

  if (!isValidNumber(freeCashFlow) || freeCashFlow <= 0) {
    return empty;
  }
  if (!isValidNumber(wacc) || wacc <= 0) {
    return empty;
  }
  if (!isValidNumber(growthRate)) {
    return empty;
  }
  if (!isValidNumber(years) || years <= 0) {
    return empty;
  }

  // Gordon model is invalid when wacc <= growthRate
  if (wacc <= growthRate) {
    return empty;
  }

  const projections = [];
  let cumulativePV = 0;

  // Step 1 & 3: Project FCFs and discount to present value
  for (let y = 1; y <= years; y++) {
    const fcf = freeCashFlow * Math.pow(1 + growthRate, y);
    const discountFactor = 1 / Math.pow(1 + wacc, y);
    const presentValue = fcf * discountFactor;

    projections.push({
      year: y,
      fcf: Math.round(fcf),
      discountFactor: Math.round(discountFactor * 10000) / 10000,
      presentValue: Math.round(presentValue),
    });

    cumulativePV += presentValue;
  }

  // Step 2: Terminal value (Gordon Growth Model)
  const lastFCF = freeCashFlow * Math.pow(1 + growthRate, years);
  const terminalValueUndiscounted = (lastFCF * (1 + growthRate)) / (wacc - growthRate);
  const terminalDiscountFactor = 1 / Math.pow(1 + wacc, years);
  const terminalValuePV = terminalValueUndiscounted * terminalDiscountFactor;

  // Step 4: Total enterprise value
  const presentValueCashFlows = Math.round(cumulativePV);
  const terminalValue = Math.round(terminalValuePV);
  const dcfValue = presentValueCashFlows + terminalValue;

  return {
    dcfValue,
    terminalValue,
    presentValueCashFlows,
    projections,
  };
}

/**
 * Calculate WACC sensitivity -- show enterprise value at different WACC levels.
 * Returns 7 data points: base-3%, base-2%, base-1%, base, base+1%, base+2%, base+3%.
 *
 * @param {number} freeCashFlow - Current year FCF
 * @param {number} baseWacc - Base WACC as decimal
 * @param {number} [growthRate=0.02] - Terminal growth rate as decimal
 * @returns {Array<{ wacc: number, waccPercent: string, value: number, label: string }>}
 */
export function calculateWACCSensitivity(freeCashFlow, baseWacc, growthRate = 0.02) {
  if (!isValidNumber(freeCashFlow) || freeCashFlow <= 0) {
    return [];
  }
  if (!isValidNumber(baseWacc) || baseWacc <= 0) {
    return [];
  }
  if (!isValidNumber(growthRate)) {
    return [];
  }

  const offsets = [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03];
  const results = [];

  for (const offset of offsets) {
    const adjustedWacc = baseWacc + offset;

    // Skip if adjusted WACC is invalid (must be positive and greater than growth rate)
    if (adjustedWacc <= 0 || adjustedWacc <= growthRate) {
      continue;
    }

    const dcf = calculateDCFValuation(freeCashFlow, adjustedWacc, growthRate);
    const sign = offset > 0 ? '+' : '';
    const offsetLabel = offset === 0 ? 'Base' : `${sign}${Math.round(offset * 100)}%`;

    results.push({
      wacc: Math.round(adjustedWacc * 10000) / 10000,
      waccPercent: `${(adjustedWacc * 100).toFixed(1)}%`,
      value: dcf.dcfValue,
      label: offsetLabel,
    });
  }

  return results;
}

/**
 * Build a complete valuation summary combining both methods, sensitivity analysis,
 * and WACC data into a single object.
 *
 * @param {Object} params
 * @param {number} params.ebitda - Annual EBITDA
 * @param {number} params.freeCashFlow - Current year FCF
 * @param {string} params.sector - Sector key
 * @param {string} params.region - Region key
 * @param {number} [params.growthRate=0.02] - Terminal growth rate as decimal
 * @returns {Object} Complete valuation with both methods, sensitivity, WACC data
 */
export function buildValuationSummary(params) {
  const {
    ebitda = 0,
    freeCashFlow = 0,
    sector = '',
    region = '',
    growthRate = 0.02,
  } = params || {};

  // WACC for the region
  const waccData = getWACCByRegion(region);

  // Method 1: EBITDA Multiples
  const multiplesValuation = calculateMultiplesValuation(ebitda, sector, region);

  // Method 2: DCF
  const dcfValuation = calculateDCFValuation(freeCashFlow, waccData.wacc, growthRate);

  // Sensitivity analysis
  const sensitivity = calculateWACCSensitivity(freeCashFlow, waccData.wacc, growthRate);

  // Consensus range: blend multiples mid with DCF value
  let consensusLow = 0;
  let consensusMid = 0;
  let consensusHigh = 0;

  const hasMultiples = multiplesValuation.midValue > 0;
  const hasDCF = dcfValuation.dcfValue > 0;

  if (hasMultiples && hasDCF) {
    consensusLow = Math.round(Math.min(multiplesValuation.lowValue, dcfValuation.dcfValue * 0.85));
    consensusMid = Math.round((multiplesValuation.midValue + dcfValuation.dcfValue) / 2);
    consensusHigh = Math.round(Math.max(multiplesValuation.highValue, dcfValuation.dcfValue * 1.15));
  } else if (hasMultiples) {
    consensusLow = multiplesValuation.lowValue;
    consensusMid = multiplesValuation.midValue;
    consensusHigh = multiplesValuation.highValue;
  } else if (hasDCF) {
    consensusLow = Math.round(dcfValuation.dcfValue * 0.85);
    consensusMid = dcfValuation.dcfValue;
    consensusHigh = Math.round(dcfValuation.dcfValue * 1.15);
  }

  return {
    inputs: {
      ebitda,
      freeCashFlow,
      sector,
      region,
      growthRate,
    },
    wacc: waccData,
    multiples: multiplesValuation,
    dcf: dcfValuation,
    sensitivity,
    consensus: {
      lowValue: consensusLow,
      midValue: consensusMid,
      highValue: consensusHigh,
    },
  };
}
