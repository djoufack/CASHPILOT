import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';
import { getAllowedOrigin } from '../_shared/cors.ts';

const GOCARDLESS_BASE = 'https://api.gocardless.com';
const GOCARDLESS_API_VERSION = '2015-07-06';
const TIMEOUT_MS = 20000;

function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    ...SECURITY_HEADERS,
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

async function gcFetch(token: string, path: string, opts: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${GOCARDLESS_BASE}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'GoCardless-Version': GOCARDLESS_API_VERSION,
        ...(opts.headers || {}),
      },
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        body?.error?.message || body?.error?.errors?.[0]?.message || `GoCardless API ${res.status}`;
      throw Object.assign(new Error(msg), { status: res.status, details: body });
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function authenticateUser(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Missing Authorization'), { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '');
  const sb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) {
    throw Object.assign(new Error('Invalid token'), { status: 401 });
  }
  return user;
}

function getServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const user = await authenticateUser(req);
    const body = await req.json().catch(() => ({}));
    const { action, companyId } = body;
    const gcToken = Deno.env.get('GOCARDLESS_ACCESS_TOKEN');

    if (!gcToken) {
      return json(req, { error: 'GoCardless access token not configured' }, 500);
    }

    const supabase = getServiceClient();

    // Verify company ownership
    if (companyId) {
      const { data: company } = await supabase
        .from('company')
        .select('id')
        .eq('id', companyId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!company) {
        return json(req, { error: 'Company not found' }, 404);
      }
    }

    switch (action) {
      // Health check
      case 'health': {
        try {
          await gcFetch(gcToken, '/creditors', { method: 'GET' });
          return json(req, { success: true, ready: true, provider: 'gocardless_payments' });
        } catch (e) {
          return json(req, {
            success: true,
            ready: false,
            message: e instanceof Error ? e.message : 'Health check failed',
          });
        }
      }

      // Create a customer in GoCardless
      case 'create-customer': {
        const { email, givenName, familyName, companyName, clientId } = body;
        if (!companyId || !email) {
          return json(req, { error: 'companyId and email required' }, 400);
        }

        const gcRes = await gcFetch(gcToken, '/customers', {
          method: 'POST',
          body: JSON.stringify({
            customers: {
              email,
              given_name: givenName || '',
              family_name: familyName || '',
              company_name: companyName || '',
              metadata: {
                cashpilot_company_id: companyId,
                cashpilot_client_id: clientId || '',
              },
            },
          }),
        });

        const gcCustomer = gcRes.customers;
        const { data: record, error: insertErr } = await supabase
          .from('gocardless_customers')
          .insert({
            company_id: companyId,
            client_id: clientId || null,
            gocardless_customer_id: gcCustomer.id,
            email: gcCustomer.email,
            given_name: gcCustomer.given_name,
            family_name: gcCustomer.family_name,
            company_name: gcCustomer.company_name,
            metadata: gcCustomer.metadata || {},
          })
          .select('*')
          .single();

        if (insertErr) throw insertErr;
        return json(req, { success: true, customer: record });
      }

      // Create a billing request (modern mandate setup flow)
      case 'create-billing-request': {
        const { customerId, scheme, redirectUri } = body;
        if (!companyId || !customerId) {
          return json(req, { error: 'companyId and customerId required' }, 400);
        }

        // Get GC customer ID
        const { data: gcCust } = await supabase
          .from('gocardless_customers')
          .select('gocardless_customer_id')
          .eq('id', customerId)
          .eq('company_id', companyId)
          .single();

        if (!gcCust) {
          return json(req, { error: 'Customer not found' }, 404);
        }

        // Create billing request
        const brRes = await gcFetch(gcToken, '/billing_requests', {
          method: 'POST',
          body: JSON.stringify({
            billing_requests: {
              mandate_request: {
                scheme: scheme || 'sepa_core',
              },
              links: {
                customer: gcCust.gocardless_customer_id,
              },
              metadata: { cashpilot_company_id: companyId },
            },
          }),
        });

        const billingRequest = brRes.billing_requests;

        // Create billing request flow (redirect URL)
        const flowRes = await gcFetch(gcToken, '/billing_request_flows', {
          method: 'POST',
          body: JSON.stringify({
            billing_request_flows: {
              redirect_uri:
                redirectUri ||
                `${Deno.env.get('APP_URL') || 'https://cashpilot.tech'}/app/gocardless-callback`,
              exit_uri:
                redirectUri ||
                `${Deno.env.get('APP_URL') || 'https://cashpilot.tech'}/app/gocardless-callback`,
              links: {
                billing_request: billingRequest.id,
              },
            },
          }),
        });

        return json(req, {
          success: true,
          billing_request_id: billingRequest.id,
          authorisation_url: flowRes.billing_request_flows.authorisation_url,
        });
      }

      // Complete billing request → save mandate
      case 'complete-billing-request': {
        const { billingRequestId } = body;
        if (!companyId || !billingRequestId) {
          return json(req, { error: 'companyId and billingRequestId required' }, 400);
        }

        const brRes = await gcFetch(gcToken, `/billing_requests/${billingRequestId}`);
        const br = brRes.billing_requests;

        if (br.status !== 'fulfilled') {
          return json(
            req,
            { error: `Billing request not fulfilled (status: ${br.status})` },
            409
          );
        }

        const mandateId = br.links?.mandate;
        if (!mandateId) {
          return json(req, { error: 'No mandate linked to this billing request' }, 422);
        }

        // Fetch mandate details
        const mandateRes = await gcFetch(gcToken, `/mandates/${mandateId}`);
        const mandate = mandateRes.mandates;

        // Find local customer
        const gcCustomerId = br.links?.customer;
        const { data: localCustomer } = await supabase
          .from('gocardless_customers')
          .select('id')
          .eq('gocardless_customer_id', gcCustomerId)
          .eq('company_id', companyId)
          .maybeSingle();

        const { data: record } = await supabase
          .from('gocardless_mandates')
          .upsert(
            {
              company_id: companyId,
              gocardless_customer_id: localCustomer?.id || null,
              gocardless_mandate_id: mandate.id,
              scheme: mandate.scheme || 'sepa_core',
              status: mandate.status,
              reference: mandate.reference || null,
              metadata: mandate.metadata || {},
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'company_id,gocardless_mandate_id' }
          )
          .select('*')
          .single();

        return json(req, { success: true, mandate: record });
      }

      // List mandates for a company
      case 'list-mandates': {
        if (!companyId) {
          return json(req, { error: 'companyId required' }, 400);
        }

        const { data: mandates } = await supabase
          .from('gocardless_mandates')
          .select('*, gocardless_customers(*)')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        return json(req, { success: true, mandates: mandates || [] });
      }

      // Create a payment against a mandate
      case 'create-payment': {
        const { mandateId, amountCents, currency, description, chargeDate, invoiceId } = body;
        if (!companyId || !mandateId || !amountCents) {
          return json(req, { error: 'companyId, mandateId, and amountCents required' }, 400);
        }

        // Get GC mandate ID
        const { data: localMandate } = await supabase
          .from('gocardless_mandates')
          .select('gocardless_mandate_id')
          .eq('id', mandateId)
          .eq('company_id', companyId)
          .single();

        if (!localMandate) {
          return json(req, { error: 'Mandate not found' }, 404);
        }

        const gcPayment = await gcFetch(gcToken, '/payments', {
          method: 'POST',
          body: JSON.stringify({
            payments: {
              amount: amountCents,
              currency: (currency || 'EUR').toUpperCase(),
              description: description || '',
              charge_date: chargeDate || null,
              links: {
                mandate: localMandate.gocardless_mandate_id,
              },
              metadata: {
                cashpilot_company_id: companyId,
                cashpilot_invoice_id: invoiceId || '',
              },
            },
          }),
        });

        const payment = gcPayment.payments;
        const { data: record } = await supabase
          .from('gocardless_payments')
          .insert({
            company_id: companyId,
            gocardless_mandate_id: mandateId,
            invoice_id: invoiceId || null,
            gocardless_payment_id: payment.id,
            amount_cents: payment.amount,
            currency: payment.currency,
            description: payment.description || '',
            status: payment.status,
            charge_date: payment.charge_date || null,
            metadata: payment.metadata || {},
          })
          .select('*')
          .single();

        return json(req, { success: true, payment: record });
      }

      // List payments for a company
      case 'list-payments': {
        if (!companyId) {
          return json(req, { error: 'companyId required' }, 400);
        }

        const { data: payments } = await supabase
          .from('gocardless_payments')
          .select('*, gocardless_mandates(*, gocardless_customers(*))')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        return json(req, { success: true, payments: payments || [] });
      }

      // List customers
      case 'list-customers': {
        if (!companyId) {
          return json(req, { error: 'companyId required' }, 400);
        }

        const { data: customers } = await supabase
          .from('gocardless_customers')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        return json(req, { success: true, customers: customers || [] });
      }

      default:
        return json(req, { error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    const status = (error as any)?.status || 500;
    return json(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, status);
  }
});
