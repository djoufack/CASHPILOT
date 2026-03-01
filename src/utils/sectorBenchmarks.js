/**
 * Sector-specific benchmark data for the Pilotage Ecosystem feature.
 *
 * Each benchmark metric uses { low, target, high } thresholds.
 * For "normal" ratios, higher is better (margins, returns).
 * For "inverse" ratios (DSO, stock days), lower is better.
 */

// ---------------------------------------------------------------------------
// SECTOR BENCHMARKS
// ---------------------------------------------------------------------------

export const SECTOR_BENCHMARKS = {
  saas: {
    operatingMargin:      { low: 5,    target: 20,  high: 35 },
    netMargin:            { low: 3,    target: 15,  high: 28 },
    grossMargin:          { low: 65,   target: 78,  high: 90 },
    gearing:              { low: 0.1,  target: 0.3, high: 0.6 },
    currentRatio:         { low: 1.2,  target: 2.0, high: 3.5 },
    quickRatio:           { low: 1.0,  target: 1.8, high: 3.0 },
    dso:                  { low: 25,   target: 40,  high: 60 },
    dpo:                  { low: 30,   target: 45,  high: 70 },
    stockRotationDays:    null,
    bfrToRevenue:         { low: -15,  target: -5,  high: 5 },
    financialIndependence:{ low: 40,   target: 60,  high: 80 },
    roe:                  { low: 8,    target: 18,  high: 30 },
    roa:                  { low: 5,    target: 12,  high: 22 },
    roce:                 { low: 10,   target: 20,  high: 35 },
  },

  industry: {
    operatingMargin:      { low: 3,    target: 8,   high: 15 },
    netMargin:            { low: 1,    target: 5,   high: 10 },
    grossMargin:          { low: 25,   target: 38,  high: 50 },
    gearing:              { low: 0.3,  target: 0.7, high: 1.2 },
    currentRatio:         { low: 1.1,  target: 1.6, high: 2.5 },
    quickRatio:           { low: 0.6,  target: 1.0, high: 1.6 },
    dso:                  { low: 40,   target: 55,  high: 75 },
    dpo:                  { low: 35,   target: 50,  high: 70 },
    stockRotationDays:    { low: 30,   target: 55,  high: 90 },
    bfrToRevenue:         { low: 10,   target: 20,  high: 35 },
    financialIndependence:{ low: 30,   target: 45,  high: 65 },
    roe:                  { low: 5,    target: 12,  high: 20 },
    roa:                  { low: 3,    target: 7,   high: 14 },
    roce:                 { low: 6,    target: 12,  high: 22 },
  },

  retail: {
    operatingMargin:      { low: 1,    target: 4,   high: 8 },
    netMargin:            { low: 0.5,  target: 2.5, high: 5 },
    grossMargin:          { low: 20,   target: 32,  high: 45 },
    gearing:              { low: 0.2,  target: 0.5, high: 1.0 },
    currentRatio:         { low: 1.0,  target: 1.4, high: 2.0 },
    quickRatio:           { low: 0.4,  target: 0.8, high: 1.3 },
    dso:                  { low: 5,    target: 15,  high: 30 },
    dpo:                  { low: 25,   target: 40,  high: 60 },
    stockRotationDays:    { low: 15,   target: 35,  high: 60 },
    bfrToRevenue:         { low: -5,   target: 5,   high: 15 },
    financialIndependence:{ low: 25,   target: 40,  high: 60 },
    roe:                  { low: 6,    target: 14,  high: 25 },
    roa:                  { low: 3,    target: 8,   high: 15 },
    roce:                 { low: 8,    target: 15,  high: 25 },
  },

  construction: {
    operatingMargin:      { low: 2,    target: 6,   high: 12 },
    netMargin:            { low: 1,    target: 3.5, high: 8 },
    grossMargin:          { low: 15,   target: 25,  high: 38 },
    gearing:              { low: 0.3,  target: 0.8, high: 1.5 },
    currentRatio:         { low: 1.0,  target: 1.3, high: 2.0 },
    quickRatio:           { low: 0.7,  target: 1.0, high: 1.5 },
    dso:                  { low: 50,   target: 75,  high: 110 },
    dpo:                  { low: 40,   target: 60,  high: 90 },
    stockRotationDays:    { low: 10,   target: 25,  high: 50 },
    bfrToRevenue:         { low: 15,   target: 30,  high: 50 },
    financialIndependence:{ low: 20,   target: 35,  high: 55 },
    roe:                  { low: 5,    target: 12,  high: 22 },
    roa:                  { low: 2,    target: 6,   high: 12 },
    roce:                 { low: 6,    target: 12,  high: 20 },
  },

  b2b_services: {
    operatingMargin:      { low: 5,    target: 12,  high: 22 },
    netMargin:            { low: 3,    target: 8,   high: 16 },
    grossMargin:          { low: 40,   target: 55,  high: 72 },
    gearing:              { low: 0.1,  target: 0.3, high: 0.7 },
    currentRatio:         { low: 1.1,  target: 1.7, high: 2.8 },
    quickRatio:           { low: 1.0,  target: 1.5, high: 2.5 },
    dso:                  { low: 35,   target: 50,  high: 70 },
    dpo:                  { low: 25,   target: 40,  high: 60 },
    stockRotationDays:    null,
    bfrToRevenue:         { low: 5,    target: 15,  high: 30 },
    financialIndependence:{ low: 35,   target: 55,  high: 75 },
    roe:                  { low: 8,    target: 16,  high: 28 },
    roa:                  { low: 5,    target: 10,  high: 18 },
    roce:                 { low: 8,    target: 16,  high: 28 },
  },
};

// ---------------------------------------------------------------------------
// SECTOR MULTIPLES  (EV / Revenue or EV / EBITDA by sector + region)
// ---------------------------------------------------------------------------

export const SECTOR_MULTIPLES = {
  saas: {
    france:  { low: 8,   mid: 12,  high: 18 },
    belgium: { low: 7,   mid: 10,  high: 15 },
    ohada:   { low: 4,   mid: 6,   high: 10 },
  },
  industry: {
    france:  { low: 4,   mid: 6,   high: 9 },
    belgium: { low: 3.5, mid: 5.5, high: 8 },
    ohada:   { low: 2,   mid: 3.5, high: 6 },
  },
  retail: {
    france:  { low: 3,   mid: 5,   high: 8 },
    belgium: { low: 2.5, mid: 4.5, high: 7 },
    ohada:   { low: 1.5, mid: 3,   high: 5 },
  },
  construction: {
    france:  { low: 3,   mid: 5,   high: 7 },
    belgium: { low: 2.5, mid: 4,   high: 6.5 },
    ohada:   { low: 1.5, mid: 3,   high: 5 },
  },
  b2b_services: {
    france:  { low: 5,   mid: 8,   high: 12 },
    belgium: { low: 4.5, mid: 7,   high: 11 },
    ohada:   { low: 2.5, mid: 4.5, high: 7 },
  },
};

// ---------------------------------------------------------------------------
// REGION WACC  (Weighted Average Cost of Capital)
// ---------------------------------------------------------------------------

export const REGION_WACC = {
  france: {
    riskFree: 3.0,
    premium:  5.5,
    beta:     1.0,
    wacc:     8.5,
  },
  belgium: {
    riskFree: 3.0,
    premium:  5.8,
    beta:     1.0,
    wacc:     8.8,
  },
  ohada: {
    riskFree: 5.0,
    premium:  10.0,
    beta:     1.2,
    wacc:     17.0,
  },
};

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Returns benchmarks for the given sector.
 * Falls back to `b2b_services` if the sector is unknown.
 *
 * @param {string} sector - One of the SECTOR_BENCHMARKS keys.
 * @returns {object} Benchmark thresholds for every ratio.
 */
export function getSectorBenchmarks(sector) {
  return SECTOR_BENCHMARKS[sector] || SECTOR_BENCHMARKS.b2b_services;
}

/**
 * Returns valuation multiples for a given sector and region.
 * Falls back to `b2b_services` for unknown sectors and `france` for unknown regions.
 *
 * @param {string} sector - One of the SECTOR_MULTIPLES keys.
 * @param {string} region - One of 'france' | 'belgium' | 'ohada'.
 * @returns {object} { low, mid, high } multiples.
 */
export function getSectorMultiples(sector, region) {
  const sectorData = SECTOR_MULTIPLES[sector] || SECTOR_MULTIPLES.b2b_services;
  return sectorData[region] || sectorData.france;
}

/**
 * Returns WACC parameters for a given region.
 * Falls back to `france` if the region is unknown.
 *
 * @param {string} region - One of 'france' | 'belgium' | 'ohada'.
 * @returns {object} { riskFree, premium, beta, wacc }
 */
export function getWACCData(region) {
  return REGION_WACC[region] || REGION_WACC.france;
}

/**
 * Evaluate a financial ratio against its sector benchmark.
 *
 * For **normal** ratios (higher is better — margins, returns, current ratio, etc.):
 *   - excellent : value >= high
 *   - good      : value >= target
 *   - average   : value >= low
 *   - poor      : value >= low * 0.5
 *   - critical  : value <  low * 0.5
 *
 * For **inverse** ratios (lower is better — DSO, stock rotation days, BFR):
 *   - excellent : value <= low
 *   - good      : value <= target
 *   - average   : value <= high
 *   - poor      : value <= high * 1.5
 *   - critical  : value >  high * 1.5
 *
 * @param {number}  value     - The actual ratio value to evaluate.
 * @param {object}  benchmark - { low, target, high } thresholds for the ratio.
 * @param {boolean} [inverse=false] - Set to true for ratios where lower is better.
 * @returns {'excellent'|'good'|'average'|'poor'|'critical'} Rating label.
 */
export function evaluateRatio(value, benchmark, inverse = false) {
  if (benchmark == null || value == null) {
    return null;
  }

  if (inverse) {
    // Lower is better (e.g. DSO, stockRotationDays, bfrToRevenue)
    if (value <= benchmark.low)       return 'excellent';
    if (value <= benchmark.target)    return 'good';
    if (value <= benchmark.high)      return 'average';
    if (value <= benchmark.high * 1.5) return 'poor';
    return 'critical';
  }

  // Higher is better (e.g. margins, returns, liquidity ratios)
  if (value >= benchmark.high)        return 'excellent';
  if (value >= benchmark.target)      return 'good';
  if (value >= benchmark.low)         return 'average';
  if (value >= benchmark.low * 0.5)   return 'poor';
  return 'critical';
}
