/**
 * test-auth-isolation.ts
 *
 * Integration test: data isolation between users.
 *
 * Usage:
 *   TEST_USER_A_EMAIL=a@example.com TEST_USER_A_PASSWORD=... \
 *   TEST_USER_B_EMAIL=b@example.com TEST_USER_B_PASSWORD=... \
 *   tsx mcp-server/test-auth-isolation.ts
 *
 * Or place credentials in mcp-server/.env and run: tsx test-auth-isolation.ts
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './test-config';
import { getUserId, login, logout, createNewSessionState, runWithSessionContext } from './src/supabase';

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
  const emailA = process.env.TEST_USER_A_EMAIL || '';
  const passwordA = process.env.TEST_USER_A_PASSWORD || '';
  const emailB = process.env.TEST_USER_B_EMAIL || '';
  const passwordB = process.env.TEST_USER_B_PASSWORD || '';

  if (!emailA || !passwordA || !emailB || !passwordB) {
    console.log(
      'SKIP: Set TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD to run isolation tests.'
    );
    record(
      'ISO-SKIP-01',
      'Isolation suite skipped',
      true,
      'Missing credentials — set all four TEST_USER_A_* and TEST_USER_B_* env vars.'
    );
    printSummary();
    return;
  }

  // ── User A session ────────────────────────────────────────────────────────
  const sbA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  let createdClientId = '';
  let userAId = '';

  // ISO-AUTH-01: Login as user A
  try {
    const { data, error } = await sbA.auth.signInWithPassword({ email: emailA, password: passwordA });
    const ok = !error && !!data?.user?.id;
    if (data?.user?.id) userAId = data.user.id;
    record('ISO-AUTH-01', 'Login as user A', ok, ok ? 'user_id: ' + data.user!.id : 'Error: ' + error?.message);
  } catch (e: any) {
    record('ISO-AUTH-01', 'Login as user A', false, e?.message || String(e));
  }

  // ISO-AUTH-02: Create a client record as user A
  try {
    if (!userAId) throw new Error('User A not authenticated');
    const clientName = '__ISO_TEST_CLIENT_A_' + Date.now();
    const { data, error } = await sbA
      .from('clients')
      .insert({ company_name: clientName, user_id: userAId })
      .select()
      .single();
    const ok = !error && !!data?.id;
    if (data?.id) createdClientId = data.id;
    record(
      'ISO-AUTH-02',
      'Create client as user A',
      ok,
      ok ? 'client_id: ' + data!.id + ', name: ' + data!.company_name : 'Error: ' + error?.message
    );
  } catch (e: any) {
    record('ISO-AUTH-02', 'Create client as user A', false, e?.message || String(e));
  }

  // ── User B session ────────────────────────────────────────────────────────
  const sbB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  // ISO-AUTH-03: Login as user B
  try {
    const { data, error } = await sbB.auth.signInWithPassword({ email: emailB, password: passwordB });
    const ok = !error && !!data?.user?.id;
    record('ISO-AUTH-03', 'Login as user B', ok, ok ? 'user_id: ' + data.user!.id : 'Error: ' + error?.message);
  } catch (e: any) {
    record('ISO-AUTH-03', 'Login as user B', false, e?.message || String(e));
  }

  // ISO-ISOL-01: User B cannot see user A's client (filtered by user_id)
  try {
    if (!createdClientId) throw new Error('No client was created by user A — cannot test isolation');
    const { data, error } = await sbB.from('clients').select('id').eq('id', createdClientId);
    const ok = !error && Array.isArray(data) && data.length === 0;
    record(
      'ISO-ISOL-01',
      "User B cannot see user A's client by ID",
      ok,
      ok
        ? 'Correct: 0 rows returned for user A client'
        : 'Error or leak: ' + (error?.message || data?.length + ' rows returned')
    );
  } catch (e: any) {
    record('ISO-ISOL-01', "User B cannot see user A's client by ID", false, e?.message || String(e));
  }

  // ISO-ISOL-02: User B's full client list does not contain user A's client
  try {
    if (!createdClientId) throw new Error('No client was created by user A — cannot test isolation');
    const { data, error } = await sbB
      .from('clients')
      .select('id')
      .eq('user_id', (await sbB.auth.getUser()).data.user?.id ?? '');
    const containsLeak = (data || []).some((r: any) => r.id === createdClientId);
    const ok = !error && !containsLeak;
    record(
      'ISO-ISOL-02',
      "User A's client not in user B's list",
      ok,
      ok
        ? "Correct: user B's list does not contain user A's client"
        : 'Error or data leak: ' + (error?.message || 'leaked record found')
    );
  } catch (e: any) {
    record('ISO-ISOL-02', "User A's client not in user B's list", false, e?.message || String(e));
  }

  // ISO-AUTH-04: getUserId() throws when called outside an authenticated session context
  try {
    // Run inside a fresh (unauthenticated) AsyncLocalStorage context so as not to
    // interfere with the stdio singleton.
    const freshState = createNewSessionState();
    let threw = false;
    let thrownMsg = '';
    runWithSessionContext(freshState, () => {
      try {
        getUserId();
      } catch (e: any) {
        threw = true;
        thrownMsg = e?.message || String(e);
      }
    });
    const ok = threw;
    record(
      'ISO-AUTH-04',
      'getUserId() throws when not authenticated',
      ok,
      ok ? 'Correctly threw: ' + thrownMsg : 'Did not throw — unexpected success'
    );
  } catch (e: any) {
    record('ISO-AUTH-04', 'getUserId() throws when not authenticated', false, e?.message || String(e));
  }

  // ISO-AUTH-05: getUserId() works inside an authenticated session context
  try {
    const stateA = createNewSessionState();
    let resolvedId = '';
    await runWithSessionContext(stateA, async () => {
      await login(emailA, passwordA);
      resolvedId = getUserId();
    });
    const ok = !!resolvedId && resolvedId === userAId;
    record(
      'ISO-AUTH-05',
      'getUserId() returns correct id inside authenticated context',
      ok,
      ok ? 'user_id matches: ' + resolvedId : 'Mismatch or empty: got ' + resolvedId + ', expected ' + userAId
    );
  } catch (e: any) {
    record('ISO-AUTH-05', 'getUserId() works inside authenticated context', false, e?.message || String(e));
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  if (createdClientId) {
    const { error } = await sbA.from('clients').delete().eq('id', createdClientId);
    console.log('Cleanup user A client: ' + (error ? 'FAIL — ' + error.message : 'OK'));
  }

  printSummary();
}

function printSummary(): void {
  console.log('\n=== ISOLATION TEST RESULTS ===');
  console.log(JSON.stringify(R, null, 2));
  console.log('\nTests passed: ' + passed + '/' + total);
}

main().catch(console.error);
