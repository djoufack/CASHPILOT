import {
  getRegionWaccMetadata,
  getSectorBenchmarksMetadata,
  getSectorMultiplesMetadata,
} from '@/services/referenceDataService';

/**
 * Returns benchmarks for the given sector.
 * Falls back to `b2b_services` if the sector is unknown.
 *
 * @param {string} sector - Sector identifier
 * @returns {object|null} Benchmark thresholds for every ratio.
 */
export function getSectorBenchmarks(sector) {
  return getSectorBenchmarksMetadata(sector);
}

/**
 * Returns valuation multiples for a given sector and region.
 * Falls back to `b2b_services` for unknown sectors and `france` for unknown regions.
 *
 * @param {string} sector - Sector identifier
 * @param {string} region - Region identifier
 * @returns {object|null} { low, mid, high } multiples.
 */
export function getSectorMultiples(sector, region) {
  return getSectorMultiplesMetadata(sector, region);
}

/**
 * Returns WACC parameters for a given region.
 * Falls back to `france` if the region is unknown.
 *
 * @param {string} region - Region identifier
 * @returns {object|null} { riskFree, premium, beta, wacc }
 */
export function getWACCData(region) {
  return getRegionWaccMetadata(region);
}

/**
 * Evaluate a financial ratio against its sector benchmark.
 *
 * For normal ratios, higher is better.
 * For inverse ratios, lower is better.
 *
 * @param {number} value
 * @param {object|null} benchmark
 * @param {boolean} [inverse=false]
 * @returns {'excellent'|'good'|'average'|'poor'|'critical'|null}
 */
export function evaluateRatio(value, benchmark, inverse = false) {
  if (benchmark == null || value == null) {
    return null;
  }

  if (inverse) {
    if (value <= benchmark.low) return 'excellent';
    if (value <= benchmark.target) return 'good';
    if (value <= benchmark.high) return 'average';
    if (value <= benchmark.high * 1.5) return 'poor';
    return 'critical';
  }

  if (value >= benchmark.high) return 'excellent';
  if (value >= benchmark.target) return 'good';
  if (value >= benchmark.low) return 'average';
  if (value >= benchmark.low * 0.5) return 'poor';
  return 'critical';
}
