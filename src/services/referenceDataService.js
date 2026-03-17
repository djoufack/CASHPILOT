import { supabase } from '@/lib/supabase';

const EMPTY_REFERENCE_DATA = Object.freeze({
  ready: false,
  loadedAt: null,
  countries: [],
  countriesByCode: {},
  currencies: [],
  currenciesByCode: {},
  taxJurisdictions: [],
  taxJurisdictionsByCode: {},
  sectorBenchmarksBySector: {},
  sectorMultiplesBySector: {},
  regionWaccByRegion: {},
});

let referenceSnapshot = { ...EMPTY_REFERENCE_DATA };
let inFlightReferenceLoad = null;

const normalizeCode = (value) =>
  String(value || '')
    .trim()
    .toUpperCase();

const sortByText = (key) => (left, right) =>
  String(left?.[key] || '').localeCompare(String(right?.[key] || ''), undefined, { sensitivity: 'base' });

const sortByNumber = (key) => (left, right) => Number(left?.[key] || 0) - Number(right?.[key] || 0);

async function selectAll(tableName, orders = []) {
  if (!supabase) {
    return [];
  }

  let query = supabase.from(tableName).select('*');
  for (const order of orders) {
    query = query.order(order.column, { ascending: order.ascending !== false });
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data || [];
}

function buildCountryState(rows) {
  const countries = [...rows]
    .map((country) => ({
      code: normalizeCode(country.code),
      label: country.label || normalizeCode(country.code),
      sort_order: Number(country.sort_order || 0),
    }))
    .sort((left, right) => {
      const orderDiff = sortByNumber('sort_order')(left, right);
      return orderDiff || sortByText('label')(left, right);
    });

  const countriesByCode = Object.fromEntries(countries.map((country) => [country.code, country]));

  return { countries, countriesByCode };
}

function buildCurrencyState(rows) {
  const currencies = [...rows]
    .map((currency) => ({
      code: normalizeCode(currency.code),
      symbol: currency.symbol || normalizeCode(currency.code),
      name: currency.name || normalizeCode(currency.code),
      region: currency.region || null,
      sort_order: Number(currency.sort_order || 0),
    }))
    .sort((left, right) => {
      const orderDiff = sortByNumber('sort_order')(left, right);
      return orderDiff || sortByText('code')(left, right);
    });

  const currenciesByCode = Object.fromEntries(currencies.map((currency) => [currency.code, currency]));

  return { currencies, currenciesByCode };
}

function buildTaxJurisdictionState(jurisdictionRows, vatRateRows) {
  const vatRatesByJurisdiction = vatRateRows.reduce((accumulator, row) => {
    const code = normalizeCode(row.jurisdiction_code);
    if (!accumulator[code]) {
      accumulator[code] = [];
    }

    accumulator[code].push({
      id: row.id,
      rate: Number(row.rate || 0),
      label: row.label || `${row.rate || 0}%`,
      default: Boolean(row.is_default),
      sort_order: Number(row.sort_order || 0),
    });
    return accumulator;
  }, {});

  for (const code of Object.keys(vatRatesByJurisdiction)) {
    vatRatesByJurisdiction[code].sort((left, right) => {
      const orderDiff = sortByNumber('sort_order')(left, right);
      return orderDiff || sortByText('label')(left, right);
    });
  }

  const taxJurisdictions = [...jurisdictionRows]
    .map((jurisdiction) => {
      const code = normalizeCode(jurisdiction.code);
      return {
        code,
        name: jurisdiction.name || code,
        currency: normalizeCode(jurisdiction.currency),
        vatRates: vatRatesByJurisdiction[code] || [],
        defaultVatRate: Number(jurisdiction.default_vat_rate || 0),
        vatLabel: jurisdiction.vat_label || 'VAT',
        vatNumberPattern: jurisdiction.vat_number_pattern || null,
        vatNumberPrefix: jurisdiction.vat_number_prefix || null,
        fiscalYear: {
          start: jurisdiction.fiscal_year_start || null,
          end: jurisdiction.fiscal_year_end || null,
        },
        exportFormats: jurisdiction.export_formats || [],
        declarationPeriods: jurisdiction.declaration_periods || [],
        invoiceRequirements: jurisdiction.invoice_requirements || {},
        isActive: jurisdiction.is_active !== false,
      };
    })
    .sort(sortByText('code'));

  const taxJurisdictionsByCode = Object.fromEntries(
    taxJurisdictions.map((jurisdiction) => [jurisdiction.code, jurisdiction])
  );

  return { taxJurisdictions, taxJurisdictionsByCode };
}

function buildSectorBenchmarksState(rows) {
  return rows.reduce((accumulator, row) => {
    const sector = row.sector || 'b2b_services';
    if (!accumulator[sector]) {
      accumulator[sector] = {};
    }

    accumulator[sector][row.metric_key] = {
      low: Number(row.low_value || 0),
      target: Number(row.target_value || 0),
      high: Number(row.high_value || 0),
    };
    return accumulator;
  }, {});
}

function buildSectorMultiplesState(rows) {
  return rows.reduce((accumulator, row) => {
    const sector = row.sector || 'b2b_services';
    if (!accumulator[sector]) {
      accumulator[sector] = {};
    }

    accumulator[sector][row.region] = {
      low: Number(row.low_value || 0),
      mid: Number(row.mid_value || 0),
      high: Number(row.high_value || 0),
    };
    return accumulator;
  }, {});
}

function buildRegionWaccState(rows) {
  return rows.reduce((accumulator, row) => {
    accumulator[row.region] = {
      riskFree: Number(row.risk_free_rate || 0) * 100,
      premium: Number(row.equity_premium || 0) * 100,
      beta: Number(row.beta || 0),
      wacc: Number(row.wacc || 0) * 100,
    };
    return accumulator;
  }, {});
}

function normalizeReferenceData(payload) {
  const {
    countries,
    currencies,
    taxJurisdictions,
    taxJurisdictionVatRates,
    sectorBenchmarks,
    sectorMultiples,
    regionWacc,
  } = payload;
  const countryState = buildCountryState(countries);
  const currencyState = buildCurrencyState(currencies);
  const taxJurisdictionState = buildTaxJurisdictionState(taxJurisdictions, taxJurisdictionVatRates);

  return {
    ready: true,
    loadedAt: new Date().toISOString(),
    ...countryState,
    ...currencyState,
    ...taxJurisdictionState,
    sectorBenchmarksBySector: buildSectorBenchmarksState(sectorBenchmarks),
    sectorMultiplesBySector: buildSectorMultiplesState(sectorMultiples),
    regionWaccByRegion: buildRegionWaccState(regionWacc),
  };
}

export function getReferenceDataSnapshot() {
  return referenceSnapshot;
}

export async function loadReferenceData({ force = false } = {}) {
  if (!force && referenceSnapshot.ready) {
    return referenceSnapshot;
  }

  if (!force && inFlightReferenceLoad) {
    return inFlightReferenceLoad;
  }

  inFlightReferenceLoad = (async () => {
    const _refResults = await Promise.allSettled([
      selectAll('reference_countries', [{ column: 'sort_order' }, { column: 'label' }]),
      selectAll('reference_currencies', [{ column: 'sort_order' }, { column: 'code' }]),
      selectAll('reference_tax_jurisdictions', [{ column: 'code' }]),
      selectAll('reference_tax_jurisdiction_vat_rates', [{ column: 'jurisdiction_code' }, { column: 'sort_order' }]),
      selectAll('reference_sector_benchmarks', [{ column: 'sector' }, { column: 'metric_key' }]),
      selectAll('reference_sector_multiples', [{ column: 'sector' }, { column: 'region' }]),
      selectAll('reference_region_wacc', [{ column: 'region' }]),
    ]);

    const _refLabels = [
      'countries',
      'currencies',
      'taxJurisdictions',
      'taxJurisdictionVatRates',
      'sectorBenchmarks',
      'sectorMultiples',
      'regionWacc',
    ];
    _refResults.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`ReferenceData fetch "${_refLabels[i]}" failed:`, r.reason);
    });

    const countries = _refResults[0].status === 'fulfilled' ? _refResults[0].value : [];
    const currencies = _refResults[1].status === 'fulfilled' ? _refResults[1].value : [];
    const taxJurisdictions = _refResults[2].status === 'fulfilled' ? _refResults[2].value : [];
    const taxJurisdictionVatRates = _refResults[3].status === 'fulfilled' ? _refResults[3].value : [];
    const sectorBenchmarks = _refResults[4].status === 'fulfilled' ? _refResults[4].value : [];
    const sectorMultiples = _refResults[5].status === 'fulfilled' ? _refResults[5].value : [];
    const regionWacc = _refResults[6].status === 'fulfilled' ? _refResults[6].value : [];

    referenceSnapshot = normalizeReferenceData({
      countries,
      currencies,
      taxJurisdictions,
      taxJurisdictionVatRates,
      sectorBenchmarks,
      sectorMultiples,
      regionWacc,
    });

    return referenceSnapshot;
  })();

  try {
    return await inFlightReferenceLoad;
  } finally {
    inFlightReferenceLoad = null;
  }
}

export function getCurrencyMetadata(currencyCode) {
  return referenceSnapshot.currenciesByCode[normalizeCode(currencyCode)] || null;
}

export function getCountryMetadata(countryCode) {
  return referenceSnapshot.countriesByCode[normalizeCode(countryCode)] || null;
}

export function getTaxJurisdictionMetadata(jurisdictionCode) {
  const normalizedCode = normalizeCode(jurisdictionCode) || 'FR';
  return (
    referenceSnapshot.taxJurisdictionsByCode[normalizedCode] || referenceSnapshot.taxJurisdictionsByCode.FR || null
  );
}

export function getSectorBenchmarksMetadata(sector) {
  return (
    referenceSnapshot.sectorBenchmarksBySector[sector] ||
    referenceSnapshot.sectorBenchmarksBySector.b2b_services ||
    null
  );
}

export function getSectorMultiplesMetadata(sector, region) {
  const sectorData =
    referenceSnapshot.sectorMultiplesBySector[sector] || referenceSnapshot.sectorMultiplesBySector.b2b_services || null;

  if (!sectorData) {
    return null;
  }

  return sectorData[region] || sectorData.france || null;
}

export function getRegionWaccMetadata(region) {
  return referenceSnapshot.regionWaccByRegion[region] || referenceSnapshot.regionWaccByRegion.france || null;
}

export async function getGlobalAccountingPlan(countryCode) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('accounting_plans')
    .select('*')
    .eq('country_code', normalizeCode(countryCode))
    .eq('is_global', true)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function getGlobalAccountingPlanAccounts(countryCode) {
  const plan = await getGlobalAccountingPlan(countryCode);
  if (!plan || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('accounting_plan_accounts')
    .select('*')
    .eq('plan_id', plan.id)
    .order('sort_order', { ascending: true })
    .order('account_code', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getAccountingMappingTemplates(countryCode) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('accounting_mapping_templates')
    .select('*')
    .eq('country_code', normalizeCode(countryCode))
    .order('source_type', { ascending: true })
    .order('source_category', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getAccountingTaxRateTemplates(countryCode) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('accounting_tax_rate_templates')
    .select('*')
    .eq('country_code', normalizeCode(countryCode))
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}
