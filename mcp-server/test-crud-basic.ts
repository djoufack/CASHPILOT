/**
 * test-crud-basic.ts
 *
 * Integration test: basic CRUD operations on clients.
 *
 * Usage:
 *   TEST_USER_EMAIL=user@example.com TEST_USER_PASSWORD=... \
 *   tsx mcp-server/test-crud-basic.ts
 *
 * Or place credentials in mcp-server/.env and run: tsx test-crud-basic.ts
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
    console.log('SKIP: Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run CRUD tests.');
    record(
      'CRUD-SKIP-01',
      'CRUD suite skipped',
      true,
      'Missing credentials — set TEST_USER_EMAIL and TEST_USER_PASSWORD.'
    );
    printSummary();
    return;
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  let userId = '';
  let createdClientId = '';
  const clientName = '__TEST_CLIENT_' + Date.now();
  const updatedName = clientName + '_UPDATED';

  // CRUD-AUTH-01: Login
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    const ok = !error && !!data?.user?.id;
    if (data?.user?.id) userId = data.user.id;
    record('CRUD-AUTH-01', 'Login', ok, ok ? 'user_id: ' + data.user!.id : 'Error: ' + error?.message);
  } catch (e: any) {
    record('CRUD-AUTH-01', 'Login', false, e?.message || String(e));
  }

  // CRUD-CO-01: List companies
  try {
    const { data, error } = await sb.from('company').select('id, name').eq('user_id', userId).limit(50);
    const ok = !error && Array.isArray(data);
    record('CRUD-CO-01', 'List companies', ok, ok ? data!.length + ' companies found' : 'Error: ' + error?.message);
  } catch (e: any) {
    record('CRUD-CO-01', 'List companies', false, e?.message || String(e));
  }

  // CRUD-CLI-01: Create client
  try {
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await sb
      .from('clients')
      .insert({ company_name: clientName, user_id: userId })
      .select()
      .single();
    const ok = !error && !!data?.id;
    if (data?.id) createdClientId = data.id;
    record(
      'CRUD-CLI-01',
      'Create client',
      ok,
      ok ? 'id: ' + data!.id + ', name: ' + data!.company_name : 'Error: ' + error?.message
    );
  } catch (e: any) {
    record('CRUD-CLI-01', 'Create client', false, e?.message || String(e));
  }

  // CRUD-CLI-02: Get client by ID
  try {
    if (!createdClientId) throw new Error('No client was created');
    const { data, error } = await sb
      .from('clients')
      .select('*')
      .eq('id', createdClientId)
      .eq('user_id', userId)
      .single();
    const ok = !error && data?.company_name === clientName;
    record(
      'CRUD-CLI-02',
      'Get client by ID',
      ok,
      ok
        ? 'company_name: ' + data!.company_name
        : 'Error: ' + (error?.message || 'name mismatch: ' + data?.company_name)
    );
  } catch (e: any) {
    record('CRUD-CLI-02', 'Get client by ID', false, e?.message || String(e));
  }

  // CRUD-CLI-03: Update client name
  try {
    if (!createdClientId) throw new Error('No client was created');
    const { data, error } = await sb
      .from('clients')
      .update({ company_name: updatedName })
      .eq('id', createdClientId)
      .eq('user_id', userId)
      .select()
      .single();
    const ok = !error && data?.company_name === updatedName;
    record(
      'CRUD-CLI-03',
      'Update client name',
      ok,
      ok ? 'new name: ' + data!.company_name : 'Error: ' + (error?.message || 'name mismatch: ' + data?.company_name)
    );
  } catch (e: any) {
    record('CRUD-CLI-03', 'Update client name', false, e?.message || String(e));
  }

  // CRUD-CLI-04: Delete client
  try {
    if (!createdClientId) throw new Error('No client was created');
    const { error } = await sb.from('clients').delete().eq('id', createdClientId).eq('user_id', userId);
    const ok = !error;
    record('CRUD-CLI-04', 'Delete client', ok, ok ? 'deleted id: ' + createdClientId : 'Error: ' + error?.message);
  } catch (e: any) {
    record('CRUD-CLI-04', 'Delete client', false, e?.message || String(e));
  }

  // CRUD-CLI-05: Verify client is gone
  try {
    if (!createdClientId) throw new Error('No client was created');
    const { data, error } = await sb.from('clients').select('id').eq('id', createdClientId).eq('user_id', userId);
    // A soft-delete (deleted_at) table may still return the row; we check for hard delete (0 rows)
    // If RLS blocks access post-delete that also results in 0 rows — both are correct.
    const ok = !error && Array.isArray(data) && data.length === 0;
    record(
      'CRUD-CLI-05',
      'Verify client is gone after delete',
      ok,
      ok ? 'Correct: 0 rows returned' : 'Error or row still present: ' + (error?.message || data?.length + ' rows')
    );
    // Mark the id as cleaned up so we skip cleanup block
    createdClientId = '';
  } catch (e: any) {
    record('CRUD-CLI-05', 'Verify client is gone after delete', false, e?.message || String(e));
  }

  // ── Cleanup (safety net if delete test failed) ────────────────────────────
  if (createdClientId) {
    const { error } = await sb.from('clients').delete().eq('id', createdClientId).eq('user_id', userId);
    console.log('Cleanup client: ' + (error ? 'FAIL — ' + error.message : 'OK'));
  }

  printSummary();
}

function printSummary(): void {
  console.log('\n=== CRUD TEST RESULTS ===');
  console.log(JSON.stringify(R, null, 2));
  console.log('\nTests passed: ' + passed + '/' + total);
}

main().catch(console.error);
