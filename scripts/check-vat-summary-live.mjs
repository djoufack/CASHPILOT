import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const DEMO_USERS = [
  { key: 'FR', email: 'pilotage.fr.demo@cashpilot.cloud' },
  { key: 'BE', email: 'pilotage.be.demo@cashpilot.cloud' },
  { key: 'OHADA', email: 'pilotage.ohada.demo@cashpilot.cloud' },
];

function loadDotEnvFile(filepath = '.env') {
  if (!existsSync(filepath)) return;
  const text = readFileSync(filepath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return String(value).trim();
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function round2(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function parseCliArgs(argv) {
  const args = { startDate: null, endDate: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--start' && argv[i + 1]) {
      args.startDate = argv[i + 1];
      i += 1;
    } else if (token === '--end' && argv[i + 1]) {
      args.endDate = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function getCurrentMonthBounds() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${day}`,
  };
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

function sumInvoiceVat(rows) {
  return round2((rows || []).reduce((sum, row) => sum + Math.max(0, toNumber(row.total_ttc) - toNumber(row.total_ht)), 0));
}

function sumInputVat(expenses, supplierInvoices) {
  const expenseVat = (expenses || []).reduce((sum, row) => {
    const direct = toNumber(row.tax_amount);
    if (direct > 0) return sum + direct;
    const fromTtc = toNumber(row.amount) - toNumber(row.amount_ht);
    if (fromTtc > 0) return sum + fromTtc;
    const rate = toNumber(row.tax_rate);
    const normalizedRate = rate > 1 ? rate / 100 : rate;
    return sum + (normalizedRate > 0 ? (toNumber(row.amount_ht) * normalizedRate) : 0);
  }, 0);

  const supplierVat = (supplierInvoices || []).reduce((sum, row) => {
    const direct = toNumber(row.vat_amount);
    if (direct > 0) return sum + direct;
    const fromTtc = toNumber(row.total_ttc) - toNumber(row.total_ht);
    if (fromTtc > 0) return sum + fromTtc;
    const rate = toNumber(row.vat_rate);
    const normalizedRate = rate > 1 ? rate / 100 : rate;
    return sum + (normalizedRate > 0 ? (toNumber(row.total_ht) * normalizedRate) : 0);
  }, 0);

  return round2(expenseVat + supplierVat);
}

async function resolveCompany(serviceClient, userId) {
  const { data: pref, error: prefError } = await serviceClient
    .from('user_company_preferences')
    .select('active_company_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (prefError) throw prefError;

  let companyId = pref?.active_company_id || null;
  if (companyId) {
    return { companyId, companyName: null };
  }

  const { data: invoiceRow, error: invoiceError } = await serviceClient
    .from('invoices')
    .select('company_id')
    .eq('user_id', userId)
    .not('company_id', 'is', null)
    .limit(1)
    .maybeSingle();
  if (invoiceError) throw invoiceError;

  companyId = invoiceRow?.company_id || null;
  return { companyId, companyName: null };
}

async function run() {
  loadDotEnvFile('.env');
  loadDotEnvFile('.env.local');

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const cli = parseCliArgs(process.argv.slice(2));
  const monthBounds = getCurrentMonthBounds();
  const startDate = cli.startDate || monthBounds.startDate;
  const endDate = cli.endDate || monthBounds.endDate;
  const report = [];

  for (const account of DEMO_USERS) {
    const user = await getUserByEmail(serviceClient, account.email);
    if (!user) {
      report.push({
        account: account.key,
        email: account.email,
        status: 'FAIL',
        reason: 'User not found',
      });
      continue;
    }

    const { companyId, companyName } = await resolveCompany(serviceClient, user.id);
    if (!companyId) {
      report.push({
        account: account.key,
        email: account.email,
        status: 'FAIL',
        reason: 'No active/primary company',
      });
      continue;
    }

    const [invoicesRes, expensesRes, supplierRes, vatRes] = await Promise.all([
      serviceClient
        .from('invoices')
        .select('id, status, date, total_ht, total_ttc')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .gte('date', startDate)
        .lte('date', endDate)
        .not('status', 'in', '(draft,cancelled)'),
      serviceClient
        .from('expenses')
        .select('id, expense_date, amount, amount_ht, tax_amount, tax_rate')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate),
      serviceClient
        .from('supplier_invoices')
        .select('id, invoice_date, total_ht, total_ttc, vat_amount, vat_rate')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate),
      serviceClient.rpc('f_vat_summary', {
        p_user_id: user.id,
        p_company_id: companyId,
        p_start_date: startDate,
        p_end_date: endDate,
      }),
    ]);

    if (invoicesRes.error) throw invoicesRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (supplierRes.error) throw supplierRes.error;
    if (vatRes.error) throw vatRes.error;

    const invoices = invoicesRes.data || [];
    const expenses = expensesRes.data || [];
    const supplierInvoices = supplierRes.data || [];
    const vat = vatRes.data || {};

    const { data: outputEntryRows, error: outputEntryError } = await serviceClient
      .from('accounting_entries')
      .select('id, source_type, source_id, account_code, debit, credit, transaction_date')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .or('account_code.like.4431%,account_code.like.4457%,account_code.like.4510%');
    if (outputEntryError) throw outputEntryError;

    const expectedOutputVat = sumInvoiceVat(invoices);
    const expectedInputVat = sumInputVat(expenses, supplierInvoices);
    const rpcOutputVat = round2(vat.outputVAT);
    const rpcInputVat = round2(vat.inputVAT);
    const rpcPayable = round2(vat.vatPayable);
    const outputDelta = round2(rpcOutputVat - expectedOutputVat);
    const vatEntryRows = outputEntryRows || [];
    const vatInvoiceEntryRows = vatEntryRows.filter((row) => row.source_type === 'invoice');
    const vatOtherEntryRows = vatEntryRows.filter((row) => row.source_type !== 'invoice');
    const uniqueInvoiceSources = new Set(vatInvoiceEntryRows.map((row) => row.source_id).filter(Boolean)).size;
    const otherSourceTypes = [...new Set(vatOtherEntryRows.map((row) => row.source_type || 'unknown'))];
    const otherSourcesVat = round2(vatOtherEntryRows.reduce((sum, row) => sum + (toNumber(row.credit) - toNumber(row.debit)), 0));

    const outputNonZeroExpected = expectedOutputVat > 0;
    const outputNonZeroActual = rpcOutputVat > 0;
    const pass = !outputNonZeroExpected || outputNonZeroActual;

    report.push({
      account: account.key,
      email: account.email,
      company: companyName || companyId,
      invoices: invoices.length,
      expectedOutputVat,
      expectedInputVat,
      rpcOutputVat,
      rpcInputVat,
      rpcPayable,
      outputDelta,
      vatEntryRows: vatEntryRows.length,
      vatInvoiceEntryRows: vatInvoiceEntryRows.length,
      vatInvoiceSources: uniqueInvoiceSources,
      vatOtherEntryRows: vatOtherEntryRows.length,
      vatOtherSourceTypes: otherSourceTypes.join(',') || '-',
      vatOtherSourcesVat: otherSourcesVat,
      status: pass ? 'PASS' : 'FAIL',
      reason: pass ? '' : 'Output VAT still zero while invoices carry VAT',
    });
  }

  const failures = report.filter((row) => row.status === 'FAIL');
  console.log(`VAT check period: ${startDate} -> ${endDate}`);
  console.table(report);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('VAT live check failed:', error.message || error);
  process.exitCode = 1;
});
