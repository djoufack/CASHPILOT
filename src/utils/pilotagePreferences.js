const DEFAULT_REGION = 'france';
export const DEFAULT_PILOTAGE_SECTOR = 'b2b_services';

const OHADA_COUNTRY_CODES = new Set([
  'BJ',
  'BF',
  'CM',
  'CF',
  'TD',
  'KM',
  'CG',
  'CI',
  'CD',
  'GA',
  'GN',
  'GQ',
  'GW',
  'ML',
  'NE',
  'SN',
  'TG',
]);

const REGION_ALIASES = new Map([
  ['FR', 'france'],
  ['FRA', 'france'],
  ['FRANCE', 'france'],
  ['BE', 'belgium'],
  ['BEL', 'belgium'],
  ['BELGIUM', 'belgium'],
  ['BELGIQUE', 'belgium'],
  ['OHADA', 'ohada'],
]);

export function normalizePilotageRegion(value, fallback = DEFAULT_REGION) {
  if (!value) {
    return fallback;
  }

  const normalized = String(value).trim().toUpperCase();

  if (REGION_ALIASES.has(normalized)) {
    return REGION_ALIASES.get(normalized);
  }

  if (OHADA_COUNTRY_CODES.has(normalized)) {
    return 'ohada';
  }

  return fallback;
}

export function resolvePilotageRegion({
  accountingCountry = null,
  companyCountry = null,
  fallback = DEFAULT_REGION,
} = {}) {
  if (accountingCountry) {
    return {
      region: normalizePilotageRegion(accountingCountry, fallback),
      source: 'accounting-settings',
    };
  }

  if (companyCountry) {
    return {
      region: normalizePilotageRegion(companyCountry, fallback),
      source: 'company',
    };
  }

  return {
    region: normalizePilotageRegion(fallback, DEFAULT_REGION),
    source: 'fallback',
  };
}

export function normalizePilotageSector(value) {
  const normalized = String(value || '').trim();
  return normalized || DEFAULT_PILOTAGE_SECTOR;
}
