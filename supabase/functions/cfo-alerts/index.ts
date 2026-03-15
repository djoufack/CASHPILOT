import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

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
    if (!authHeader) throw new HttpError(401, 'Missing authorization');

    const authUser = await requireAuthenticatedUser(req);
    const scopedSupabase = createAuthClient(authHeader);
    const serviceClient = createServiceClient();
    const payload = await req.json();
    const companyIdRaw = payload?.company_id;

    const companyId = await resolveActiveCompanyId(scopedSupabase, authUser.id, companyIdRaw);
    if (!companyId) throw new HttpError(400, 'No active company found');

    const alerts: Array<{
      alert_type: string;
      severity: 'info' | 'warning' | 'critical';
      title: string;
      message: string;
      data: Record<string, unknown>;
    }> = [];

    // 1. Check overdue invoices (> 30 days)
    const { data: overdueInvoices } = await scopedSupabase
      .from('invoices')
      .select('id, invoice_number, total_ttc, due_date, client:clients(company_name)')
      .eq('company_id', companyId)
      .neq('payment_status', 'paid')
      .lt('due_date', new Date().toISOString());

    const overdue30 = (overdueInvoices || []).filter((inv) => {
      if (!inv.due_date) return false;
      const daysDiff = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000);
      return daysDiff > 30;
    });

    if (overdue30.length > 0) {
      const totalOverdue = overdue30.reduce((sum, inv) => sum + toNumber(inv.total_ttc), 0);
      alerts.push({
        alert_type: 'overdue_invoices',
        severity: overdue30.length >= 5 ? 'critical' : 'warning',
        title: `${overdue30.length} facture(s) en retard > 30 jours`,
        message: `Montant total en retard: ${totalOverdue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR. Action de recouvrement recommandee.`,
        data: {
          count: overdue30.length,
          total: Math.round(totalOverdue * 100) / 100,
          invoices: overdue30.slice(0, 5).map((inv) => ({
            invoice_number: inv.invoice_number,
            amount: toNumber(inv.total_ttc),
            due_date: inv.due_date,
            client: (inv.client as any)?.company_name || 'N/A',
          })),
        },
      });
    }

    // 2. Check low cash position
    const { data: invoices } = await scopedSupabase
      .from('invoices')
      .select('total_ttc, status')
      .eq('company_id', companyId);

    const { data: expenses } = await scopedSupabase.from('expenses').select('amount').eq('company_id', companyId);

    const { data: payments } = await scopedSupabase.from('payments').select('amount').eq('company_id', companyId);

    const totalRevenue = (invoices || [])
      .filter((i) => ['paid', 'sent'].includes(i.status || ''))
      .reduce((sum, i) => sum + toNumber(i.total_ttc), 0);
    const totalExpenses = (expenses || []).reduce((sum, e) => sum + toNumber(e.amount), 0);
    const totalPaid = (payments || []).reduce((sum, p) => sum + toNumber(p.amount), 0);
    const netPosition = totalPaid - totalExpenses;

    if (netPosition < 0) {
      alerts.push({
        alert_type: 'low_cash',
        severity: netPosition < -5000 ? 'critical' : 'warning',
        title: 'Position de tresorerie negative',
        message: `Tresorerie nette: ${netPosition.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR. Risque de tension de tresorerie.`,
        data: {
          netPosition: Math.round(netPosition * 100) / 100,
          totalPaid: Math.round(totalPaid * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
        },
      });
    }

    // 3. Check client concentration risk
    const { data: clientInvoices } = await scopedSupabase
      .from('invoices')
      .select('total_ttc, client_id')
      .eq('company_id', companyId)
      .in('status', ['paid', 'sent']);

    if (clientInvoices && clientInvoices.length > 0) {
      const clientTotals: Record<string, number> = {};
      for (const inv of clientInvoices) {
        if (!inv.client_id) continue;
        clientTotals[inv.client_id] = (clientTotals[inv.client_id] || 0) + toNumber(inv.total_ttc);
      }

      const sortedClients = Object.entries(clientTotals).sort((a, b) => b[1] - a[1]);
      if (sortedClients.length > 0 && totalRevenue > 0) {
        const topClientShare = (sortedClients[0][1] / totalRevenue) * 100;
        if (topClientShare > 60) {
          alerts.push({
            alert_type: 'client_concentration',
            severity: topClientShare > 80 ? 'critical' : 'warning',
            title: 'Risque de concentration client',
            message: `Un seul client represente ${topClientShare.toFixed(1)}% du CA. Diversification recommandee.`,
            data: {
              topClientShare: Math.round(topClientShare * 10) / 10,
              clientCount: sortedClients.length,
            },
          });
        }
      }
    }

    // 4. Low margin alert
    if (totalRevenue > 0) {
      const margin = ((totalRevenue - totalExpenses) / totalRevenue) * 100;
      if (margin < 10) {
        alerts.push({
          alert_type: 'low_margin',
          severity: margin < 0 ? 'critical' : 'warning',
          title: 'Marge faible',
          message: `Marge nette: ${margin.toFixed(1)}%. Optimisation des couts recommandee.`,
          data: {
            margin: Math.round(margin * 10) / 10,
            revenue: Math.round(totalRevenue * 100) / 100,
            expenses: Math.round(totalExpenses * 100) / 100,
          },
        });
      }
    }

    // Insert new alerts (deduplicate by alert_type today)
    const today = new Date().toISOString().split('T')[0];
    let insertedCount = 0;

    for (const alert of alerts) {
      // Check if same alert_type already exists today
      const { data: existing } = await serviceClient
        .from('cfo_alerts')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('company_id', companyId)
        .eq('alert_type', alert.alert_type)
        .gte('created_at', `${today}T00:00:00Z`)
        .limit(1);

      if (!existing || existing.length === 0) {
        await serviceClient.from('cfo_alerts').insert({
          user_id: authUser.id,
          company_id: companyId,
          ...alert,
        });
        insertedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        alerts_generated: alerts.length,
        alerts_inserted: insertedCount,
        alerts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error('CFO Alerts error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
