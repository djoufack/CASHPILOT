import { createClient } from '@supabase/supabase-js';

const ISO_CURRENCY_CODE = /^[A-Z]{3}$/;

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return String(value).trim();
}

function normalizeCurrency(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return ISO_CURRENCY_CODE.test(normalized) ? normalized : null;
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const [accountingColumnRes, legacyCompanyRes, fxRatesRes] = await Promise.all([
    supabase
      .from('company')
      .select('id, user_id, company_name, currency, accounting_currency'),
    supabase
      .from('company')
      .select('id, user_id, company_name, currency', { count: 'exact' })
      .limit(5),
    supabase
      .from('fx_rates')
      .select('id', { count: 'exact', head: true }),
  ]);

  if (accountingColumnRes.error) {
    if (accountingColumnRes.error.code === '42703') {
      console.log(JSON.stringify({
        summary: {
          schemaReady: false,
          missingColumn: 'company.accounting_currency',
          companyCount: legacyCompanyRes.count ?? null,
          fxRatesTableReady: !fxRatesRes.error,
        },
        sampleCompanies: legacyCompanyRes.data || [],
        fxRatesError: fxRatesRes.error,
        message: 'Remote database is not ready for removing legacy company.currency fallbacks.',
      }, null, 2));
      process.exitCode = 1;
      return;
    }

    throw accountingColumnRes.error;
  }

  if (legacyCompanyRes.error) {
    throw legacyCompanyRes.error;
  }

  if (fxRatesRes.error) {
    throw fxRatesRes.error;
  }

  const companies = accountingColumnRes.data || [];
  const missingAccountingCurrency = [];
  const invalidAccountingCurrency = [];
  const legacyCurrencyMismatch = [];

  for (const company of companies) {
    const accountingCurrency = normalizeCurrency(company.accounting_currency);
    const legacyCurrency = normalizeCurrency(company.currency);

    if (!accountingCurrency) {
      missingAccountingCurrency.push(company);
      continue;
    }

    if (!ISO_CURRENCY_CODE.test(company.accounting_currency)) {
      invalidAccountingCurrency.push(company);
    }

    if (legacyCurrency !== accountingCurrency) {
      legacyCurrencyMismatch.push(company);
    }
  }

  const summary = {
    schemaReady: true,
    companyCount: companies.length,
    missingAccountingCurrencyCount: missingAccountingCurrency.length,
    invalidAccountingCurrencyCount: invalidAccountingCurrency.length,
    legacyCurrencyMismatchCount: legacyCurrencyMismatch.length,
    fxRatesTableReady: true,
    fxRatesCount: fxRatesRes.count ?? 0,
  };

  console.log(JSON.stringify({
    summary,
    sampleMissingAccountingCurrency: missingAccountingCurrency.slice(0, 5),
    sampleInvalidAccountingCurrency: invalidAccountingCurrency.slice(0, 5),
    sampleLegacyCurrencyMismatch: legacyCurrencyMismatch.slice(0, 5),
  }, null, 2));

  if (
    summary.missingAccountingCurrencyCount > 0 ||
    summary.invalidAccountingCurrencyCount > 0 ||
    summary.legacyCurrencyMismatchCount > 0
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
