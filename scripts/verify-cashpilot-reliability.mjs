import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import {
  buildCanonicalDashboardSnapshot,
  buildCanonicalRevenueCollectionSnapshot,
} from '../src/shared/canonicalDashboardSnapshot.js';

const DEMO_ACCOUNTS = [
  { key: 'FR', email: 'pilotage.fr.demo@cashpilot.cloud', passwordEnv: 'PILOTAGE_FR_PASSWORD' },
  { key: 'BE', email: 'pilotage.be.demo@cashpilot.cloud', passwordEnv: 'PILOTAGE_BE_PASSWORD' },
  { key: 'OHADA', email: 'pilotage.ohada.demo@cashpilot.cloud', passwordEnv: 'PILOTAGE_OHADA_PASSWORD' },
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return String(value).trim();
}

function optionalEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) return String(value).trim();
  }
  return null;
}

function isMissingCompanyScopeError(error) {
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return text.includes('company_id') && (
    text.includes('does not exist')
    || text.includes('schema cache')
    || text.includes('could not find')
    || text.includes('unknown')
  );
}

async function queryWithCompanyFallback(buildScoped, buildUnscoped) {
  const scoped = await buildScoped();
  if (!scoped.error) return scoped.data || [];
  if (isMissingCompanyScopeError(scoped.error)) {
    const unscoped = await buildUnscoped();
    if (unscoped.error) throw unscoped.error;
    return unscoped.data || [];
  }

  throw scoped.error;
}

function parseMoney(text) {
  const normalized = String(text || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:[^\d]|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseLineValue(reply, label) {
  const regex = new RegExp(`-\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^\\n]+)`, 'i');
  const match = String(reply || '').match(regex);
  return match ? match[1].trim() : null;
}

function toHash(value) {
  return createHash('sha256').update(value).digest('hex');
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

function createCheck(id, ok, details = null) {
  return { id, ok: Boolean(ok), details };
}

function extractCspBySource(vercelJsonText, source) {
  try {
    const parsed = JSON.parse(vercelJsonText);
    const block = (parsed.headers || []).find((entry) => entry.source === source);
    if (!block) return null;
    const csp = (block.headers || []).find((header) => String(header.key || '').toLowerCase() === 'content-security-policy');
    return csp?.value || null;
  } catch {
    return null;
  }
}

async function run() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = optionalEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!anonKey) {
    throw new Error('Missing SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY');
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  const checks = [];
  const accountSummaries = [];

  // Static/code checks
  const [appContent, privacyContent, legalContent, aiChatContent, analyticsContent, mcpContent, vercelConfig, invoiceGuardsMigration, encryptionDoc] = await Promise.all([
    readFile('src/App.jsx', 'utf8'),
    readFile('src/pages/PrivacyPage.jsx', 'utf8'),
    readFile('src/pages/LegalPage.jsx', 'utf8'),
    readFile('supabase/functions/ai-chatbot/index.ts', 'utf8'),
    readFile('src/utils/analyticsCalculations.js', 'utf8'),
    readFile('supabase/functions/mcp/index.ts', 'utf8'),
    readFile('vercel.json', 'utf8'),
    readFile('supabase/migrations/20260306103000_financial_coherence_guards.sql', 'utf8'),
    readFile('docs/security/encryption-at-rest.md', 'utf8'),
  ]);

  checks.push(createCheck(
    'public_legal_routes',
    appContent.includes('path="/privacy"') && appContent.includes('path="/legal"'),
    'Routes /privacy and /legal are declared in App router',
  ));
  checks.push(createCheck(
    'privacy_mentions_transfer_and_dpo',
    /dpo@cashpilot\.tech/i.test(privacyContent) && /etats-unis|usa/i.test(privacyContent) && /gemini/i.test(privacyContent),
    'Privacy page includes DPO and IA transfer disclosure',
  ));
  checks.push(createCheck(
    'legal_page_present',
    /Mentions legales/i.test(legalContent) && /dpo@cashpilot\.tech/i.test(legalContent),
    'Legal page includes legal and GDPR contact details',
  ));
  checks.push(createCheck(
    'chatbot_canonical_source',
    aiChatContent.includes('Source canonique unique CashPilot')
      && aiChatContent.includes('buildCanonicalDashboardSnapshot')
      && aiChatContent.includes('buildCanonicalRevenueCollectionSnapshot'),
    'Chatbot deterministic answers are tied to canonical snapshots',
  ));
  checks.push(createCheck(
    'chatbot_persistent_rate_limit',
    aiChatContent.includes("rpc('enforce_rate_limit'")
      && aiChatContent.includes('const enforceRateLimit = async')
      && aiChatContent.includes('rateLimitResponse(rateLimit, corsHeaders)'),
    'Chatbot uses persistent DB-backed rate limiting with fallback',
  ));
  checks.push(createCheck(
    'analytics_use_canonical_helpers',
    analyticsContent.includes('buildCanonicalRevenueCollectionSnapshot')
      && analyticsContent.includes('getCanonicalInvoiceAmount')
      && analyticsContent.includes('isCanonicalInvoiceCollected'),
    'Analytics calculations use canonical source helpers',
  ));
  const mainCsp = extractCspBySource(vercelConfig, '/(.*)');
  checks.push(createCheck(
    'csp_main_without_inline_script',
    Boolean(mainCsp)
      && /script-src/i.test(mainCsp)
      && !/script-src[^;]*'unsafe-inline'/i.test(mainCsp),
    'Main app CSP removes unsafe-inline from script-src',
  ));
  checks.push(createCheck(
    'invoice_consistency_guards_present',
    invoiceGuardsMigration.includes('invoices_total_consistency_chk')
      && invoiceGuardsMigration.includes('supplier_invoices_supplier_required_chk')
      && invoiceGuardsMigration.includes('invoices_non_negative_amounts_chk'),
    'DB migration adds invoice arithmetic and supplier-link consistency guards',
  ));
  checks.push(createCheck(
    'encryption_at_rest_documented',
    /chiffrement/i.test(encryptionDoc)
      && /supabase/i.test(encryptionDoc)
      && /storage/i.test(encryptionDoc),
    'Data-at-rest encryption is documented for DB and storage layers',
  ));
  checks.push(createCheck(
    'mcp_hardening_enabled',
    mcpContent.includes("from '../_shared/rateLimiter.ts'")
      && mcpContent.includes('validateToolArgs(')
      && mcpContent.includes('MAX_BATCH_REQUESTS')
      && mcpContent.includes('Payload too large'),
    'MCP has rate limiting + schema validation + payload guardrails',
  ));

  for (const account of DEMO_ACCOUNTS) {
    const password = optionalEnv(account.passwordEnv);
    const user = await getUserByEmail(serviceClient, account.email);
    if (!user) {
      checks.push(createCheck(`demo_${account.key}_exists`, false, `User not found: ${account.email}`));
      continue;
    }
    checks.push(createCheck(`demo_${account.key}_exists`, true, `User found: ${account.email}`));

    const userId = user.id;
    const { data: prefData } = await serviceClient
      .from('user_company_preferences')
      .select('active_company_id')
      .eq('user_id', userId)
      .maybeSingle();
    const activeCompanyId = prefData?.active_company_id || null;

    const withCompany = (table, select) => serviceClient
      .from(table)
      .select(select)
      .eq('user_id', userId)
      .or(`company_id.is.null,company_id.eq.${activeCompanyId}`);
    const withoutCompany = (table, select) => serviceClient
      .from(table)
      .select(select)
      .eq('user_id', userId);

    const invoices = await queryWithCompanyFallback(
      () => withCompany('invoices', 'id, invoice_number, status, payment_status, total_ht, total_ttc, tax_rate, date, due_date'),
      () => withoutCompany('invoices', 'id, invoice_number, status, payment_status, total_ht, total_ttc, tax_rate, date, due_date'),
    );
    const expenses = await queryWithCompanyFallback(
      () => withCompany('expenses', 'id, amount, created_at'),
      () => withoutCompany('expenses', 'id, amount, created_at'),
    );
    const payments = await queryWithCompanyFallback(
      () => withCompany('payments', 'id, amount'),
      () => withoutCompany('payments', 'id, amount'),
    );

    const { data: supplierRows, error: suppliersError } = await serviceClient
      .from('suppliers')
      .select('id')
      .eq('user_id', userId);
    if (suppliersError) throw suppliersError;

    const supplierIds = (supplierRows || []).map((row) => row.id).filter(Boolean);
    let supplierInvoices = [];
    if (supplierIds.length > 0) {
      const { data: supplierInvoiceRows, error: supplierInvoicesError } = await serviceClient
        .from('supplier_invoices')
        .select('id, total_ht, total_ttc, total_amount, vat_amount, vat_rate, supplier_id, payment_status')
        .in('supplier_id', supplierIds);
      if (supplierInvoicesError) throw supplierInvoicesError;
      supplierInvoices = supplierInvoiceRows || [];
    }

    const missingTaxRate = invoices.filter((row) => Number(row.tax_rate) <= 0 || row.tax_rate == null).length;
    const ttcMismatch = invoices.filter((row) => {
      const ht = Number(row.total_ht || 0);
      const ttc = Number(row.total_ttc || 0);
      const rate = Number(row.tax_rate || 0);
      const expected = Math.round((ht * (1 + (rate / 100))) * 100) / 100;
      return Number.isFinite(ht) && Number.isFinite(ttc) && rate > 0 && Math.abs(expected - ttc) > 0.05;
    }).length;
    const missingSupplierLink = supplierInvoices.filter((row) => !row.supplier_id).length;
    const missingSupplierVat = supplierInvoices.filter((row) => row.vat_amount == null).length;

    const dashboard = buildCanonicalDashboardSnapshot({ invoices, expenses, timesheets: [], projects: [] });
    const revenueCollection = buildCanonicalRevenueCollectionSnapshot({ invoices, expenses, payments });

    checks.push(createCheck(`demo_${account.key}_tax_rate_complete`, missingTaxRate === 0, { missingTaxRate, invoices: invoices.length }));
    checks.push(createCheck(`demo_${account.key}_ttc_consistent`, ttcMismatch === 0, { ttcMismatch, invoices: invoices.length }));
    checks.push(createCheck(`demo_${account.key}_supplier_linked`, missingSupplierLink === 0, { missingSupplierLink, supplierInvoices: supplierInvoices.length }));
    checks.push(createCheck(`demo_${account.key}_supplier_vat_present`, missingSupplierVat === 0, { missingSupplierVat, supplierInvoices: supplierInvoices.length }));

    let chatbotCoherence = createCheck(`demo_${account.key}_chatbot_canonical`, false, 'Skipped (missing demo password)');
    if (password) {
      const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
        email: account.email,
        password,
      });

      if (authError || !authData?.session?.access_token) {
        chatbotCoherence = createCheck(`demo_${account.key}_chatbot_canonical`, false, `Auth failed: ${authError?.message || 'unknown error'}`);
      } else {
        const response = await fetch(`${supabaseUrl}/functions/v1/ai-chatbot`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authData.session.access_token}`,
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'quel est mon chiffre d\'affaires ?',
            activeCompanyId,
            context: [],
          }),
        });

        if (!response.ok) {
          chatbotCoherence = createCheck(`demo_${account.key}_chatbot_canonical`, false, `HTTP ${response.status}`);
        } else {
          const body = await response.json();
          const reply = String(body?.reply || '');
          const caDashboardRaw = parseLineValue(reply, 'CA dashboard (facture)');
          const caEncaisseRaw = parseLineValue(reply, 'CA encaisse (analytics)');
          const caDashboard = parseMoney(caDashboardRaw);
          const caEncaisse = parseMoney(caEncaisseRaw);
          const expectedDashboard = Number(dashboard.metrics.revenue || 0);
          const expectedEncaisse = Number(revenueCollection.collectedRevenue || 0);
          const dashboardMatch = Number.isFinite(caDashboard) && Math.abs(caDashboard - expectedDashboard) < 0.1;
          const encaiseMatch = Number.isFinite(caEncaisse) && Math.abs(caEncaisse - expectedEncaisse) < 0.1;

          chatbotCoherence = createCheck(
            `demo_${account.key}_chatbot_canonical`,
            reply.includes('Source canonique unique CashPilot') && dashboardMatch && encaiseMatch,
            {
              caDashboardReply: caDashboard,
              caDashboardExpected: expectedDashboard,
              caEncaisseReply: caEncaisse,
              caEncaisseExpected: expectedEncaisse,
            },
          );
        }
      }
    }

    checks.push(chatbotCoherence);
    accountSummaries.push({
      account: account.key,
      invoices: invoices.length,
      supplierInvoices: supplierInvoices.length,
      canonicalRevenue: dashboard.metrics.revenue,
      canonicalCollected: revenueCollection.collectedRevenue,
    });
  }

  // MCP live checks (temporary API key)
  const firstDemo = await getUserByEmail(serviceClient, DEMO_ACCOUNTS[0].email);
  if (!firstDemo) {
    checks.push(createCheck('mcp_live_validation', false, 'Cannot run MCP smoke test: demo FR user missing'));
  } else {
    const mcpAuthHeaders = {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: anonKey,
    };

    const rawKey = `cp_test_${randomUUID().replace(/-/g, '')}`;
    const keyHash = toHash(rawKey);
    const keyPrefix = rawKey.slice(0, 8);

    const { data: apiKeyRow, error: keyInsertError } = await serviceClient
      .from('api_keys')
      .insert({
        user_id: firstDemo.id,
        name: 'codex-temp-reliability-check',
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: ['read', 'write'],
        is_active: true,
      })
      .select('id')
      .single();

    if (keyInsertError || !apiKeyRow?.id) {
      checks.push(createCheck('mcp_live_validation', false, `Cannot create API key: ${keyInsertError?.message || 'unknown'}`));
    } else {
      const mcpUrl = `${supabaseUrl}/functions/v1/mcp`;
      try {
        const invalidArgsResp = await fetch(mcpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': rawKey,
            ...mcpAuthHeaders,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              name: 'get_tax_summary',
              arguments: { start_date: 20260305, end_date: 'bad' },
            },
          }),
        });

        const invalidArgsBody = await invalidArgsResp.json();
        const invalidArgsText = JSON.stringify(invalidArgsBody);
        const validationCaught = invalidArgsResp.ok && /Invalid arguments/i.test(invalidArgsText);

        let toolRateLimited = false;
        let sampleRateBody = null;
        for (let i = 0; i < 260; i += 1) {
          const rateResp = await fetch(mcpUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': rawKey,
              ...mcpAuthHeaders,
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 2000 + i,
              method: 'tools/call',
              params: {
                name: 'not_existing_tool_for_rate_test',
                arguments: {},
              },
            }),
          });

          const rateBody = await rateResp.json();
          sampleRateBody = rateBody;
          const text = JSON.stringify(rateBody);
          if (/Rate limit exceeded/i.test(text)) {
            toolRateLimited = true;
            break;
          }
        }

        checks.push(createCheck('mcp_live_validation', validationCaught && toolRateLimited, {
          validationCaught,
          toolRateLimited,
          sampleInvalidArgsResponse: invalidArgsBody,
          sampleRateResponse: sampleRateBody,
        }));
      } finally {
        await serviceClient.from('api_keys').delete().eq('id', apiKeyRow.id);
      }
    }
  }

  const failed = checks.filter((entry) => !entry.ok);
  const result = {
    generatedAt: new Date().toISOString(),
    checks,
    accountSummaries,
    totals: {
      passed: checks.length - failed.length,
      failed: failed.length,
      total: checks.length,
    },
    failedIds: failed.map((entry) => entry.id),
  };

  console.log(JSON.stringify(result, null, 2));
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('[verify-cashpilot-reliability] fatal:', error?.message || error);
  process.exitCode = 1;
});
