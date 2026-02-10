import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ─── CORS ────────────────────────────────────────────────────────────────────
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, mcp-session-id, authorization, apikey',
  'Access-Control-Expose-Headers': 'mcp-session-id',
};

// ─── Utilities ───────────────────────────────────────────────────────────────
function escapeXml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
}
function fmtAmt(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return '0.00';
  return Number(n).toFixed(2);
}
function round2(n: number): number { return Math.round(n * 100) / 100; }
function pf(v: unknown): number { return parseFloat(String(v || '0')); }

type SB = ReturnType<typeof createClient>;

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ─── JSON-RPC helpers ────────────────────────────────────────────────────────
function rpcOk(id: unknown, result: unknown) { return { jsonrpc: '2.0', result, id }; }
function rpcErr(id: unknown, code: number, message: string) { return { jsonrpc: '2.0', error: { code, message }, id }; }

// ─── Tool definitions ────────────────────────────────────────────────────────
const TOOLS = [
  // ── Invoices ──
  {
    name: 'list_invoices',
    description: 'List invoices with optional filters by status, client, and limit.',
    inputSchema: { type: 'object', properties: {
      status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'], description: 'Filter by status' },
      client_id: { type: 'string', description: 'Filter by client ID' },
      limit: { type: 'number', description: 'Max results (default 50)' },
    }},
  },
  {
    name: 'get_invoice',
    description: 'Get full invoice details including items, payments, and client info.',
    inputSchema: { type: 'object', properties: { invoice_id: { type: 'string', description: 'Invoice ID' } }, required: ['invoice_id'] },
  },
  {
    name: 'create_invoice',
    description: 'Create a new invoice.',
    inputSchema: { type: 'object', properties: {
      invoice_number: { type: 'string' }, client_id: { type: 'string' },
      date: { type: 'string', description: 'YYYY-MM-DD' }, due_date: { type: 'string', description: 'YYYY-MM-DD' },
      total_ht: { type: 'number' }, tax_rate: { type: 'number', description: 'Default 20' }, total_ttc: { type: 'number' },
      status: { type: 'string', enum: ['draft', 'sent'], description: 'Default draft' }, notes: { type: 'string' },
    }, required: ['invoice_number', 'client_id', 'date', 'due_date', 'total_ht', 'total_ttc'] },
  },
  {
    name: 'update_invoice_status',
    description: 'Update the status of an invoice.',
    inputSchema: { type: 'object', properties: {
      invoice_id: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'] },
    }, required: ['invoice_id', 'status'] },
  },
  {
    name: 'search_invoices',
    description: 'Search invoices by text (number, notes, reference).',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'get_invoice_stats',
    description: 'Get invoice statistics: totals billed, paid, unpaid, overdue.',
    inputSchema: { type: 'object', properties: { months: { type: 'number', description: 'Period in months (default 12)' } } },
  },

  // ── Clients ──
  {
    name: 'list_clients',
    description: 'List all clients with optional search by name/email.',
    inputSchema: { type: 'object', properties: {
      search: { type: 'string', description: 'Search in company_name, contact_name, email' },
      limit: { type: 'number', description: 'Max results (default 50)' },
    }},
  },
  {
    name: 'get_client',
    description: 'Get client details with their 10 most recent invoices.',
    inputSchema: { type: 'object', properties: { client_id: { type: 'string' } }, required: ['client_id'] },
  },
  {
    name: 'create_client',
    description: 'Create a new client.',
    inputSchema: { type: 'object', properties: {
      company_name: { type: 'string' }, contact_name: { type: 'string' }, email: { type: 'string' },
      address: { type: 'string' }, city: { type: 'string' }, postal_code: { type: 'string' },
      country: { type: 'string' }, phone: { type: 'string' }, vat_number: { type: 'string' }, notes: { type: 'string' },
    }, required: ['company_name'] },
  },
  {
    name: 'get_client_balance',
    description: 'Get client balance: total invoiced, paid, outstanding, overdue.',
    inputSchema: { type: 'object', properties: { client_id: { type: 'string' } }, required: ['client_id'] },
  },

  // ── Payments ──
  {
    name: 'list_payments',
    description: 'List payments with optional filters by invoice or client.',
    inputSchema: { type: 'object', properties: {
      invoice_id: { type: 'string' }, client_id: { type: 'string' }, limit: { type: 'number', description: 'Default 50' },
    }},
  },
  {
    name: 'create_payment',
    description: 'Record a payment for an invoice. Auto-updates invoice payment status.',
    inputSchema: { type: 'object', properties: {
      invoice_id: { type: 'string' }, amount: { type: 'number' },
      payment_method: { type: 'string', description: 'Default bank_transfer' },
      payment_date: { type: 'string', description: 'YYYY-MM-DD, default today' },
      reference: { type: 'string' }, notes: { type: 'string' },
    }, required: ['invoice_id', 'amount'] },
  },
  {
    name: 'get_unpaid_invoices',
    description: 'List all unpaid/partial invoices, optionally filtered by days overdue.',
    inputSchema: { type: 'object', properties: { days_overdue: { type: 'number', description: 'Only show invoices overdue by N+ days' } } },
  },
  {
    name: 'get_receivables_summary',
    description: 'Get accounts receivable summary: total owed, collected, pending, overdue.',
    inputSchema: { type: 'object', properties: {} },
  },

  // ── Accounting ──
  {
    name: 'get_chart_of_accounts',
    description: 'Get chart of accounts, optionally filtered by category.',
    inputSchema: { type: 'object', properties: {
      category: { type: 'string', enum: ['asset', 'liability', 'equity', 'revenue', 'expense'] },
    }},
  },
  {
    name: 'get_accounting_entries',
    description: 'Get journal entries with optional date range and account filters.',
    inputSchema: { type: 'object', properties: {
      start_date: { type: 'string', description: 'YYYY-MM-DD' }, end_date: { type: 'string', description: 'YYYY-MM-DD' },
      account_code: { type: 'string' }, limit: { type: 'number', description: 'Default 100' },
    }},
  },
  {
    name: 'get_trial_balance',
    description: 'Get trial balance: sum of debits and credits per account.',
    inputSchema: { type: 'object', properties: { date: { type: 'string', description: 'Cutoff date YYYY-MM-DD (default today)' } } },
  },
  {
    name: 'get_tax_summary',
    description: 'Get VAT/tax summary: output VAT vs input VAT for a period.',
    inputSchema: { type: 'object', properties: {
      start_date: { type: 'string', description: 'YYYY-MM-DD' }, end_date: { type: 'string', description: 'YYYY-MM-DD' },
    }, required: ['start_date', 'end_date'] },
  },
  {
    name: 'init_accounting',
    description: 'Initialize accounting for a country (FR, BE, or OHADA).',
    inputSchema: { type: 'object', properties: {
      country: { type: 'string', enum: ['FR', 'BE', 'OHADA'] },
    }, required: ['country'] },
  },

  // ── Analytics ──
  {
    name: 'get_cash_flow',
    description: 'Get monthly cash flow data: income, expenses, net balance.',
    inputSchema: { type: 'object', properties: { months: { type: 'number', description: 'Number of months (default 6)' } } },
  },
  {
    name: 'get_dashboard_kpis',
    description: 'Get KPIs: revenue this month, pending invoices, expenses, margin.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_top_clients',
    description: 'Get top clients ranked by total revenue.',
    inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Number of clients (default 10)' } } },
  },

  // ── Exports ──
  {
    name: 'export_fec',
    description: 'Generate FEC (Fichier des Ecritures Comptables) for French tax compliance.',
    inputSchema: { type: 'object', properties: {
      start_date: { type: 'string', description: 'YYYY-MM-DD' }, end_date: { type: 'string', description: 'YYYY-MM-DD' },
    }, required: ['start_date', 'end_date'] },
  },
  {
    name: 'export_saft',
    description: 'Generate SAF-T XML (Standard Audit File for Tax).',
    inputSchema: { type: 'object', properties: {
      start_date: { type: 'string', description: 'YYYY-MM-DD' }, end_date: { type: 'string', description: 'YYYY-MM-DD' },
    }, required: ['start_date', 'end_date'] },
  },
  {
    name: 'export_facturx',
    description: 'Generate Factur-X (CII) XML for an invoice.',
    inputSchema: { type: 'object', properties: {
      invoice_id: { type: 'string' },
      profile: { type: 'string', enum: ['MINIMUM', 'BASIC', 'EN16931'], description: 'Default BASIC' },
    }, required: ['invoice_id'] },
  },
  {
    name: 'backup_all_data',
    description: 'Export all user data as a JSON backup.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ─── Scope requirements ──────────────────────────────────────────────────────
const WRITE_TOOLS = new Set(['create_client', 'create_invoice', 'create_payment', 'update_invoice_status', 'init_accounting']);

// ─── Tool Handlers ───────────────────────────────────────────────────────────
type Handler = (sb: SB, uid: string, a: Record<string, unknown>) => Promise<string>;

// -- Invoices --

const hListInvoices: Handler = async (sb, uid, a) => {
  let q = sb.from('invoices')
    .select('*, client:clients(id, company_name), items:invoice_items(*)')
    .eq('user_id', uid);
  if (a.status) q = q.eq('status', a.status);
  if (a.client_id) q = q.eq('client_id', a.client_id);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(Number(a.limit) || 50);
  if (error) throw new Error(error.message);
  return JSON.stringify({ invoices: data, count: data?.length ?? 0 }, null, 2);
};

const hGetInvoice: Handler = async (sb, uid, a) => {
  const { data, error } = await sb.from('invoices')
    .select('*, client:clients(*), items:invoice_items(*), payments(id, amount, payment_date, payment_method, receipt_number)')
    .eq('id', a.invoice_id).eq('user_id', uid).single();
  if (error) throw new Error(error.message);
  return JSON.stringify(data, null, 2);
};

const hCreateInvoice: Handler = async (sb, uid, a) => {
  const { data, error } = await sb.from('invoices').insert({
    user_id: uid, invoice_number: a.invoice_number, client_id: a.client_id,
    date: a.date, due_date: a.due_date, total_ht: a.total_ht,
    tax_rate: a.tax_rate ?? 20, total_ttc: a.total_ttc,
    status: a.status ?? 'draft', notes: a.notes ?? null,
  }).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, invoice: data }, null, 2);
};

const hUpdateInvoiceStatus: Handler = async (sb, uid, a) => {
  const { data, error } = await sb.from('invoices')
    .update({ status: a.status })
    .eq('id', a.invoice_id).eq('user_id', uid).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ updated: true, invoice: data }, null, 2);
};

const hSearchInvoices: Handler = async (sb, uid, a) => {
  const q = `%${a.query}%`;
  const { data, error } = await sb.from('invoices')
    .select('*, client:clients(id, company_name)')
    .eq('user_id', uid)
    .or(`invoice_number.ilike.${q},notes.ilike.${q},reference.ilike.${q}`)
    .order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  return JSON.stringify({ invoices: data, count: data?.length ?? 0 }, null, 2);
};

const hGetInvoiceStats: Handler = async (sb, uid, a) => {
  const months = Number(a.months) || 12;
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  const startStr = start.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await sb.from('invoices').select('total_ttc, total_ht, status, payment_status, due_date')
    .eq('user_id', uid).gte('date', startStr);
  if (error) throw new Error(error.message);

  let totalBilled = 0, totalPaid = 0, totalUnpaid = 0, overdue = 0;
  let countDraft = 0, countSent = 0, countPaid = 0;
  for (const inv of data ?? []) {
    const ttc = pf(inv.total_ttc);
    totalBilled += ttc;
    if (inv.status === 'paid' || inv.payment_status === 'paid') { totalPaid += ttc; countPaid++; }
    else if (inv.payment_status === 'unpaid' || inv.payment_status === 'partial') {
      totalUnpaid += ttc;
      if (inv.due_date && inv.due_date < today) overdue++;
    }
    if (inv.status === 'draft') countDraft++;
    if (inv.status === 'sent') countSent++;
  }

  return JSON.stringify({
    period_months: months,
    total_billed: round2(totalBilled), total_paid: round2(totalPaid), total_unpaid: round2(totalUnpaid),
    overdue_count: overdue, count: { draft: countDraft, sent: countSent, paid: countPaid, total: data?.length ?? 0 },
  }, null, 2);
};

// -- Clients --

const hListClients: Handler = async (sb, uid, a) => {
  let q = sb.from('clients').select('*').eq('user_id', uid);
  if (a.search) {
    const s = `%${a.search}%`;
    q = q.or(`company_name.ilike.${s},contact_name.ilike.${s},email.ilike.${s}`);
  }
  const { data, error } = await q.order('company_name').limit(Number(a.limit) || 50);
  if (error) throw new Error(error.message);
  return JSON.stringify({ clients: data, count: data?.length ?? 0 }, null, 2);
};

const hGetClient: Handler = async (sb, uid, a) => {
  const [clientRes, invoicesRes] = await Promise.all([
    sb.from('clients').select('*').eq('id', a.client_id).eq('user_id', uid).single(),
    sb.from('invoices').select('id, invoice_number, date, due_date, total_ttc, status, payment_status')
      .eq('client_id', a.client_id).eq('user_id', uid).order('date', { ascending: false }).limit(10),
  ]);
  if (clientRes.error) throw new Error(clientRes.error.message);
  return JSON.stringify({ client: clientRes.data, recent_invoices: invoicesRes.data ?? [] }, null, 2);
};

const hCreateClient: Handler = async (sb, uid, a) => {
  const { data, error } = await sb.from('clients').insert({
    user_id: uid, company_name: a.company_name, contact_name: a.contact_name ?? null,
    email: a.email ?? null, address: a.address ?? null, city: a.city ?? null,
    postal_code: a.postal_code ?? null, country: a.country ?? null,
    phone: a.phone ?? null, vat_number: a.vat_number ?? null, notes: a.notes ?? null,
  }).select().single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ created: true, client: data }, null, 2);
};

const hGetClientBalance: Handler = async (sb, uid, a) => {
  const [invRes, payRes] = await Promise.all([
    sb.from('invoices').select('total_ttc, due_date, payment_status')
      .eq('client_id', a.client_id).eq('user_id', uid),
    sb.from('payments').select('amount')
      .eq('client_id', a.client_id).eq('user_id', uid),
  ]);
  if (invRes.error) throw new Error(invRes.error.message);

  const today = new Date().toISOString().split('T')[0];
  let totalInvoiced = 0, totalOverdue = 0;
  for (const i of invRes.data ?? []) {
    totalInvoiced += pf(i.total_ttc);
    if (i.due_date && i.due_date < today && i.payment_status !== 'paid') totalOverdue += pf(i.total_ttc);
  }
  const totalPaid = (payRes.data ?? []).reduce((s: number, p: { amount: unknown }) => s + pf(p.amount), 0);

  return JSON.stringify({
    total_invoiced: round2(totalInvoiced), total_paid: round2(totalPaid),
    outstanding: round2(totalInvoiced - totalPaid), overdue: round2(totalOverdue),
  }, null, 2);
};

// -- Payments --

const hListPayments: Handler = async (sb, uid, a) => {
  let q = sb.from('payments')
    .select('*, invoice:invoices(id, invoice_number, total_ttc), client:clients(id, company_name)')
    .eq('user_id', uid);
  if (a.invoice_id) q = q.eq('invoice_id', a.invoice_id);
  if (a.client_id) q = q.eq('client_id', a.client_id);
  const { data, error } = await q.order('payment_date', { ascending: false }).limit(Number(a.limit) || 50);
  if (error) throw new Error(error.message);
  return JSON.stringify({ payments: data, count: data?.length ?? 0 }, null, 2);
};

const hCreatePayment: Handler = async (sb, uid, a) => {
  const { data: inv, error: invErr } = await sb.from('invoices')
    .select('client_id, total_ttc').eq('id', a.invoice_id).eq('user_id', uid).single();
  if (invErr || !inv) throw new Error(`Invoice not found: ${invErr?.message || 'unknown'}`);

  const date = (a.payment_date as string) ?? new Date().toISOString().split('T')[0];
  const receipt = `REC-${Date.now()}`;

  const { data: payment, error } = await sb.from('payments').insert([{
    user_id: uid, invoice_id: a.invoice_id, client_id: inv.client_id,
    amount: a.amount, payment_method: a.payment_method ?? 'bank_transfer',
    payment_date: date, reference: a.reference ?? null, notes: a.notes ?? null,
    receipt_number: receipt,
  }]).select().single();
  if (error) throw new Error(error.message);

  // Update invoice payment_status
  const { data: allPay } = await sb.from('payments').select('amount').eq('invoice_id', a.invoice_id);
  const totalPaid = (allPay ?? []).reduce((s: number, p: { amount: unknown }) => s + pf(p.amount), 0);
  const totalTtc = pf(inv.total_ttc);
  let ps = 'unpaid';
  if (totalPaid >= totalTtc) ps = 'paid';
  else if (totalPaid > 0) ps = 'partial';
  await sb.from('invoices').update({ payment_status: ps, ...(ps === 'paid' ? { status: 'paid' } : {}) }).eq('id', a.invoice_id);

  return JSON.stringify({ created: true, payment, receipt_number: receipt, invoice_payment_status: ps }, null, 2);
};

const hGetUnpaidInvoices: Handler = async (sb, uid, a) => {
  let q = sb.from('invoices')
    .select('id, invoice_number, date, due_date, total_ttc, payment_status, client:clients(id, company_name)')
    .eq('user_id', uid).in('payment_status', ['unpaid', 'partial'])
    .order('due_date', { ascending: true });
  if (a.days_overdue) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(a.days_overdue));
    q = q.lte('due_date', cutoff.toISOString().split('T')[0]);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const total = (data ?? []).reduce((s: number, i: { total_ttc: unknown }) => s + pf(i.total_ttc), 0);
  return JSON.stringify({ invoices: data, summary: { count: data?.length ?? 0, total_unpaid: round2(total) } }, null, 2);
};

const hGetReceivablesSummary: Handler = async (sb, uid) => {
  const { data, error } = await sb.from('receivables').select('*').eq('user_id', uid);
  if (error) throw new Error(error.message);
  const now = new Date().toISOString().split('T')[0];
  let totalR = 0, totalC = 0, totalP = 0, totalO = 0;
  for (const r of data ?? []) {
    const amt = pf(r.amount); const paid = pf(r.amount_paid);
    totalR += amt; totalC += paid;
    const rem = amt - paid;
    if (rem > 0) { totalP += rem; if (r.due_date && r.due_date < now) totalO += rem; }
  }
  return JSON.stringify({
    total_receivable: round2(totalR), total_collected: round2(totalC),
    total_pending: round2(totalP), total_overdue: round2(totalO), count: data?.length ?? 0,
  }, null, 2);
};

// -- Accounting --

const hGetChartOfAccounts: Handler = async (sb, uid, a) => {
  let q = sb.from('accounting_chart_of_accounts').select('*').eq('user_id', uid).order('account_code', { ascending: true });
  if (a.category) q = q.eq('account_category', a.category);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ accounts: data, count: data?.length ?? 0 }, null, 2);
};

const hGetAccountingEntries: Handler = async (sb, uid, a) => {
  let q = sb.from('accounting_entries').select('*').eq('user_id', uid)
    .order('transaction_date', { ascending: false }).limit(Number(a.limit) || 100);
  if (a.start_date) q = q.gte('transaction_date', a.start_date);
  if (a.end_date) q = q.lte('transaction_date', a.end_date);
  if (a.account_code) q = q.eq('account_code', a.account_code);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return JSON.stringify({ entries: data, count: data?.length ?? 0 }, null, 2);
};

const hGetTrialBalance: Handler = async (sb, uid, a) => {
  const cutoff = (a.date as string) ?? new Date().toISOString().split('T')[0];
  const [eRes, cRes] = await Promise.all([
    sb.from('accounting_entries').select('account_code, debit, credit').eq('user_id', uid).lte('transaction_date', cutoff),
    sb.from('accounting_chart_of_accounts').select('account_code, account_name').eq('user_id', uid),
  ]);
  if (eRes.error) throw new Error(eRes.error.message);
  const chartMap: Record<string, string> = {};
  for (const c of cRes.data ?? []) chartMap[c.account_code] = c.account_name || '';

  const bal: Record<string, { account_code: string; account_name: string; total_debit: number; total_credit: number }> = {};
  for (const e of eRes.data ?? []) {
    const code = e.account_code;
    if (!bal[code]) bal[code] = { account_code: code, account_name: chartMap[code] || '', total_debit: 0, total_credit: 0 };
    bal[code].total_debit += pf(e.debit);
    bal[code].total_credit += pf(e.credit);
  }
  const accounts = Object.values(bal)
    .map(b => ({ ...b, balance: round2(b.total_debit - b.total_credit), total_debit: round2(b.total_debit), total_credit: round2(b.total_credit) }))
    .sort((a, b) => a.account_code.localeCompare(b.account_code));
  const td = accounts.reduce((s, b) => s + b.total_debit, 0);
  const tc = accounts.reduce((s, b) => s + b.total_credit, 0);
  return JSON.stringify({ accounts, total_debit: round2(td), total_credit: round2(tc), balanced: Math.abs(td - tc) < 0.01, cutoff_date: cutoff }, null, 2);
};

const hGetTaxSummary: Handler = async (sb, uid, a) => {
  const [invRes, expRes, trRes] = await Promise.all([
    sb.from('invoices').select('total_ht, total_ttc, tax_rate, date').eq('user_id', uid).gte('date', a.start_date).lte('date', a.end_date),
    sb.from('expenses').select('amount, created_at, category').eq('user_id', uid).gte('created_at', a.start_date).lte('created_at', a.end_date),
    sb.from('accounting_tax_rates').select('*').eq('user_id', uid),
  ]);
  const outputVat = (invRes.data ?? []).reduce((s: number, i: { total_ttc: unknown; total_ht: unknown }) => s + (pf(i.total_ttc) - pf(i.total_ht)), 0);
  const totalRev = (invRes.data ?? []).reduce((s: number, i: { total_ht: unknown }) => s + pf(i.total_ht), 0);
  const totalExp = (expRes.data ?? []).reduce((s: number, e: { amount: unknown }) => s + pf(e.amount), 0);
  const defRate = trRes.data?.find((t: { is_default: boolean }) => t.is_default)?.rate ?? 20;
  const inputVat = totalExp * (defRate / (100 + defRate));
  return JSON.stringify({
    period: { start: a.start_date, end: a.end_date },
    revenue_ht: round2(totalRev), output_vat: round2(outputVat),
    total_expenses: round2(totalExp), estimated_input_vat: round2(inputVat),
    vat_payable: round2(outputVat - inputVat),
    invoice_count: invRes.data?.length ?? 0, expense_count: expRes.data?.length ?? 0,
  }, null, 2);
};

const hInitAccounting: Handler = async (sb, uid, a) => {
  const country = String(a.country).toUpperCase();
  if (!['FR', 'BE', 'OHADA'].includes(country)) throw new Error('country must be FR, BE, or OHADA');
  const { data: settings } = await sb.from('user_accounting_settings').select('*').eq('user_id', uid).single();
  if (settings?.is_initialized) {
    return JSON.stringify({ already_initialized: true, country: settings.country, message: `Accounting already initialized for ${settings.country}.` }, null, 2);
  }
  const { error } = await sb.from('user_accounting_settings').upsert({ user_id: uid, country, is_initialized: true }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  return JSON.stringify({ initialized: true, country }, null, 2);
};

// -- Analytics --

const hGetCashFlow: Handler = async (sb, uid, a) => {
  const months = Number(a.months) || 6;
  const start = new Date(); start.setMonth(start.getMonth() - months);
  const startStr = start.toISOString().split('T')[0];

  const [invRes, expRes] = await Promise.all([
    sb.from('invoices').select('total_ttc, date, status').eq('user_id', uid).in('status', ['paid', 'sent']).gte('date', startStr),
    sb.from('expenses').select('amount, created_at').eq('user_id', uid).gte('created_at', startStr),
  ]);

  const monthly: Record<string, { month: string; income: number; expenses: number }> = {};
  const now = new Date();
  for (let i = months; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthly[k] = { month: k, income: 0, expenses: 0 };
  }
  for (const inv of invRes.data ?? []) { const k = inv.date?.substring(0, 7); if (k && monthly[k]) monthly[k].income += pf(inv.total_ttc); }
  for (const exp of expRes.data ?? []) { const k = exp.created_at?.substring(0, 7); if (k && monthly[k]) monthly[k].expenses += pf(exp.amount); }

  const result = Object.values(monthly).map(m => ({ ...m, income: round2(m.income), expenses: round2(m.expenses), net: round2(m.income - m.expenses) }));
  const tIn = result.reduce((s, m) => s + m.income, 0);
  const tOut = result.reduce((s, m) => s + m.expenses, 0);
  return JSON.stringify({ monthly: result, summary: { total_income: round2(tIn), total_expenses: round2(tOut), net: round2(tIn - tOut) } }, null, 2);
};

const hGetDashboardKpis: Handler = async (sb, uid) => {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().split('T')[0];

  const [invRes, paidRes, expRes, pendRes] = await Promise.all([
    sb.from('invoices').select('total_ttc').eq('user_id', uid).gte('date', monthStart).lte('date', today),
    sb.from('invoices').select('total_ttc').eq('user_id', uid).gte('date', monthStart).in('status', ['paid']),
    sb.from('expenses').select('amount').eq('user_id', uid).gte('created_at', monthStart).lte('created_at', today),
    sb.from('invoices').select('total_ttc').eq('user_id', uid).in('payment_status', ['unpaid', 'partial']),
  ]);

  const billed = (invRes.data ?? []).reduce((s: number, i: { total_ttc: unknown }) => s + pf(i.total_ttc), 0);
  const paid = (paidRes.data ?? []).reduce((s: number, i: { total_ttc: unknown }) => s + pf(i.total_ttc), 0);
  const exp = (expRes.data ?? []).reduce((s: number, e: { amount: unknown }) => s + pf(e.amount), 0);
  const pend = (pendRes.data ?? []).reduce((s: number, i: { total_ttc: unknown }) => s + pf(i.total_ttc), 0);

  return JSON.stringify({
    month: monthStart.substring(0, 7), revenue_billed: round2(billed), revenue_collected: round2(paid),
    expenses: round2(exp), margin: round2(paid - exp), total_pending_all_time: round2(pend),
    invoices_this_month: invRes.data?.length ?? 0,
  }, null, 2);
};

const hGetTopClients: Handler = async (sb, uid, a) => {
  const limit = Number(a.limit) || 10;
  const { data, error } = await sb.from('invoices')
    .select('total_ttc, client:clients(id, company_name, email)')
    .eq('user_id', uid).in('status', ['paid', 'sent']);
  if (error) throw new Error(error.message);

  const ct: Record<string, { client_id: string; company_name: string; email: string; total_revenue: number; invoice_count: number }> = {};
  for (const inv of data ?? []) {
    const c = inv.client as { id: string; company_name: string; email: string } | null;
    if (!c) continue;
    if (!ct[c.id]) ct[c.id] = { client_id: c.id, company_name: c.company_name, email: c.email, total_revenue: 0, invoice_count: 0 };
    ct[c.id].total_revenue += pf(inv.total_ttc); ct[c.id].invoice_count++;
  }
  const ranked = Object.values(ct).map(c => ({ ...c, total_revenue: round2(c.total_revenue) }))
    .sort((a, b) => b.total_revenue - a.total_revenue).slice(0, limit);
  return JSON.stringify({ top_clients: ranked }, null, 2);
};

// -- Exports --

const hExportFec: Handler = async (sb, uid, a) => {
  const { data: entries, error } = await sb.from('accounting_entries').select('*').eq('user_id', uid)
    .gte('transaction_date', a.start_date).lte('transaction_date', a.end_date)
    .order('transaction_date', { ascending: true });
  if (error) throw new Error(error.message);

  const header = 'JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise';
  if (!entries?.length) return `FEC file generated (empty period ${a.start_date} to ${a.end_date}).\n\n${header}`;

  const rows = entries.map((e: Record<string, unknown>, i: number) => {
    const d = String(e.transaction_date || '').replace(/-/g, '');
    return [e.journal_code || 'VE', e.journal_name || 'Ventes', String(i + 1), d,
      e.account_code || '', e.account_name || '', '', '', e.reference || '', d,
      e.description || '', fmtAmt(e.debit as number), fmtAmt(e.credit as number),
      '', '', d, '', ''].join('|');
  });
  return `FEC generated: ${entries.length} entries from ${a.start_date} to ${a.end_date}.\n\n${[header, ...rows].join('\n')}`;
};

const hExportSaft: Handler = async (sb, uid, a) => {
  const [coRes, acRes, enRes, clRes] = await Promise.all([
    sb.from('companies').select('*').eq('user_id', uid).single(),
    sb.from('accounting_chart_of_accounts').select('*').eq('user_id', uid),
    sb.from('accounting_entries').select('*').eq('user_id', uid).gte('transaction_date', a.start_date).lte('transaction_date', a.end_date).order('transaction_date', { ascending: true }),
    sb.from('clients').select('*').eq('user_id', uid),
  ]);
  const co = coRes.data || { company_name: 'Unknown', tax_id: '' };
  const acXml = (acRes.data ?? []).map((x: Record<string, unknown>) => `    <Account><AccountID>${escapeXml(x.account_code as string)}</AccountID><AccountDescription>${escapeXml(x.account_name as string)}</AccountDescription></Account>`).join('\n');
  const cuXml = (clRes.data ?? []).map((x: Record<string, unknown>) => `    <Customer><CustomerID>${escapeXml(x.id as string)}</CustomerID><Name>${escapeXml(x.company_name as string)}</Name></Customer>`).join('\n');
  const enXml = (enRes.data ?? []).map((x: Record<string, unknown>) => `    <Transaction><TransactionDate>${x.transaction_date}</TransactionDate><Description>${escapeXml(x.description as string)}</Description><DebitAmount>${fmtAmt(x.debit as number)}</DebitAmount><CreditAmount>${fmtAmt(x.credit as number)}</CreditAmount><AccountID>${escapeXml(x.account_code as string)}</AccountID></Transaction>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:2.00">
  <Header>
    <AuditFileVersion>2.00</AuditFileVersion>
    <CompanyID>${escapeXml(co.tax_id || '')}</CompanyID>
    <CompanyName>${escapeXml(co.company_name)}</CompanyName>
    <DateCreated>${new Date().toISOString().split('T')[0]}</DateCreated>
    <StartDate>${a.start_date}</StartDate><EndDate>${a.end_date}</EndDate>
    <CurrencyCode>EUR</CurrencyCode>
  </Header>
  <MasterFiles>
    <GeneralLedgerAccounts>\n${acXml}\n    </GeneralLedgerAccounts>
    <Customers>\n${cuXml}\n    </Customers>
  </MasterFiles>
  <GeneralLedgerEntries>\n${enXml}\n  </GeneralLedgerEntries>
</AuditFile>`;
};

const hExportFacturx: Handler = async (sb, uid, a) => {
  const profiles: Record<string, string> = { MINIMUM: 'urn:factur-x.eu:1p0:minimum', BASIC: 'urn:factur-x.eu:1p0:basic', EN16931: 'urn:cen.eu:en16931:2017' };
  const profile = String(a.profile || 'BASIC').toUpperCase();

  const [invRes, coRes] = await Promise.all([
    sb.from('invoices').select('*, client:clients(*)').eq('id', a.invoice_id).eq('user_id', uid).single(),
    sb.from('companies').select('*').eq('user_id', uid).single(),
  ]);
  if (invRes.error) throw new Error(`Invoice not found: ${invRes.error.message}`);

  const inv = invRes.data;
  const seller = coRes.data || {};
  const buyer = inv.client || {};
  const vatAmt = fmtAmt(pf(inv.total_ttc) - pf(inv.total_ht));

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${profiles[profile] || profiles.BASIC}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(inv.invoice_number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${fmtDate(inv.date)}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty><ram:Name>${escapeXml(seller.company_name || '')}</ram:Name>${seller.tax_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(seller.tax_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}</ram:SellerTradeParty>
      <ram:BuyerTradeParty><ram:Name>${escapeXml(buyer.company_name || '')}</ram:Name>${buyer.vat_number ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(buyer.vat_number)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}</ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${vatAmt}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${fmtAmt(inv.total_ht)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${inv.tax_rate || 20}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime><udt:DateTimeString format="102">${fmtDate(inv.due_date)}</udt:DateTimeString></ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmtAmt(inv.total_ht)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${fmtAmt(inv.total_ht)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${vatAmt}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmtAmt(inv.total_ttc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${fmtAmt(inv.total_ttc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
};

const hBackupAllData: Handler = async (sb, uid) => {
  const tables = [
    'clients', 'invoices', 'invoice_items', 'payments', 'expenses', 'suppliers',
    'accounting_chart_of_accounts', 'accounting_entries', 'accounting_mappings',
    'accounting_tax_rates', 'projects', 'timesheets', 'quotes', 'credit_notes',
    'recurring_invoices', 'receivables', 'payables',
  ];
  const backup: Record<string, unknown[]> = {};
  for (const t of tables) {
    const { data } = await sb.from(t).select('*').eq('user_id', uid);
    backup[t] = data ?? [];
  }
  const stats: Record<string, number> = {};
  for (const [t, d] of Object.entries(backup)) stats[t] = d.length;
  return JSON.stringify({ exported_at: new Date().toISOString(), stats, tables: backup }, null, 2);
};

// ─── Handler Registry ────────────────────────────────────────────────────────
const HANDLERS: Record<string, Handler> = {
  // Invoices
  list_invoices: hListInvoices, get_invoice: hGetInvoice, create_invoice: hCreateInvoice,
  update_invoice_status: hUpdateInvoiceStatus, search_invoices: hSearchInvoices, get_invoice_stats: hGetInvoiceStats,
  // Clients
  list_clients: hListClients, get_client: hGetClient, create_client: hCreateClient, get_client_balance: hGetClientBalance,
  // Payments
  list_payments: hListPayments, create_payment: hCreatePayment, get_unpaid_invoices: hGetUnpaidInvoices, get_receivables_summary: hGetReceivablesSummary,
  // Accounting
  get_chart_of_accounts: hGetChartOfAccounts, get_accounting_entries: hGetAccountingEntries, get_trial_balance: hGetTrialBalance,
  get_tax_summary: hGetTaxSummary, init_accounting: hInitAccounting,
  // Analytics
  get_cash_flow: hGetCashFlow, get_dashboard_kpis: hGetDashboardKpis, get_top_clients: hGetTopClients,
  // Exports
  export_fec: hExportFec, export_saft: hExportSaft, export_facturx: hExportFacturx, backup_all_data: hBackupAllData,
};

// ─── JSON-RPC Request Handler ────────────────────────────────────────────────
async function handleRpc(
  r: { method?: string; params?: Record<string, unknown>; id?: unknown },
  sb: SB, uid: string, scopes: string[],
): Promise<unknown | null> {
  const { method, params, id } = r;

  // Notifications (no id) → no response
  if (id === undefined) return null;

  switch (method) {
    case 'initialize':
      return rpcOk(id, {
        protocolVersion: (params?.protocolVersion as string) || '2025-03-26',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'cashpilot', version: '1.0.0' },
      });

    case 'ping':
      return rpcOk(id, {});

    case 'tools/list':
      return rpcOk(id, { tools: TOOLS });

    case 'tools/call': {
      const toolName = params?.name as string;
      const args = (params?.arguments as Record<string, unknown>) || {};
      const handler = HANDLERS[toolName];
      if (!handler) {
        return rpcOk(id, { content: [{ type: 'text', text: `Unknown tool: ${toolName}. Use tools/list to see available tools.` }], isError: true });
      }
      // Scope check
      if (WRITE_TOOLS.has(toolName) && !scopes.includes('write')) {
        return rpcOk(id, { content: [{ type: 'text', text: `Error: API key does not have "write" scope required for ${toolName}.` }], isError: true });
      }
      try {
        const text = await handler(sb, uid, args);
        return rpcOk(id, { content: [{ type: 'text', text }] });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return rpcOk(id, { content: [{ type: 'text', text: `Error executing ${toolName}: ${msg}` }], isError: true });
      }
    }

    default:
      return rpcErr(id, -32601, `Method not found: ${method}`);
  }
}

// ─── Main HTTP Handler ──────────────────────────────────────────────────────
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // MCP Streamable HTTP only accepts POST
  if (req.method !== 'POST') {
    return jsonRes({ jsonrpc: '2.0', error: { code: -32600, message: 'Only POST is accepted for MCP Streamable HTTP.' } }, 405);
  }

  try {
    // ── Authenticate via API key ────────────────────────────────
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return jsonRes({ error: 'Missing X-API-Key header' }, 401);
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Hash the key (SHA-256, same as frontend)
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
    const keyHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: keyData, error: keyError } = await sb
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      return jsonRes({ error: 'Invalid API key' }, 401);
    }

    // Check expiration
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return jsonRes({ error: 'API key expired' }, 401);
    }

    // Update last_used_at (fire-and-forget)
    sb.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyData.id).then(() => {});

    const userId: string = keyData.user_id;
    const scopes: string[] = keyData.scopes || ['read'];

    // ── Parse JSON-RPC body ─────────────────────────────────────
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonRes(rpcErr(null, -32700, 'Parse error: invalid JSON'), 400);
    }

    // ── Handle batch or single request ──────────────────────────
    const isBatch = Array.isArray(body);
    const requests = isBatch ? body : [body];
    const responses: unknown[] = [];

    for (const r of requests) {
      const resp = await handleRpc(r, sb, userId, scopes);
      if (resp !== null) responses.push(resp);
    }

    // All notifications → 202
    if (responses.length === 0) {
      return new Response(null, { status: 202, headers: CORS });
    }

    return new Response(JSON.stringify(isBatch ? responses : responses[0]), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonRes({ jsonrpc: '2.0', error: { code: -32603, message: `Internal error: ${msg}` } }, 500);
  }
});
