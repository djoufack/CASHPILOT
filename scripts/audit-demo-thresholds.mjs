#!/usr/bin/env node

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_EMAILS = [
  'pilotage.fr.demo@cashpilot.cloud',
  'pilotage.be.demo@cashpilot.cloud',
  'pilotage.ohada.demo@cashpilot.cloud',
];

const DEFAULT_TABLES = [
  'accounting_chart_of_accounts',
  'clients',
  'invoices',
  'payments',
  'expenses',
  'products',
  'services',
  'suppliers',
  'quotes',
  'projects',
  'purchase_orders',
  'recurring_invoices',
  'supplier_orders',
  'supplier_invoices',
  'payment_reminder_rules',
  'payment_reminder_logs',
  'timesheets',
  'credit_notes',
  'delivery_notes',
  'receivables',
  'payables',
  'debt_payments',
  'product_categories',
  'service_categories',
  'supplier_product_categories',
  'supplier_products',
  'supplier_services',
  'accounting_fixed_assets',
  'financial_scenarios',
  'bank_connections',
  'bank_transactions',
  'peppol_transmission_log',
  'dashboard_snapshots',
];

function parseArguments(argv) {
  const options = {
    min: 7,
    emails: [...DEFAULT_EMAILS],
    tables: [...DEFAULT_TABLES],
    json: false,
  };

  for (const arg of argv) {
    if (arg === '--json') {
      options.json = true;
    } else if (arg.startsWith('--min=')) {
      const value = Number(arg.split('=', 2)[1]);
      if (Number.isFinite(value) && value > 0) {
        options.min = Math.floor(value);
      }
    } else if (arg.startsWith('--emails=')) {
      options.emails = arg
        .split('=', 2)[1]
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
    } else if (arg.startsWith('--tables=')) {
      options.tables = arg
        .split('=', 2)[1]
        .split(',')
        .map((table) => table.trim())
        .filter(Boolean);
    }
  }

  return options;
}

function ensureEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function fetchUsersByEmail(client, emails) {
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    throw new Error(`Unable to list auth users: ${error.message}`);
  }

  const users = data?.users || [];
  return Object.fromEntries(
    emails.map((email) => [
      email,
      users.find((user) => String(user.email || '').toLowerCase() === email.toLowerCase()) || null,
    ])
  );
}

async function countByCompany(client, table, companyIds) {
  const { data, error } = await client.from(table).select('company_id').in('company_id', companyIds);
  if (error) {
    return { error: error.message, counts: {} };
  }

  const counts = Object.fromEntries(companyIds.map((id) => [id, 0]));
  for (const row of data || []) {
    if (row.company_id in counts) {
      counts[row.company_id] += 1;
    }
  }

  return { error: null, counts };
}

function printHumanReport(report, minThreshold) {
  console.log(`Audit threshold >= ${minThreshold} enregistrements par table/societe`);

  for (const account of report.accounts) {
    if (!account.found) {
      console.log(`- ${account.email}: MISSING USER`);
      continue;
    }

    if (!account.companies.length) {
      console.log(`- ${account.email}: NO COMPANIES`);
      continue;
    }

    if (!account.deficits.length && !account.tableErrors.length) {
      console.log(`- ${account.email}: OK`);
      continue;
    }

    console.log(
      `- ${account.email}: ${account.deficits.length} deficit(s), ${account.tableErrors.length} table error(s)`
    );

    for (const tableError of account.tableErrors) {
      console.log(`  table error -> ${tableError.table}: ${tableError.error}`);
    }

    for (const deficit of account.deficits) {
      console.log(
        `  deficit -> ${deficit.table} | ${deficit.company_name} (${deficit.company_id}) = ${deficit.count}`
      );
    }
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const supabaseUrl = ensureEnv('SUPABASE_URL');
  const serviceRoleKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const usersByEmail = await fetchUsersByEmail(client, options.emails);
  const accounts = [];

  for (const email of options.emails) {
    const user = usersByEmail[email];
    if (!user) {
      accounts.push({
        email,
        found: false,
        user_id: null,
        companies: [],
        deficits: [],
        tableErrors: [],
      });
      continue;
    }

    const companiesResponse = await client
      .from('company')
      .select('id,company_name')
      .eq('user_id', user.id)
      .order('company_name', { ascending: true });

    if (companiesResponse.error) {
      throw new Error(`Unable to list companies for ${email}: ${companiesResponse.error.message}`);
    }

    const companies = companiesResponse.data || [];
    const companyIds = companies.map((company) => company.id);
    const companyNameById = new Map(companies.map((company) => [company.id, company.company_name]));
    const deficits = [];
    const tableErrors = [];

    if (companyIds.length > 0) {
      for (const table of options.tables) {
        const result = await countByCompany(client, table, companyIds);
        if (result.error) {
          tableErrors.push({ table, error: result.error });
          continue;
        }

        for (const [companyId, count] of Object.entries(result.counts)) {
          if (Number(count) < options.min) {
            deficits.push({
              table,
              company_id: companyId,
              company_name: companyNameById.get(companyId) || companyId,
              count: Number(count),
            });
          }
        }
      }
    }

    accounts.push({
      email,
      found: true,
      user_id: user.id,
      companies,
      deficits,
      tableErrors,
    });
  }

  const hasFailures = accounts.some(
    (account) =>
      !account.found ||
      account.companies.length === 0 ||
      account.deficits.length > 0 ||
      account.tableErrors.length > 0
  );

  const payload = {
    min: options.min,
    emails: options.emails,
    tables: options.tables,
    hasFailures,
    accounts,
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printHumanReport(payload, options.min);
  }

  if (hasFailures) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
