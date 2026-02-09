// CashPilot REST API Test Suite - Agent 2 SCTE
const BASE = 'https://rfzvrezrcigzmldgvntz.supabase.co/functions/v1/api-v1';
const API_KEY = 'cpk_test_scte_2026';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmenZyZXpyY2lnem1sZGd2bnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjcxODIsImV4cCI6MjA4NTIwMzE4Mn0.glzebP-k0AqNHdoru-bY83mJqyS19gVSEH-hgQhuXTA';

type TR = { id: string; description: string; status: 'PASS' | 'FAIL'; detail: string };
const R: TR[] = [];

function add(id: string, d: string, pass: boolean, detail: string) {
  R.push({ id, description: d, status: pass ? 'PASS' : 'FAIL', detail });
}

async function api(method: string, path: string, body?: any, customHeaders?: Record<string, string>): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ANON_KEY}`,
    ...(customHeaders !== undefined ? customHeaders : { 'X-API-Key': API_KEY })
  };
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let data: any;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, data };
}

let createdInvoiceId = '';
let createdClientId = '';

async function runTests() {
  // ==================== AUTH TESTS ====================

  // A2-REST-14: Sans API key (but with Supabase auth to reach the function)
  try {
    const { status, data } = await api('GET', '/invoices', undefined, { 'Authorization': `Bearer ${ANON_KEY}` });
    add('A2-REST-14', 'Sans API key', status === 401 && data?.error?.includes('Missing'), `status: ${status}, body: ${JSON.stringify(data).substring(0, 100)}`);
  } catch (e: any) { add('A2-REST-14', 'Sans API key', false, String(e)); }

  // A2-REST-15: Mauvaise API key
  try {
    const { status, data } = await api('GET', '/invoices', undefined, { 'Authorization': `Bearer ${ANON_KEY}`, 'X-API-Key': 'invalid-key-123' });
    add('A2-REST-15', 'Mauvaise API key', status === 401 && data?.error?.includes('Invalid'), `status: ${status}, body: ${JSON.stringify(data).substring(0, 100)}`);
  } catch (e: any) { add('A2-REST-15', 'Mauvaise API key', false, String(e)); }

  // ==================== CRUD: CLIENTS ====================

  // A2-REST-06: Creer un client
  try {
    const { status, data } = await api('POST', '/clients', {
      company_name: 'REST Test Client',
      contact_name: 'Marie Martin',
      email: 'marie@rest-test.fr',
      city: 'Paris'
    });
    const clientId = data?.data?.id ?? data?.id;
    const pass = status === 201 && !!clientId;
    if (clientId) createdClientId = clientId;
    add('A2-REST-06', 'Creer un client', pass, `status: ${status}, id: ${clientId}`);
  } catch (e: any) { add('A2-REST-06', 'Creer un client', false, String(e)); }

  // A2-REST-05: Lister clients
  try {
    const { status, data } = await api('GET', '/clients?limit=10');
    add('A2-REST-05', 'Lister clients', status === 200 && Array.isArray(data?.data), `status: ${status}, count: ${data?.data?.length}`);
  } catch (e: any) { add('A2-REST-05', 'Lister clients', false, String(e)); }

  // ==================== CRUD: INVOICES ====================

  // A2-REST-03: Creer une facture
  try {
    const { status, data } = await api('POST', '/invoices', {
      invoice_number: `REST-TEST-${Date.now()}`,
      client_id: createdClientId || null,
      date: '2026-02-09',
      due_date: '2026-03-09',
      total_ht: 2000,
      total_ttc: 2400,
      status: 'draft'
    });
    const invoiceId = data?.data?.id ?? data?.id;
    const pass = status === 201 && !!invoiceId;
    if (invoiceId) createdInvoiceId = invoiceId;
    add('A2-REST-03', 'Creer une facture', pass, `status: ${status}, id: ${invoiceId}`);
  } catch (e: any) { add('A2-REST-03', 'Creer une facture', false, String(e)); }

  // A2-REST-01: Lister factures
  try {
    const { status, data } = await api('GET', '/invoices?page=1&limit=5');
    add('A2-REST-01', 'Lister factures', status === 200 && Array.isArray(data?.data), `status: ${status}, count: ${data?.data?.length}, meta: ${JSON.stringify(data?.meta)}`);
  } catch (e: any) { add('A2-REST-01', 'Lister factures', false, String(e)); }

  // A2-REST-02: Recuperer une facture
  try {
    if (!createdInvoiceId) throw new Error('No invoice created');
    const { status, data } = await api('GET', `/invoices/${createdInvoiceId}`);
    const inv = data?.data ?? data;
    add('A2-REST-02', 'Recuperer une facture', status === 200 && !!inv?.invoice_number, `status: ${status}, number: ${inv?.invoice_number}`);
  } catch (e: any) { add('A2-REST-02', 'Recuperer une facture', false, String(e)); }

  // A2-REST-04: Modifier une facture
  try {
    if (!createdInvoiceId) throw new Error('No invoice created');
    const { status, data } = await api('PUT', `/invoices/${createdInvoiceId}`, { status: 'sent', notes: 'Updated via REST' });
    const updated = data?.data ?? data;
    add('A2-REST-04', 'Modifier une facture', status === 200 && updated?.status === 'sent', `status: ${status}, new_status: ${updated?.status}`);
  } catch (e: any) { add('A2-REST-04', 'Modifier une facture', false, String(e)); }

  // A2-REST-13: Pagination
  try {
    const { status, data } = await api('GET', '/invoices?page=1&limit=2');
    add('A2-REST-13', 'Pagination', status === 200 && data?.meta?.page !== undefined, `status: ${status}, meta: ${JSON.stringify(data?.meta)}`);
  } catch (e: any) { add('A2-REST-13', 'Pagination', false, String(e)); }

  // ==================== CRUD: PAYMENTS ====================

  // A2-REST-07: Lister paiements
  try {
    const { status, data } = await api('GET', '/payments');
    add('A2-REST-07', 'Lister paiements', status === 200 && Array.isArray(data?.data), `status: ${status}, count: ${data?.data?.length}`);
  } catch (e: any) { add('A2-REST-07', 'Lister paiements', false, String(e)); }

  // A2-REST-08: Creer un paiement
  try {
    if (!createdInvoiceId) throw new Error('No invoice');
    const { status, data } = await api('POST', '/payments', {
      invoice_id: createdInvoiceId,
      amount: 1000,
      payment_method: 'bank_transfer',
      payment_date: '2026-02-09'
    });
    const paymentId = data?.data?.id ?? data?.id;
    add('A2-REST-08', 'Creer un paiement', status === 201 && !!paymentId, `status: ${status}, id: ${paymentId}`);
  } catch (e: any) { add('A2-REST-08', 'Creer un paiement', false, String(e)); }

  // ==================== CRUD: OTHER RESOURCES ====================

  // A2-REST-09: Lister devis
  try {
    const { status, data } = await api('GET', '/quotes');
    add('A2-REST-09', 'Lister devis', status === 200, `status: ${status}, count: ${data?.data?.length ?? 'N/A'}`);
  } catch (e: any) { add('A2-REST-09', 'Lister devis', false, String(e)); }

  // A2-REST-10: Lister depenses
  try {
    const { status, data } = await api('GET', '/expenses');
    add('A2-REST-10', 'Lister depenses', status === 200, `status: ${status}, count: ${data?.data?.length ?? 'N/A'}`);
  } catch (e: any) { add('A2-REST-10', 'Lister depenses', false, String(e)); }

  // A2-REST-11: Lister produits
  try {
    const { status, data } = await api('GET', '/products');
    add('A2-REST-11', 'Lister produits', status === 200, `status: ${status}, count: ${data?.data?.length ?? 'N/A'}`);
  } catch (e: any) { add('A2-REST-11', 'Lister produits', false, String(e)); }

  // A2-REST-12: Lister projets
  try {
    const { status, data } = await api('GET', '/projects');
    add('A2-REST-12', 'Lister projets', status === 200, `status: ${status}, count: ${data?.data?.length ?? 'N/A'}`);
  } catch (e: any) { add('A2-REST-12', 'Lister projets', false, String(e)); }

  // ==================== ROUTES SPECIALISEES ====================

  // A2-REST-16: Factures impayees
  try {
    const { status, data } = await api('GET', '/payments/unpaid');
    add('A2-REST-16', 'Factures impayees', status === 200, `status: ${status}, count: ${Array.isArray(data) ? data.length : data?.data?.length ?? 'N/A'}`);
  } catch (e: any) { add('A2-REST-16', 'Factures impayees', false, String(e)); }

  // A2-REST-17: Impayees > 30j
  try {
    const { status, data } = await api('GET', '/payments/unpaid?days_overdue=30');
    add('A2-REST-17', 'Impayees > 30j', status === 200, `status: ${status}`);
  } catch (e: any) { add('A2-REST-17', 'Impayees > 30j', false, String(e)); }

  // A2-REST-18: Resume creances
  try {
    const { status, data } = await api('GET', '/payments/receivables');
    add('A2-REST-18', 'Resume creances', status === 200, `status: ${status}, keys: ${Object.keys(data || {}).join(',')}`);
  } catch (e: any) { add('A2-REST-18', 'Resume creances', false, String(e)); }

  // A2-REST-19: Plan comptable
  try {
    const { status, data } = await api('GET', '/accounting/chart');
    add('A2-REST-19', 'Plan comptable', status === 200, `status: ${status}`);
  } catch (e: any) { add('A2-REST-19', 'Plan comptable', false, String(e)); }

  // A2-REST-20: Ecritures
  try {
    const { status, data } = await api('GET', '/accounting/entries?start_date=2026-01-01&end_date=2026-02-28');
    add('A2-REST-20', 'Ecritures comptables', status === 200, `status: ${status}`);
  } catch (e: any) { add('A2-REST-20', 'Ecritures comptables', false, String(e)); }

  // A2-REST-21: Balance
  try {
    const { status, data } = await api('GET', '/accounting/trial-balance');
    add('A2-REST-21', 'Balance', status === 200, `status: ${status}`);
  } catch (e: any) { add('A2-REST-21', 'Balance', false, String(e)); }

  // A2-REST-22: Resume TVA
  try {
    const { status, data } = await api('GET', '/accounting/tax-summary?start_date=2026-01-01&end_date=2026-02-28');
    add('A2-REST-22', 'Resume TVA', status === 200, `status: ${status}`);
  } catch (e: any) { add('A2-REST-22', 'Resume TVA', false, String(e)); }

  // A2-REST-23: KPIs
  try {
    const { status, data } = await api('GET', '/analytics/kpis');
    add('A2-REST-23', 'KPIs', status === 200, `status: ${status}, keys: ${Object.keys(data || {}).join(',')}`);
  } catch (e: any) { add('A2-REST-23', 'KPIs', false, String(e)); }

  // A2-REST-24: Cash flow
  try {
    const { status, data } = await api('GET', '/analytics/cash-flow?months=6');
    add('A2-REST-24', 'Cash flow', status === 200, `status: ${status}`);
  } catch (e: any) { add('A2-REST-24', 'Cash flow', false, String(e)); }

  // A2-REST-25: Top clients
  try {
    const { status, data } = await api('GET', '/analytics/top-clients?limit=5');
    add('A2-REST-25', 'Top clients', status === 200, `status: ${status}`);
  } catch (e: any) { add('A2-REST-25', 'Top clients', false, String(e)); }

  // A2-REST-26: Export FEC
  try {
    const { status, data } = await api('GET', '/exports/fec?start_date=2026-01-01&end_date=2026-02-28');
    add('A2-REST-26', 'Export FEC', status === 200, `status: ${status}`);
  } catch (e: any) { add('A2-REST-26', 'Export FEC', false, String(e)); }

  // A2-REST-27: Backup
  try {
    const { status, data } = await api('GET', '/exports/backup');
    add('A2-REST-27', 'Backup', status === 200 && typeof data === 'object', `status: ${status}, keys: ${Object.keys(data || {}).join(',')}`);
  } catch (e: any) { add('A2-REST-27', 'Backup', false, String(e)); }

  // ==================== CLEANUP ====================
  // Delete test data
  if (createdInvoiceId) {
    await api('DELETE', `/invoices/${createdInvoiceId}`).catch(() => {});
  }
  if (createdClientId) {
    await api('DELETE', `/clients/${createdClientId}`).catch(() => {});
  }

  // ==================== RESULTS ====================
  const passed = R.filter(r => r.status === 'PASS').length;
  console.log(`\n=== REST API TEST RESULTS ===`);
  console.log(`Total: ${passed}/${R.length} PASS\n`);
  for (const r of R) {
    console.log(`  ${r.status === 'PASS' ? 'OK' : 'XX'} ${r.id}: ${r.description} → ${r.detail}`);
  }
  console.log(`\n===JSON_RESULTS===`);
  console.log(JSON.stringify(R, null, 2));
}

runTests().catch(console.error);
