import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// ---------------------------------------------------------------------------
// Utility functions (inlined - cannot import from MCP server in Deno)
// ---------------------------------------------------------------------------

function escapeXml(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDateFacturX(date: string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatAmount(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00';
  return Number(amount).toFixed(2);
}

// ---------------------------------------------------------------------------
// Helper to build JSON responses
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // -----------------------------------------------------------------------
    // Authenticate via API key
    // -----------------------------------------------------------------------
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      return jsonResponse({ error: 'Missing X-API-Key header' }, 401);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      return jsonResponse({ error: 'Invalid API key' }, 401);
    }

    // Check expiration
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return jsonResponse({ error: 'API key expired' }, 401);
    }

    // Update last used
    await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyData.id);

    const userId = keyData.user_id;
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api-v1\/?/, '').replace(/^functions\/v1\/api-v1\/?/, '');
    const method = req.method;

    // Route handling
    const segments = path.split('/').filter(Boolean);
    const resource = segments[0];
    const subResource = segments[1];
    const thirdSegment = segments[2];

    // -----------------------------------------------------------------------
    // Check scopes (applies to all routes)
    // -----------------------------------------------------------------------
    const needsWrite = ['POST', 'PUT', 'PATCH'].includes(method);
    const needsDelete = method === 'DELETE';
    if (needsWrite && !keyData.scopes.includes('write')) {
      return jsonResponse({ error: 'Insufficient scope: write required' }, 403);
    }
    if (needsDelete && !keyData.scopes.includes('delete')) {
      return jsonResponse({ error: 'Insufficient scope: delete required' }, 403);
    }

    // =====================================================================
    // SPECIAL ROUTES: payments/unpaid, payments/receivables
    // (must be checked BEFORE generic CRUD to avoid treating "unpaid" as an ID)
    // =====================================================================
    if (resource === 'payments' && subResource === 'unpaid' && method === 'GET') {
      return await handlePaymentsUnpaid(supabase, userId, url);
    }

    if (resource === 'payments' && subResource === 'receivables' && method === 'GET') {
      return await handlePaymentsReceivables(supabase, userId);
    }

    // =====================================================================
    // ACCOUNTING routes
    // =====================================================================
    if (resource === 'accounting') {
      switch (subResource) {
        case 'chart':
          if (method === 'GET') return await handleAccountingChart(supabase, userId, url);
          return jsonResponse({ error: 'Method not allowed' }, 405);

        case 'entries':
          if (method === 'GET') return await handleAccountingEntries(supabase, userId, url);
          return jsonResponse({ error: 'Method not allowed' }, 405);

        case 'trial-balance':
          if (method === 'GET') return await handleTrialBalance(supabase, userId, url);
          return jsonResponse({ error: 'Method not allowed' }, 405);

        case 'tax-summary':
          if (method === 'GET') return await handleTaxSummary(supabase, userId, url);
          return jsonResponse({ error: 'Method not allowed' }, 405);

        case 'init':
          if (method === 'POST') return await handleAccountingInit(supabase, userId, req);
          return jsonResponse({ error: 'Method not allowed' }, 405);

        default:
          return jsonResponse({ error: 'Not found', available: ['chart', 'entries', 'trial-balance', 'tax-summary', 'init'] }, 404);
      }
    }

    // =====================================================================
    // ANALYTICS routes
    // =====================================================================
    if (resource === 'analytics') {
      if (method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
      switch (subResource) {
        case 'cash-flow':
          return await handleCashFlow(supabase, userId, url);
        case 'kpis':
          return await handleKpis(supabase, userId);
        case 'top-clients':
          return await handleTopClients(supabase, userId, url);
        default:
          return jsonResponse({ error: 'Not found', available: ['cash-flow', 'kpis', 'top-clients'] }, 404);
      }
    }

    // =====================================================================
    // EXPORTS routes
    // =====================================================================
    if (resource === 'exports') {
      if (method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
      switch (subResource) {
        case 'fec':
          return await handleExportFec(supabase, userId, url);
        case 'saft':
          return await handleExportSaft(supabase, userId, url);
        case 'facturx':
          if (!thirdSegment) return jsonResponse({ error: 'Invoice ID required: GET /exports/facturx/:invoice_id' }, 400);
          return await handleExportFacturx(supabase, userId, thirdSegment, url);
        case 'backup':
          return await handleExportBackup(supabase, userId);
        default:
          return jsonResponse({ error: 'Not found', available: ['fec', 'saft', 'facturx/:invoice_id', 'backup'] }, 404);
      }
    }

    // =====================================================================
    // GENERIC CRUD ROUTES (invoices, clients, quotes, expenses, products, projects, payments)
    // =====================================================================
    const ALLOWED_RESOURCES = ['invoices', 'clients', 'quotes', 'expenses', 'products', 'projects', 'payments'];
    const resourceId = subResource; // for CRUD, segment[1] is the resource id

    if (!resource || !ALLOWED_RESOURCES.includes(resource)) {
      return jsonResponse({
        error: 'Not found',
        available_resources: ALLOWED_RESOURCES,
        special_routes: ['accounting/*', 'analytics/*', 'exports/*', 'payments/unpaid', 'payments/receivables'],
        usage: 'GET /api-v1/{resource} or GET /api-v1/{resource}/{id}',
      }, 404);
    }

    // Handle CRUD
    switch (method) {
      case 'GET': {
        if (resourceId) {
          const { data, error } = await supabase.from(resource).select('*').eq('user_id', userId).eq('id', resourceId).single();
          if (error) return jsonResponse({ error: 'Not found' }, 404);
          return jsonResponse({ data });
        }

        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
        const from = (page - 1) * limit;

        // Build query with optional filters for payments
        let query = supabase
          .from(resource)
          .select(
            resource === 'payments'
              ? '*, invoice:invoices(id, invoice_number, total_ttc), client:clients(id, company_name)'
              : '*',
            { count: 'exact' }
          )
          .eq('user_id', userId);

        // Payment-specific filters
        if (resource === 'payments') {
          const invoiceId = url.searchParams.get('invoice_id');
          const clientId = url.searchParams.get('client_id');
          if (invoiceId) query = query.eq('invoice_id', invoiceId);
          if (clientId) query = query.eq('client_id', clientId);
          query = query.order('payment_date', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: false });
        }

        const { data, error, count } = await query.range(from, from + limit - 1);

        return jsonResponse({ data, meta: { page, limit, total: count } });
      }

      case 'POST': {
        // Special handling for payments: auto-update invoice payment_status
        if (resource === 'payments') {
          return await handleCreatePayment(supabase, userId, req);
        }

        const body = await req.json();
        const { data, error } = await supabase.from(resource).insert({ ...body, user_id: userId }).select().single();
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ data }, 201);
      }

      case 'PUT':
      case 'PATCH': {
        if (!resourceId) return jsonResponse({ error: 'Resource ID required' }, 400);
        const body = await req.json();
        const { data, error } = await supabase.from(resource).update(body).eq('id', resourceId).eq('user_id', userId).select().single();
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ data });
      }

      case 'DELETE': {
        if (!resourceId) return jsonResponse({ error: 'Resource ID required' }, 400);
        const { error } = await supabase.from(resource).delete().eq('id', resourceId).eq('user_id', userId);
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});


// ==========================================================================
// PAYMENT HANDLERS
// ==========================================================================

async function handleCreatePayment(supabase: ReturnType<typeof createClient>, userId: string, req: Request) {
  const body = await req.json();
  const { invoice_id, amount, payment_method, payment_date, reference, notes } = body;

  if (!invoice_id || amount === undefined) {
    return jsonResponse({ error: 'invoice_id and amount are required' }, 400);
  }

  // Get invoice to find client_id and total
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('client_id, total_ttc')
    .eq('id', invoice_id)
    .eq('user_id', userId)
    .single();

  if (invErr || !invoice) {
    return jsonResponse({ error: `Invoice not found: ${invErr?.message || 'unknown'}` }, 404);
  }

  const date = payment_date ?? new Date().toISOString().split('T')[0];
  const receiptNumber = `REC-${Date.now()}`;

  const { data: payment, error } = await supabase
    .from('payments')
    .insert([{
      user_id: userId,
      invoice_id,
      client_id: invoice.client_id,
      amount,
      payment_method: payment_method ?? 'bank_transfer',
      payment_date: date,
      reference: reference ?? null,
      notes: notes ?? null,
      receipt_number: receiptNumber,
    }])
    .select()
    .single();

  if (error) return jsonResponse({ error: error.message }, 400);

  // Update invoice payment status
  const totalTtc = parseFloat(invoice.total_ttc || '0');
  const { data: allPayments } = await supabase
    .from('payments')
    .select('amount')
    .eq('invoice_id', invoice_id);

  const totalPaid = (allPayments ?? []).reduce((s: number, p: { amount: string | number }) => s + parseFloat(String(p.amount || '0')), 0);
  let paymentStatus = 'unpaid';
  if (totalPaid >= totalTtc) paymentStatus = 'paid';
  else if (totalPaid > 0) paymentStatus = 'partial';

  await supabase
    .from('invoices')
    .update({ payment_status: paymentStatus, ...(paymentStatus === 'paid' ? { status: 'paid' } : {}) })
    .eq('id', invoice_id);

  return jsonResponse({
    data: payment,
    receipt_number: receiptNumber,
    invoice_payment_status: paymentStatus,
  }, 201);
}

async function handlePaymentsUnpaid(supabase: ReturnType<typeof createClient>, userId: string, url: URL) {
  const daysOverdue = url.searchParams.get('days_overdue');

  let query = supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, due_date, total_ttc, payment_status, balance_due, client:clients(id, company_name)')
    .eq('user_id', userId)
    .in('payment_status', ['unpaid', 'partial'])
    .order('due_date', { ascending: true });

  if (daysOverdue) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(daysOverdue));
    query = query.lte('due_date', cutoff.toISOString().split('T')[0]);
  }

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 500);

  const total = (data ?? []).reduce((s: number, i: { total_ttc: string | number }) => s + parseFloat(String(i.total_ttc || '0')), 0);

  return jsonResponse({
    data,
    summary: {
      count: data?.length ?? 0,
      total_unpaid: Math.round(total * 100) / 100,
    },
  });
}

async function handlePaymentsReceivables(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('receivables')
    .select('*')
    .eq('user_id', userId);

  if (error) return jsonResponse({ error: error.message }, 500);

  const stats = {
    total_receivable: 0,
    total_collected: 0,
    total_pending: 0,
    total_overdue: 0,
    count: data?.length ?? 0,
  };

  const now = new Date().toISOString().split('T')[0];
  for (const r of data ?? []) {
    const amount = parseFloat(r.amount || '0');
    const paid = parseFloat(r.amount_paid || '0');
    stats.total_receivable += amount;
    stats.total_collected += paid;
    const remaining = amount - paid;
    if (remaining > 0) {
      stats.total_pending += remaining;
      if (r.due_date && r.due_date < now) {
        stats.total_overdue += remaining;
      }
    }
  }

  stats.total_receivable = Math.round(stats.total_receivable * 100) / 100;
  stats.total_collected = Math.round(stats.total_collected * 100) / 100;
  stats.total_pending = Math.round(stats.total_pending * 100) / 100;
  stats.total_overdue = Math.round(stats.total_overdue * 100) / 100;

  return jsonResponse({ data: stats });
}


// ==========================================================================
// ACCOUNTING HANDLERS
// ==========================================================================

async function handleAccountingChart(supabase: ReturnType<typeof createClient>, userId: string, url: URL) {
  const category = url.searchParams.get('category');

  let query = supabase
    .from('accounting_chart_of_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('account_code', { ascending: true });

  if (category) query = query.eq('account_category', category);

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({ data, count: data?.length ?? 0 });
}

async function handleAccountingEntries(supabase: ReturnType<typeof createClient>, userId: string, url: URL) {
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  const accountCode = url.searchParams.get('account_code');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

  let query = supabase
    .from('accounting_entries')
    .select('*')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .limit(limit);

  if (startDate) query = query.gte('transaction_date', startDate);
  if (endDate) query = query.lte('transaction_date', endDate);
  if (accountCode) query = query.eq('account_code', accountCode);

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({ data, count: data?.length ?? 0 });
}

async function handleTrialBalance(supabase: ReturnType<typeof createClient>, userId: string, url: URL) {
  const cutoff = url.searchParams.get('date') ?? new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('accounting_entries')
    .select('account_code, account_name, debit, credit')
    .eq('user_id', userId)
    .lte('transaction_date', cutoff);

  if (error) return jsonResponse({ error: error.message }, 500);

  const balances: Record<string, { account_code: string; account_name: string; total_debit: number; total_credit: number; balance: number }> = {};

  for (const entry of data ?? []) {
    const code = entry.account_code;
    if (!balances[code]) {
      balances[code] = { account_code: code, account_name: entry.account_name || '', total_debit: 0, total_credit: 0, balance: 0 };
    }
    balances[code].total_debit += parseFloat(entry.debit || '0');
    balances[code].total_credit += parseFloat(entry.credit || '0');
  }

  const accounts = Object.values(balances)
    .map(b => ({
      ...b,
      balance: Math.round((b.total_debit - b.total_credit) * 100) / 100,
      total_debit: Math.round(b.total_debit * 100) / 100,
      total_credit: Math.round(b.total_credit * 100) / 100,
    }))
    .sort((a, b) => a.account_code.localeCompare(b.account_code));

  const totalDebit = accounts.reduce((s, b) => s + b.total_debit, 0);
  const totalCredit = accounts.reduce((s, b) => s + b.total_credit, 0);

  return jsonResponse({
    data: {
      accounts,
      total_debit: Math.round(totalDebit * 100) / 100,
      total_credit: Math.round(totalCredit * 100) / 100,
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
      cutoff_date: cutoff,
    },
  });
}

async function handleTaxSummary(supabase: ReturnType<typeof createClient>, userId: string, url: URL) {
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');

  if (!startDate || !endDate) {
    return jsonResponse({ error: 'start_date and end_date query parameters are required' }, 400);
  }

  const [invoicesRes, expensesRes, taxRatesRes] = await Promise.all([
    supabase.from('invoices').select('total_vat, total_ht, total_ttc, tax_rate, invoice_date')
      .eq('user_id', userId).gte('invoice_date', startDate).lte('invoice_date', endDate),
    supabase.from('expenses').select('amount, date, category')
      .eq('user_id', userId).gte('date', startDate).lte('date', endDate),
    supabase.from('accounting_tax_rates').select('*').eq('user_id', userId),
  ]);

  const outputVat = (invoicesRes.data ?? []).reduce((s: number, i: { total_vat: string | number }) => s + parseFloat(String(i.total_vat || '0')), 0);
  const totalRevenue = (invoicesRes.data ?? []).reduce((s: number, i: { total_ht: string | number }) => s + parseFloat(String(i.total_ht || '0')), 0);
  const totalExpenses = (expensesRes.data ?? []).reduce((s: number, e: { amount: string | number }) => s + parseFloat(String(e.amount || '0')), 0);

  // Estimate input VAT (simplified: assume default rate on expenses)
  const defaultRate = taxRatesRes.data?.find((t: { is_default: boolean }) => t.is_default)?.rate ?? 20;
  const estimatedInputVat = totalExpenses * (defaultRate / (100 + defaultRate));

  const summary = {
    period: { start: startDate, end: endDate },
    revenue_ht: Math.round(totalRevenue * 100) / 100,
    output_vat: Math.round(outputVat * 100) / 100,
    total_expenses: Math.round(totalExpenses * 100) / 100,
    estimated_input_vat: Math.round(estimatedInputVat * 100) / 100,
    vat_payable: Math.round((outputVat - estimatedInputVat) * 100) / 100,
    invoice_count: invoicesRes.data?.length ?? 0,
    expense_count: expensesRes.data?.length ?? 0,
    tax_rates: taxRatesRes.data ?? [],
  };

  return jsonResponse({ data: summary });
}

async function handleAccountingInit(supabase: ReturnType<typeof createClient>, userId: string, req: Request) {
  const body = await req.json();
  const country = body.country;

  if (!country || !['FR', 'BE', 'OHADA'].includes(country.toUpperCase())) {
    return jsonResponse({ error: 'country is required and must be one of: FR, BE, OHADA' }, 400);
  }

  // Check if already initialized
  const { data: settings } = await supabase
    .from('user_accounting_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (settings?.is_initialized) {
    return jsonResponse({
      data: {
        already_initialized: true,
        country: settings.country,
        message: `Accounting already initialized for country: ${settings.country}. To reinitialize, reset the settings first.`,
      },
    });
  }

  // Create or update settings
  const { error } = await supabase
    .from('user_accounting_settings')
    .upsert({ user_id: userId, country: country.toUpperCase(), is_initialized: true }, { onConflict: 'user_id' });

  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({
    data: {
      initialized: true,
      country: country.toUpperCase(),
      message: `Accounting initialized for ${country.toUpperCase()}. Chart of accounts should be loaded via the CashPilot UI for full initialization with default accounts, mappings, and tax rates.`,
    },
  }, 201);
}


// ==========================================================================
// ANALYTICS HANDLERS
// ==========================================================================

async function handleCashFlow(supabase: ReturnType<typeof createClient>, userId: string, url: URL) {
  const periodMonths = parseInt(url.searchParams.get('months') || '6');
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - periodMonths);
  const startStr = startDate.toISOString().split('T')[0];

  const [invoicesRes, expensesRes] = await Promise.all([
    supabase.from('invoices').select('total_ttc, invoice_date, status')
      .eq('user_id', userId).in('status', ['paid', 'sent']).gte('invoice_date', startStr),
    supabase.from('expenses').select('amount, date, category')
      .eq('user_id', userId).gte('date', startStr),
  ]);

  // Group by month
  const monthlyData: Record<string, { month: string; income: number; expenses: number; net: number }> = {};
  const now = new Date();
  for (let i = periodMonths; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = { month: key, income: 0, expenses: 0, net: 0 };
  }

  for (const inv of invoicesRes.data ?? []) {
    const key = inv.invoice_date?.substring(0, 7);
    if (key && monthlyData[key]) monthlyData[key].income += parseFloat(inv.total_ttc || '0');
  }

  for (const exp of expensesRes.data ?? []) {
    const key = exp.date?.substring(0, 7);
    if (key && monthlyData[key]) monthlyData[key].expenses += parseFloat(exp.amount || '0');
  }

  const monthly = Object.values(monthlyData).map(m => ({
    ...m,
    income: Math.round(m.income * 100) / 100,
    expenses: Math.round(m.expenses * 100) / 100,
    net: Math.round((m.income - m.expenses) * 100) / 100,
  }));

  const totalIn = monthly.reduce((s, m) => s + m.income, 0);
  const totalOut = monthly.reduce((s, m) => s + m.expenses, 0);

  return jsonResponse({
    data: {
      monthly,
      summary: {
        total_income: Math.round(totalIn * 100) / 100,
        total_expenses: Math.round(totalOut * 100) / 100,
        net: Math.round((totalIn - totalOut) * 100) / 100,
      },
    },
  });
}

async function handleKpis(supabase: ReturnType<typeof createClient>, userId: string) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().split('T')[0];

  const [invoicesRes, paidRes, expensesRes, pendingRes] = await Promise.all([
    supabase.from('invoices').select('total_ttc')
      .eq('user_id', userId).gte('invoice_date', monthStart).lte('invoice_date', today),
    supabase.from('invoices').select('total_ttc')
      .eq('user_id', userId).gte('invoice_date', monthStart).in('status', ['paid']),
    supabase.from('expenses').select('amount')
      .eq('user_id', userId).gte('date', monthStart).lte('date', today),
    supabase.from('invoices').select('total_ttc')
      .eq('user_id', userId).in('payment_status', ['unpaid', 'partial']),
  ]);

  const totalBilled = (invoicesRes.data ?? []).reduce((s: number, i: { total_ttc: string | number }) => s + parseFloat(String(i.total_ttc || '0')), 0);
  const totalPaid = (paidRes.data ?? []).reduce((s: number, i: { total_ttc: string | number }) => s + parseFloat(String(i.total_ttc || '0')), 0);
  const totalExpenses = (expensesRes.data ?? []).reduce((s: number, e: { amount: string | number }) => s + parseFloat(String(e.amount || '0')), 0);
  const totalPending = (pendingRes.data ?? []).reduce((s: number, i: { total_ttc: string | number }) => s + parseFloat(String(i.total_ttc || '0')), 0);

  const kpis = {
    month: monthStart.substring(0, 7),
    revenue_billed: Math.round(totalBilled * 100) / 100,
    revenue_collected: Math.round(totalPaid * 100) / 100,
    expenses: Math.round(totalExpenses * 100) / 100,
    margin: Math.round((totalPaid - totalExpenses) * 100) / 100,
    total_pending_all_time: Math.round(totalPending * 100) / 100,
    invoices_this_month: invoicesRes.data?.length ?? 0,
  };

  return jsonResponse({ data: kpis });
}

async function handleTopClients(supabase: ReturnType<typeof createClient>, userId: string, url: URL) {
  const limit = parseInt(url.searchParams.get('limit') || '10');

  const { data, error } = await supabase
    .from('invoices')
    .select('total_ttc, client:clients(id, company_name, email)')
    .eq('user_id', userId)
    .in('status', ['paid', 'sent']);

  if (error) return jsonResponse({ error: error.message }, 500);

  const clientTotals: Record<string, { client_id: string; company_name: string; email: string; total_revenue: number; invoice_count: number }> = {};

  for (const inv of data ?? []) {
    const client = inv.client as { id: string; company_name: string; email: string } | null;
    if (!client) continue;
    if (!clientTotals[client.id]) {
      clientTotals[client.id] = { client_id: client.id, company_name: client.company_name, email: client.email, total_revenue: 0, invoice_count: 0 };
    }
    clientTotals[client.id].total_revenue += parseFloat(String(inv.total_ttc || '0'));
    clientTotals[client.id].invoice_count++;
  }

  const ranked = Object.values(clientTotals)
    .map(c => ({ ...c, total_revenue: Math.round(c.total_revenue * 100) / 100 }))
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, limit);

  return jsonResponse({ data: ranked });
}


// ==========================================================================
// EXPORT HANDLERS
// ==========================================================================

async function handleExportFec(supabase: ReturnType<typeof createClient>, userId: string, url: URL) {
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');

  if (!startDate || !endDate) {
    return jsonResponse({ error: 'start_date and end_date query parameters are required' }, 400);
  }

  const { data: entries, error } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .order('transaction_date', { ascending: true });

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!entries?.length) return jsonResponse({ error: 'No entries found for the given period' }, 404);

  // FEC header
  const header = 'JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise';

  const rows = entries.map((e: Record<string, unknown>, i: number) => {
    const date = (String(e.transaction_date || '')).replace(/-/g, '');
    return [
      e.journal_code || 'VE',
      e.journal_name || 'Ventes',
      String(i + 1),
      date,
      e.account_code || '',
      e.account_name || '',
      '', // CompAuxNum
      '', // CompAuxLib
      e.reference || '',
      date,
      e.description || '',
      formatAmount(e.debit as number),
      formatAmount(e.credit as number),
      '', // EcritureLet
      '', // DateLet
      date,
      '', // Montantdevise
      '',  // Idevise
    ].join('|');
  });

  const fecContent = '\uFEFF' + [header, ...rows].join('\n');

  return new Response(fecContent, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="FEC_${startDate}_${endDate}.txt"`,
    },
  });
}

async function handleExportSaft(supabase: ReturnType<typeof createClient>, userId: string, url: URL) {
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');

  if (!startDate || !endDate) {
    return jsonResponse({ error: 'start_date and end_date query parameters are required' }, 400);
  }

  const [companyRes, accountsRes, entriesRes, clientsRes] = await Promise.all([
    supabase.from('companies').select('*').eq('user_id', userId).single(),
    supabase.from('accounting_chart_of_accounts').select('*').eq('user_id', userId),
    supabase.from('accounting_entries').select('*').eq('user_id', userId)
      .gte('transaction_date', startDate).lte('transaction_date', endDate)
      .order('transaction_date', { ascending: true }),
    supabase.from('clients').select('*').eq('user_id', userId),
  ]);

  const company = companyRes.data || { company_name: 'Unknown', tax_id: '' };
  const accounts = accountsRes.data ?? [];
  const entries = entriesRes.data ?? [];
  const clients = clientsRes.data ?? [];

  const now = new Date().toISOString();
  const accountsXml = accounts.map((a: Record<string, unknown>) =>
    `    <Account><AccountID>${escapeXml(a.account_code as string)}</AccountID><AccountDescription>${escapeXml(a.account_name as string)}</AccountDescription></Account>`
  ).join('\n');

  const customersXml = clients.map((c: Record<string, unknown>) =>
    `    <Customer><CustomerID>${escapeXml(c.id as string)}</CustomerID><Name>${escapeXml(c.company_name as string)}</Name></Customer>`
  ).join('\n');

  const entriesXml = entries.map((e: Record<string, unknown>) =>
    `    <Transaction><TransactionDate>${e.transaction_date}</TransactionDate><Description>${escapeXml(e.description as string)}</Description><DebitAmount>${formatAmount(e.debit as number)}</DebitAmount><CreditAmount>${formatAmount(e.credit as number)}</CreditAmount><AccountID>${escapeXml(e.account_code as string)}</AccountID></Transaction>`
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:2.00">
  <Header>
    <AuditFileVersion>2.00</AuditFileVersion>
    <CompanyID>${escapeXml(company.tax_id || '')}</CompanyID>
    <CompanyName>${escapeXml(company.company_name)}</CompanyName>
    <DateCreated>${now.split('T')[0]}</DateCreated>
    <StartDate>${startDate}</StartDate>
    <EndDate>${endDate}</EndDate>
    <CurrencyCode>EUR</CurrencyCode>
  </Header>
  <MasterFiles>
    <GeneralLedgerAccounts>
${accountsXml}
    </GeneralLedgerAccounts>
    <Customers>
${customersXml}
    </Customers>
  </MasterFiles>
  <GeneralLedgerEntries>
${entriesXml}
  </GeneralLedgerEntries>
</AuditFile>`;

  return new Response(xml, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="SAFT_${startDate}_${endDate}.xml"`,
    },
  });
}

async function handleExportFacturx(supabase: ReturnType<typeof createClient>, userId: string, invoiceId: string, url: URL) {
  const profileParam = url.searchParams.get('profile') ?? 'BASIC';
  const profiles: Record<string, string> = {
    MINIMUM: 'urn:factur-x.eu:1p0:minimum',
    BASIC: 'urn:factur-x.eu:1p0:basic',
    EN16931: 'urn:cen.eu:en16931:2017',
  };

  const profileId = profileParam.toUpperCase();

  const [invoiceRes, companyRes] = await Promise.all([
    supabase.from('invoices').select('*, client:clients(*)').eq('id', invoiceId).eq('user_id', userId).single(),
    supabase.from('companies').select('*').eq('user_id', userId).single(),
  ]);

  if (invoiceRes.error) return jsonResponse({ error: `Invoice not found: ${invoiceRes.error.message}` }, 404);

  const inv = invoiceRes.data;
  const seller = companyRes.data || {};
  const buyer = inv.client || {};

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${profiles[profileId] || profiles.BASIC}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(inv.invoice_number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatDateFacturX(inv.invoice_date)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(seller.company_name || '')}</ram:Name>
        ${seller.tax_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(seller.tax_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(buyer.company_name || '')}</ram:Name>
        ${buyer.vat_number ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(buyer.vat_number)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${formatDateFacturX(inv.invoice_date)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      ${seller.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${escapeXml(seller.iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>` : ''}
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${formatAmount(inv.total_vat)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${formatAmount(inv.total_ht)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${inv.tax_rate || 20}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${formatDateFacturX(inv.due_date)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${formatAmount(inv.total_ht)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${formatAmount(inv.total_ht)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${formatAmount(inv.total_vat)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${formatAmount(inv.total_ttc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${formatAmount(inv.total_ttc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

  return new Response(xml, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="facturx_${inv.invoice_number}.xml"`,
    },
  });
}

async function handleExportBackup(supabase: ReturnType<typeof createClient>, userId: string) {
  const tables = [
    'clients', 'invoices', 'invoice_items', 'payments', 'expenses', 'suppliers',
    'accounting_chart_of_accounts', 'accounting_entries', 'accounting_mappings',
    'accounting_tax_rates', 'projects', 'timesheets', 'quotes', 'credit_notes',
    'recurring_invoices', 'receivables', 'payables',
  ];

  const backup: Record<string, unknown[]> = {};

  for (const table of tables) {
    const { data } = await supabase.from(table).select('*').eq('user_id', userId);
    backup[table] = data ?? [];
  }

  const stats: Record<string, number> = {};
  for (const [t, d] of Object.entries(backup)) {
    stats[t] = d.length;
  }

  return jsonResponse({
    data: {
      exported_at: new Date().toISOString(),
      stats,
      tables: backup,
    },
  });
}
