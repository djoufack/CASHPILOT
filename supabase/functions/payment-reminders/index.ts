import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { paymentReminderTemplate } from '../_shared/emailTemplates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 1. Read all active reminder rules grouped by user
    const { data: rules, error: rulesError } = await supabase
      .from('payment_reminder_rules')
      .select('*')
      .eq('is_active', true);

    if (rulesError) throw rulesError;

    if (!rules || rules.length === 0) {
      // Fallback: if no rules configured, use default behavior (1, 7, 14, 30, 60 days overdue)
      return await handleDefaultReminders(supabase, resendApiKey, today);
    }

    const results: Array<{ invoice_id: string; rule_id: string; status: string; daysOverdue?: number; error?: string }> = [];

    // Group rules by user_id
    const rulesByUser = new Map<string, typeof rules>();
    for (const rule of rules) {
      const userRules = rulesByUser.get(rule.user_id) || [];
      userRules.push(rule);
      rulesByUser.set(rule.user_id, userRules);
    }

    // 2. For each user, find unpaid invoices matching rule criteria
    for (const [userId, userRules] of rulesByUser) {
      // Fetch unpaid invoices for this user
      const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select('*, client:clients(id, name, email)')
        .eq('user_id', userId)
        .in('status', ['sent', 'overdue', 'draft']);

      if (invError) {
        console.error(`Error fetching invoices for user ${userId}:`, invError);
        continue;
      }

      if (!invoices || invoices.length === 0) continue;

      // Get user profile for company name
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, full_name')
        .eq('user_id', userId)
        .single();

      const companyName = profile?.company_name || profile?.full_name || 'CashPilot';

      for (const rule of userRules) {
        for (const invoice of invoices) {
          if (!invoice.client?.email || !invoice.due_date) continue;

          const dueDate = new Date(invoice.due_date);
          const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          // Check if this invoice matches the rule's criteria
          let shouldSend = false;

          if (rule.days_before_due > 0 && diffDays === -rule.days_before_due) {
            // Pre-due reminder (e.g., 3 days before due)
            shouldSend = true;
          }

          if (rule.days_after_due > 0 && diffDays === rule.days_after_due) {
            // Post-due reminder (e.g., 7 days after due)
            shouldSend = true;
          }

          if (!shouldSend) continue;

          // Check how many reminders already sent for this invoice + rule
          const { count: reminderCount } = await supabase
            .from('payment_reminder_logs')
            .select('*', { count: 'exact', head: true })
            .eq('invoice_id', invoice.id)
            .eq('rule_id', rule.id);

          if ((reminderCount || 0) >= rule.max_reminders) continue;

          try {
            const daysOverdue = Math.max(0, diffDays);

            const template = paymentReminderTemplate({
              clientName: invoice.client.name,
              invoiceNumber: invoice.invoice_number,
              totalTTC: invoice.total_ttc,
              currency: invoice.currency || 'EUR',
              dueDate: invoice.due_date,
              daysOverdue,
              companyName,
            });

            // Send via Resend
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: `${companyName} <noreply@cashpilot.app>`,
                to: [invoice.client.email],
                subject: template.subject,
                html: template.html,
                text: template.text,
              }),
            });

            const sendStatus = res.ok ? 'sent' : 'failed';

            // Log the reminder
            await supabase.from('payment_reminder_logs').insert({
              invoice_id: invoice.id,
              rule_id: rule.id,
              reminder_number: (reminderCount || 0) + 1,
              status: sendStatus,
              recipient_email: invoice.client.email,
              user_id: userId,
            });

            // Update invoice status to overdue if past due and not already
            if (diffDays > 0 && invoice.status !== 'overdue') {
              await supabase.from('invoices').update({ status: 'overdue' }).eq('id', invoice.id);
            }

            results.push({
              invoice_id: invoice.id,
              rule_id: rule.id,
              status: sendStatus,
              daysOverdue,
            });
          } catch (err) {
            // Log the failure
            await supabase.from('payment_reminder_logs').insert({
              invoice_id: invoice.id,
              rule_id: rule.id,
              reminder_number: (reminderCount || 0) + 1,
              status: 'failed',
              recipient_email: invoice.client?.email,
              user_id: userId,
            });

            results.push({
              invoice_id: invoice.id,
              rule_id: rule.id,
              status: 'error',
              error: (err as Error).message,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: results.filter(r => r.status === 'sent').length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Fallback handler when no rules are configured.
 * Sends reminders at fixed intervals: 1, 7, 14, 30, 60 days overdue.
 */
async function handleDefaultReminders(
  supabase: any,
  resendApiKey: string,
  today: Date
) {
  const { data: overdueInvoices, error: fetchError } = await supabase
    .from('invoices')
    .select('*, client:clients(id, name, email)')
    .in('status', ['sent', 'overdue'])
    .lt('due_date', today.toISOString().split('T')[0]);

  if (fetchError) throw fetchError;

  const results: Array<{ invoice_id: string; status: string; daysOverdue?: number; error?: string }> = [];

  for (const invoice of (overdueInvoices || [])) {
    if (!invoice.client?.email) continue;

    const dueDate = new Date(invoice.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (![1, 7, 14, 30, 60].includes(daysOverdue)) continue;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, full_name')
        .eq('user_id', invoice.user_id)
        .single();

      const companyName = profile?.company_name || profile?.full_name || 'CashPilot';

      const template = paymentReminderTemplate({
        clientName: invoice.client.name,
        invoiceNumber: invoice.invoice_number,
        totalTTC: invoice.total_ttc,
        currency: invoice.currency || 'EUR',
        dueDate: invoice.due_date,
        daysOverdue,
        companyName,
      });

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${companyName} <noreply@cashpilot.app>`,
          to: [invoice.client.email],
          subject: template.subject,
          html: template.html,
          text: template.text,
        }),
      });

      // Log the reminder
      await supabase.from('payment_reminder_logs').insert({
        invoice_id: invoice.id,
        rule_id: null,
        reminder_number: daysOverdue,
        status: 'sent',
        recipient_email: invoice.client.email,
        user_id: invoice.user_id,
      });

      if (invoice.status !== 'overdue') {
        await supabase.from('invoices').update({ status: 'overdue' }).eq('id', invoice.id);
      }

      results.push({ invoice_id: invoice.id, status: 'sent', daysOverdue });
    } catch (err) {
      results.push({ invoice_id: invoice.id, status: 'error', error: (err as Error).message });
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      reminders_sent: results.filter(r => r.status === 'sent').length,
      results,
      mode: 'default_fallback',
    }),
    { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
  );
}
