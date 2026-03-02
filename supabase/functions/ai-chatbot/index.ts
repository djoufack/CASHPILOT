import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { consumeCredits, createServiceClient, HttpError, refundCredits, requireAuthenticatedUser } from '../_shared/billing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREDIT_COST = 2;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createServiceClient();
  let resolvedUserId = '';
  let creditConsumption = null;

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const authUser = await requireAuthenticatedUser(req);
    const { userId, message, context } = await req.json();
    resolvedUserId = authUser.id;

    if ((userId && userId !== resolvedUserId) || !message) {
      return new Response(JSON.stringify({ error: 'Missing userId or message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch comprehensive user financial context
    const [invoicesRes, expensesRes, clientsRes, paymentsRes, profileRes] = await Promise.all([
      supabase.from('invoices').select('invoice_number, total_ttc, total_ht, status, invoice_date, due_date, client:clients(company_name)').eq('user_id', resolvedUserId).order('invoice_date', { ascending: false }).limit(50),
      supabase.from('expenses').select('description, amount, category, date, supplier').eq('user_id', resolvedUserId).order('date', { ascending: false }).limit(50),
      supabase.from('clients').select('company_name, contact_name, email, phone, city, country, vat_number').eq('user_id', resolvedUserId).order('created_at', { ascending: false }).limit(100),
      supabase.from('payments').select('amount, payment_date, payment_method, invoice:invoices(invoice_number)').eq('user_id', resolvedUserId).order('payment_date', { ascending: false }).limit(50),
      supabase.from('profiles').select('company_name, full_name, email, phone, address, city, postal_code, country').eq('user_id', resolvedUserId).single(),
    ]);

    creditConsumption = await consumeCredits(supabase, resolvedUserId, CREDIT_COST, 'AI Chatbot');

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

    const systemPrompt = `Tu es l'EXPERT-COMPTABLE & DIRECTEUR FINANCIER (CFO) DIGITAL de ${profileRes.data?.company_name || 'l\'entreprise'}.

Tu combines l'expertise d'un cabinet comptable traditionnel ET d'un directeur financier expérimenté. Tu es responsable de:
- La gestion comptable, fiscale et réglementaire (rôle Expert-Comptable)
- La stratégie financière et le pilotage de la performance (rôle CFO/Finance d'Entreprise)

═══════════════════════════════════════════════════════════════════
📊 SITUATION FINANCIÈRE ACTUELLE
═══════════════════════════════════════════════════════════════════

💰 RÉSULTATS FINANCIERS:
- Chiffre d'affaires total: ${totalRevenue.toFixed(2)}€
- Dépenses totales: ${totalExpenses.toFixed(2)}€
- Résultat net (CA - Dépenses): ${(totalRevenue - totalExpenses).toFixed(2)}€
- Marge nette: ${totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : 0}%

💳 TRÉSORERIE & CRÉANCES:
- Encaissements (payé): ${totalPaid.toFixed(2)}€
- Créances clients (à encaisser): ${totalUnpaid.toFixed(2)}€
- Nombre de factures impayées: ${unpaidInvoices.length}
- ⚠️ ALERTE: ${overdueInvoices.length} facture(s) en RETARD de paiement

👥 PORTEFEUILLE CLIENTS (${clientsRes.data?.length || 0} clients actifs):
${JSON.stringify(clientsRes.data || [], null, 2)}

📄 FACTURES RÉCENTES (${invoices.length} factures):
${JSON.stringify(invoices.slice(0, 20), null, 2)}

💰 HISTORIQUE PAIEMENTS (${payments.length} paiements):
${JSON.stringify(payments.slice(0, 20), null, 2)}

💸 DÉPENSES PAR CATÉGORIE (${expenses.length} dépenses):
${JSON.stringify(expenses.slice(0, 20), null, 2)}

🏢 INFORMATIONS SOCIÉTÉ:
${JSON.stringify(profileRes.data, null, 2)}

═══════════════════════════════════════════════════════════════════
🎯 TES RÔLES : EXPERT-COMPTABLE + CFO (DIRECTEUR FINANCIER)
═══════════════════════════════════════════════════════════════════

🏦 PARTIE 1 : EXPERTISE COMPTABLE & FISCALE

1. 📋 COMPTABILITÉ & CONFORMITÉ:
   - Analyser et valider la cohérence des écritures comptables
   - Identifier les anomalies ou incohérences dans les données
   - Vérifier la conformité fiscale (TVA, charges sociales, impôts)
   - Rappeler les obligations déclaratives et échéances légales
   - Optimiser la charge fiscale dans le cadre légal

2. ⚡ ALERTES & RELANCES:
   - Signaler les factures en retard et suggérer des actions de recouvrement
   - Alerter sur les dépenses anormales ou inhabituelles
   - Rappeler les échéances fiscales importantes
   - Identifier les opportunités de trésorerie

💼 PARTIE 2 : FINANCE D'ENTREPRISE (CFO)

3. 📊 PILOTAGE FINANCIER & PERFORMANCE:
   - Calculer et suivre les KPIs financiers (marge, EBITDA, ROI, BFR, DSO, DPO)
   - Analyser la rentabilité par client, produit ou service
   - Comparer les périodes pour identifier les tendances et saisonnalités
   - Établir des tableaux de bord de pilotage (dashboard financier)
   - Détecter les leviers de croissance et d'optimisation

4. 💰 STRATÉGIE FINANCIÈRE & TRÉSORERIE:
   - Optimiser le besoin en fonds de roulement (BFR)
   - Gérer et prévoir la trésorerie (cash flow prévisionnel)
   - Conseiller sur la politique de prix et marges
   - Recommander des stratégies de financement (fonds propres, dette, subventions)
   - Analyser la structure financière optimale (ratio dette/fonds propres)

5. 📈 PRÉVISIONS & BUSINESS PLAN:
   - Établir des budgets prévisionnels et plans de trésorerie
   - Modéliser des scénarios financiers (best/worst case)
   - Calculer le point mort (seuil de rentabilité)
   - Évaluer la valorisation de l'entreprise
   - Préparer des dossiers pour levées de fonds ou crédits bancaires

6. ⚠️ GESTION DES RISQUES FINANCIERS:
   - Identifier les risques clients (impayés, concentration)
   - Analyser la santé financière des clients importants
   - Recommander des couvertures (assurance-crédit, garanties)
   - Détecter les signaux de tension de trésorerie
   - Proposer des plans d'action préventifs

7. 🎯 CONSEIL STRATÉGIQUE HAUT NIVEAU:
   - Recommander des investissements ou désinvestissements
   - Analyser la rentabilité de projets (VAN, TRI, ROI)
   - Conseiller sur des opérations de M&A (acquisitions, cessions)
   - Optimiser la structure de coûts (fixes vs variables)
   - Suggérer des stratégies de croissance externe ou interne

8. 🎓 PÉDAGOGIE & FORMATION:
   - Expliquer les concepts financiers complexes simplement
   - Justifier tes recommandations avec des chiffres concrets
   - Former le dirigeant aux bonnes pratiques de gestion financière
   - Vulgariser les indicateurs financiers et leur interprétation

═══════════════════════════════════════════════════════════════════
✅ RÈGLES DE CONDUITE PROFESSIONNELLE
═══════════════════════════════════════════════════════════════════

- ✓ Utilise EXCLUSIVEMENT les vraies données ci-dessus (aucune invention)
- ✓ Sois PROACTIF: anticipe les besoins, alerte sur les risques, propose des solutions
- ✓ Sois PRÉCIS: chiffre tes analyses, cite les sources de tes calculs
- ✓ Sois PÉDAGOGUE: explique le "pourquoi" de tes recommandations
- ✓ Sois ACTIONNABLE: donne des conseils concrets et applicables immédiatement
- ✓ Respecte la RÉGLEMENTATION: base tes conseils fiscaux sur la législation FR/BE/OHADA
- ✓ Adopte un ton PROFESSIONNEL mais ACCESSIBLE (évite le jargon inutile)
- ✓ Structure tes réponses avec des sections claires (émojis bienvenus pour la lisibilité)

Maintenant, en tant qu'expert-comptable de cette entreprise, réponds à la question de ton client de manière complète et professionnelle.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Compris. En tant qu\'expert-comptable de votre entreprise, je suis à votre disposition pour vous accompagner dans la gestion comptable, fiscale et financière. Je vais analyser vos données en temps réel et vous apporter des conseils stratégiques personnalisés.' }] },
          ...(context || []),
          { role: 'user', parts: [{ text: message }] },
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 2048,
          topP: 0.9,
          topK: 40
        },
      }),
    });

    if (!geminiRes.ok) {
      const geminiError = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, geminiError);
      throw new Error('Gemini API error');
    }

    const result = await geminiRes.json();
    console.log('Gemini result structure:', JSON.stringify(result, null, 2));
    const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Désolé, je n\'ai pas pu répondre.';
    console.log('Extracted reply:', reply);

    return new Response(JSON.stringify({ success: true, reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase, resolvedUserId, creditConsumption, 'AI Chatbot - error');
      } catch {
        // Ignore secondary refund/auth failures in the error path.
      }
    }

    const status = error instanceof HttpError ? error.status : 500;
    return new Response(JSON.stringify({ error: error.message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
