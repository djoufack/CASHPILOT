import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Default templates by tone and channel */
const DEFAULT_TEMPLATES: Record<string, Record<string, { subject: string; body: string }>> = {
  friendly: {
    email: {
      subject: 'Petit rappel : facture {{invoice_number}} en attente',
      body: `Bonjour {{client_name}},

Nous espérons que tout va bien de votre côté. Nous souhaitons simplement vous rappeler que la facture {{invoice_number}} d'un montant de {{balance_due}} EUR est arrivée à échéance le {{due_date}}.

Si le paiement a déjà été effectué, veuillez ignorer ce message.

Cordialement,
{{company_name}}`,
    },
    sms: {
      subject: '',
      body: 'Rappel: Facture {{invoice_number}} de {{balance_due}} EUR échue le {{due_date}}. Merci de votre attention. - {{company_name}}',
    },
    whatsapp: {
      subject: '',
      body: 'Bonjour {{client_name}}, petit rappel pour la facture {{invoice_number}} ({{balance_due}} EUR) échue le {{due_date}}. Merci ! - {{company_name}}',
    },
    letter: {
      subject: 'Rappel de paiement - Facture {{invoice_number}}',
      body: `{{client_name}}\n\nObjet : Rappel aimable - Facture {{invoice_number}}\n\nMadame, Monsieur,\n\nNous nous permettons de vous rappeler que la facture {{invoice_number}} d'un montant de {{balance_due}} EUR, échue le {{due_date}}, reste impayée.\n\nNous vous remercions de bien vouloir procéder au règlement.\n\nCordialement,\n{{company_name}}`,
    },
  },
  professional: {
    email: {
      subject: 'Rappel de paiement : facture {{invoice_number}}',
      body: `Madame, Monsieur,

La facture {{invoice_number}} d'un montant de {{balance_due}} EUR, dont l'échéance était fixée au {{due_date}}, reste impayée à ce jour.

Nous vous prions de bien vouloir procéder au règlement dans les meilleurs délais.

Si le paiement a déjà été effectué, merci de nous en informer.

Cordialement,
{{company_name}}`,
    },
    sms: {
      subject: '',
      body: 'Rappel: Facture {{invoice_number}} ({{balance_due}} EUR) impayée depuis le {{due_date}}. Merci de régulariser. - {{company_name}}',
    },
    whatsapp: {
      subject: '',
      body: 'Bonjour, la facture {{invoice_number}} ({{balance_due}} EUR) échue le {{due_date}} est en attente de paiement. Merci de régulariser. - {{company_name}}',
    },
    letter: {
      subject: 'Relance de paiement - Facture {{invoice_number}}',
      body: `{{client_name}}\n\nObjet : Relance - Facture {{invoice_number}}\n\nMadame, Monsieur,\n\nSauf erreur de notre part, la facture {{invoice_number}} d'un montant de {{balance_due}} EUR, échue le {{due_date}}, n'a toujours pas été réglée.\n\nNous vous prions de bien vouloir procéder au paiement dans les plus brefs délais.\n\nCordialement,\n{{company_name}}`,
    },
  },
  firm: {
    email: {
      subject: 'URGENT : Facture {{invoice_number}} impayée',
      body: `Madame, Monsieur,

Malgré nos précédents rappels, la facture {{invoice_number}} d'un montant de {{balance_due}} EUR, échue depuis le {{due_date}}, n'a toujours pas été réglée.

Nous vous demandons de procéder au paiement sous 48 heures.

À défaut de régularisation, nous serons contraints d'engager des mesures de recouvrement.

{{company_name}}`,
    },
    sms: {
      subject: '',
      body: 'URGENT: Facture {{invoice_number}} ({{balance_due}} EUR) impayée depuis le {{due_date}}. Paiement sous 48h requis. - {{company_name}}',
    },
    whatsapp: {
      subject: '',
      body: 'URGENT: La facture {{invoice_number}} ({{balance_due}} EUR) échue le {{due_date}} est toujours impayée. Merci de régler sous 48h. - {{company_name}}',
    },
    letter: {
      subject: 'Mise en demeure - Facture {{invoice_number}}',
      body: `{{client_name}}\n\nObjet : Mise en demeure - Facture {{invoice_number}}\n\nMadame, Monsieur,\n\nMalgré nos relances, la facture {{invoice_number}} ({{balance_due}} EUR), échue le {{due_date}}, reste impayée.\n\nNous vous mettons en demeure de régler cette somme sous 8 jours. Passé ce délai, nous nous réservons le droit d'engager toute procédure de recouvrement.\n\n{{company_name}}`,
    },
  },
  urgent: {
    email: {
      subject: 'DERNIER RAPPEL : Facture {{invoice_number}} - Action immédiate requise',
      body: `Madame, Monsieur,

Ce courrier constitue notre dernier rappel avant engagement de procédures de recouvrement pour la facture {{invoice_number}} d'un montant de {{balance_due}} EUR, impayée depuis le {{due_date}}.

Le paiement doit être effectué immédiatement.

{{company_name}}`,
    },
    sms: {
      subject: '',
      body: 'DERNIER RAPPEL: Facture {{invoice_number}} ({{balance_due}} EUR). Paiement immédiat requis. Procédure de recouvrement imminente. - {{company_name}}',
    },
    whatsapp: {
      subject: '',
      body: 'DERNIER RAPPEL: Facture {{invoice_number}} ({{balance_due}} EUR) impayée. Paiement immédiat requis avant procédure de recouvrement. - {{company_name}}',
    },
    letter: {
      subject: 'Dernier rappel avant procédure - Facture {{invoice_number}}',
      body: `{{client_name}}\n\nObjet : Dernier rappel avant procédure judiciaire\n\nMadame, Monsieur,\n\nLa facture {{invoice_number}} ({{balance_due}} EUR), échue le {{due_date}}, demeure impayée malgré nos multiples relances.\n\nCeci constitue notre dernier avertissement. Sans paiement intégral sous 5 jours, nous transmettrons le dossier à notre service contentieux.\n\n{{company_name}}`,
    },
  },
};

/** Replace template placeholders with actual values */
const renderTemplate = (template: string, vars: Record<string, string>): string => {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '');
  }
  return result;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Authenticate user
    const user = await requireAuthenticatedUser(req);
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createAuthClient(authHeader);
    const serviceClient = createServiceClient();

    const body = await req.json();
    const { company_id, campaign_id, invoice_id, client_id, channel, tone, step_number } = body;

    // Validate company_id
    if (!company_id || !UUID_REGEX.test(company_id)) {
      throw new HttpError(400, 'Valid company_id is required');
    }

    // Validate invoice_id
    if (!invoice_id || !UUID_REGEX.test(invoice_id)) {
      throw new HttpError(400, 'Valid invoice_id is required');
    }

    // Verify company ownership
    const { data: companyData, error: companyError } = await supabase
      .from('company')
      .select('id, name')
      .eq('id', company_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (companyError || !companyData) {
      throw new HttpError(403, 'Company not found or access denied');
    }

    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_ttc, balance_due, due_date, client_id, status, payment_status')
      .eq('id', invoice_id)
      .eq('company_id', company_id)
      .maybeSingle();

    if (invoiceError || !invoice) {
      throw new HttpError(404, 'Invoice not found');
    }

    // Fetch client details
    const actualClientId = client_id || invoice.client_id;
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, company_name, email, phone')
      .eq('id', actualClientId)
      .maybeSingle();

    if (clientError || !client) {
      throw new HttpError(404, 'Client not found');
    }

    // Determine channel and tone
    const selectedChannel = channel || 'email';
    const selectedTone = tone || 'professional';
    const selectedStep = step_number || 1;

    // Try to find a custom template from the campaign
    let messageSubject = '';
    let messageBody = '';

    if (campaign_id && UUID_REGEX.test(campaign_id)) {
      const { data: customTemplate } = await supabase
        .from('dunning_templates')
        .select('subject, body')
        .eq('campaign_id', campaign_id)
        .eq('step_number', selectedStep)
        .eq('channel', selectedChannel)
        .maybeSingle();

      if (customTemplate) {
        messageSubject = customTemplate.subject || '';
        messageBody = customTemplate.body || '';
      }
    }

    // Fallback to default templates
    if (!messageBody) {
      const toneTemplates = DEFAULT_TEMPLATES[selectedTone] || DEFAULT_TEMPLATES.professional;
      const channelTemplate = toneTemplates[selectedChannel] || toneTemplates.email;
      messageSubject = channelTemplate.subject;
      messageBody = channelTemplate.body;
    }

    // Render template variables
    const templateVars: Record<string, string> = {
      client_name: client.company_name || 'Client',
      invoice_number: invoice.invoice_number || 'N/A',
      balance_due: (invoice.balance_due ?? invoice.total_ttc ?? 0).toFixed(2),
      total_ttc: (invoice.total_ttc ?? 0).toFixed(2),
      due_date: invoice.due_date || 'N/A',
      company_name: companyData.name || 'CashPilot',
    };

    const renderedSubject = renderTemplate(messageSubject, templateVars);
    const renderedBody = renderTemplate(messageBody, templateVars);

    // Determine or create campaign_id
    let finalCampaignId = campaign_id;

    if (!finalCampaignId || !UUID_REGEX.test(finalCampaignId)) {
      // Create a default auto-campaign
      const { data: autoCampaign, error: campaignError } = await serviceClient
        .from('dunning_campaigns')
        .insert({
          user_id: user.id,
          company_id,
          name: `Auto-relance ${new Date().toISOString().slice(0, 10)}`,
          strategy: 'standard',
          channels: [selectedChannel],
          max_steps: 3,
          auto_escalate: true,
          is_active: true,
        })
        .select('id')
        .single();

      if (campaignError || !autoCampaign) {
        throw new HttpError(500, 'Failed to create auto-campaign');
      }

      finalCampaignId = autoCampaign.id;
    }

    // Create dunning execution record
    const { data: execution, error: execError } = await serviceClient
      .from('dunning_executions')
      .insert({
        user_id: user.id,
        company_id,
        campaign_id: finalCampaignId,
        invoice_id,
        client_id: actualClientId,
        step_number: selectedStep,
        channel: selectedChannel,
        status: 'sent',
        scheduled_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        message_content: renderedBody,
        ai_score: body.ai_score || null,
        metadata: {
          subject: renderedSubject,
          tone: selectedTone,
          template_type: campaign_id ? 'custom' : 'default',
          rendered_at: new Date().toISOString(),
        },
      })
      .select('*')
      .single();

    if (execError) {
      throw new HttpError(500, `Failed to create execution: ${execError.message}`);
    }

    // Update invoice status to 'overdue' if not already
    if (invoice.status !== 'overdue') {
      await serviceClient.from('invoices').update({ status: 'overdue' }).eq('id', invoice_id);
    }

    // Also record in legacy dunning_history for backward compatibility
    await serviceClient
      .from('dunning_history')
      .insert({
        user_id: user.id,
        invoice_id,
        sent_at: new Date().toISOString(),
        method: selectedChannel === 'whatsapp' ? 'sms' : selectedChannel === 'letter' ? 'letter' : selectedChannel,
        status: 'sent',
        notes: `Smart Dunning - Step ${selectedStep} - ${selectedTone} tone via ${selectedChannel}`,
      })
      .then(() => {}) // ignore errors on legacy table
      .catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        execution_id: execution.id,
        channel: selectedChannel,
        tone: selectedTone,
        step_number: selectedStep,
        message: {
          subject: renderedSubject,
          body: renderedBody,
        },
        invoice: {
          id: invoice.id,
          number: invoice.invoice_number,
          balance_due: invoice.balance_due ?? invoice.total_ttc,
        },
        client: {
          id: client.id,
          name: client.company_name,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Internal server error';

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
