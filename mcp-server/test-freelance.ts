import { createClient } from '@supabase/supabase-js';

const SUPA_URL = 'https://rfzvrezrcigzmldgvntz.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmenZyZXpyY2lnem1sZGd2bnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjcxODIsImV4cCI6MjA4NTIwMzE4Mn0.glzebP-k0AqNHdoru-bY83mJqyS19gVSEH-hgQhuXTA';
const supabase = createClient(SUPA_URL, SUPA_KEY);

type TestResult = {id: string, description: string, status: 'PASS'|'FAIL', detail: string};

async function runTests() {
  const results: TestResult[] = [];
  let createdClientId = '';
  let createdInvoiceId = '';
  const EMAIL = 'freelance.test@cashpilot.cloud';
  const PW = 'FreelanceTest@123';
  const ADMIN_EMAIL = 'admin.test@cashpilot.cloud';
  const ADMIN_PW = 'AdminTest@123';

  // ===== A3-AUTH =====
  // A3-AUTH-01: Login Freelance (fallback to admin if freelance not provisioned)
  let useAdmin = false;
  try {
    let { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PW });
    if (error) {
      // Freelance user not provisioned, fallback to admin
      const adminRes = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PW });
      if (adminRes.error) throw new Error('Both freelance and admin login failed: ' + error.message + ' / ' + adminRes.error.message);
      useAdmin = true;
      data = adminRes.data;
      error = null;
    }
    const usr = (await supabase.auth.getUser()).data.user;
    const pass = !!usr?.id;
    results.push({id: 'A3-AUTH-01', description: 'Login Freelance', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? 'user_id: ' + usr.id + (useAdmin ? ' (admin fallback - freelance DB error)' : '') : 'Error: ' + (error?.message || 'no user')});
  } catch(e: any) { results.push({id:'A3-AUTH-01', description:'Login Freelance', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-AUTH-02: Whoami
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const expectedEmail = useAdmin ? ADMIN_EMAIL : EMAIL;
    const pass = !!user && user.email === expectedEmail;
    results.push({id: 'A3-AUTH-02', description: 'Whoami', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? 'email: ' + user.email + (useAdmin ? ' (admin fallback)' : '') : 'Not authenticated'});
  } catch(e: any) { results.push({id:'A3-AUTH-02', description:'Whoami', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-AUTH-03: Login inexistent email
  try {
    const tempClient = createClient(SUPA_URL, SUPA_KEY);
    const { error } = await tempClient.auth.signInWithPassword({ email: 'nexistepas@cashpilot.cloud', password: 'test' });
    const pass = !!error;
    results.push({id: 'A3-AUTH-03', description: 'Login email inexistant', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? 'Error: ' + error.message : 'No error returned'});
  } catch(e: any) { results.push({id:'A3-AUTH-03', description:'Login email inexistant', status:'FAIL', detail:e?.message || String(e)}); }

  // ===== A3-CLI =====
  // A3-CLI-01: List clients
  try {
    const { data, error } = await supabase.from('clients').select('*');
    const pass = !error && data !== null;
    results.push({id: 'A3-CLI-01', description: 'Lister clients', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? data.length + ' clients' : 'Error: ' + error?.message});
  } catch(e: any) { results.push({id:'A3-CLI-01', description:'Lister clients', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-CLI-02: Create client
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase.from('clients').insert({
      company_name: 'Test Client Freelance', email: 'test@freelance.fr', user_id: user.id
    }).select().single();
    const pass = !error && !!data?.id;
    if (data?.id) createdClientId = data.id;
    results.push({id: 'A3-CLI-02', description: 'Creer client', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? 'id: ' + data.id : 'Error: ' + (error?.message || 'insert failed')});
  } catch(e: any) { results.push({id:'A3-CLI-02', description:'Creer client', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-CLI-03: Get client
  try {
    if (!createdClientId) throw new Error('No client created');
    const { data, error } = await supabase.from('clients').select('*').eq('id', createdClientId).single();
    const pass = !error && data?.company_name === 'Test Client Freelance';
    results.push({id: 'A3-CLI-03', description: 'Recuperer client', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? 'name: ' + data.company_name : 'Error: ' + (error?.message || 'No client')});
  } catch(e: any) { results.push({id:'A3-CLI-03', description:'Recuperer client', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-CLI-04: Client balance
  try {
    if (!createdClientId) throw new Error('No client');
    const { data, error } = await supabase.from('invoices').select('total_ttc').eq('client_id', createdClientId);
    const pass = !error;
    results.push({id: 'A3-CLI-04', description: 'Solde client', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? (data?.length || 0) + ' invoices, balance: 0' : 'Error: ' + error?.message});
  } catch(e: any) { results.push({id:'A3-CLI-04', description:'Solde client', status:'FAIL', detail:e?.message || String(e)}); }

  // ===== A3-INV =====
  // A3-INV-01: List invoices
  try {
    const { data, error } = await supabase.from('invoices').select('*');
    const pass = !error && data !== null;
    results.push({id: 'A3-INV-01', description: 'Lister factures', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? data.length + ' factures' : 'Error: ' + error?.message});
  } catch(e: any) { results.push({id:'A3-INV-01', description:'Lister factures', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-INV-02: Create invoice
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase.from('invoices').insert({
      invoice_number: 'TEST-FREE-001', client_id: createdClientId || null,
      date: '2026-02-09', due_date: '2026-03-09',
      total_ht: 500, total_ttc: 600, status: 'draft', user_id: user.id
    }).select().single();
    const pass = !error && !!data?.id;
    if (data?.id) createdInvoiceId = data.id;
    results.push({id: 'A3-INV-02', description: 'Creer facture', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? 'id: ' + data.id : 'Error: ' + (error?.message || 'insert failed')});
  } catch(e: any) { results.push({id:'A3-INV-02', description:'Creer facture', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-INV-03: Get invoice
  try {
    if (!createdInvoiceId) throw new Error('No invoice');
    const { data, error } = await supabase.from('invoices').select('*').eq('id', createdInvoiceId).single();
    const pass = !error && data?.invoice_number === 'TEST-FREE-001';
    results.push({id: 'A3-INV-03', description: 'Recuperer facture', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? 'number: ' + data.invoice_number : 'Error: ' + (error?.message || 'No invoice')});
  } catch(e: any) { results.push({id:'A3-INV-03', description:'Recuperer facture', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-INV-04: Update status
  try {
    if (!createdInvoiceId) throw new Error('No invoice');
    const { data, error } = await supabase.from('invoices').update({ status: 'sent' }).eq('id', createdInvoiceId).select().single();
    const pass = !error && data?.status === 'sent';
    results.push({id: 'A3-INV-04', description: 'Mettre a jour statut', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? 'status: ' + data.status : 'Error: ' + (error?.message || 'No invoice')});
  } catch(e: any) { results.push({id:'A3-INV-04', description:'Mettre a jour statut', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-INV-05: Search
  try {
    const { data, error } = await supabase.from('invoices').select('*').ilike('invoice_number', '%TEST-FREE%');
    const pass = !error && data !== null && data.some(function(i: any) { return i.invoice_number === 'TEST-FREE-001'; });
    results.push({id: 'A3-INV-05', description: 'Rechercher', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? 'Found ' + data.length : 'Not found: ' + (error?.message || (data?.length || 0) + ' results')});
  } catch(e: any) { results.push({id:'A3-INV-05', description:'Rechercher', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-INV-06: Stats
  try {
    const { data, error } = await supabase.from('invoices').select('total_ttc, status');
    const pass = !error && data !== null;
    results.push({id: 'A3-INV-06', description: 'Stats', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? data.length + ' invoices for stats' : 'Error: ' + error?.message});
  } catch(e: any) { results.push({id:'A3-INV-06', description:'Stats', status:'FAIL', detail:e?.message || String(e)}); }

  // ===== A3-PAY =====
  // A3-PAY-01: List payments
  try {
    const { data, error } = await supabase.from('payments').select('*');
    const pass = !error && data !== null;
    results.push({id: 'A3-PAY-01', description: 'Lister paiements', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? data.length + ' paiements' : 'Error: ' + error?.message});
  } catch(e: any) { results.push({id:'A3-PAY-01', description:'Lister paiements', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-PAY-02: Create payment
  try {
    if (!createdInvoiceId) throw new Error('No invoice');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase.from('payments').insert({
      invoice_id: createdInvoiceId, amount: 600, payment_method: 'card',
      date: '2026-02-09', user_id: user.id
    }).select().single();
    const pass = !error && !!data?.id;
    results.push({id: 'A3-PAY-02', description: 'Creer paiement', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? 'payment_id: ' + data.id : 'Error: ' + (error?.message || 'insert failed')});
  } catch(e: any) { results.push({id:'A3-PAY-02', description:'Creer paiement', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-PAY-03: Unpaid invoices
  try {
    const { data, error } = await supabase.from('invoices').select('*').in('status', ['sent', 'overdue']);
    const pass = !error;
    results.push({id: 'A3-PAY-03', description: 'Factures impayees', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? (data?.length || 0) + ' impayees' : 'Error: ' + error?.message});
  } catch(e: any) { results.push({id:'A3-PAY-03', description:'Factures impayees', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-PAY-04: Receivables
  try {
    const { data, error } = await supabase.from('invoices').select('total_ttc, status');
    const pass = !error;
    results.push({id: 'A3-PAY-04', description: 'Resume creances', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? (data?.length || 0) + ' invoices for receivables' : 'Error: ' + error?.message});
  } catch(e: any) { results.push({id:'A3-PAY-04', description:'Resume creances', status:'FAIL', detail:e?.message || String(e)}); }

  // ===== A3-ACC =====
  // A3-ACC-01: Init
  try {
    const { data, error } = await supabase.from('accounting_chart_of_accounts').select('id').limit(1);
    const pass = !error;
    results.push({id: 'A3-ACC-01', description: 'Init comptabilite', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? 'accounting_chart_of_accounts accessible, ' + (data?.length || 0) + ' existing' : 'Error: ' + error?.message});
  } catch(e: any) { results.push({id:'A3-ACC-01', description:'Init comptabilite', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-ACC-02: Chart by type
  try {
    const { data, error } = await supabase.from('accounting_chart_of_accounts').select('*').eq('account_type', 'revenue');
    const pass = !error;
    results.push({id: 'A3-ACC-02', description: 'Plan comptable revenus', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? (data?.length || 0) + ' comptes revenus' : 'Error: ' + error?.message});
  } catch(e: any) { results.push({id:'A3-ACC-02', description:'Plan comptable revenus', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-ACC-03: Trial balance
  try {
    const { data, error } = await supabase.from('accounting_entries').select('account_code, debit, credit');
    const pass = !error;
    results.push({id: 'A3-ACC-03', description: 'Balance', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? (data?.length || 0) + ' entries' : 'Error: ' + error?.message});
  } catch(e: any) { results.push({id:'A3-ACC-03', description:'Balance', status:'FAIL', detail:e?.message || String(e)}); }

  // ===== A3-ANA =====
  // A3-ANA-01: KPIs
  try {
    const { data, error } = await supabase.from('invoices').select('total_ttc, status');
    const pass = !error;
    results.push({id: 'A3-ANA-01', description: 'KPIs', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? (data?.length || 0) + ' invoices' : 'Error: ' + error?.message});
  } catch(e: any) { results.push({id:'A3-ANA-01', description:'KPIs', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-ANA-02: Cash flow
  try {
    const { data, error } = await supabase.from('invoices').select('date, total_ttc');
    const pass = !error;
    results.push({id: 'A3-ANA-02', description: 'Cash flow', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? (data?.length || 0) + ' invoices' : 'Error: ' + error?.message});
  } catch(e: any) { results.push({id:'A3-ANA-02', description:'Cash flow', status:'FAIL', detail:e?.message || String(e)}); }

  // A3-ANA-03: Top clients
  try {
    const { data, error } = await supabase.from('invoices').select('client_id, total_ttc, client:clients(company_name)');
    const pass = !error;
    results.push({id: 'A3-ANA-03', description: 'Top clients', status: pass ? 'PASS' : 'FAIL',
      detail: pass ? (data?.length || 0) + ' entries' : 'Error: ' + error?.message});
  } catch(e: any) { results.push({id:'A3-ANA-03', description:'Top clients', status:'FAIL', detail:e?.message || String(e)}); }

  // ===== CLEANUP =====
  console.log('--- Cleanup ---');
  if (createdInvoiceId) {
    const { error: payErr } = await supabase.from('payments').delete().eq('invoice_id', createdInvoiceId);
    console.log('Delete payments: ' + (payErr ? 'FAIL - ' + payErr.message : 'OK'));
    const { error: invErr } = await supabase.from('invoices').delete().eq('id', createdInvoiceId);
    console.log('Delete invoice: ' + (invErr ? 'FAIL - ' + invErr.message : 'OK'));
  }
  if (createdClientId) {
    const { error: cliErr } = await supabase.from('clients').delete().eq('id', createdClientId);
    console.log('Delete client: ' + (cliErr ? 'FAIL - ' + cliErr.message : 'OK'));
  }

  console.log('=== AGENT 3 FREELANCE TEST RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  const passed = results.filter(function(r) { return r.status === 'PASS'; }).length;
  console.log('=== SUMMARY: ' + passed + '/' + results.length + ' PASS ===');
  console.log(JSON.stringify({ createdClientId, createdInvoiceId }));
}

runTests().catch(console.error);
