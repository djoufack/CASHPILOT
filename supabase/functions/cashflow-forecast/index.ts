import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';
import { getAllowedOrigin } from '../_shared/cors.ts';

const buildCorsHeaders = (req: Request) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(req),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

/** Analyze patterns: payment delays, seasonality, trends */
const analyzePatterns = (forecast: Record<string, unknown>) => {
  const dailyProjections = (forecast.daily_projections || []) as Array<{
    date: string;
    inflow: number;
    outflow: number;
    balance: number;
  }>;

  if (dailyProjections.length === 0) {
    return {
      trend: 'stable' as const,
      volatility: 'low' as const,
      recommendations: [],
    };
  }

  // Trend analysis
  const firstThird = dailyProjections.slice(0, Math.ceil(dailyProjections.length / 3));
  const lastThird = dailyProjections.slice(-Math.ceil(dailyProjections.length / 3));

  const avgFirstBalance = firstThird.reduce((s, d) => s + d.balance, 0) / firstThird.length;
  const avgLastBalance = lastThird.reduce((s, d) => s + d.balance, 0) / lastThird.length;
  const balanceChange = avgLastBalance - avgFirstBalance;
  const trendPct = avgFirstBalance !== 0 ? (balanceChange / Math.abs(avgFirstBalance)) * 100 : 0;

  let trend: 'growing' | 'declining' | 'stable';
  if (trendPct > 10) trend = 'growing';
  else if (trendPct < -10) trend = 'declining';
  else trend = 'stable';

  // Volatility analysis
  const balances = dailyProjections.map((d) => d.balance);
  const avgBalance = balances.reduce((s, b) => s + b, 0) / balances.length;
  const variance = balances.reduce((s, b) => s + Math.pow(b - avgBalance, 2), 0) / balances.length;
  const stdDev = Math.sqrt(variance);
  const coeffVariation = avgBalance !== 0 ? (stdDev / Math.abs(avgBalance)) * 100 : 0;

  let volatility: 'low' | 'medium' | 'high';
  if (coeffVariation < 15) volatility = 'low';
  else if (coeffVariation < 40) volatility = 'medium';
  else volatility = 'high';

  // Build recommendations
  const recommendations: string[] = [];
  const alerts = (forecast.alerts || []) as Array<{ type: string; days_until: number; projected_balance: number }>;
  const startingBalance = Number(forecast.starting_balance) || 0;
  const endingBalance = Number(forecast.ending_balance) || 0;
  const pendingReceivables = Number(forecast.pending_receivables) || 0;
  const pendingPayables = Number(forecast.pending_payables) || 0;

  // Overdraft-specific recommendations
  const overdraftAlert = alerts.find((a) => a.type === 'overdraft_risk');
  if (overdraftAlert) {
    recommendations.push(
      `Action urgente : decouverte prevue dans ${overdraftAlert.days_until} jours. Accelerez les encaissements ou negociez un delai avec vos fournisseurs.`
    );
    if (pendingReceivables > 0) {
      recommendations.push(
        `Relancez vos creances impayees (${formatMoney(pendingReceivables)} en attente) pour couvrir le deficit.`
      );
    }
  }

  // Low balance recommendations
  if (alerts.some((a) => a.type === 'low_balance')) {
    recommendations.push('Constituez une reserve de securite equivalente a 2-3 mois de charges fixes.');
  }

  // Growth recommendations
  if (alerts.some((a) => a.type === 'growth_opportunity')) {
    recommendations.push(
      'Excellente position de tresorerie. Considerez un placement court terme ou un investissement strategique.'
    );
  }

  // General recommendations based on patterns
  if (trend === 'declining' && !overdraftAlert) {
    recommendations.push('Tendance baissiere detectee. Revoyez vos postes de depenses et optimisez votre BFR.');
  }

  if (volatility === 'high') {
    recommendations.push('Forte volatilite de tresorerie. Lissez vos echeances et diversifiez vos sources de revenus.');
  }

  if (pendingPayables > pendingReceivables * 1.5 && pendingReceivables > 0) {
    recommendations.push(
      `Desequilibre : ${formatMoney(pendingPayables)} a payer contre ${formatMoney(pendingReceivables)} a recevoir. Negociez des delais fournisseurs.`
    );
  }

  // Default if no specific recommendations
  if (recommendations.length === 0) {
    recommendations.push(
      'Votre tresorerie est saine. Maintenez un suivi regulier et anticipez vos besoins a moyen terme.'
    );
  }

  return { trend, volatility, recommendations };
};

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new HttpError(401, 'Missing authorization');
    }

    const authUser = await requireAuthenticatedUser(req);
    const scopedSupabase = createAuthClient(authHeader);
    const payload = await req.json();

    const companyIdRaw = payload?.company_id;
    const days = Math.min(Math.max(Number(payload?.days) || 90, 7), 365);

    const companyId = await resolveActiveCompanyId(scopedSupabase, authUser.id, companyIdRaw);
    if (!companyId) {
      throw new HttpError(400, 'No active company found');
    }

    // Call the RPC function
    const { data: forecastData, error: rpcError } = await scopedSupabase.rpc('compute_cashflow_forecast', {
      p_company_id: companyId,
      p_days: days,
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      throw new HttpError(500, `Forecast computation failed: ${rpcError.message}`);
    }

    const forecast = forecastData || {};

    // Enrich with pattern analysis
    const analysis = analyzePatterns(forecast);

    // Build AI-enriched response
    const response = {
      ...forecast,
      analysis: {
        trend: analysis.trend,
        volatility: analysis.volatility,
        recommendations: analysis.recommendations,
      },
      // Compute milestone projections for 30/60/90 day summaries
      milestones: buildMilestones(forecast),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error('Cash Flow Forecast error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/** Extract 30/60/90 day milestone snapshots from daily projections */
function buildMilestones(forecast: Record<string, unknown>) {
  const dailyProjections = (forecast.daily_projections || []) as Array<{
    date: string;
    day: number;
    inflow: number;
    outflow: number;
    balance: number;
    cumulative_inflows: number;
    cumulative_outflows: number;
  }>;

  const milestones: Record<string, unknown> = {};

  for (const target of [30, 60, 90, 180]) {
    const dayEntry = dailyProjections.find((d) => d.day === target);
    if (dayEntry) {
      milestones[`day_${target}`] = {
        date: dayEntry.date,
        balance: dayEntry.balance,
        cumulative_inflows: dayEntry.cumulative_inflows,
        cumulative_outflows: dayEntry.cumulative_outflows,
      };
    }
  }

  return milestones;
}
