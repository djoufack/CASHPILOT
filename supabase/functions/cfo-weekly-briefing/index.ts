import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';
import { getScopedCompany } from '../_shared/companyScope.ts';
import { gatherFinancialContext } from '../cfo-agent/context.ts';
import { buildWeeklyBriefing, getUtcWeekStart } from './briefing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new HttpError(401, 'Missing authorization');
    }

    const authUser = await requireAuthenticatedUser(req);
    const authClient = createAuthClient(authHeader);
    const serviceClient = createServiceClient();
    const payload = await req.json().catch(() => ({}));

    const { company, companyId } = await getScopedCompany(
      authClient,
      authUser.id,
      'id, company_name',
      payload?.company_id
    );

    const weekStart = getUtcWeekStart(new Date()).toISOString().slice(0, 10);

    const { data: existingBriefing, error: briefingError } = await serviceClient
      .from('cfo_weekly_briefings')
      .select('id, user_id, company_id, week_start, generated_at, briefing_text, briefing_json, created_at, updated_at')
      .eq('company_id', companyId)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (briefingError) {
      throw briefingError;
    }

    if (existingBriefing) {
      return jsonResponse({
        generated_now: false,
        briefing: existingBriefing,
      });
    }

    const financialContext = await gatherFinancialContext(authClient, companyId);
    const briefing = buildWeeklyBriefing(
      {
        companyId,
        companyName: company.company_name || financialContext.companyName,
        summary: financialContext.summary,
        topClientsByRevenue: financialContext.topClientsByRevenue,
        overdueInvoices: financialContext.overdueInvoices,
      },
      new Date()
    );

    const { data: insertedBriefing, error: insertError } = await serviceClient
      .from('cfo_weekly_briefings')
      .insert({
        user_id: authUser.id,
        company_id: companyId,
        week_start: briefing.week_start,
        generated_at: briefing.generated_at,
        briefing_text: briefing.briefing_text,
        briefing_json: briefing.briefing_json,
      })
      .select('id, user_id, company_id, week_start, generated_at, briefing_text, briefing_json, created_at, updated_at')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: cachedBriefing, error: cachedError } = await serviceClient
          .from('cfo_weekly_briefings')
          .select(
            'id, user_id, company_id, week_start, generated_at, briefing_text, briefing_json, created_at, updated_at'
          )
          .eq('company_id', companyId)
          .eq('week_start', weekStart)
          .maybeSingle();

        if (cachedError) {
          throw cachedError;
        }

        return jsonResponse({
          generated_now: false,
          briefing: cachedBriefing || briefing,
        });
      }

      throw insertError;
    }

    return jsonResponse({
      generated_now: true,
      briefing: insertedBriefing || briefing,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ error: message }, status);
  }
});
