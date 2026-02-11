import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREDIT_COST = 2;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { userId, message, context } = await req.json();

    if (!userId || !message) {
      return new Response(JSON.stringify({ error: 'Missing userId or message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check credits
    const { data: credits } = await supabase.from('user_credits').select('free_credits, paid_credits').eq('user_id', userId).single();
    const availableCredits = (credits?.free_credits || 0) + (credits?.paid_credits || 0);
    if (!credits || availableCredits < CREDIT_COST) {
      return new Response(JSON.stringify({ error: 'insufficient_credits' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Deduct credits (from free first, then paid)
    const freeDeduction = Math.min(credits.free_credits, CREDIT_COST);
    const paidDeduction = CREDIT_COST - freeDeduction;
    const { error: updateError } = await supabase.from('user_credits').update({
      free_credits: credits.free_credits - freeDeduction,
      paid_credits: credits.paid_credits - paidDeduction,
      updated_at: new Date().toISOString()
    }).eq('user_id', userId);

    if (updateError) {
      console.error('Credit update error:', updateError);
    }

    await supabase.from('credit_transactions').insert([{ user_id: userId, amount: -CREDIT_COST, type: 'usage', description: 'AI Chatbot' }]);

    // Fetch comprehensive user financial context
    const [invoicesRes, expensesRes, clientsRes, paymentsRes, profileRes] = await Promise.all([
      supabase.from('invoices').select('invoice_number, total_ttc, total_ht, status, invoice_date, due_date, client:clients(company_name)').eq('user_id', userId).order('invoice_date', { ascending: false }).limit(50),
      supabase.from('expenses').select('description, amount, category, date, supplier').eq('user_id', userId).order('date', { ascending: false }).limit(50),
      supabase.from('clients').select('company_name, contact_name, email, phone, city, country, vat_number').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
      supabase.from('payments').select('amount, payment_date, payment_method, invoice:invoices(invoice_number)').eq('user_id', userId).order('payment_date', { ascending: false }).limit(50),
      supabase.from('profiles').select('company_name, full_name, email, phone, address, city, postal_code, country').eq('user_id', userId).single(),
    ]);

    // Calculate financial summary (bilan)
    const invoices = invoicesRes.data || [];
    const expenses = expensesRes.data || [];
    const payments = paymentsRes.data || [];

    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalPaid = payments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
    const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid');
    const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0);
    const overdueInvoices = unpaidInvoices.filter(inv => new Date(inv.due_date) < new Date());

    const systemPrompt = `Tu es un assistant comptable expert pour ${profileRes.data?.company_name || 'l\'utilisateur'}. Tu aides avec la comptabilité, la fiscalité belge/française, et l'analyse financière.

CONTEXTE COMPLET DE L'ENTREPRISE:

📊 BILAN FINANCIER:
- Chiffre d'affaires (factures émises): ${totalRevenue.toFixed(2)}€
- Dépenses totales: ${totalExpenses.toFixed(2)}€
- Résultat net: ${(totalRevenue - totalExpenses).toFixed(2)}€
- Montant payé: ${totalPaid.toFixed(2)}€
- Créances (impayés): ${totalUnpaid.toFixed(2)}€ (${unpaidInvoices.length} factures)
- Factures en retard: ${overdueInvoices.length} factures

👥 CLIENTS (${clientsRes.data?.length || 0} clients):
${JSON.stringify(clientsRes.data || [], null, 2)}

📄 FACTURES (${invoices.length} factures récentes):
${JSON.stringify(invoices.slice(0, 20), null, 2)}

💰 PAIEMENTS (${payments.length} paiements récents):
${JSON.stringify(payments.slice(0, 20), null, 2)}

💸 DÉPENSES (${expenses.length} dépenses récentes):
${JSON.stringify(expenses.slice(0, 20), null, 2)}

🏢 PROFIL ENTREPRISE:
${JSON.stringify(profileRes.data, null, 2)}

INSTRUCTIONS:
- Réponds de manière concise et professionnelle en français
- Utilise UNIQUEMENT les vraies données ci-dessus pour tes réponses
- Si on te demande des calculs, des stats ou des informations, base-toi sur ces données
- Tu peux faire des analyses financières, identifier des tendances, suggérer des optimisations
- Tu as accès à TOUT le contexte financier de l'entreprise`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Compris. Je suis prêt à vous aider.' }] },
          ...(context || []),
          { role: 'user', parts: [{ text: message }] },
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    });

    if (!geminiRes.ok) {
      // Refund credits on error
      await supabase.from('user_credits').update({
        free_credits: credits.free_credits,
        paid_credits: credits.paid_credits
      }).eq('user_id', userId);
      await supabase.from('credit_transactions').insert([{ user_id: userId, amount: CREDIT_COST, type: 'refund', description: 'AI Chatbot - error' }]);
      throw new Error('Gemini API error');
    }

    const result = await geminiRes.json();
    const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Désolé, je n\'ai pas pu répondre.';

    return new Response(JSON.stringify({ success: true, reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
