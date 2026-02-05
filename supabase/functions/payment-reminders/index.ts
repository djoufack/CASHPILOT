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

    // Find overdue invoices (sent status, due_date in the past)
    const { data: overdueInvoices, error: fetchError } = await supabase
      .from('invoices')
      .select('*, client:clients(id, name, email)')
      .in('status', ['sent', 'overdue'])
      .lt('due_date', today.toISOString().split('T')[0]);

    if (fetchError) throw fetchError;

    const results = [];

    for (const invoice of (overdueInvoices || [])) {
      if (!invoice.client?.email) continue;

      const dueDate = new Date(invoice.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Only send reminders at 1, 7, 14, 30, 60 days overdue
      if (![1, 7, 14, 30, 60].includes(daysOverdue)) continue;

      try {
        // Get user profile for company name
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

        // Send via Resend
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'CashPilot <noreply@cashpilot.app>',
            to: [invoice.client.email],
            subject: template.subject,
            html: template.html,
            text: template.text,
          }),
        });

        // Update invoice status to overdue if not already
        if (invoice.status !== 'overdue') {
          await supabase.from('invoices').update({ status: 'overdue' }).eq('id', invoice.id);
        }

        results.push({ invoice_id: invoice.id, status: 'sent', daysOverdue });
      } catch (err) {
        results.push({ invoice_id: invoice.id, status: 'error', error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: results.filter(r => r.status === 'sent').length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
