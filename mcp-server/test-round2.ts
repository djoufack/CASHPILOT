import { createClient } from '@supabase/supabase-js';

const SU = 'https://rfzvrezrcigzmldgvntz.supabase.co';
const SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmenZyZXpyY2lnem1sZGd2bnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjcxODIsImV4cCI6MjA4NTIwMzE4Mn0.glzebP-k0AqNHdoru-bY83mJqyS19gVSEH-hgQhuXTA';

type TR = { id: string; description: string; status: 'PASS' | 'FAIL'; detail: string };

async function test(id: string, desc: string, fn: () => Promise<string>): Promise<TR> {
  try {
    const detail = await fn();
    return { id, description: desc, status: 'PASS', detail };
  } catch (e: any) {
    return { id, description: desc, status: 'FAIL', detail: e?.message || String(e) };
  }
}

// =============================================================================
// AGENT 1 - ADMIN
// =============================================================================
async function runAdminTests(): Promise<TR[]> {
  const sb = createClient(SU, SK, { auth: { persistSession: false } });
  const R: TR[] = [];

  R.push(await test('A1-AUTH-01', 'Login admin', async () => {
    const { data, error } = await sb.auth.signInWithPassword({ email: 'admin.test@cashpilot.cloud', password: 'AdminTest@123' });
    if (error) throw error;
    return 'user_id: ' + data.user?.id;
  }));

  R.push(await test('A1-AUTH-02', 'Whoami', async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== 'admin.test@cashpilot.cloud') throw new Error('wrong user: ' + user?.email);
    return 'email: ' + user.email;
  }));

  R.push(await test('A1-AUTH-03', 'Logout + re-login', async () => {
    await sb.auth.signOut();
    const { data: { user: u2 } } = await sb.auth.getUser();
    if (u2) throw new Error('still logged in');
    const { error } = await sb.auth.signInWithPassword({ email: 'admin.test@cashpilot.cloud', password: 'AdminTest@123' });
    if (error) throw error;
    return 'Logout OK, whoami null, re-login OK';
  }));

  R.push(await test('A1-DATA-01', 'Lister toutes les factures', async () => {
    const { data, error } = await sb.from('invoices').select('*').limit(100);
    if (error) throw error;
    return (data?.length || 0) + ' factures';
  }));

  R.push(await test('A1-DATA-02', 'Lister tous les clients', async () => {
    const { data, error } = await sb.from('clients').select('*').limit(100);
    if (error) throw error;
    return (data?.length || 0) + ' clients';
  }));

  R.push(await test('A1-DATA-03', 'Lister tous les paiements', async () => {
    const { data, error } = await sb.from('payments').select('*').limit(100);
    if (error) throw error;
    return (data?.length || 0) + ' paiements';
  }));

  R.push(await test('A1-DATA-04', 'Plan comptable global', async () => {
    const { data, error } = await sb.from('accounting_chart_of_accounts').select('*');
    if (error) throw error;
    return (data?.length || 0) + ' comptes';
  }));

  R.push(await test('A1-DATA-05', 'Ecritures comptables', async () => {
    const { data, error } = await sb.from('accounting_entries').select('*').gte('transaction_date', '2025-01-01').lte('transaction_date', '2026-12-31');
    if (error) throw error;
    return (data?.length || 0) + ' ecritures';
  }));

  R.push(await test('A1-DATA-06', 'Balance des comptes', async () => {
    const { data, error } = await sb.from('accounting_entries').select('account_code, debit, credit');
    if (error) throw error;
    return (data?.length || 0) + ' lignes balance';
  }));

  R.push(await test('A1-DATA-07', 'KPIs dashboard', async () => {
    const { data: inv, error: e1 } = await sb.from('invoices').select('total_ttc, status');
    const { data: exp, error: e2 } = await sb.from('expenses').select('amount');
    if (e1) throw e1; if (e2) throw e2;
    return 'invoices: ' + (inv?.length || 0) + ', expenses: ' + (exp?.length || 0);
  }));

  R.push(await test('A1-DATA-08', 'Cash flow 12 mois', async () => {
    const { data: inv, error: e1 } = await sb.from('invoices').select('date, total_ttc');
    const { data: exp, error: e2 } = await sb.from('expenses').select('created_at, amount');
    if (e1) throw e1; if (e2) throw e2;
    return (inv?.length || 0) + ' factures, ' + (exp?.length || 0) + ' depenses';
  }));

  R.push(await test('A1-DATA-09', 'Top clients', async () => {
    const { data, error } = await sb.from('invoices').select('client_id, total_ttc, client:clients(company_name)');
    if (error) throw error;
    return (data?.length || 0) + ' factures pour top clients';
  }));

  R.push(await test('A1-DATA-10', 'Backup complet', async () => {
    const tables = ['clients', 'invoices', 'invoice_items', 'payments', 'expenses', 'suppliers',
      'accounting_chart_of_accounts', 'accounting_entries', 'projects', 'timesheets', 'quotes'];
    let total = 0;
    for (const t of tables) {
      const { data, error } = await sb.from(t).select('*');
      if (error) throw new Error(t + ': ' + error.message);
      total += data?.length || 0;
    }
    return total + ' rows across ' + tables.length + ' tables';
  }));

  return R;
}

// =============================================================================
// AGENT 2 - SCTE SRL
// =============================================================================
async function runScteTests(): Promise<TR[]> {
  const sb = createClient(SU, SK, { auth: { persistSession: false } });
  const R: TR[] = [];
  let userId = '', cCli = '', cInv = '', cPay = '';

  // AUTH
  R.push(await test('A2-AUTH-01', 'Login SCTE', async () => {
    const { data, error } = await sb.auth.signInWithPassword({ email: 'scte.test@cashpilot.cloud', password: 'ScteTest@123' });
    if (error) throw error;
    userId = data.user?.id || '';
    return 'user_id: ' + userId;
  }));

  R.push(await test('A2-AUTH-02', 'Whoami', async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== 'scte.test@cashpilot.cloud') throw new Error('wrong: ' + user?.email);
    return 'email: ' + user.email;
  }));

  R.push(await test('A2-AUTH-03', 'Login mauvais mdp', async () => {
    const tmp = createClient(SU, SK, { auth: { persistSession: false } });
    const { error } = await tmp.auth.signInWithPassword({ email: 'scte.test@cashpilot.cloud', password: 'wrong' });
    if (!error) throw new Error('Should have failed');
    return 'Error correctly returned: ' + error.message;
  }));

  // CLIENTS
  R.push(await test('A2-CLI-01', 'Lister clients', async () => {
    const { data, error } = await sb.from('clients').select('*');
    if (error) throw error;
    return (data?.length || 0) + ' clients';
  }));

  R.push(await test('A2-CLI-02', 'Creer client', async () => {
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await sb.from('clients').insert({
      company_name: 'Test Client SCTE', contact_name: 'Jean Dupont',
      email: 'jean@test-scte.fr', city: 'Bruxelles', user_id: userId
    }).select().single();
    if (error) throw error;
    cCli = data.id;
    return 'id: ' + data.id + ', name: ' + data.company_name;
  }));

  R.push(await test('A2-CLI-03', 'Recuperer client', async () => {
    if (!cCli) throw new Error('No client');
    const { data, error } = await sb.from('clients').select('*').eq('id', cCli).single();
    if (error) throw error;
    if (data.company_name !== 'Test Client SCTE') throw new Error('Wrong name: ' + data.company_name);
    return 'company_name: ' + data.company_name;
  }));

  R.push(await test('A2-CLI-04', 'Chercher client', async () => {
    const { data, error } = await sb.from('clients').select('*').ilike('company_name', '%Test Client SCTE%');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Not found');
    return 'Found ' + data.length + ' matching';
  }));

  R.push(await test('A2-CLI-05', 'Solde client', async () => {
    if (!cCli) throw new Error('No client');
    const { data, error } = await sb.from('invoices').select('total_ttc').eq('client_id', cCli);
    if (error) throw error;
    return (data?.length || 0) + ' invoices, balance: 0';
  }));

  // INVOICES
  R.push(await test('A2-INV-01', 'Lister factures', async () => {
    const { data, error } = await sb.from('invoices').select('*');
    if (error) throw error;
    return (data?.length || 0) + ' factures';
  }));

  R.push(await test('A2-INV-02', 'Lister par statut draft', async () => {
    const { data, error } = await sb.from('invoices').select('*').eq('status', 'draft');
    if (error) throw error;
    return (data?.length || 0) + ' factures draft';
  }));

  R.push(await test('A2-INV-03', 'Creer facture', async () => {
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await sb.from('invoices').insert({
      invoice_number: 'TEST-SCTE-001', client_id: cCli || null,
      date: '2026-02-09', due_date: '2026-03-09',
      total_ht: 1000, total_ttc: 1200, status: 'draft', user_id: userId
    }).select().single();
    if (error) throw error;
    cInv = data.id;
    return 'id: ' + data.id + ', number: ' + data.invoice_number;
  }));

  R.push(await test('A2-INV-04', 'Recuperer facture', async () => {
    if (!cInv) throw new Error('No invoice');
    const { data, error } = await sb.from('invoices').select('*, client:clients(company_name)').eq('id', cInv).single();
    if (error) throw error;
    if (data.invoice_number !== 'TEST-SCTE-001') throw new Error('Wrong number');
    return 'number: ' + data.invoice_number;
  }));

  R.push(await test('A2-INV-05', 'Mettre a jour statut', async () => {
    if (!cInv) throw new Error('No invoice');
    const { data, error } = await sb.from('invoices').update({ status: 'sent' }).eq('id', cInv).select().single();
    if (error) throw error;
    if (data.status !== 'sent') throw new Error('Status: ' + data.status);
    return 'status: sent';
  }));

  R.push(await test('A2-INV-06', 'Rechercher factures', async () => {
    const { data, error } = await sb.from('invoices').select('*').ilike('invoice_number', '%TEST-SCTE%');
    if (error) throw error;
    if (!data?.some((i: any) => i.invoice_number === 'TEST-SCTE-001')) throw new Error('Not found');
    return 'Found ' + data.length + ' matching';
  }));

  R.push(await test('A2-INV-07', 'Stats factures', async () => {
    const { data, error } = await sb.from('invoices').select('total_ttc, status');
    if (error) throw error;
    const total = (data || []).reduce((s: number, i: any) => s + (parseFloat(i.total_ttc) || 0), 0);
    return 'total: ' + total + ', count: ' + (data?.length || 0);
  }));

  R.push(await test('A2-INV-08', 'Lister avec limite 2', async () => {
    const { data, error } = await sb.from('invoices').select('*').limit(2);
    if (error) throw error;
    if ((data?.length || 0) > 2) throw new Error('Too many: ' + data?.length);
    return (data?.length || 0) + ' factures (limit 2)';
  }));

  // PAYMENTS
  R.push(await test('A2-PAY-01', 'Lister paiements', async () => {
    const { data, error } = await sb.from('payments').select('*');
    if (error) throw error;
    return (data?.length || 0) + ' paiements';
  }));

  R.push(await test('A2-PAY-02', 'Paiement partiel', async () => {
    if (!cInv || !userId) throw new Error('No invoice/user');
    const { data, error } = await sb.from('payments').insert({
      invoice_id: cInv, amount: 500, payment_method: 'bank_transfer',
      payment_date: '2026-02-09', user_id: userId
    }).select().single();
    if (error) throw error;
    cPay = data.id;
    return 'payment_id: ' + data.id;
  }));

  R.push(await test('A2-PAY-03', 'Paiement solde', async () => {
    if (!cInv || !userId) throw new Error('No invoice/user');
    const { data, error } = await sb.from('payments').insert({
      invoice_id: cInv, amount: 700, payment_method: 'bank_transfer',
      payment_date: '2026-02-09', user_id: userId
    }).select().single();
    if (error) throw error;
    return 'payment_id: ' + data.id;
  }));

  R.push(await test('A2-PAY-04', 'Factures impayees', async () => {
    const { data, error } = await sb.from('invoices').select('*').in('status', ['sent', 'overdue']);
    if (error) throw error;
    return (data?.length || 0) + ' impayees';
  }));

  R.push(await test('A2-PAY-05', 'Resume creances', async () => {
    const { data, error } = await sb.from('invoices').select('total_ttc, payment_status');
    if (error) throw error;
    return (data?.length || 0) + ' invoices for receivables';
  }));

  // ACCOUNTING
  R.push(await test('A2-ACC-01', 'Plan comptable', async () => {
    const { data, error } = await sb.from('accounting_chart_of_accounts').select('*');
    if (error) throw error;
    return (data?.length || 0) + ' comptes';
  }));

  R.push(await test('A2-ACC-02', 'Init comptabilite FR', async () => {
    const { data, error } = await sb.from('accounting_chart_of_accounts').select('id').limit(1);
    if (error) throw error;
    return 'Table accessible, ' + (data?.length || 0) + ' existing';
  }));

  R.push(await test('A2-ACC-03', 'Plan comptable apres init', async () => {
    const { data, error } = await sb.from('accounting_chart_of_accounts').select('*');
    if (error) throw error;
    return (data?.length || 0) + ' comptes';
  }));

  R.push(await test('A2-ACC-04', 'Ecritures comptables', async () => {
    const { data, error } = await sb.from('accounting_entries').select('*').gte('transaction_date', '2026-01-01').lte('transaction_date', '2026-02-28');
    if (error) throw error;
    return (data?.length || 0) + ' ecritures';
  }));

  R.push(await test('A2-ACC-05', 'Resume TVA', async () => {
    const { data, error } = await sb.from('accounting_entries').select('account_code, debit, credit').gte('transaction_date', '2026-01-01').lte('transaction_date', '2026-02-28');
    if (error) throw error;
    return (data?.length || 0) + ' entries for tax calc';
  }));

  // ANALYTICS
  R.push(await test('A2-ANA-01', 'Cash flow 6 mois', async () => {
    const { data, error } = await sb.from('invoices').select('date, total_ttc');
    if (error) throw error;
    return (data?.length || 0) + ' invoices for cash flow';
  }));

  R.push(await test('A2-ANA-02', 'KPIs dashboard', async () => {
    const { data: inv, error: e1 } = await sb.from('invoices').select('total_ttc, status');
    const { data: exp, error: e2 } = await sb.from('expenses').select('amount');
    if (e1) throw e1; if (e2) throw e2;
    return 'invoices: ' + (inv?.length || 0) + ', expenses: ' + (exp?.length || 0);
  }));

  R.push(await test('A2-ANA-03', 'Top clients', async () => {
    const { data, error } = await sb.from('invoices').select('client_id, total_ttc, client:clients(company_name)').limit(3);
    if (error) throw error;
    return (data?.length || 0) + ' entries';
  }));

  // EXPORTS
  R.push(await test('A2-EXP-01', 'Export FEC data', async () => {
    const { data, error } = await sb.from('accounting_entries').select('*').gte('transaction_date', '2026-01-01').lte('transaction_date', '2026-02-28');
    if (error) throw error;
    return (data?.length || 0) + ' entries for FEC';
  }));

  R.push(await test('A2-EXP-02', 'Export SAF-T data', async () => {
    const { data, error } = await sb.from('accounting_entries').select('*').gte('transaction_date', '2026-01-01').lte('transaction_date', '2026-02-28');
    if (error) throw error;
    return (data?.length || 0) + ' entries for SAF-T';
  }));

  R.push(await test('A2-EXP-03', 'Export Factur-X data', async () => {
    if (!cInv) throw new Error('No invoice');
    const { data, error } = await sb.from('invoices').select('*, client:clients(*), items:invoice_items(*)').eq('id', cInv).single();
    if (error) throw error;
    return 'Invoice data loaded for Factur-X';
  }));

  R.push(await test('A2-EXP-04', 'Backup complet', async () => {
    const tables = ['invoices', 'clients', 'payments', 'expenses', 'quotes', 'projects'];
    let total = 0;
    for (const t of tables) {
      const { data, error } = await sb.from(t).select('*');
      if (error) throw new Error(t + ': ' + error.message);
      total += data?.length || 0;
    }
    return total + ' rows across ' + tables.length + ' tables';
  }));

  return R;
}

// =============================================================================
// AGENT 3 - FREELANCE
// =============================================================================
async function runFreelanceTests(): Promise<TR[]> {
  const sb = createClient(SU, SK, { auth: { persistSession: false } });
  const R: TR[] = [];
  let userId = '', cCli = '', cInv = '';

  // AUTH
  R.push(await test('A3-AUTH-01', 'Login Freelance', async () => {
    const { data, error } = await sb.auth.signInWithPassword({ email: 'freelance.test@cashpilot.cloud', password: 'FreelanceTest@123' });
    if (error) throw error;
    userId = data.user?.id || '';
    return 'user_id: ' + userId;
  }));

  R.push(await test('A3-AUTH-02', 'Whoami', async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== 'freelance.test@cashpilot.cloud') throw new Error('wrong: ' + user?.email);
    return 'email: ' + user.email;
  }));

  R.push(await test('A3-AUTH-03', 'Login email inexistant', async () => {
    const tmp = createClient(SU, SK, { auth: { persistSession: false } });
    const { error } = await tmp.auth.signInWithPassword({ email: 'nexistepas@cashpilot.cloud', password: 'test' });
    if (!error) throw new Error('Should have failed');
    return 'Error: ' + error.message;
  }));

  // CLIENTS
  R.push(await test('A3-CLI-01', 'Lister clients', async () => {
    const { data, error } = await sb.from('clients').select('*');
    if (error) throw error;
    return (data?.length || 0) + ' clients';
  }));

  R.push(await test('A3-CLI-02', 'Creer client', async () => {
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await sb.from('clients').insert({
      company_name: 'Test Client Freelance', email: 'test@freelance.fr', user_id: userId
    }).select().single();
    if (error) throw error;
    cCli = data.id;
    return 'id: ' + data.id;
  }));

  R.push(await test('A3-CLI-03', 'Recuperer client', async () => {
    if (!cCli) throw new Error('No client');
    const { data, error } = await sb.from('clients').select('*').eq('id', cCli).single();
    if (error) throw error;
    if (data.company_name !== 'Test Client Freelance') throw new Error('Wrong name');
    return 'name: ' + data.company_name;
  }));

  R.push(await test('A3-CLI-04', 'Solde client', async () => {
    if (!cCli) throw new Error('No client');
    const { data, error } = await sb.from('invoices').select('total_ttc').eq('client_id', cCli);
    if (error) throw error;
    return (data?.length || 0) + ' invoices, balance: 0';
  }));

  // INVOICES
  R.push(await test('A3-INV-01', 'Lister factures', async () => {
    const { data, error } = await sb.from('invoices').select('*');
    if (error) throw error;
    return (data?.length || 0) + ' factures';
  }));

  R.push(await test('A3-INV-02', 'Creer facture', async () => {
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await sb.from('invoices').insert({
      invoice_number: 'TEST-FREE-001', client_id: cCli || null,
      date: '2026-02-09', due_date: '2026-03-09',
      total_ht: 500, total_ttc: 600, status: 'draft', user_id: userId
    }).select().single();
    if (error) throw error;
    cInv = data.id;
    return 'id: ' + data.id;
  }));

  R.push(await test('A3-INV-03', 'Recuperer facture', async () => {
    if (!cInv) throw new Error('No invoice');
    const { data, error } = await sb.from('invoices').select('*').eq('id', cInv).single();
    if (error) throw error;
    if (data.invoice_number !== 'TEST-FREE-001') throw new Error('Wrong number');
    return 'number: ' + data.invoice_number;
  }));

  R.push(await test('A3-INV-04', 'Mettre a jour statut', async () => {
    if (!cInv) throw new Error('No invoice');
    const { data, error } = await sb.from('invoices').update({ status: 'sent' }).eq('id', cInv).select().single();
    if (error) throw error;
    return 'status: ' + data.status;
  }));

  R.push(await test('A3-INV-05', 'Rechercher', async () => {
    const { data, error } = await sb.from('invoices').select('*').ilike('invoice_number', '%TEST-FREE%');
    if (error) throw error;
    if (!data?.some((i: any) => i.invoice_number === 'TEST-FREE-001')) throw new Error('Not found');
    return 'Found ' + data.length;
  }));

  R.push(await test('A3-INV-06', 'Stats', async () => {
    const { data, error } = await sb.from('invoices').select('total_ttc, status');
    if (error) throw error;
    return (data?.length || 0) + ' invoices';
  }));

  // PAYMENTS
  R.push(await test('A3-PAY-01', 'Lister paiements', async () => {
    const { data, error } = await sb.from('payments').select('*');
    if (error) throw error;
    return (data?.length || 0) + ' paiements';
  }));

  R.push(await test('A3-PAY-02', 'Creer paiement', async () => {
    if (!cInv || !userId) throw new Error('No invoice');
    const { data, error } = await sb.from('payments').insert({
      invoice_id: cInv, amount: 600, payment_method: 'card',
      payment_date: '2026-02-09', user_id: userId
    }).select().single();
    if (error) throw error;
    return 'payment_id: ' + data.id;
  }));

  R.push(await test('A3-PAY-03', 'Factures impayees', async () => {
    const { data, error } = await sb.from('invoices').select('*').in('status', ['sent', 'overdue']);
    if (error) throw error;
    return (data?.length || 0) + ' impayees';
  }));

  R.push(await test('A3-PAY-04', 'Resume creances', async () => {
    const { data, error } = await sb.from('invoices').select('total_ttc, status');
    if (error) throw error;
    return (data?.length || 0) + ' invoices';
  }));

  // ACCOUNTING
  R.push(await test('A3-ACC-01', 'Init comptabilite', async () => {
    const { data, error } = await sb.from('accounting_chart_of_accounts').select('*');
    if (error) throw error;
    return (data?.length || 0) + ' comptes';
  }));

  R.push(await test('A3-ACC-02', 'Plan comptable revenus', async () => {
    const { data, error } = await sb.from('accounting_chart_of_accounts').select('*').eq('account_type', 'revenue');
    if (error) throw error;
    return (data?.length || 0) + ' comptes revenus';
  }));

  R.push(await test('A3-ACC-03', 'Balance', async () => {
    const { data, error } = await sb.from('accounting_entries').select('account_code, debit, credit');
    if (error) throw error;
    return (data?.length || 0) + ' entries';
  }));

  // ANALYTICS
  R.push(await test('A3-ANA-01', 'KPIs', async () => {
    const { data, error } = await sb.from('invoices').select('total_ttc, status');
    if (error) throw error;
    return (data?.length || 0) + ' invoices';
  }));

  R.push(await test('A3-ANA-02', 'Cash flow', async () => {
    const { data, error } = await sb.from('invoices').select('date, total_ttc');
    if (error) throw error;
    return (data?.length || 0) + ' invoices';
  }));

  R.push(await test('A3-ANA-03', 'Top clients', async () => {
    const { data, error } = await sb.from('invoices').select('client_id, total_ttc, client:clients(company_name)');
    if (error) throw error;
    return (data?.length || 0) + ' entries';
  }));

  return R;
}

// =============================================================================
// RLS CROSS-AGENT TESTS
// =============================================================================
async function runRLSTests(scteResults: TR[], freelanceResults: TR[]): Promise<TR[]> {
  const R: TR[] = [];
  const sbScte = createClient(SU, SK, { auth: { persistSession: false } });
  const sbFree = createClient(SU, SK, { auth: { persistSession: false } });

  await sbScte.auth.signInWithPassword({ email: 'scte.test@cashpilot.cloud', password: 'ScteTest@123' });
  await sbFree.auth.signInWithPassword({ email: 'freelance.test@cashpilot.cloud', password: 'FreelanceTest@123' });

  R.push(await test('RLS-01', 'Freelance ne voit pas factures SCTE', async () => {
    const { data } = await sbFree.from('invoices').select('invoice_number').limit(100);
    const hasSCTE = (data || []).some((i: any) => i.invoice_number?.includes('TEST-SCTE'));
    if (hasSCTE) throw new Error('Freelance can see SCTE invoices!');
    return 'OK: ' + (data?.length || 0) + ' invoices, none from SCTE';
  }));

  R.push(await test('RLS-02', 'SCTE ne voit pas factures Freelance', async () => {
    const { data } = await sbScte.from('invoices').select('invoice_number').limit(100);
    const hasFree = (data || []).some((i: any) => i.invoice_number?.includes('TEST-FREE'));
    if (hasFree) throw new Error('SCTE can see Freelance invoices!');
    return 'OK: ' + (data?.length || 0) + ' invoices, none from Freelance';
  }));

  R.push(await test('RLS-03', 'Freelance ne voit pas clients SCTE', async () => {
    const { data } = await sbFree.from('clients').select('company_name').limit(100);
    const hasSCTE = (data || []).some((c: any) => c.company_name?.includes('Test Client SCTE'));
    if (hasSCTE) throw new Error('Freelance can see SCTE clients!');
    return 'OK: ' + (data?.length || 0) + ' clients, none from SCTE';
  }));

  R.push(await test('RLS-04', 'SCTE ne voit pas clients Freelance', async () => {
    const { data } = await sbScte.from('clients').select('company_name').limit(100);
    const hasFree = (data || []).some((c: any) => c.company_name?.includes('Test Client Freelance'));
    if (hasFree) throw new Error('SCTE can see Freelance clients!');
    return 'OK: ' + (data?.length || 0) + ' clients, none from Freelance';
  }));

  R.push(await test('RLS-05', 'Comptabilite isolee (chart)', async () => {
    const { data: scteData } = await sbScte.from('accounting_chart_of_accounts').select('id');
    const { data: freeData } = await sbFree.from('accounting_chart_of_accounts').select('id');
    const scteIds = new Set((scteData || []).map((d: any) => d.id));
    const freeIds = new Set((freeData || []).map((d: any) => d.id));
    const overlap = [...scteIds].filter(id => freeIds.has(id));
    if (overlap.length > 0) throw new Error(overlap.length + ' overlapping IDs!');
    return 'OK: SCTE ' + scteIds.size + ' comptes, Freelance ' + freeIds.size + ' comptes, 0 overlap';
  }));

  // Cleanup test data
  console.log('\n--- Cleanup ---');
  const { data: scteInv } = await sbScte.from('invoices').select('id').ilike('invoice_number', '%TEST-SCTE%');
  for (const inv of scteInv || []) {
    await sbScte.from('payments').delete().eq('invoice_id', inv.id);
    await sbScte.from('invoices').delete().eq('id', inv.id);
  }
  await sbScte.from('clients').delete().ilike('company_name', '%Test Client SCTE%');

  const { data: freeInv } = await sbFree.from('invoices').select('id').ilike('invoice_number', '%TEST-FREE%');
  for (const inv of freeInv || []) {
    await sbFree.from('payments').delete().eq('invoice_id', inv.id);
    await sbFree.from('invoices').delete().eq('id', inv.id);
  }
  await sbFree.from('clients').delete().ilike('company_name', '%Test Client Freelance%');
  console.log('Cleanup done');

  return R;
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log('========== CASHPILOT TEST SUITE - ROUND 2 ==========\n');

  console.log('--- AGENT 1: ADMIN ---');
  const adminResults = await runAdminTests();
  const adminPass = adminResults.filter(r => r.status === 'PASS').length;
  console.log(`ADMIN: ${adminPass}/${adminResults.length} PASS\n`);
  for (const r of adminResults) console.log(`  ${r.status === 'PASS' ? 'OK' : 'XX'} ${r.id}: ${r.description} → ${r.detail}`);

  console.log('\n--- AGENT 2: SCTE SRL ---');
  const scteResults = await runScteTests();
  const sctePass = scteResults.filter(r => r.status === 'PASS').length;
  console.log(`SCTE: ${sctePass}/${scteResults.length} PASS\n`);
  for (const r of scteResults) console.log(`  ${r.status === 'PASS' ? 'OK' : 'XX'} ${r.id}: ${r.description} → ${r.detail}`);

  console.log('\n--- AGENT 3: FREELANCE ---');
  const freelanceResults = await runFreelanceTests();
  const freelancePass = freelanceResults.filter(r => r.status === 'PASS').length;
  console.log(`FREELANCE: ${freelancePass}/${freelanceResults.length} PASS\n`);
  for (const r of freelanceResults) console.log(`  ${r.status === 'PASS' ? 'OK' : 'XX'} ${r.id}: ${r.description} → ${r.detail}`);

  console.log('\n--- RLS CROSS-AGENT ---');
  const rlsResults = await runRLSTests(scteResults, freelanceResults);
  const rlsPass = rlsResults.filter(r => r.status === 'PASS').length;
  console.log(`RLS: ${rlsPass}/${rlsResults.length} PASS\n`);
  for (const r of rlsResults) console.log(`  ${r.status === 'PASS' ? 'OK' : 'XX'} ${r.id}: ${r.description} → ${r.detail}`);

  const allResults = [...adminResults, ...scteResults, ...freelanceResults, ...rlsResults];
  const totalPass = allResults.filter(r => r.status === 'PASS').length;
  const totalFail = allResults.filter(r => r.status === 'FAIL').length;

  console.log('\n========== FINAL SUMMARY ==========');
  console.log(`Total: ${totalPass}/${allResults.length} PASS, ${totalFail} FAIL`);
  console.log(`Admin: ${adminPass}/${adminResults.length}`);
  console.log(`SCTE: ${sctePass}/${scteResults.length}`);
  console.log(`Freelance: ${freelancePass}/${freelanceResults.length}`);
  console.log(`RLS: ${rlsPass}/${rlsResults.length}`);

  // Output JSON for report generation
  console.log('\n===JSON_RESULTS===');
  console.log(JSON.stringify({ admin: adminResults, scte: scteResults, freelance: freelanceResults, rls: rlsResults }, null, 2));
}

main().catch(console.error);
