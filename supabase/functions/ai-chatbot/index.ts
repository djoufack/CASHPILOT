import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  consumeCredits,
  createAuthClient,
  createServiceClient,
  HttpError,
  refundCredits,
  requireAuthenticatedUser,
} from '../_shared/billing.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';
import {
  buildCanonicalDashboardSnapshot,
  buildCanonicalRevenueCollectionSnapshot,
} from '../../../src/shared/canonicalDashboardSnapshot.js';
import { buildCanonicalOperationsSnapshot } from '../../../src/shared/canonicalOperationsSnapshot.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREDIT_COST = 2;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_MESSAGES = 12;
const MAX_CONTEXT_PARTS = 3;
const MAX_CONTEXT_PART_LENGTH = 1500;
const GEMINI_CACHE_TTL_MS = 10 * 60 * 1000;
const GEMINI_CACHE_MAX_ENTRIES = 300;
const CHATBOT_RATE_LIMIT = { maxRequests: 50, windowMs: 15 * 60 * 1000, keyPrefix: 'ai-chatbot' };
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalizeStatus = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeQuestion = (value: string) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .replace(/[’']/g, '')
  .replace(/\s+/g, ' ')
  .trim();
const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatMoney = (value: unknown) => `${toNumber(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const formatPercent = (value: unknown) => `${toNumber(value).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const hasAnyKeyword = (text: string, keywords: string[]) => keywords.some((keyword) => text.includes(keyword));
const looksLikeFactualQuestion = (text: string) => /\b(quel|quelle|quels|quelles|combien|donne|montre|affiche|what|how much|c est quoi|c'est quoi|solde|total)\b/.test(text);
const geminiReplyCache = new Map<string, { reply: string; expiresAt: number }>();

type CanonicalAssistantFacts = {
  companyName: string;
  dashboard: ReturnType<typeof buildCanonicalDashboardSnapshot>;
  revenueCollection: ReturnType<typeof buildCanonicalRevenueCollectionSnapshot>;
  operations: ReturnType<typeof buildCanonicalOperationsSnapshot>;
  counts: {
    clients: number;
    projects: number;
    timesheets: number;
    quotes: number;
    invoices: number;
    payments: number;
    purchaseOrders: number | null;
    deliveryNotes: number | null;
    recurringInvoices: number | null;
    creditNotes: number | null;
    bankTransactions: number | null;
    receivables: number | null;
    payables: number | null;
  };
  activeCompanyId: string | null;
  currentPath: string | null;
};

const buildDeterministicMetricReply = (
  message: string,
  canonicalFacts: CanonicalAssistantFacts,
) => {
  const normalized = normalizeQuestion(message);
  if (!looksLikeFactualQuestion(normalized)) return null;

  const dashboard = canonicalFacts.dashboard.metrics;
  const revenueCollection = canonicalFacts.revenueCollection;
  const operations = canonicalFacts.operations;
  const counts = canonicalFacts.counts;
  const companyName = canonicalFacts.companyName || "l'entreprise";

  if (hasAnyKeyword(normalized, ['tableau de bord', 'dashboard', 'kpi', 'indicateur', 'tous les chiffres', 'tous les indicateurs'])) {
    return [
      `Source canonique unique CashPilot - ${companyName}`,
      `- CA dashboard (facture): ${formatMoney(dashboard.revenue)}`,
      `- CA encaisse (analytics): ${formatMoney(revenueCollection.collectedRevenue)}`,
      `- Depenses: ${formatMoney(dashboard.totalExpenses)}`,
      `- Marge dashboard: ${formatPercent(dashboard.profitMargin)}`,
      `- Marge brute encaisee: ${formatPercent(revenueCollection.grossMarginPct)}`,
      `- Creances a encaisser: ${formatMoney(revenueCollection.outstandingReceivables)}`,
      `- Factures en retard: ${revenueCollection.invoicesOverdueCount}`,
    ].join('\n');
  }

  const asksForRevenue = hasAnyKeyword(normalized, ['chiffre daffaires', 'revenu', 'revenue'])
    || /(^|\W)ca(\W|$)/.test(normalized);

  if (asksForRevenue) {
    return [
      `Source canonique unique CashPilot - ${companyName}`,
      `- CA dashboard (facture): ${formatMoney(dashboard.revenue)}`,
      `- CA encaisse (analytics): ${formatMoney(revenueCollection.collectedRevenue)}`,
      `- CA en attente: ${formatMoney(revenueCollection.outstandingReceivables)}`,
      `- CA en retard: ${formatMoney(revenueCollection.overdueReceivables)} (${revenueCollection.invoicesOverdueCount} facture(s))`,
    ].join('\n');
  }

  if (hasAnyKeyword(normalized, ['encaisse', 'encaissement', 'collected', 'collecte'])) {
    return [
      `Source canonique unique CashPilot - ${companyName}`,
      `- Encaissements canoniques (CA encaisse): ${formatMoney(revenueCollection.collectedRevenue)}`,
      `- Taux d'encaissement: ${formatPercent(revenueCollection.collectionRate)}`,
      `- Paiements enregistres (journal paiements): ${formatMoney(revenueCollection.paymentsRecorded)}`,
    ].join('\n');
  }

  if (hasAnyKeyword(normalized, ['depense', 'charge', 'cout', 'cost', 'expense'])) {
    return [
      `Source canonique unique CashPilot - ${companyName}`,
      `- Depenses totales: ${formatMoney(dashboard.totalExpenses)}`,
      `- Resultat net dashboard (CA - depenses): ${formatMoney(dashboard.netCashFlow)}`,
      `- Marge nette dashboard: ${formatPercent(dashboard.profitMargin)}`,
    ].join('\n');
  }

  if (hasAnyKeyword(normalized, ['marge', 'margin', 'profit'])) {
    return [
      `Source canonique unique CashPilot - ${companyName}`,
      `- Marge nette dashboard: ${formatPercent(dashboard.profitMargin)}`,
      `- Marge brute analytics: ${formatPercent(revenueCollection.grossMarginPct)}`,
      `- Resultat net dashboard: ${formatMoney(dashboard.netCashFlow)}`,
      `- Marge brute (CA encaisse - depenses): ${formatMoney(revenueCollection.grossMargin)}`,
    ].join('\n');
  }

  if (hasAnyKeyword(normalized, ['creance', 'a encaisser', 'impaye', 'receivable', 'outstanding'])) {
    return [
      `Source canonique unique CashPilot - ${companyName}`,
      `- Creances a encaisser: ${formatMoney(revenueCollection.outstandingReceivables)}`,
      `- Dont en retard: ${formatMoney(revenueCollection.overdueReceivables)}`,
      `- Factures en attente: ${revenueCollection.invoicesOutstandingCount}`,
      `- Factures en retard: ${revenueCollection.invoicesOverdueCount}`,
    ].join('\n');
  }

  if (hasAnyKeyword(normalized, ['facture', 'invoice'])) {
    return [
      `Source canonique unique CashPilot - ${companyName}`,
      `- Nombre total de factures: ${counts.invoices}`,
      `- Factures comptabilisees (hors brouillon/annulees): ${revenueCollection.invoicesBookedCount}`,
      `- Factures encaissees: ${revenueCollection.invoicesCollectedCount}`,
      `- Factures en attente: ${revenueCollection.invoicesOutstandingCount}`,
      `- Factures en retard: ${revenueCollection.invoicesOverdueCount}`,
    ].join('\n');
  }

  if (hasAnyKeyword(normalized, ['client', 'projet', 'devis', 'quote'])) {
    return [
      `Source canonique unique CashPilot - ${companyName}`,
      `- Clients: ${counts.clients}`,
      `- Projets: ${counts.projects}`,
      `- Devis: ${counts.quotes}`,
      `- Feuilles de temps: ${counts.timesheets}`,
    ].join('\n');
  }

  if (hasAnyKeyword(normalized, ['fournisseur', 'supplier', 'achat', 'purchase', 'stock', 'banque', 'bank'])) {
    return [
      `Source canonique unique CashPilot - ${companyName}`,
      `- Fournisseurs: ${operations.suppliers.totalSuppliers}`,
      `- Factures fournisseurs: ${operations.suppliers.supplierInvoices.totalCount}`,
      `- Commandes fournisseurs: ${operations.purchases.totalOrders}`,
      `- Connexions bancaires: ${operations.bank.totalConnections}`,
      `- Solde banque synchronisable: ${formatMoney(operations.bank.totalBalance)}`,
    ].join('\n');
  }

  return null;
};

const applyCompanyScope = (
  query: any,
  activeCompanyId: string | null,
  { includeUnassigned = true }: { includeUnassigned?: boolean } = {},
) => {
  if (!activeCompanyId) return query;

  if (includeUnassigned) {
    return query.or(`company_id.is.null,company_id.eq.${activeCompanyId}`);
  }

  return query.eq('company_id', activeCompanyId);
};

const stringifyQueryError = (
  error: { message?: string | null; details?: string | null; hint?: string | null } | null | undefined,
) => [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();

const isMissingCompanyScopeError = (
  error: { message?: string | null; details?: string | null; hint?: string | null } | null | undefined,
) => {
  const text = stringifyQueryError(error);
  if (!text) return false;
  return text.includes('company_id')
    && (
      text.includes('does not exist')
      || text.includes('could not find')
      || text.includes('schema cache')
      || text.includes('unknown')
    );
};

const isMissingRelationOrColumnError = (
  error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined,
) => {
  const text = stringifyQueryError(error);
  if (!text) return false;
  return (
    text.includes('does not exist')
    || text.includes('could not find the table')
    || text.includes('schema cache')
    || text.includes('unknown')
    || error?.code === '42P01'
    || error?.code === '42703'
    || error?.code === 'PGRST205'
  );
};

const executeScopedQueryWithFallback = async (
  name: string,
  runScoped: () => Promise<any>,
  runUnscoped: (() => Promise<any>) | null,
) => {
  const primary = await runScoped();
  if (!primary?.error) return primary;

  if (runUnscoped && isMissingCompanyScopeError(primary.error)) {
    console.warn(`[ai-chatbot] ${name}: company scope unavailable, retrying without company filter.`);
    return runUnscoped();
  }

  return primary;
};

const coerceOptionalListResult = (name: string, response: any) => {
  if (!response?.error) return response;
  if (!isMissingRelationOrColumnError(response.error)) return response;
  console.warn(`[ai-chatbot] ${name}: optional dataset unavailable (${response.error?.message}). Using empty list.`);
  return {
    ...response,
    data: [],
    error: null,
  };
};

const coerceOptionalSingleResult = (name: string, response: any) => {
  if (!response?.error) return response;
  if (!isMissingRelationOrColumnError(response.error)) return response;
  console.warn(`[ai-chatbot] ${name}: optional dataset unavailable (${response.error?.message}). Using empty object.`);
  return {
    ...response,
    data: null,
    error: null,
  };
};

const resolveActiveCompanyId = async (
  supabase: ReturnType<typeof createAuthClient>,
  userId: string,
  requestedCompanyId: unknown,
) => {
  if (typeof requestedCompanyId === 'string' && UUID_REGEX.test(requestedCompanyId)) {
    return requestedCompanyId;
  }

  const { data: prefData } = await supabase
    .from('user_company_preferences')
    .select('active_company_id')
    .eq('user_id', userId)
    .maybeSingle();

  return prefData?.active_company_id || null;
};

const sample = <T>(rows: T[] | null | undefined, size = 20) => (Array.isArray(rows) ? rows.slice(0, size) : []);

const fetchScopedCount = async (
  supabase: ReturnType<typeof createAuthClient>,
  table: string,
  activeCompanyId: string | null,
) => {
  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true });

  query = applyCompanyScope(query, activeCompanyId);

  const { count, error } = await query;
  if (error) {
    console.warn(`[ai-chatbot] count query failed for ${table}:`, error.message);
    return null;
  }

  return count ?? 0;
};

type RateLimitCheck = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const enforceRateLimit = async (
  serviceClient: ReturnType<typeof createServiceClient>,
  scope: string,
  rateKey: string,
  config: { maxRequests: number; windowMs: number; keyPrefix: string },
): Promise<RateLimitCheck> => {
  const windowSeconds = Math.max(1, Math.floor(config.windowMs / 1000));
  const persistentRateKey = `${scope}:${rateKey}`;

  try {
    const { data, error } = await serviceClient.rpc('enforce_rate_limit', {
      p_scope: scope,
      p_rate_key: persistentRateKey,
      p_max_requests: config.maxRequests,
      p_window_seconds: windowSeconds,
    });

    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        const resetAt = new Date(String(row.reset_at || '')).getTime();
        return {
          allowed: Boolean(row.allowed),
          remaining: Number(row.remaining ?? 0),
          resetAt: Number.isFinite(resetAt) ? resetAt : (Date.now() + config.windowMs),
        };
      }
    }
  } catch (_) {
    // Fall through to in-memory fallback when RPC is unavailable.
  }

  const fallback = checkRateLimit(persistentRateKey, config);
  return {
    allowed: fallback.allowed,
    remaining: fallback.remaining,
    resetAt: fallback.resetAt,
  };
};

const assertNoCriticalQueryError = (
  responses: Array<{ name: string; error: { message: string; code?: string | null; details?: string | null; hint?: string | null } | null }>,
) => {
  const failed = responses.filter((response) => response.error);
  if (failed.length === 0) return;

  console.error('[ai-chatbot] canonical query errors:', failed.map((response) => ({
    query: response.name,
    error: response.error,
  })));

  const failedNames = failed.map((response) => response.name).join(', ');
  throw new HttpError(500, `Impossible de charger les donnees canoniques (${failedNames})`);
};

const sanitizeUserMessage = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim();
};

const escapeXml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const sanitizeConversationContext = (
  value: unknown,
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> => {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((rawEntry) => {
      const entry = (rawEntry && typeof rawEntry === 'object')
        ? rawEntry as { role?: unknown; parts?: unknown }
        : {};
      const role = entry.role === 'model' ? 'model' : 'user';
      const rawParts = Array.isArray(entry.parts) ? entry.parts : [];
      const parts = rawParts
        .map((rawPart) => {
          const part = (rawPart && typeof rawPart === 'object')
            ? rawPart as { text?: unknown }
            : {};
          return sanitizeUserMessage(part.text).slice(0, MAX_CONTEXT_PART_LENGTH);
        })
          .filter((text) => Boolean(text))
          .slice(0, MAX_CONTEXT_PARTS)
          .map((text) => ({ text }));

      if (parts.length === 0) return null;
      return { role, parts };
    })
    .filter((entry): entry is { role: 'user' | 'model'; parts: Array<{ text: string }> } => Boolean(entry));
};

const pruneGeminiCache = () => {
  const now = Date.now();
  for (const [key, entry] of geminiReplyCache.entries()) {
    if (entry.expiresAt <= now) {
      geminiReplyCache.delete(key);
    }
  }
};

const readGeminiCache = (cacheKey: string) => {
  const cached = geminiReplyCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    geminiReplyCache.delete(cacheKey);
    return null;
  }
  return cached.reply;
};

const writeGeminiCache = (cacheKey: string, reply: string) => {
  pruneGeminiCache();
  if (geminiReplyCache.size >= GEMINI_CACHE_MAX_ENTRIES) {
    const oldestKey = geminiReplyCache.keys().next().value;
    if (oldestKey) geminiReplyCache.delete(oldestKey);
  }
  geminiReplyCache.set(cacheKey, { reply, expiresAt: Date.now() + GEMINI_CACHE_TTL_MS });
};

const sha256Hex = async (input: string) => {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createServiceClient();
  let resolvedUserId = '';
  let creditConsumption = null;

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const scopedSupabase = createAuthClient(authHeader);
    const authUser = await requireAuthenticatedUser(req);
    const payload = await req.json();
    const userId = payload?.userId;
    const activeCompanyId = payload?.activeCompanyId;
    const message = sanitizeUserMessage(payload?.message);
    const context = sanitizeConversationContext(payload?.context);
    const currentPath = typeof payload?.currentPath === 'string'
      ? payload.currentPath.slice(0, 300)
      : null;
    resolvedUserId = authUser.id;

    if ((userId && userId !== resolvedUserId) || !message) {
      return new Response(JSON.stringify({ error: 'Missing userId or message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return new Response(JSON.stringify({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const rateLimit = await enforceRateLimit(
      supabase,
      'ai-chatbot',
      resolvedUserId,
      CHATBOT_RATE_LIMIT,
    );
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, corsHeaders);
    }

    const resolvedActiveCompanyId = await resolveActiveCompanyId(scopedSupabase, resolvedUserId, activeCompanyId);

    const withCompanyScopeFallback = (name: string, buildQuery: (withScope: boolean) => any) => (
      executeScopedQueryWithFallback(
        name,
        () => buildQuery(Boolean(resolvedActiveCompanyId)),
        resolvedActiveCompanyId ? (() => buildQuery(false)) : null,
      )
    );

    const [
      invoicesRes,
      expensesRes,
      clientsRes,
      paymentsRes,
      timesheetsRes,
      projectsRes,
      quotesRes,
      suppliersRes,
      productsRes,
      supplierOrdersRes,
      supplierInvoicesRes,
      bankConnectionsRes,
      profileRes,
      companyRes,
      purchaseOrdersCount,
      deliveryNotesCount,
      recurringInvoicesCount,
      creditNotesCount,
      bankTransactionsCount,
      receivablesCount,
      payablesCount,
    ] = await Promise.all([
      withCompanyScopeFallback('invoices', (withScope) => {
        let query = scopedSupabase
          .from('invoices')
          .select(`
            id,
            invoice_number,
            total_ttc,
            total_ht,
            status,
            due_date,
            created_at,
            client:clients(company_name),
            items:invoice_items(total, quantity, unit_price, item_type, product_id, service_id)
          `)
          .order('created_at', { ascending: false });
        if (withScope) query = applyCompanyScope(query, resolvedActiveCompanyId);
        return query;
      }),
      withCompanyScopeFallback('expenses', (withScope) => {
        let query = scopedSupabase
          .from('expenses')
          .select('id, description, amount, category, created_at')
          .order('created_at', { ascending: false });
        if (withScope) query = applyCompanyScope(query, resolvedActiveCompanyId);
        return query;
      }),
      withCompanyScopeFallback('clients', (withScope) => {
        let query = scopedSupabase
          .from('clients')
          .select('id, company_name, contact_name, email, created_at')
          .order('created_at', { ascending: false });
        if (withScope) query = applyCompanyScope(query, resolvedActiveCompanyId);
        return query;
      }),
      withCompanyScopeFallback('payments', (withScope) => {
        let query = scopedSupabase
          .from('payments')
          .select('id, amount, payment_date, payment_method, created_at')
          .order('created_at', { ascending: false });
        if (withScope) query = applyCompanyScope(query, resolvedActiveCompanyId);
        return query;
      }),
      withCompanyScopeFallback('timesheets', (withScope) => {
        let query = scopedSupabase
          .from('timesheets')
          .select('id, duration_minutes, date, created_at')
          .order('created_at', { ascending: false });
        if (withScope) query = applyCompanyScope(query, resolvedActiveCompanyId);
        return query;
      }),
      withCompanyScopeFallback('projects', (withScope) => {
        let query = scopedSupabase
          .from('projects')
          .select('id, name, budget_hours, status, created_at')
          .order('created_at', { ascending: false });
        if (withScope) query = applyCompanyScope(query, resolvedActiveCompanyId);
        return query;
      }),
      withCompanyScopeFallback('quotes', (withScope) => {
        let query = scopedSupabase
          .from('quotes')
          .select('id, quote_number, status, total_ttc, created_at')
          .order('created_at', { ascending: false });
        if (withScope) query = applyCompanyScope(query, resolvedActiveCompanyId);
        return query;
      }).then((response) => coerceOptionalListResult('quotes', response)),
      withCompanyScopeFallback('suppliers', (withScope) => {
        let query = scopedSupabase
          .from('suppliers')
          .select('id, status, created_at')
          .order('created_at', { ascending: false });
        if (withScope) query = applyCompanyScope(query, resolvedActiveCompanyId);
        return query;
      }).then((response) => coerceOptionalListResult('suppliers', response)),
      withCompanyScopeFallback('products', (withScope) => {
        let query = scopedSupabase
          .from('products')
          .select('id, stock_quantity, min_stock_level, created_at')
          .order('created_at', { ascending: false });
        if (withScope) query = applyCompanyScope(query, resolvedActiveCompanyId);
        return query;
      }).then((response) => coerceOptionalListResult('products', response)),
      withCompanyScopeFallback('supplier_orders', (withScope) => {
        let query = scopedSupabase
          .from('supplier_orders')
          .select('id, order_status, total_amount, created_at')
          .order('created_at', { ascending: false });
        if (withScope) query = applyCompanyScope(query, resolvedActiveCompanyId);
        return query;
      }).then((response) => coerceOptionalListResult('supplier_orders', response)),
      withCompanyScopeFallback('supplier_invoices', (withScope) => {
        let query = scopedSupabase
          .from('supplier_invoices')
          .select('id, payment_status, total_amount, due_date, created_at')
          .order('created_at', { ascending: false });
        if (withScope) query = applyCompanyScope(query, resolvedActiveCompanyId);
        return query;
      }).then((response) => coerceOptionalListResult('supplier_invoices', response)),
      withCompanyScopeFallback('bank_connections', (withScope) => {
        let query = scopedSupabase
          .from('bank_connections')
          .select('id, status, account_id, account_balance, account_currency, created_at')
          .eq('user_id', resolvedUserId)
          .order('created_at', { ascending: false });
        if (withScope) {
          query = applyCompanyScope(
            query,
            resolvedActiveCompanyId,
            { includeUnassigned: false },
          );
        }
        return query;
      }).then((response) => coerceOptionalListResult('bank_connections', response)),
      scopedSupabase
        .from('profiles')
        .select('company_name')
        .eq('user_id', resolvedUserId)
        .maybeSingle()
        .then((response) => coerceOptionalSingleResult('profiles', response)),
      (() => {
        let companyQuery = scopedSupabase
          .from('company')
          .select('id, company_name')
          .order('created_at', { ascending: true })
          .limit(1);
        if (resolvedActiveCompanyId) {
          companyQuery = companyQuery.eq('id', resolvedActiveCompanyId);
        }
        return companyQuery
          .maybeSingle()
          .then((response) => coerceOptionalSingleResult('company', response));
      })(),
      fetchScopedCount(scopedSupabase, 'purchase_orders', resolvedActiveCompanyId),
      fetchScopedCount(scopedSupabase, 'delivery_notes', resolvedActiveCompanyId),
      fetchScopedCount(scopedSupabase, 'recurring_invoices', resolvedActiveCompanyId),
      fetchScopedCount(scopedSupabase, 'credit_notes', resolvedActiveCompanyId),
      fetchScopedCount(scopedSupabase, 'bank_transactions', resolvedActiveCompanyId),
      fetchScopedCount(scopedSupabase, 'receivables', resolvedActiveCompanyId),
      fetchScopedCount(scopedSupabase, 'payables', resolvedActiveCompanyId),
    ]);

    assertNoCriticalQueryError([
      { name: 'invoices', error: invoicesRes.error },
      { name: 'expenses', error: expensesRes.error },
      { name: 'payments', error: paymentsRes.error },
      { name: 'timesheets', error: timesheetsRes.error },
      { name: 'projects', error: projectsRes.error },
      { name: 'clients', error: clientsRes.error },
    ]);

    creditConsumption = await consumeCredits(supabase, resolvedUserId, CREDIT_COST, 'AI Chatbot');

    // Calculate financial summary (bilan)
    const invoices = invoicesRes.data || [];
    const expenses = expensesRes.data || [];
    const payments = paymentsRes.data || [];
    const timesheets = timesheetsRes.data || [];
    const projects = projectsRes.data || [];
    const quotes = quotesRes.data || [];
    const suppliers = suppliersRes.data || [];
    const products = productsRes.data || [];
    const supplierOrders = supplierOrdersRes.data || [];
    const supplierInvoices = supplierInvoicesRes.data || [];
    const bankConnections = bankConnectionsRes.data || [];
    const canonicalDashboard = buildCanonicalDashboardSnapshot({
      invoices,
      expenses,
      timesheets,
      projects,
    });
    const canonicalRevenueCollection = buildCanonicalRevenueCollectionSnapshot({
      invoices,
      expenses,
      payments,
    });
    const canonicalOperations = buildCanonicalOperationsSnapshot({
      suppliers,
      products,
      supplierOrders,
      supplierInvoices,
      bankConnections,
    });

    const totalRevenue = canonicalDashboard.metrics.revenue;
    const totalExpenses = canonicalDashboard.metrics.totalExpenses;
    const profitMargin = canonicalDashboard.metrics.profitMargin;
    const occupancyRate = canonicalDashboard.metrics.occupancyRate;
    const revenueTrend = canonicalDashboard.metrics.revenueTrend;
    const marginTrend = canonicalDashboard.metrics.marginTrend;
    const occupancyTrend = canonicalDashboard.metrics.occupancyTrend;
    const totalPaid = canonicalRevenueCollection.collectedRevenue;
    const totalUnpaid = canonicalRevenueCollection.outstandingReceivables;
    const overdueInvoicesCount = canonicalRevenueCollection.invoicesOverdueCount;
    const quoteCountByStatus = quotes.reduce((acc, quote) => {
      const status = normalizeStatus(quote.status) || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const resolvedCompanyName = companyRes.data?.company_name || profileRes.data?.company_name || 'l\'entreprise';
    const escapedCompanyName = escapeXml(resolvedCompanyName);
    const canonicalFacts: CanonicalAssistantFacts = {
      companyName: resolvedCompanyName,
      dashboard: canonicalDashboard,
      revenueCollection: canonicalRevenueCollection,
      operations: canonicalOperations,
      counts: {
        clients: clientsRes.data?.length || 0,
        projects: projects.length,
        timesheets: timesheets.length,
        quotes: quotes.length,
        invoices: invoices.length,
        payments: payments.length,
        purchaseOrders: purchaseOrdersCount,
        deliveryNotes: deliveryNotesCount,
        recurringInvoices: recurringInvoicesCount,
        creditNotes: creditNotesCount,
        bankTransactions: bankTransactionsCount,
        receivables: receivablesCount,
        payables: payablesCount,
      },
      activeCompanyId: resolvedActiveCompanyId,
      currentPath: currentPath || null,
    };

    const deterministicReply = buildDeterministicMetricReply(message, canonicalFacts);
    if (deterministicReply) {
      return new Response(JSON.stringify({
        success: true,
        reply: deterministicReply,
        source: 'canonical-facts',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const systemPrompt = `Tu es l'EXPERT-COMPTABLE & DIRECTEUR FINANCIER (CFO) DIGITAL de ${escapedCompanyName}.

Tu combines l'expertise d'un cabinet comptable traditionnel ET d'un directeur financier expérimenté. Tu es responsable de:
- La gestion comptable, fiscale et réglementaire (rôle Expert-Comptable)
- La stratégie financière et le pilotage de la performance (rôle CFO/Finance d'Entreprise)

═══════════════════════════════════════════════════════════════════
📊 SITUATION FINANCIÈRE ACTUELLE
═══════════════════════════════════════════════════════════════════

💰 RÉSULTATS FINANCIERS:
- Chiffre d'affaires total: ${totalRevenue.toFixed(2)}€
- Dépenses totales: ${totalExpenses.toFixed(2)}€
- Résultat net (CA - Dépenses): ${(canonicalDashboard.metrics.netCashFlow).toFixed(2)}€
- Marge nette: ${profitMargin.toFixed(1)}%
- Taux d'occupation: ${occupancyRate.toFixed(1)}%
- Tendance CA (mois courant vs précédent): ${revenueTrend.toFixed(1)}%
- Tendance marge (mois courant vs précédent): ${marginTrend.toFixed(1)}%
- Tendance occupation (mois courant vs précédent): ${occupancyTrend.toFixed(1)}%

📈 DÉCOMPOSITION DU CA (moteur canonique commun UI + assistant):
- Revenus produits: ${canonicalDashboard.revenueByType.product.toFixed(2)}€
- Revenus services: ${canonicalDashboard.revenueByType.service.toFixed(2)}€
- Revenus autres: ${canonicalDashboard.revenueByType.other.toFixed(2)}€

💳 TRÉSORERIE & CRÉANCES:
- Encaissements canoniques (CA encaissé): ${totalPaid.toFixed(2)}€
- Créances clients (à encaisser): ${totalUnpaid.toFixed(2)}€
- Nombre de factures en attente: ${canonicalRevenueCollection.invoicesOutstandingCount}
- ⚠️ ALERTE: ${overdueInvoicesCount} facture(s) en RETARD de paiement
- Taux d'encaissement: ${canonicalRevenueCollection.collectionRate.toFixed(1)}%
- Paiements enregistrés (journal paiements): ${canonicalRevenueCollection.paymentsRecorded.toFixed(2)}€

📦 ACTIVITÉ OPÉRATIONNELLE:
- Nombre de clients: ${clientsRes.data?.length || 0}
- Nombre de projets: ${projects.length}
- Nombre de feuilles de temps: ${timesheets.length}
- Nombre de devis: ${quotes.length}
- Devis par statut: ${JSON.stringify(quoteCountByStatus)}

📚 AUTRES MODULES (SCOPE SOCIÉTÉ ACTIF):
${JSON.stringify({
  suppliers_count: canonicalOperations.suppliers.totalSuppliers,
  supplier_invoices_count: canonicalOperations.suppliers.supplierInvoices.totalCount,
  supplier_orders_count: canonicalOperations.purchases.totalOrders,
  purchase_orders_count: purchaseOrdersCount,
  delivery_notes_count: deliveryNotesCount,
  recurring_invoices_count: recurringInvoicesCount,
  credit_notes_count: creditNotesCount,
  bank_connections_count: canonicalOperations.bank.totalConnections,
  bank_transactions_count: bankTransactionsCount,
  receivables_count: receivablesCount,
  payables_count: payablesCount,
}, null, 2)}

👥 PORTEFEUILLE CLIENTS (${clientsRes.data?.length || 0} clients actifs):
${JSON.stringify(sample(clientsRes.data, 20), null, 2)}

📄 FACTURES RÉCENTES (${invoices.length} factures):
${JSON.stringify(sample(invoices, 20), null, 2)}

💰 HISTORIQUE PAIEMENTS (${payments.length} paiements):
${JSON.stringify(sample(payments, 20), null, 2)}

💸 DÉPENSES PAR CATÉGORIE (${expenses.length} dépenses):
${JSON.stringify(sample(expenses, 20), null, 2)}

🧭 KPIS CANONIQUES DASHBOARD:
${JSON.stringify(canonicalDashboard.metrics, null, 2)}

🧮 KPIS CANONIQUES REVENUS / ENCAISSEMENTS / CRÉANCES:
${JSON.stringify(canonicalRevenueCollection, null, 2)}

🧩 KPIS CANONIQUES OPÉRATIONS (Fournisseurs / Achats / Banque):
${JSON.stringify(canonicalOperations, null, 2)}

📌 SOURCE UNIQUE DE VÉRITÉ (à utiliser pour tous les chiffres affichés):
${JSON.stringify(canonicalFacts, null, 2)}

🏢 INFORMATIONS SOCIÉTÉ:
${JSON.stringify({
  ...(profileRes.data || {}),
  ...(companyRes.data || {}),
  active_company_id: resolvedActiveCompanyId,
}, null, 2)}

🖥️ CONTEXTE UI ACTUEL:
${JSON.stringify({
  current_path: currentPath || null,
}, null, 2)}

═══════════════════════════════════════════════════════════════════
🎯 TES RÔLES : EXPERT-COMPTABLE + CFO (DIRECTEUR FINANCIER)
═══════════════════════════════════════════════════════════════════

🏦 PARTIE 1 : EXPERTISE COMPTABLE & FISCALE

1. 📋 COMPTABILITÉ & CONFORMITÉ:
   - Analyser et valider la cohérence des écritures comptables
   - Identifier les anomalies ou incohérences dans les données
   - Vérifier la conformité fiscale (TVA, charges sociales, impôts)
   - Rappeler les obligations déclaratives et échéances légales
   - Optimiser la charge fiscale dans le cadre légal

2. ⚡ ALERTES & RELANCES:
   - Signaler les factures en retard et suggérer des actions de recouvrement
   - Alerter sur les dépenses anormales ou inhabituelles
   - Rappeler les échéances fiscales importantes
   - Identifier les opportunités de trésorerie

💼 PARTIE 2 : FINANCE D'ENTREPRISE (CFO)

3. 📊 PILOTAGE FINANCIER & PERFORMANCE:
   - Calculer et suivre les KPIs financiers (marge, EBITDA, ROI, BFR, DSO, DPO)
   - Analyser la rentabilité par client, produit ou service
   - Comparer les périodes pour identifier les tendances et saisonnalités
   - Établir des tableaux de bord de pilotage (dashboard financier)
   - Détecter les leviers de croissance et d'optimisation

4. 💰 STRATÉGIE FINANCIÈRE & TRÉSORERIE:
   - Optimiser le besoin en fonds de roulement (BFR)
   - Gérer et prévoir la trésorerie (cash flow prévisionnel)
   - Conseiller sur la politique de prix et marges
   - Recommander des stratégies de financement (fonds propres, dette, subventions)
   - Analyser la structure financière optimale (ratio dette/fonds propres)

5. 📈 PRÉVISIONS & BUSINESS PLAN:
   - Établir des budgets prévisionnels et plans de trésorerie
   - Modéliser des scénarios financiers (best/worst case)
   - Calculer le point mort (seuil de rentabilité)
   - Évaluer la valorisation de l'entreprise
   - Préparer des dossiers pour levées de fonds ou crédits bancaires

6. ⚠️ GESTION DES RISQUES FINANCIERS:
   - Identifier les risques clients (impayés, concentration)
   - Analyser la santé financière des clients importants
   - Recommander des couvertures (assurance-crédit, garanties)
   - Détecter les signaux de tension de trésorerie
   - Proposer des plans d'action préventifs

7. 🎯 CONSEIL STRATÉGIQUE HAUT NIVEAU:
   - Recommander des investissements ou désinvestissements
   - Analyser la rentabilité de projets (VAN, TRI, ROI)
   - Conseiller sur des opérations de M&A (acquisitions, cessions)
   - Optimiser la structure de coûts (fixes vs variables)
   - Suggérer des stratégies de croissance externe ou interne

8. 🎓 PÉDAGOGIE & FORMATION:
   - Expliquer les concepts financiers complexes simplement
   - Justifier tes recommandations avec des chiffres concrets
   - Former le dirigeant aux bonnes pratiques de gestion financière
   - Vulgariser les indicateurs financiers et leur interprétation

═══════════════════════════════════════════════════════════════════
✅ RÈGLES DE CONDUITE PROFESSIONNELLE
═══════════════════════════════════════════════════════════════════

- ✓ Utilise EXCLUSIVEMENT les vraies données ci-dessus (aucune invention)
- ✓ Les objets "SOURCE UNIQUE DE VÉRITÉ" et "KPIS canoniques" sont la source absolue
- ✓ N'affiche JAMAIS un chiffre qui n'existe pas dans ces objets
- ✓ N'invente aucun total, aucun arrondi, aucune période implicite
- ✓ Si une donnée manque, dis-le explicitement au lieu d'estimer
- ✓ Sois PROACTIF: anticipe les besoins, alerte sur les risques, propose des solutions
- ✓ Sois PRÉCIS: chiffre tes analyses, cite les sources de tes calculs
- ✓ Sois PÉDAGOGUE: explique le "pourquoi" de tes recommandations
- ✓ Sois ACTIONNABLE: donne des conseils concrets et applicables immédiatement
- ✓ Respecte la RÉGLEMENTATION: base tes conseils fiscaux sur la législation FR/BE/OHADA
- ✓ Adopte un ton PROFESSIONNEL mais ACCESSIBLE (évite le jargon inutile)
- ✓ Structure tes réponses avec des sections claires (émojis bienvenus pour la lisibilité)

Maintenant, en tant qu'expert-comptable de cette entreprise, réponds à la question de ton client de manière complète et professionnelle.`;

    const geminiCacheKey = await sha256Hex(JSON.stringify({
      user_id: resolvedUserId,
      company_id: resolvedActiveCompanyId,
      current_path: currentPath,
      message,
      context,
      canonical_metrics: canonicalFacts.dashboard.metrics,
      canonical_revenue: canonicalFacts.revenueCollection,
      canonical_operations: canonicalFacts.operations,
    }));
    const cachedGeminiReply = readGeminiCache(geminiCacheKey);
    if (cachedGeminiReply) {
      return new Response(JSON.stringify({
        success: true,
        reply: cachedGeminiReply,
        source: 'gemini-cache',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Compris. En tant qu\'expert-comptable de votre entreprise, je suis à votre disposition pour vous accompagner dans la gestion comptable, fiscale et financière. Je vais analyser vos données en temps réel et vous apporter des conseils stratégiques personnalisés.' }] },
          ...context,
          { role: 'user', parts: [{ text: message }] },
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 2048,
          topP: 0.9,
          topK: 40
        },
      }),
    });

    if (!geminiRes.ok) {
      const geminiError = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, geminiError);
      throw new Error('Gemini API error');
    }

    const result = await geminiRes.json();
    console.log('Gemini result structure:', JSON.stringify(result, null, 2));
    const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Désolé, je n\'ai pas pu répondre.';
    console.log('Extracted reply:', reply);
    writeGeminiCache(geminiCacheKey, reply);

    return new Response(JSON.stringify({ success: true, reply, source: 'gemini-live' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase, resolvedUserId, creditConsumption, 'AI Chatbot - error');
      } catch {
        // Ignore secondary refund/auth failures in the error path.
      }
    }

    const status = error instanceof HttpError ? error.status : 500;
    console.error('AI chatbot error:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
