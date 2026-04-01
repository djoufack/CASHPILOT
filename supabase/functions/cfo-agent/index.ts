import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';
import { formatMoney, gatherFinancialContext } from './context.ts';
import { computeCfoHealthScore } from './insights.ts';
import { sanitizeCfoAnswer } from './answerSanitizer.ts';
import { buildCfoSourceEvidence } from './sourceEvidence.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 20;
const GEMINI_TIMEOUT_MS = 30_000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const financialContext = await gatherFinancialContext(scopedSupabase, companyId, authUser.id);
    const healthScore = computeCfoHealthScore(financialContext.summary);
    const sourceEvidence = buildCfoSourceEvidence(
      {
        companyId,
        companyName: financialContext.companyName,
        summary: financialContext.summary,
      },
      healthScore
    );

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
- DSO: ${financialContext.workingCapitalKpis?.dso ?? 'N/A'} jours
- DPO: ${financialContext.workingCapitalKpis?.dpo ?? 'N/A'} jours
- DIO: ${financialContext.workingCapitalKpis?.dio ?? 'N/A'} jours
- CCC: ${financialContext.workingCapitalKpis?.ccc ?? 'N/A'} jours
- Score de sante financiere: ${healthScore.score}/100

FACTURES EN RETARD:
${JSON.stringify(financialContext.overdueInvoices.slice(0, 5), null, 2)}

FACTURES RECENTES:
${JSON.stringify(financialContext.recentInvoices.slice(0, 5), null, 2)}

DEPENSES RECENTES:
${JSON.stringify(financialContext.recentExpenses.slice(0, 5), null, 2)}

FACTURES AVEC CLIENT ASSOCIE:
${JSON.stringify(financialContext.invoicesWithClient.slice(0, 10), null, 2)}

TOP CLIENTS PAR CA FACTURE:
${JSON.stringify(financialContext.topClientsByRevenue.slice(0, 10), null, 2)}

FACTURES SANS CLIENT ASSOCIE:
${financialContext.unassignedInvoicesCount}

REGLES:
- Utilise UNIQUEMENT les donnees ci-dessus, n'invente rien
- Sois precis, cite tes sources de calcul
- Donne des conseils concrets et actionnables
- Structure tes reponses avec des sections claires
- Si une donnee manque, dis-le explicitement
- Pour "clients les plus rentables", utilise d'abord TOP CLIENTS PAR CA FACTURE.
- Si les couts directs par client sont absents, precise que la rentabilite nette exacte par client n'est pas calculable.
- Ne mentionne jamais les noms de sections internes (ex: TOP CLIENTS PAR CA FACTURE, FACTURES AVEC CLIENT ASSOCIE).
- N'ecris jamais "vous m'avez fourni une section ...". Parle toujours des "donnees disponibles" ou des "factures associees aux clients".
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

    const geminiController = new AbortController();
    const geminiTimeout = setTimeout(() => geminiController.abort(), GEMINI_TIMEOUT_MS);
    let geminiRes: Response;
    try {
      geminiRes = await fetch(geminiUrl, {
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
        signal: geminiController.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpError(504, 'AI service timeout');
      }
      throw error;
    } finally {
      clearTimeout(geminiTimeout);
    }

    if (!geminiRes.ok) {
      console.error('Gemini API error:', geminiRes.status, await geminiRes.text());
      throw new HttpError(500, 'AI service error');
    }

    const geminiResult = await geminiRes.json();
    const rawAnswer = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const answer = sanitizeCfoAnswer(rawAnswer) || "Desole, je n'ai pas pu generer une reponse.";

    // Save assistant response to history
    await serviceClient.from('cfo_chat_history').insert({
      user_id: authUser.id,
      company_id: companyId,
      role: 'assistant',
      content: answer,
      tool_calls: [sourceEvidence],
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
        tool_calls: [sourceEvidence],
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
