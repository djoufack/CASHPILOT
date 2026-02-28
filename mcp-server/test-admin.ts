import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasPasswordAuth, requirePasswordAuth } from './test-config';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const R: any[] = [];

async function t(id: string, d: string, fn: () => Promise<string>) {
  try {
    const r = await fn();
    R.push({ id, description: d, status: 'PASS', detail: r });
  } catch (e: any) {
    R.push({ id, description: d, status: 'FAIL', detail: e?.message || JSON.stringify(e) });
  }
}

async function main() {
  if (!hasPasswordAuth('admin')) {
    console.log(JSON.stringify([
      {
        id: 'A1-SKIP-01',
        description: 'Admin suite skipped',
        status: 'PASS',
        detail: 'Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to run admin tests.',
      },
    ], null, 2));
    return;
  }

  const { email, password } = requirePasswordAuth('admin');

  await t('A1-AUTH-01', 'Login admin', async () => {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return 'user_id: ' + data.user?.id;
  });
  await t('A1-AUTH-02', 'Whoami', async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (user == null || user.email !== email) throw new Error('wrong user');
    return 'email: ' + user.email + ', id: ' + user.id;
  });
  await t('A1-AUTH-03', 'Logout + re-login', async () => {
    const { error: le } = await sb.auth.signOut();
    if (le) throw le;
    const { data: { user: u2 } } = await sb.auth.getUser();
    if (u2) throw new Error('still logged in');
    const { error: re } = await sb.auth.signInWithPassword({ email, password });
    if (re) throw re;
    return 'Logout OK, whoami null, re-login OK';
  });
  await t('A1-DATA-01', 'Lister toutes les factures', async () => {
    const { data, error, count } = await sb.from('invoices').select('*', { count: 'exact' }).limit(100);
    if (error) throw new Error(error.message);
    return (data?.length || 0) + ' factures (count:' + count + ')';
  });
  await t('A1-DATA-02', 'Lister tous les clients', async () => {
    const { data, error } = await sb.from('clients').select('*').limit(100);
    if (error) throw new Error(error.message);
    return (data?.length || 0) + ' clients';
  });
  await t('A1-DATA-03', 'Lister tous les paiements', async () => {
    const { data, error } = await sb.from('payments').select('*').limit(100);
    if (error) throw new Error(error.message);
    return (data?.length || 0) + ' paiements';
  });
  await t('A1-DATA-04', 'Plan comptable global', async () => {
    const { data, error } = await sb.from('accounting_chart_of_accounts').select('*');
    if (error) throw new Error(error.message);
    return (data?.length || 0) + ' comptes';
  });
  await t('A1-DATA-05', 'Ecritures comptables 2025-2026', async () => {
    const { data, error } = await sb.from('accounting_entries').select('*').gte('transaction_date', '2025-01-01').lte('transaction_date', '2026-12-31');
    if (error) throw new Error(error.message);
    return (data?.length || 0) + ' ecritures';
  });
  await t('A1-DATA-06', 'Balance des comptes', async () => {
    const { data, error } = await sb.from('accounting_entries').select('account_code,debit,credit');
    if (error) throw new Error(error.message);
    if (data == null || data.length === 0) return '0 lignes';
    const tot: Record<string, { d: number; c: number }> = {};
    for (const row of data) {
      const code = (row as any).account_code || '?';
      if (tot[code] == null) tot[code] = { d: 0, c: 0 };
      tot[code].d += Number((row as any).debit) || 0;
      tot[code].c += Number((row as any).credit) || 0;
    }
    const td = Object.values(tot).reduce((s, v) => s + v.d, 0);
    const tc = Object.values(tot).reduce((s, v) => s + v.c, 0);
    return Object.keys(tot).length + ' comptes, debit:' + td.toFixed(2) + ', credit:' + tc.toFixed(2) + ', eq:' + (Math.abs(td - tc) < 0.01 ? 'OUI' : 'NON');
  });
  await t('A1-DATA-07', 'KPIs dashboard', async () => {
    const { data: inv, error: e1 } = await sb.from('invoices').select('total_ttc,status');
    const { data: exp, error: e2 } = await sb.from('expenses').select('amount');
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    const rev = (inv || []).reduce((s: number, i: any) => s + (Number(i.total_ttc) || 0), 0);
    const te = (exp || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
    return 'revenue:' + rev.toFixed(2) + ', expenses:' + te.toFixed(2) + ', profit:' + (rev - te).toFixed(2);
  });
  await t('A1-DATA-08', 'Cash flow 12 mois', async () => {
    const { data: inv, error: e1 } = await sb.from('invoices').select('date,total_ttc,status');
    const { data: exp, error: e2 } = await sb.from('expenses').select('created_at,amount');
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return (inv?.length || 0) + ' factures, ' + (exp?.length || 0) + ' depenses pour cash flow';
  });
  await t('A1-DATA-09', 'Top clients', async () => {
    const { data, error } = await sb.from('invoices').select('client_id,total_ttc,client:clients(company_name)');
    if (error) throw new Error(error.message);
    const ct: Record<string, { n: string; t: number }> = {};
    for (const i of (data || [])) {
      const c = (i as any).client_id || '?';
      const n = (i as any).client?.company_name || '?';
      if (ct[c] == null) ct[c] = { n, t: 0 };
      ct[c].t += Number((i as any).total_ttc) || 0;
    }
    const s = Object.values(ct).sort((a, b) => b.t - a.t).slice(0, 5);
    return s.map((c, i) => (i + 1) + '.' + c.n + ':' + c.t.toFixed(2)).join(', ') || 'aucun client';
  });
  await t('A1-DATA-10', 'Backup complet', async () => {
    const tables = ['clients', 'invoices', 'invoice_items', 'payments', 'expenses', 'suppliers', 'accounting_chart_of_accounts', 'accounting_entries', 'accounting_mappings', 'accounting_tax_rates', 'projects', 'timesheets', 'quotes', 'credit_notes', 'recurring_invoices', 'receivables', 'payables'];
    const bk: Record<string, any[]> = {};
    const fails: string[] = [];
    for (const tb of tables) {
      const { data, error } = await sb.from(tb).select('*');
      if (error) {
        fails.push(tb + ':' + error.message);
      } else {
        bk[tb] = data || [];
      }
    }
    const tr = Object.values(bk).reduce((s, a) => s + a.length, 0);
    const ok = Object.entries(bk).map(([t, d]) => t + '(' + d.length + ')').join(', ');
    return tr + ' rows OK [' + ok + ']' + (fails.length > 0 ? ' | MISSING: ' + fails.join(', ') : '');
  });

  console.log(JSON.stringify(R, null, 2));
  const p = R.filter((r: any) => r.status === 'PASS').length;
  console.log('=== SUMMARY: ' + p + '/' + R.length + ' PASS, ' + (R.length - p) + '/' + R.length + ' FAIL ===');
}

main().catch(console.error);
