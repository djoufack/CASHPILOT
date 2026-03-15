import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 20;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: number) =>
  `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;

const resolveActiveCompanyId = async (
  supabase: ReturnType<typeof createAuthClient>,
  userId: string,
  requestedCompanyId: unknown
) => {
  if (typeof requestedCompanyId === 'string' && UUID_REGEX.test(requestedCompanyId)) {
    return requestedCompanyId;
  }
  const { data } = await supabase
    .from('user_company_preferences')
    .select('active_company_id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.active_company_id || null;
};

/** Gather financial data for CFO analysis */
const gatherFinancialContext = async (supabase: ReturnType<typeof createAuthClient>, companyId: string) => {
  const [invoicesRes, expensesRes, paymentsRes, clientsRes, companyRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, total_ttc, total_ht, status, payment_status, balance_due, date, due_date')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('expenses')
      .select('id, description, amount, category, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('payments')
      .select('id, amount, payment_date, payment_method')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('clients')
      .select('id, company_name, contact_name, email')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('company').select('id, company_name').eq('id', companyId).maybeSingle(),
  ]);

  const invoices = invoicesRes.data || [];
  const expenses = expensesRes.data || [];
  const payments = paymentsRes.data || [];
  const clients = clientsRes.data || [];

  const totalRevenue = invoices
    .filter((i) => ['paid', 'sent', 'overdue'].includes(i.status || ''))
    .reduce((sum, i) => sum + toNumber(i.total_ttc), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
  const totalPaid = payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
  const overdueInvoices = invoices.filter(
    (i) => i.due_date && new Date(i.due_date) < new Date() && i.payment_status !== 'paid'
  );
  const unpaidTotal = invoices
    .filter((i) => i.payment_status !== 'paid')
    .reduce((sum, i) => sum + toNumber(i.balance_due || i.total_ttc), 0);

  return {
    companyName: companyRes.data?.company_name || 'Entreprise',
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netResult: Math.round((totalRevenue - totalExpenses) * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      unpaidTotal: Math.round(unpaidTotal * 100) / 100,
      overdueCount: overdueInvoices.length,
      clientCount: clients.length,
      invoiceCount: invoices.length,
    },
    recentInvoices: invoices.slice(0, 10),
    recentExpenses: expenses.slice(0, 10),
    overdueInvoices: overdueInvoices.slice(0, 10),
    topClients: clients.slice(0, 10),
  };
};

/** Compute a health score (0-100) from financial data */
const computeHealthScore = (context: Awaited<ReturnType<typeof gatherFinancialContext>>) => {
  const { summary } = context;
  let score = 50;
  const factors: Record<string, { value: number; impact: number; label: string }> = {};

  // Profitability factor (max +20)
  const margin =
    summary.totalRevenue > 0 ? ((summary.totalRevenue - summary.totalExpenses) / summary.totalRevenue) * 100 : 0;
  const profitImpact = Math.min(20, Math.max(-20, margin * 0.5));
  score += profitImpact;
  factors.profitability = {
    value: Math.round(margin * 10) / 10,
    impact: Math.round(profitImpact),
    label: 'Marge nette (%)',
  };

  // Collection rate factor (max +15)
  const collectionRate = summary.totalRevenue > 0 ? (summary.totalPaid / summary.totalRevenue) * 100 : 0;
  const collectionImpact = Math.min(15, Math.max(-10, (collectionRate - 50) * 0.3));
  score += collectionImpact;
  factors.collection = {
    value: Math.round(collectionRate * 10) / 10,
    impact: Math.round(collectionImpact),
    label: 'Taux encaissement (%)',
  };

  // Overdue risk factor (max -20)
  const overdueRatio = summary.invoiceCount > 0 ? (summary.overdueCount / summary.invoiceCount) * 100 : 0;
  const overdueImpact = Math.max(-20, -overdueRatio * 0.5);
  score += overdueImpact;
  factors.overdue = { value: summary.overdueCount, impact: Math.round(overdueImpact), label: 'Factures en retard' };

  // Client diversification factor (max +10)
  const diversImpact = Math.min(10, summary.clientCount * 1.5);
  score += diversImpact;
  factors.diversification = {
    value: summary.clientCount,
    impact: Math.round(diversImpact),
    label: 'Diversification clients',
  };

  // Cash position factor (max +5)
  const cashImpact = summary.netResult >= 0 ? 5 : -5;
  score += cashImpact;
  factors.cashPosition = { value: summary.netResult, impact: cashImpact, label: 'Position nette' };

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    factors,
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new HttpError(401, 'Missing authorization');
    }

    const authUser = await requireAuthenticatedUser(req);
    const scopedSupabase = createAuthClient(authHeader);
    const serviceClient = createServiceClient();
    const payload = await req.json();

    const question = typeof payload?.question === 'string' ? payload.question.trim() : '';
    const companyIdRaw = payload?.company_id;

    if (!question || question.length > MAX_MESSAGE_LENGTH) {
      throw new HttpError(400, 'Invalid or missing question');
    }

    const companyId = await resolveActiveCompanyId(scopedSupabase, authUser.id, companyIdRaw);
    if (!companyId) {
      throw new HttpError(400, 'No active company found');
    }

    // Gather financial context
    const financialContext = await gatherFinancialContext(scopedSupabase, companyId);
    const healthScore = computeHealthScore(financialContext);

    // Save health score
    await serviceClient.from('cfo_health_scores').insert({
      user_id: authUser.id,
      company_id: companyId,
      score: healthScore.score,
      factors: healthScore.factors,
    });

    // Save user message to history
    await serviceClient.from('cfo_chat_history').insert({
      user_id: authUser.id,
      company_id: companyId,
      role: 'user',
      content: question,
    });

    // Build context for AI
    const history = Array.isArray(payload?.history) ? payload.history.slice(-MAX_HISTORY_MESSAGES) : [];

    const systemPrompt = `Tu es le Directeur Financier (CFO) IA de ${financialContext.companyName}.

SITUATION FINANCIERE:
- CA total: ${formatMoney(financialContext.summary.totalRevenue)}
- Depenses: ${formatMoney(financialContext.summary.totalExpenses)}
- Resultat net: ${formatMoney(financialContext.summary.netResult)}
- Encaissements: ${formatMoney(financialContext.summary.totalPaid)}
- Impayes: ${formatMoney(financialContext.summary.unpaidTotal)}
- Factures en retard: ${financialContext.summary.overdueCount}
- Nombre de clients: ${financialContext.summary.clientCount}
- Score de sante financiere: ${healthScore.score}/100

FACTURES EN RETARD:
${JSON.stringify(financialContext.overdueInvoices.slice(0, 5), null, 2)}

FACTURES RECENTES:
${JSON.stringify(financialContext.recentInvoices.slice(0, 5), null, 2)}

DEPENSES RECENTES:
${JSON.stringify(financialContext.recentExpenses.slice(0, 5), null, 2)}

REGLES:
- Utilise UNIQUEMENT les donnees ci-dessus, n'invente rien
- Sois precis, cite tes sources de calcul
- Donne des conseils concrets et actionnables
- Structure tes reponses avec des sections claires
- Si une donnee manque, dis-le explicitement
- Reponds en francais`;

    // Call Gemini for AI response
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new HttpError(500, 'AI service not configured');

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      {
        role: 'model',
        parts: [
          {
            text: `Compris. En tant que CFO IA de ${financialContext.companyName}, j'analyse vos donnees financieres en temps reel. Score de sante: ${healthScore.score}/100. Comment puis-je vous aider?`,
          },
        ],
      },
      ...history.map((h: { role: string; content: string }) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(h.content || '').slice(0, 1500) }],
      })),
      { role: 'user', parts: [{ text: question }] },
    ];

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
          topP: 0.9,
        },
      }),
    });

    if (!geminiRes.ok) {
      console.error('Gemini API error:', geminiRes.status, await geminiRes.text());
      throw new HttpError(500, 'AI service error');
    }

    const geminiResult = await geminiRes.json();
    const answer =
      geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || "Desole, je n'ai pas pu generer une reponse.";

    // Save assistant response to history
    await serviceClient.from('cfo_chat_history').insert({
      user_id: authUser.id,
      company_id: companyId,
      role: 'assistant',
      content: answer,
    });

    // Generate suggestions based on context
    const suggestions: string[] = [];
    if (financialContext.summary.overdueCount > 0) {
      suggestions.push('Quels clients ont des factures en retard ?');
    }
    if (financialContext.summary.netResult < 0) {
      suggestions.push('Comment ameliorer ma rentabilite ?');
    }
    suggestions.push('Previsions de tresorerie a 30 jours ?');
    if (financialContext.summary.clientCount > 3) {
      suggestions.push('Quels sont mes clients les plus rentables ?');
    }

    return new Response(
      JSON.stringify({
        answer,
        health_score: healthScore,
        suggestions: suggestions.slice(0, 3),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error('CFO Agent error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
