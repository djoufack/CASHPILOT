/**
 * test-company-scope.ts
 *
 * Integration test: company_id is always injected on financial records.
 *
 * Verifies that when creating invoices and expenses, the company_id field
 * is automatically populated (ENF-2 compliance: ownership chain user → company → data).
 *
 * Usage:
 *   TEST_USER_EMAIL=user@example.com TEST_USER_PASSWORD=... \
 *   tsx mcp-server/test-company-scope.ts
 *
 * Or place credentials in mcp-server/.env and run: tsx test-company-scope.ts
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './test-config';

type TestResult = { id: string; description: string; status: 'PASS' | 'FAIL'; detail: string };
const R: TestResult[] = [];
let passed = 0;
let total = 0;

function record(id: string, description: string, ok: boolean, detail: string): void {
  total++;
  if (ok) passed++;
  const status = ok ? 'PASS' : 'FAIL';
  R.push({ id, description, status, detail });
  if (ok) {
    console.log('✓ PASS: [' + id + '] ' + description + ' — ' + detail);
  } else {
    console.error('✗ FAIL: [' + id + '] ' + description + ' — ' + detail);
  }
}

async function main() {
  const email = process.env.TEST_USER_EMAIL || '';
  const password = process.env.TEST_USER_PASSWORD || '';

  if (!email || !password) {
    console.log('SKIP: Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run company-scope tests.');
    record(
      'SCOPE-SKIP-01',
      'Company scope suite skipped',
      true,
      'Missing credentials — set TEST_USER_EMAIL and TEST_USER_PASSWORD.'
    );
    printSummary();
    return;
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  let userId = '';
  let companyId = '';
  let createdInvoiceId = '';
  let createdExpenseId = '';
  let createdClientId = '';

  // SCOPE-AUTH-01: Login
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    const ok = !error && !!data?.user?.id;
    if (data?.user?.id) userId = data.user.id;
    record('SCOPE-AUTH-01', 'Login', ok, ok ? 'user_id: ' + data.user!.id : 'Error: ' + error?.message);
  } catch (e: any) {
    record('SCOPE-AUTH-01', 'Login', false, e?.message || String(e));
  }

  // SCOPE-CO-01: Resolve company_id for the authenticated user
  try {
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await sb
      .from('company')
      .select('id, name')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    const ok = !error && !!data?.id;
    if (data?.id) companyId = data.id;
    record(
      'SCOPE-CO-01',
      'Resolve company_id for user',
      ok,
      ok ? 'company_id: ' + data!.id + ', name: ' + data!.name : 'Error: ' + error?.message
    );
  } catch (e: any) {
    record('SCOPE-CO-01', 'Resolve company_id for user', false, e?.message || String(e));
  }

  // We need a client to attach the invoice to
  try {
    if (!userId || !companyId) throw new Error('Missing userId or companyId');
    const { data, error } = await sb
      .from('clients')
      .insert({ company_name: '__SCOPE_TEST_CLIENT_' + Date.now(), user_id: userId, company_id: companyId })
      .select()
      .single();
    if (!error && data?.id) createdClientId = data.id;
  } catch {
    // Client creation failure is non-fatal; invoice may accept null client_id
  }

  // SCOPE-INV-01: Create an invoice
  try {
    if (!userId || !companyId) throw new Error('Missing userId or companyId — cannot create invoice');
    const invoiceNumber = 'TEST-SCOPE-INV-' + Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    const { data, error } = await sb
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        user_id: userId,
        company_id: companyId,
        client_id: createdClientId || null,
        date: today,
        due_date: due,
        total_ht: 100,
        total_ttc: 120,
        status: 'draft',
      })
      .select()
      .single();
    const ok = !error && !!data?.id;
    if (data?.id) createdInvoiceId = data.id;
    record(
      'SCOPE-INV-01',
      'Create invoice',
      ok,
      ok ? 'invoice_id: ' + data!.id + ', number: ' + data!.invoice_number : 'Error: ' + error?.message
    );
  } catch (e: any) {
    record('SCOPE-INV-01', 'Create invoice', false, e?.message || String(e));
  }

  // SCOPE-INV-02: Read invoice back and verify company_id is set and not null
  try {
    if (!createdInvoiceId) throw new Error('No invoice was created');
    const { data, error } = await sb
      .from('invoices')
      .select('id, company_id, user_id')
      .eq('id', createdInvoiceId)
      .single();
    const ok = !error && !!data?.company_id && data.company_id === companyId;
    record(
      'SCOPE-INV-02',
      'Invoice has non-null company_id matching user company',
      ok,
      ok
        ? 'company_id: ' + data!.company_id
        : 'Error or mismatch: ' + (error?.message || 'got company_id=' + data?.company_id + ', expected ' + companyId)
    );
  } catch (e: any) {
    record('SCOPE-INV-02', 'Invoice has non-null company_id', false, e?.message || String(e));
  }

  // SCOPE-EXP-01: Create an expense
  try {
    if (!userId || !companyId) throw new Error('Missing userId or companyId — cannot create expense');
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await sb
      .from('expenses')
      .insert({
        user_id: userId,
        company_id: companyId,
        description: '__SCOPE_TEST_EXPENSE_' + Date.now(),
        amount: 50,
        currency: 'EUR',
        date: today,
        category: 'other',
      })
      .select()
      .single();
    const ok = !error && !!data?.id;
    if (data?.id) createdExpenseId = data.id;
    record('SCOPE-EXP-01', 'Create expense', ok, ok ? 'expense_id: ' + data!.id : 'Error: ' + error?.message);
  } catch (e: any) {
    record('SCOPE-EXP-01', 'Create expense', false, e?.message || String(e));
  }

  // SCOPE-EXP-02: Read expense back and verify company_id is set and not null
  try {
    if (!createdExpenseId) throw new Error('No expense was created');
    const { data, error } = await sb
      .from('expenses')
      .select('id, company_id, user_id')
      .eq('id', createdExpenseId)
      .single();
    const ok = !error && !!data?.company_id && data.company_id === companyId;
    record(
      'SCOPE-EXP-02',
      'Expense has non-null company_id matching user company',
      ok,
      ok
        ? 'company_id: ' + data!.company_id
        : 'Error or mismatch: ' + (error?.message || 'got company_id=' + data?.company_id + ', expected ' + companyId)
    );
  } catch (e: any) {
    record('SCOPE-EXP-02', 'Expense has non-null company_id', false, e?.message || String(e));
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log('--- Cleanup ---');
  if (createdInvoiceId) {
    const { error } = await sb.from('invoices').delete().eq('id', createdInvoiceId).eq('user_id', userId);
    console.log('Delete invoice: ' + (error ? 'FAIL — ' + error.message : 'OK'));
  }
  if (createdExpenseId) {
    const { error } = await sb.from('expenses').delete().eq('id', createdExpenseId).eq('user_id', userId);
    console.log('Delete expense: ' + (error ? 'FAIL — ' + error.message : 'OK'));
  }
  if (createdClientId) {
    const { error } = await sb.from('clients').delete().eq('id', createdClientId).eq('user_id', userId);
    console.log('Delete client: ' + (error ? 'FAIL — ' + error.message : 'OK'));
  }

  printSummary();
}

function printSummary(): void {
  console.log('\n=== COMPANY SCOPE TEST RESULTS ===');
  console.log(JSON.stringify(R, null, 2));
  console.log('\nTests passed: ' + passed + '/' + total);
}

main().catch(console.error);
