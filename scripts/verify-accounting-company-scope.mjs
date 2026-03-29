import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { evaluateAccountingDatasetQuality } from '../src/utils/accountingQualityChecks.js';

const DEMO_ACCOUNTS = [
  {
    key: 'FR',
    email: process.env.PILOTAGE_FR_EMAIL || 'pilotage.fr.demo@cashpilot.cloud',
    passwordEnv: 'PILOTAGE_FR_PASSWORD'
  },
  {
    key: 'BE',
    email: process.env.PILOTAGE_BE_EMAIL || 'pilotage.be.demo@cashpilot.cloud',
    passwordEnv: 'PILOTAGE_BE_PASSWORD'
  },
  {
    key: 'OHADA',
    email: process.env.PILOTAGE_OHADA_EMAIL || 'pilotage.ohada.demo@cashpilot.cloud',
    passwordEnv: 'PILOTAGE_OHADA_PASSWORD'
  },
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return String(value).trim();
}

function optionalEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getUserByEmail(serviceClient, email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = (data?.users || []).find((entry) => String(entry.email || '').toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (!data?.users?.length) break;
    page += 1;
  }
  return null;
}

async function expectRows(label, query, options = {}) {
  const { paginate = false, pageSize = 1000 } = options;
  if (!paginate) {
    const { data, error } = await query;
    if (error) {
      throw new Error(`${label}: ${error.message}`);
    }
    return data || [];
  }

  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) {
      throw new Error(`${label}: ${error.message}`);
    }
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  return rows;
}

async function expectCount(label, query) {
  const { count, error } = await query;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  return count ?? 0;
}

function flattenChecks(categories = {}) {
  return Object.values(categories).flatMap((category) => category?.checks || []);
}

function summarizeCompanyResult(result) {
  return {
    companyId: result.companyId,
    companyName: result.companyName,
    period: result.period,
    accountCount: result.accountCount,
    mappingCount: result.mappingCount,
    bankStatementCount: result.bankStatementCount,
    entryCount: result.entryCount,
    invoiceCount: result.invoiceCount,
    expenseCount: result.expenseCount,
    bankTransactionCount: result.bankTransactionCount,
    categoryCoverage: result.categoryCoverage,
    auditScore: result.auditScore,
    grade: result.grade,
    ok: result.ok,
    failures: result.failures,
  };
}

async function run() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = optionalEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!anonKey) {
    throw new Error('Missing SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY');
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const nullChartCompanyCount = await expectCount(
    'chart rows without company_id',
    serviceClient.from('accounting_chart_of_accounts').select('*', { count: 'exact', head: true }).is('company_id', null),
  );
  const nullMappingsCompanyCount = await expectCount(
    'accounting mappings rows without company_id',
    serviceClient.from('accounting_mappings').select('*', { count: 'exact', head: true }).is('company_id', null),
  );
  const nullBankStatementsCompanyCount = await expectCount(
    'bank statements rows without company_id',
    serviceClient.from('bank_statements').select('*', { count: 'exact', head: true }).is('company_id', null),
  );

  const accountResults = [];

  for (const account of DEMO_ACCOUNTS) {
    const password = requireEnv(account.passwordEnv);
    const user = await getUserByEmail(serviceClient, account.email);
    if (!user) {
      accountResults.push({
        key: account.key,
        email: account.email,
        ok: false,
        companies: [],
        failures: [`Missing demo user: ${account.email}`],
      });
      continue;
    }

    const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email: account.email,
      password,
    });

    if (authError || !authData?.session?.access_token) {
      accountResults.push({
        key: account.key,
        email: account.email,
        ok: false,
        companies: [],
        failures: [`Auth failed for ${account.email}: ${authError?.message || 'unknown error'}`],
      });
      continue;
    }

    const accessToken = authData.session.access_token;
    const companies = await expectRows(
      `company rows for ${account.email}`,
      serviceClient
        .from('company')
        .select('id, company_name, country, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    );

    const companyResults = [];

    for (const company of companies) {
      const [accounts, entries, firstEntryRows, lastEntryRows, mappingCount, bankStatementCount] = await Promise.all([
        expectRows(
          `accounts for ${company.company_name}`,
          serviceClient
            .from('accounting_chart_of_accounts')
            .select('account_code, account_name, account_type, account_category')
            .eq('user_id', user.id)
            .eq('company_id', company.id)
            .order('account_code', { ascending: true }),
          { paginate: true },
        ),
        expectRows(
          `entries for ${company.company_name}`,
          serviceClient
            .from('accounting_entries')
            .select('entry_ref, transaction_date, source_type, source_id, journal, debit, credit, account_code')
            .eq('user_id', user.id)
            .eq('company_id', company.id)
            .order('transaction_date', { ascending: true }),
          { paginate: true },
        ),
        expectRows(
          `first entry date for ${company.company_name}`,
          serviceClient
            .from('accounting_entries')
            .select('transaction_date')
            .eq('user_id', user.id)
            .eq('company_id', company.id)
            .order('transaction_date', { ascending: true })
            .limit(1),
        ),
        expectRows(
          `last entry date for ${company.company_name}`,
          serviceClient
            .from('accounting_entries')
            .select('transaction_date')
            .eq('user_id', user.id)
            .eq('company_id', company.id)
            .order('transaction_date', { ascending: false })
            .limit(1),
        ),
        expectCount(
          `mapping count for ${company.company_name}`,
          serviceClient
            .from('accounting_mappings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('company_id', company.id),
        ),
        expectCount(
          `bank statement count for ${company.company_name}`,
          serviceClient
            .from('bank_statements')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('company_id', company.id),
        ),
      ]);

      const firstEntryDate = firstEntryRows[0]?.transaction_date || null;
      const lastEntryDate = lastEntryRows[0]?.transaction_date || null;
      const failures = [];

      if (!firstEntryDate || !lastEntryDate) {
        failures.push('No accounting entries found for company');
      }

      const uniqueAccountCodes = new Set(accounts.map((row) => row.account_code)).size === accounts.length;
      if (!uniqueAccountCodes) {
        failures.push('Duplicate account codes within company chart');
      }

      const datasetQuality = evaluateAccountingDatasetQuality({ accounts, entries });
      const categoryCoverage = Number(datasetQuality?.chartSummary?.categoryCoverage || 0);
      if (!datasetQuality.canRunPilotage) {
        failures.push(`Quality gate blocked (${datasetQuality.reliabilityStatus || 'unknown'})`);
      }
      if (Math.abs(categoryCoverage - 1) > 0.000001) {
        failures.push(`Account category coverage is ${categoryCoverage}`);
      }

      let invoiceCount = 0;
      let expenseCount = 0;
      let bankTransactionCount = 0;
      let auditScore = null;
      let grade = null;

      if (firstEntryDate && lastEntryDate) {
        [invoiceCount, expenseCount, bankTransactionCount] = await Promise.all([
          expectCount(
            `invoice count for ${company.company_name}`,
            serviceClient
              .from('invoices')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('company_id', company.id)
              .gte('date', firstEntryDate)
              .lte('date', lastEntryDate),
          ),
          expectCount(
            `expense count for ${company.company_name}`,
            serviceClient
              .from('expenses')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('company_id', company.id)
              .gte('expense_date', firstEntryDate)
              .lte('expense_date', lastEntryDate),
          ),
          expectCount(
            `bank transaction count for ${company.company_name}`,
            serviceClient
              .from('bank_transactions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('company_id', company.id)
              .gte('date', firstEntryDate)
              .lte('date', lastEntryDate),
          ),
        ]);

        let auditResponse = null;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          auditResponse = await fetch(`${supabaseUrl}/functions/v1/audit-comptable`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              apikey: anonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              company_id: company.id,
              period_start: firstEntryDate,
              period_end: lastEntryDate,
            }),
          });

          if (auditResponse.ok || auditResponse.status < 500 || attempt === 3) {
            break;
          }
          await sleep(500 * attempt);
        }

        if (!auditResponse?.ok) {
          failures.push(`audit-comptable HTTP ${auditResponse?.status ?? 'unknown'}`);
        } else {
          const audit = await auditResponse.json();
          const checks = flattenChecks(audit.categories);
          const balanceCheck = checks.find((check) => check.id === 'balance_debit_credit');
          const chartCheck = checks.find((check) => check.id === 'chart_coherence');

          auditScore = audit.score ?? null;
          grade = audit.grade ?? null;

          if (balanceCheck?.status !== 'pass') {
            failures.push(`balance_debit_credit=${balanceCheck?.status || 'missing'}`);
          }
          if (chartCheck?.status !== 'pass') {
            failures.push(`chart_coherence=${chartCheck?.status || 'missing'}`);
          }

          const auditSummary = audit.data_summary || {};
          if (auditSummary.entries_count !== entries.length) {
            failures.push(`entries_count mismatch (${auditSummary.entries_count} != ${entries.length})`);
          }
          if (auditSummary.accounts_count !== accounts.length) {
            failures.push(`accounts_count mismatch (${auditSummary.accounts_count} != ${accounts.length})`);
          }
          if (auditSummary.invoices_count !== invoiceCount) {
            failures.push(`invoices_count mismatch (${auditSummary.invoices_count} != ${invoiceCount})`);
          }
          if (auditSummary.expenses_count !== expenseCount) {
            failures.push(`expenses_count mismatch (${auditSummary.expenses_count} != ${expenseCount})`);
          }
          if (auditSummary.bank_transactions_count !== bankTransactionCount) {
            failures.push(`bank_transactions_count mismatch (${auditSummary.bank_transactions_count} != ${bankTransactionCount})`);
          }
        }
      }

      companyResults.push({
        companyId: company.id,
        companyName: company.company_name,
        country: company.country,
        period: { start: firstEntryDate, end: lastEntryDate },
        accountCount: accounts.length,
        mappingCount,
        bankStatementCount,
        entryCount: entries.length,
        invoiceCount,
        expenseCount,
        bankTransactionCount,
        categoryCoverage,
        auditScore,
        grade,
        ok: failures.length === 0,
        failures,
      });
    }

    accountResults.push({
      key: account.key,
      email: account.email,
      ok: companyResults.every((company) => company.ok),
      companies: companyResults.map(summarizeCompanyResult),
      failures: companyResults.flatMap((company) => company.failures.map((failure) => `${company.companyName}: ${failure}`)),
    });

    await anonClient.auth.signOut();
  }

  const companyResults = accountResults.flatMap((account) => account.companies);
  const failedAccounts = accountResults.filter((account) => !account.ok);
  const failedCompanies = companyResults.filter((company) => !company.ok);

  const result = {
    generatedAt: new Date().toISOString(),
    chartRowsMissingCompanyScope: nullChartCompanyCount,
    mappingRowsMissingCompanyScope: nullMappingsCompanyCount,
    bankStatementRowsMissingCompanyScope: nullBankStatementsCompanyCount,
    accounts: accountResults,
    totals: {
      passedAccounts: accountResults.length - failedAccounts.length,
      failedAccounts: failedAccounts.length,
      totalAccounts: accountResults.length,
      passedCompanies: companyResults.length - failedCompanies.length,
      failedCompanies: failedCompanies.length,
      totalCompanies: companyResults.length,
    },
    failures: failedAccounts.flatMap((account) => account.failures.map((failure) => `${account.key}: ${failure}`)),
  };

  console.log(JSON.stringify(result, null, 2));

  if (
    nullChartCompanyCount !== 0 ||
    nullMappingsCompanyCount !== 0 ||
    nullBankStatementsCompanyCount !== 0 ||
    failedAccounts.length > 0
  ) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('[verify-accounting-company-scope] fatal:', error?.message || error);
  process.exitCode = 1;
});

