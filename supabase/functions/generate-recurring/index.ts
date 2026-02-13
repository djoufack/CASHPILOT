import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];

    // Find all active recurring invoices due for generation
    const { data: dueInvoices, error: fetchError } = await supabase
      .from('recurring_invoices')
      .select('*, line_items:recurring_invoice_line_items(*)')
      .eq('status', 'active')
      .lte('next_generation_date', today);

    if (fetchError) throw fetchError;

    const results = [];

    for (const recurring of (dueInvoices || [])) {
      try {
        // Generate invoice number
        const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        // Create invoice
        const { data: invoice, error: createError } = await supabase
          .from('invoices')
          .insert({
            user_id: recurring.user_id,
            client_id: recurring.client_id,
            invoice_number: invoiceNumber,
            invoice_date: today,
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'draft',
            currency: recurring.currency,
            total_ht: recurring.total_ht,
            tva_rate: recurring.tva_rate,
            total_tva: recurring.total_tva,
            total_ttc: recurring.total_ttc,
            notes: `Auto-generated from recurring template: ${recurring.title}`,
          })
          .select()
          .single();

        if (createError) throw createError;

        // Copy line items to invoice_items
        if (recurring.line_items?.length > 0) {
          const lineItems = recurring.line_items.map((item: any) => ({
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          }));
          await supabase.from('invoice_items').insert(lineItems);
        }

        // Calculate next generation date
        const nextDate = calculateNextDate(recurring.next_generation_date, recurring.frequency, recurring.interval_count);

        // Check if completed
        const isCompleted = recurring.end_date && nextDate > recurring.end_date;

        await supabase
          .from('recurring_invoices')
          .update({
            next_generation_date: isCompleted ? recurring.next_generation_date : nextDate,
            last_generated_at: new Date().toISOString(),
            invoices_generated: (recurring.invoices_generated || 0) + 1,
            status: isCompleted ? 'completed' : 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', recurring.id);

        results.push({ recurring_id: recurring.id, invoice_id: invoice.id, status: 'generated' });
      } catch (err) {
        results.push({ recurring_id: recurring.id, status: 'error', error: (err as Error).message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, generated: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateNextDate(currentDate: string, frequency: string, interval: number): string {
  const date = new Date(currentDate);
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7 * interval);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + interval);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3 * interval);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + interval);
      break;
  }
  return date.toISOString().split('T')[0];
}
