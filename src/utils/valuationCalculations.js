// ============================================================================
// valuationCalculations.js
// Company valuation calculation engine for CashPilot's Pilotage Ecosystem
// Supports: EBITDA multiples method & simplified DCF method
// ============================================================================

import {
  getRegionWaccMetadata,
  getSectorMultiplesMetadata,
} from '@/services/referenceDataService';

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
 * @param {string} sector
 * @param {string} region
 * @returns {{ low: number, mid: number, high: number }}
 */
export function getSectorMultiples(sector, region) {
  const multiples = getSectorMultiplesMetadata(sector, region);
  if (!multiples) {
    return { low: 0, mid: 0, high: 0 };
  }

  return { ...multiples };
}

/**
 * Get WACC (Weighted Average Cost of Capital) by region.
 *
 * @param {string} region
 * @returns {{ riskFreeRate: number, equityPremium: number, beta: number, wacc: number, description: string }}
 */
export function getWACCByRegion(region) {
  const params = getRegionWaccMetadata(region);
  if (!params) {
    return {
      riskFreeRate: 0,
      equityPremium: 0,
      beta: 0,
      wacc: 0,
      description: '',
    };
  }

  return {
    riskFreeRate: params.riskFree / 100,
    equityPremium: params.premium / 100,
    beta: params.beta,
    wacc: params.wacc / 100,
    description: '',
  };
}

/**
 * Calculate enterprise value using the EBITDA multiples method.
 *
 * @param {number} ebitda
 * @param {string} sector
 * @param {string} region
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
 * @param {number} freeCashFlow
 * @param {number} wacc
 * @param {number} [growthRate=0.02]
 * @param {number} [years=5]
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

  if (wacc <= growthRate) {
    return empty;
  }

  const projections = [];
  let cumulativePV = 0;

  for (let y = 1; y <= years; y += 1) {
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

  const lastFCF = freeCashFlow * Math.pow(1 + growthRate, years);
  const terminalValueUndiscounted = (lastFCF * (1 + growthRate)) / (wacc - growthRate);
  const terminalDiscountFactor = 1 / Math.pow(1 + wacc, years);
  const terminalValuePV = terminalValueUndiscounted * terminalDiscountFactor;

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
 * Calculate WACC sensitivity.
 *
 * @param {number} freeCashFlow
 * @param {number} baseWacc
 * @param {number} [growthRate=0.02]
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
 * @param {number} params.ebitda
 * @param {number} params.freeCashFlow
 * @param {string} params.sector
 * @param {string} params.region
 * @param {number} [params.growthRate=0.02]
 * @returns {Object}
 */
export function buildValuationSummary(params) {
  const {
    ebitda = 0,
    freeCashFlow = 0,
    sector = '',
    region = '',
    growthRate = 0.02,
  } = params || {};

  const waccData = getWACCByRegion(region);
  const multiplesValuation = calculateMultiplesValuation(ebitda, sector, region);
  const dcfValuation = calculateDCFValuation(freeCashFlow, waccData.wacc, growthRate);
  const sensitivity = calculateWACCSensitivity(freeCashFlow, waccData.wacc, growthRate);

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
