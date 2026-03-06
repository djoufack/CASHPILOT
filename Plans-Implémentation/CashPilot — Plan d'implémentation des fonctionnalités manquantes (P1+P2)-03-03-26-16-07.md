CashPilot — Plan d'implémentation des fonctionnalités manquantes (P1+P2)
For Claude: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

Goal: Implémenter les 8 fonctionnalités manquantes identifiées lors de l'audit fonctionnel (3×P1 + 5×P2) pour atteindre ~95% de complétude vs concurrents.

Architecture: Chaque fonctionnalité = migration SQL + hook React + composant UI + (optionnel) Edge Function Supabase. Les migrations sont cumulatives et ordonnées. Le pattern existant (useX.js + ComponentX.jsx + onglet dans page parente) est systématiquement réutilisé.

Tech Stack: React 18 + Vite + Tailwind + Supabase (Auth/DB/Functions) + Stripe + i18next (fr/en) + Recharts + Framer Motion + Shadcn/Radix UI

Vue d'ensemble des sprints
Sprint	Fonctionnalité	Complexité	Risque
S1-F1	Amortissements / Immobilisations	Haute	Moyen
S1-F2	Signature électronique des devis	Moyenne	Faible
S1-F3	Lien de paiement Stripe sur facture	Moyenne	Faible
S2-F4	Rentabilité par projet	Faible	Faible
S2-F5	Vue Gantt projets	Moyenne	Faible
S2-F6	Comptabilité analytique	Moyenne	Faible
S2-F7	Webhooks étendus (Zapier/Make)	Faible	Faible
S2-F8	Multi-sociétés	Très haute	Élevé — faire en dernier
SPRINT 1 — Priorité Haute (P1)
FEATURE S1-F1 : Amortissements / Immobilisations
Fichiers à créer :

supabase/migrations/YYYYMMDD_fixed_assets.sql
src/hooks/useFixedAssets.js
src/components/accounting/FixedAssets.jsx
Fichiers à modifier :

src/pages/AccountingIntegration.jsx (ajouter onglet)
src/i18n/locales/fr.json (clés i18n)
src/i18n/locales/en.json (clés i18n)
Task 1 : Migration SQL — Table fixed_assets
Fichier : supabase/migrations/YYYYMMDD_fixed_assets.sql

Step 1 : Écrire la migration


-- Table des immobilisations
CREATE TABLE IF NOT EXISTS public.accounting_fixed_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_name      TEXT NOT NULL,
  asset_code      TEXT,                          -- Code comptable (ex: 2154)
  acquisition_date DATE NOT NULL,
  acquisition_cost NUMERIC(15,2) NOT NULL CHECK (acquisition_cost > 0),
  residual_value  NUMERIC(15,2) NOT NULL DEFAULT 0,
  useful_life_years INTEGER NOT NULL CHECK (useful_life_years > 0),
  depreciation_method TEXT NOT NULL DEFAULT 'linear'
    CHECK (depreciation_method IN ('linear', 'declining')),
  asset_type      TEXT NOT NULL DEFAULT 'tangible'
    CHECK (asset_type IN ('tangible', 'intangible', 'financial')),
  category        TEXT,                          -- ex: Matériel, Véhicule, Logiciel
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disposed', 'fully_depreciated')),
  disposal_date   DATE,
  disposal_value  NUMERIC(15,2),
  account_code_asset TEXT,                       -- Compte d'actif (21xx PCG)
  account_code_depreciation TEXT,                -- Compte amortissement (28xx PCG)
  account_code_expense TEXT,                     -- Compte dotation (68xx PCG)
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.accounting_fixed_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own assets"
  ON public.accounting_fixed_assets
  FOR ALL USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_fixed_assets_user_id
  ON public.accounting_fixed_assets(user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_fixed_assets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_fixed_assets_updated_at
  BEFORE UPDATE ON public.accounting_fixed_assets
  FOR EACH ROW EXECUTE FUNCTION update_fixed_assets_updated_at();

-- Table des lignes d'amortissement calculées
CREATE TABLE IF NOT EXISTS public.accounting_depreciation_schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id        UUID NOT NULL REFERENCES public.accounting_fixed_assets(id) ON DELETE CASCADE,
  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  depreciation_amount NUMERIC(15,2) NOT NULL,
  accumulated_depreciation NUMERIC(15,2) NOT NULL,
  net_book_value  NUMERIC(15,2) NOT NULL,
  is_posted       BOOLEAN NOT NULL DEFAULT false,
  entry_ref       TEXT,                          -- Ref de l'écriture accounting_entries
  posted_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.accounting_depreciation_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own schedule"
  ON public.accounting_depreciation_schedule
  FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_depreciation_schedule_asset
  ON public.accounting_depreciation_schedule(asset_id);
Step 2 : Appliquer la migration


supabase db push
# ou via Supabase Dashboard → SQL Editor
Step 3 : Vérifier les tables créées


supabase db inspect --schema public | grep fixed_assets
Step 4 : Commit


git add supabase/migrations/
git commit -m "feat(accounting): add fixed_assets and depreciation_schedule tables"
Task 2 : Hook useFixedAssets.js
Fichier : src/hooks/useFixedAssets.js

Step 1 : Créer le hook


import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

/**
 * Calcule le tableau d'amortissement linéaire ou dégressif
 * @param {number} cost - Coût d'acquisition
 * @param {number} residualValue - Valeur résiduelle
 * @param {number} usefulLife - Durée de vie en années
 * @param {string} method - 'linear' | 'declining'
 * @param {Date} acquisitionDate - Date d'acquisition
 * @returns {Array} Lignes du tableau d'amortissement
 */
export function calculateDepreciationSchedule(cost, residualValue, usefulLife, method, acquisitionDate) {
  const depreciableBase = cost - residualValue;
  const lines = [];
  let accumulated = 0;

  const startYear = new Date(acquisitionDate).getFullYear();
  const startMonth = new Date(acquisitionDate).getMonth() + 1;

  for (let year = 0; year < usefulLife; year++) {
    let annualDepreciation;
    if (method === 'linear') {
      annualDepreciation = depreciableBase / usefulLife;
    } else {
      // Dégressif : taux = 2 / usefulLife
      const decliningRate = 2 / usefulLife;
      const remainingValue = depreciableBase - accumulated;
      annualDepreciation = Math.min(remainingValue, (cost - accumulated) * decliningRate);
    }

    // Pro-rata première année
    const monthsInFirstYear = 12 - startMonth + 1;
    const yearDepreciation = year === 0
      ? (annualDepreciation * monthsInFirstYear) / 12
      : annualDepreciation;

    const monthlyDepreciation = yearDepreciation / (year === 0 ? monthsInFirstYear : 12);
    const periodYear = startYear + year;

    for (let m = (year === 0 ? startMonth : 1); m <= 12; m++) {
      if (accumulated >= depreciableBase) break;
      const amount = Math.min(monthlyDepreciation, depreciableBase - accumulated);
      accumulated += amount;
      lines.push({
        period_year: periodYear,
        period_month: m,
        depreciation_amount: Math.round(amount * 100) / 100,
        accumulated_depreciation: Math.round(accumulated * 100) / 100,
        net_book_value: Math.round((cost - accumulated) * 100) / 100,
        is_posted: false,
      });
    }
  }
  return lines;
}

export function useFixedAssets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assets, setAssets] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAssets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounting_fixed_assets')
        .select('*')
        .eq('user_id', user.id)
        .order('acquisition_date', { ascending: false });
      if (error) throw error;
      setAssets(data || []);
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const fetchSchedule = useCallback(async (assetId) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('accounting_depreciation_schedule')
      .select('*')
      .eq('asset_id', assetId)
      .order('period_year')
      .order('period_month');
    if (error) throw error;
    setSchedule(data || []);
    return data || [];
  }, [user]);

  const createAsset = useCallback(async (assetData) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('accounting_fixed_assets')
      .insert({ ...assetData, user_id: user.id })
      .select()
      .single();
    if (error) throw error;

    // Générer et sauvegarder le tableau d'amortissement
    const lines = calculateDepreciationSchedule(
      assetData.acquisition_cost,
      assetData.residual_value || 0,
      assetData.useful_life_years,
      assetData.depreciation_method || 'linear',
      assetData.acquisition_date
    );
    const scheduleRows = lines.map(l => ({
      ...l, asset_id: data.id, user_id: user.id,
    }));
    if (scheduleRows.length > 0) {
      const { error: scheduleError } = await supabase
        .from('accounting_depreciation_schedule')
        .insert(scheduleRows);
      if (scheduleError) throw scheduleError;
    }

    toast({ title: 'Immobilisation créée', description: assetData.asset_name });
    await fetchAssets();
    return data;
  }, [user, fetchAssets, toast]);

  const updateAsset = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('accounting_fixed_assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    toast({ title: 'Immobilisation mise à jour' });
    await fetchAssets();
    return data;
  }, [fetchAssets, toast]);

  const deleteAsset = useCallback(async (id) => {
    const { error } = await supabase
      .from('accounting_fixed_assets')
      .delete()
      .eq('id', id);
    if (error) throw error;
    toast({ title: 'Immobilisation supprimée' });
    await fetchAssets();
  }, [fetchAssets, toast]);

  /**
   * Passe en écriture comptable une dotation mensuelle
   */
  const postDepreciationEntry = useCallback(async (asset, scheduleLine) => {
    if (!user) return;
    const entryRef = `AMORT-${asset.id.slice(0, 8)}-${scheduleLine.period_year}-${scheduleLine.period_month}`;

    // Écriture 1 : débit dotation (68xx), crédit amortissement (28xx)
    const entries = [
      {
        user_id: user.id,
        account_code: asset.account_code_expense || '6811',
        entry_ref: entryRef,
        transaction_date: `${scheduleLine.period_year}-${String(scheduleLine.period_month).padStart(2, '0')}-28`,
        debit: scheduleLine.depreciation_amount,
        credit: 0,
        description: `Dotation amortissement — ${asset.asset_name}`,
        journal: 'OD',
        source_type: 'fixed_asset',
        source_id: asset.id,
        is_auto: true,
      },
      {
        user_id: user.id,
        account_code: asset.account_code_depreciation || '2815',
        entry_ref: entryRef,
        transaction_date: `${scheduleLine.period_year}-${String(scheduleLine.period_month).padStart(2, '0')}-28`,
        debit: 0,
        credit: scheduleLine.depreciation_amount,
        description: `Amortissement — ${asset.asset_name}`,
        journal: 'OD',
        source_type: 'fixed_asset',
        source_id: asset.id,
        is_auto: true,
      },
    ];

    const { error } = await supabase.from('accounting_entries').insert(entries);
    if (error) throw error;

    // Marquer la ligne comme postée
    await supabase
      .from('accounting_depreciation_schedule')
      .update({ is_posted: true, entry_ref: entryRef, posted_at: new Date().toISOString() })
      .eq('id', scheduleLine.id);

    toast({ title: 'Dotation comptabilisée', description: `${scheduleLine.depreciation_amount} €` });
  }, [user, toast]);

  return {
    assets, schedule, loading,
    fetchAssets, fetchSchedule,
    createAsset, updateAsset, deleteAsset,
    postDepreciationEntry,
  };
}
Step 2 : Commit


git add src/hooks/useFixedAssets.js
git commit -m "feat(accounting): add useFixedAssets hook with depreciation schedule calculation"
Task 3 : Composant FixedAssets.jsx
Fichier : src/components/accounting/FixedAssets.jsx

Step 1 : Créer le composant (structure — implémenter avec le pattern des autres composants accounting)

Le composant doit afficher :

Tableau des immobilisations : liste avec colonnes (nom, code, date acquisition, coût, valeur nette comptable, méthode, statut)
Bouton "Nouvelle immobilisation" : dialog avec formulaire (asset_name, asset_type, category, acquisition_date, acquisition_cost, residual_value, useful_life_years, depreciation_method, account_code_asset, account_code_depreciation, account_code_expense)
Vue tableau d'amortissement : pour chaque actif, affiche les lignes du schedule avec bouton "Comptabiliser" sur les lignes non postées
KPIs : Valeur brute totale, Amortissements cumulés, Valeur nette comptable totale
Réutiliser Card, Table, Dialog, Button, Select, Input depuis @/components/ui/
Même design glassmorphism que BalanceSheet.jsx (référence pour le style)
useFixedAssets() comme data source
Step 2 : Ajouter clés i18n

Dans src/i18n/locales/fr.json, ajouter sous la clé accounting :


"fixedAssets": {
  "title": "Immobilisations",
  "newAsset": "Nouvelle immobilisation",
  "assetName": "Désignation",
  "acquisitionDate": "Date d'acquisition",
  "acquisitionCost": "Coût d'acquisition (€)",
  "residualValue": "Valeur résiduelle (€)",
  "usefulLife": "Durée d'utilisation (années)",
  "method": "Méthode d'amortissement",
  "linear": "Linéaire",
  "declining": "Dégressif",
  "netBookValue": "Valeur nette comptable",
  "schedule": "Plan d'amortissement",
  "postEntry": "Comptabiliser",
  "posted": "Comptabilisée",
  "totalGross": "Valeur brute totale",
  "totalDepreciation": "Amortissements cumulés",
  "totalNet": "Valeur nette totale"
}
Répliquer les mêmes clés en anglais dans en.json.

Step 3 : Commit


git add src/components/accounting/FixedAssets.jsx src/i18n/
git commit -m "feat(accounting): add FixedAssets component with depreciation table and posting"
Task 4 : Intégrer l'onglet dans AccountingIntegration.jsx
Fichier : src/pages/AccountingIntegration.jsx

Step 1 : Ajouter l'import


import FixedAssets from '@/components/accounting/FixedAssets';
Step 2 : Ajouter l'onglet dans le tableau tabs (ligne ~205)


{ value: 'fixedAssets', label: t('accounting.fixedAssets.title'), icon: Building2 },
Ajouter Building2 à l'import lucide-react existant.

Step 3 : Ajouter le TabsContent (après le dernier <TabsContent> existant)


<TabsContent value="fixedAssets">
  <FixedAssets />
</TabsContent>
Step 4 : Vérifier visuellement


npm run dev
# Naviguer vers /app/suppliers/accounting → onglet "Immobilisations"
Step 5 : Commit


git add src/pages/AccountingIntegration.jsx
git commit -m "feat(accounting): integrate fixed assets tab into AccountingIntegration"
FEATURE S1-F2 : Signature électronique des devis
Approche retenue : Signature in-app via canvas (sans provider externe payant). Le client reçoit un email avec un lien vers une page publique /quote-sign/:token où il peut lire et signer le devis avec son doigt/souris. La signature est stockée comme PNG base64 dans Supabase Storage.

Dépendance npm : react-signature-canvas (MIT)

Fichiers à créer :

supabase/migrations/YYYYMMDD_quote_signatures.sql
src/hooks/useQuoteSignature.js
src/pages/QuoteSignPage.jsx (page publique)
src/components/SignaturePad.jsx
supabase/functions/quote-sign-request/index.ts
Fichiers à modifier :

src/pages/QuotesPage.jsx (bouton + affichage statut)
src/App.jsx (route publique)
src/i18n/locales/fr.json + en.json
Task 1 : Migration SQL — Signature
Fichier : supabase/migrations/YYYYMMDD_quote_signatures.sql


-- Colonnes de signature sur quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS signature_status TEXT
    NOT NULL DEFAULT 'unsigned'
    CHECK (signature_status IN ('unsigned', 'pending', 'signed', 'rejected', 'expired')),
  ADD COLUMN IF NOT EXISTS signature_token  TEXT UNIQUE,   -- token court pour URL publique
  ADD COLUMN IF NOT EXISTS signature_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by        TEXT,          -- Nom déclaré du signataire
  ADD COLUMN IF NOT EXISTS signer_email     TEXT,
  ADD COLUMN IF NOT EXISTS signed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_url    TEXT;          -- URL Storage du PNG

-- Index sur le token (lookup rapide depuis la page publique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_signature_token
  ON public.quotes(signature_token) WHERE signature_token IS NOT NULL;
Step 2 : supabase db push puis vérifier.

Step 3 : Commit


git add supabase/migrations/
git commit -m "feat(quotes): add signature fields to quotes table"
Task 2 : Edge Function quote-sign-request
Fichier : supabase/functions/quote-sign-request/index.ts

Logique :

Reçoit { quoteId } (auth requise)
Génère un token aléatoire (crypto.randomUUID())
Calcule expiry = now() + 7 jours
UPDATE quotes SET signature_status='pending', signature_token, signature_token_expires_at, signer_email
Retourne { signatureUrl: 'https://cashpilot.tech/quote-sign/{token}' }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuthenticatedUser } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const verifiedUserId = await requireAuthenticatedUser(req, supabase);
  const { quoteId, signerEmail } = await req.json();

  const token = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('quotes')
    .update({
      signature_status: 'pending',
      signature_token: token,
      signature_token_expires_at: expiresAt,
      signer_email: signerEmail,
    })
    .eq('id', quoteId)
    .eq('user_id', verifiedUserId);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  const appUrl = Deno.env.get('APP_URL') || 'https://cashpilot.tech';
  return new Response(JSON.stringify({
    signatureUrl: `${appUrl}/quote-sign/${token}`,
    expiresAt,
  }), { headers: { 'Content-Type': 'application/json' } });
});
Step : supabase functions deploy quote-sign-request

Task 3 : Composant SignaturePad.jsx
Fichier : src/components/SignaturePad.jsx


npm install react-signature-canvas

import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';

export default function SignaturePad({ onSave, onClear }) {
  const sigRef = useRef(null);

  const handleSave = () => {
    if (sigRef.current?.isEmpty()) return;
    const dataUrl = sigRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  const handleClear = () => {
    sigRef.current?.clear();
    onClear?.();
  };

  return (
    <div className="space-y-3">
      <div className="border border-white/20 rounded-lg overflow-hidden bg-white">
        <SignatureCanvas
          ref={sigRef}
          canvasProps={{ width: 600, height: 200, className: 'w-full' }}
          penColor="#1a1a2e"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleClear}>Effacer</Button>
        <Button onClick={handleSave}>Valider la signature</Button>
      </div>
    </div>
  );
}
Task 4 : Page publique QuoteSignPage.jsx
Fichier : src/pages/QuoteSignPage.jsx

Logique :

Lit le token depuis useParams()
Fetch quotes?signature_token=eq.{token} sans auth (policy publique sur ce champ)
Affiche le devis (client, items, montant, conditions)
Bouton "Refuser" → update signature_status = 'rejected'
Zone de signature (SignaturePad)
Bouton "Signer et accepter" → upload PNG vers supabase.storage.from('signatures').upload(...), update quotes (signed_by, signed_at, signature_url, signature_status='signed')
Important : Ajouter une policy Supabase permettant SELECT public sur quotes via signature_token uniquement.

Step : Ajouter la route dans App.jsx


import QuoteSignPage from './pages/QuoteSignPage';
// Dans les routes publiques :
<Route path="/quote-sign/:token" element={<Suspense fallback={<PageLoader />}><QuoteSignPage /></Suspense>} />
Step : Commit


git add src/pages/QuoteSignPage.jsx src/components/SignaturePad.jsx src/App.jsx
git commit -m "feat(quotes): add public quote signing page with canvas signature pad"
Task 5 : Intégrer dans QuotesPage.jsx
Dans src/pages/QuotesPage.jsx, pour chaque devis avec status != 'signed' :

Ajouter bouton "Demander signature" (ouvre dialog pour saisir l'email du signataire)
On appelle supabase.functions.invoke('quote-sign-request', { body: { quoteId, signerEmail } })
Afficher le lien retourné (copier dans le presse-papier)
Afficher badge de statut de signature (unsigned / pending / signed / rejected / expired) — réutiliser le pattern de PeppolStatusBadge.jsx
Step : Commit


git add src/pages/QuotesPage.jsx
git commit -m "feat(quotes): add signature request button and status badge to QuotesPage"
FEATURE S1-F3 : Lien de paiement Stripe sur facture
Fichiers à créer :

supabase/migrations/YYYYMMDD_invoice_payment_link.sql
supabase/functions/stripe-invoice-link/index.ts
Fichiers à modifier :

src/pages/InvoicesPage.jsx (bouton + affichage)
supabase/functions/stripe-webhook/index.ts (handler payment_intent.succeeded)
src/i18n/locales/fr.json + en.json
Task 1 : Migration SQL

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id   TEXT,   -- ID Stripe Price Link
  ADD COLUMN IF NOT EXISTS stripe_payment_link_url  TEXT,   -- URL publique Stripe
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_expires_at  TIMESTAMPTZ;
Task 2 : Edge Function stripe-invoice-link
Fichier : supabase/functions/stripe-invoice-link/index.ts

Utilise l'API Stripe Payment Links (pas Checkout Session) pour créer un lien permanent.


import Stripe from 'https://esm.sh/stripe@14';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuthenticatedUser } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const verifiedUserId = await requireAuthenticatedUser(req, supabase);

  const { invoiceId } = await req.json();

  // Récupérer la facture
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('id', invoiceId)
    .eq('user_id', verifiedUserId)
    .single();
  if (fetchError || !invoice) return new Response(JSON.stringify({ error: 'Invoice not found' }), { status: 404 });

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

  // Créer un Price dynamique pour le montant exact
  const price = await stripe.prices.create({
    currency: (invoice.currency || 'eur').toLowerCase(),
    unit_amount: Math.round(invoice.total_ttc * 100),
    product_data: {
      name: `Facture ${invoice.invoice_number}`,
    },
  });

  // Créer le Payment Link
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { invoice_id: invoiceId, user_id: verifiedUserId },
    after_completion: {
      type: 'redirect',
      redirect: { url: `${Deno.env.get('APP_URL')}/payment-success?invoice=${invoiceId}` },
    },
  });

  // Sauvegarder sur la facture
  await supabase.from('invoices')
    .update({
      stripe_payment_link_id: paymentLink.id,
      stripe_payment_link_url: paymentLink.url,
    })
    .eq('id', invoiceId);

  return new Response(JSON.stringify({ paymentLinkUrl: paymentLink.url }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
Task 3 : Webhook Stripe — traitement paiement facture
Dans supabase/functions/stripe-webhook/index.ts, ajouter dans le handler checkout.session.completed (ou nouveau handler payment_intent.succeeded) :


// Après le handler mode === 'subscription' et mode === 'payment' (crédits) existants
if (session.metadata?.invoice_id) {
  // Paiement d'une facture client
  const invoiceId = session.metadata.invoice_id;
  const amountPaid = session.amount_total ? session.amount_total / 100 : 0;

  await supabaseAdmin.from('invoices').update({
    payment_status: 'paid',
    status: 'paid',
    amount_paid: amountPaid,
    balance_due: 0,
  }).eq('id', invoiceId);

  // Créer un enregistrement dans payments
  await supabaseAdmin.from('payments').insert({
    user_id: session.metadata.user_id,
    invoice_id: invoiceId,
    payment_date: new Date().toISOString().split('T')[0],
    amount: amountPaid,
    payment_method: 'card',
    reference: session.id,
    notes: 'Paiement en ligne via Stripe Payment Link',
  });
}
Task 4 : UI dans InvoicesPage.jsx
Pour chaque facture avec status != 'paid' :

Ajouter bouton "Lien de paiement" (icône Link)
Si stripe_payment_link_url existe : afficher le lien avec bouton Copier
Sinon : bouton "Générer le lien" → appel stripe-invoice-link
Afficher badge "Payé via Stripe" si payment_status = 'paid' et stripe_payment_link_id non null
Step : Commit


git add supabase/migrations/ supabase/functions/stripe-invoice-link/ \
        supabase/functions/stripe-webhook/ src/pages/InvoicesPage.jsx
git commit -m "feat(invoices): add Stripe Payment Link generation and auto-payment handling"
SPRINT 2 — Priorité Moyenne (P2)
FEATURE S2-F4 : Rentabilité par projet
Approche : Aucune nouvelle table requise. Tous les champs existent (budget_hours, hourly_rate dans projects ; duration_minutes, hourly_rate, billable dans timesheets). Créer un hook de calcul et étendre l'UI.

Fichiers à créer :

src/hooks/useProjectProfitability.js
Fichiers à modifier :

src/components/ProjectStatistics.jsx
src/pages/ProjectDetail.jsx
src/i18n/locales/fr.json + en.json
Task 1 : Hook useProjectProfitability.js
Fichier : src/hooks/useProjectProfitability.js


import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export function useProjectProfitability(projectId) {
  const { user } = useAuth();
  const [timesheets, setTimesheets] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user || !projectId) return;
    setLoading(true);
    try {
      const [tsResult, invResult, expResult] = await Promise.all([
        supabase.from('timesheets').select('duration_minutes, hourly_rate, billable, invoice_id').eq('project_id', projectId).eq('user_id', user.id),
        supabase.from('invoices').select('total_ttc, status, payment_status').eq('project_id', projectId).eq('user_id', user.id),
        supabase.from('expenses').select('amount').eq('project_id', projectId).eq('user_id', user.id),
      ]);
      setTimesheets(tsResult.data || []);
      setInvoices(invResult.data || []);
      setExpenses(expResult.data || []);
    } finally {
      setLoading(false);
    }
  }, [user, projectId]);

  const profitability = useMemo(() => {
    const totalHours = timesheets.reduce((s, t) => s + (t.duration_minutes || 0) / 60, 0);
    const billableHours = timesheets.filter(t => t.billable).reduce((s, t) => s + (t.duration_minutes || 0) / 60, 0);
    const laborCost = timesheets.reduce((s, t) => s + ((t.duration_minutes || 0) / 60) * (t.hourly_rate || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalRevenue = invoices.filter(i => i.payment_status === 'paid').reduce((s, i) => s + (i.total_ttc || 0), 0);
    const pendingRevenue = invoices.filter(i => i.payment_status !== 'paid').reduce((s, i) => s + (i.total_ttc || 0), 0);
    const totalCost = laborCost + totalExpenses;
    const grossMargin = totalRevenue - totalCost;
    const grossMarginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

    return {
      totalHours: Math.round(totalHours * 10) / 10,
      billableHours: Math.round(billableHours * 10) / 10,
      laborCost: Math.round(laborCost * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      pendingRevenue: Math.round(pendingRevenue * 100) / 100,
      grossMargin: Math.round(grossMargin * 100) / 100,
      grossMarginPct: Math.round(grossMarginPct * 10) / 10,
      utilizationRate: totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0,
    };
  }, [timesheets, invoices, expenses]);

  return { profitability, loading, fetchData };
}
Task 2 : Intégrer dans ProjectDetail.jsx
Ajouter un onglet "Rentabilité" dans ProjectDetail.jsx :

Importer useProjectProfitability
Afficher les métriques clés (KPI cards) : Heures totales, Heures facturables, Coût main d'œuvre, Charges, CA encaissé, Marge brute (€ et %), Taux d'utilisation
Réutiliser les composants Card + Recharts BarChart pour visualisation
Appeler fetchData() dans un useEffect lors du montage de l'onglet
Step : Commit


git add src/hooks/useProjectProfitability.js src/pages/ProjectDetail.jsx
git commit -m "feat(projects): add profitability tab with labor cost, margin, and utilization metrics"
FEATURE S2-F5 : Vue Gantt projets
Dépendance npm : frappe-gantt (MIT, léger, sans dépendances lourdes)

Fichiers à créer :

supabase/migrations/YYYYMMDD_project_dates.sql
src/components/GanttView.jsx
Fichiers à modifier :

src/pages/ProjectDetail.jsx (onglet Gantt)
src/pages/ProjectsPage.jsx (vue Gantt globale)
Task 1 : Migration SQL — dates sur projects et tasks

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS depends_on UUID[] DEFAULT '{}';  -- IDs de tâches prérequises
Task 2 : Installer frappe-gantt

npm install frappe-gantt
Task 3 : Composant GanttView.jsx
Fichier : src/components/GanttView.jsx


import React, { useEffect, useRef } from 'react';
import Gantt from 'frappe-gantt';
import 'frappe-gantt/dist/frappe-gantt.css';

/**
 * @param {Array} tasks - [{ id, name, start, end, progress, dependencies, custom_class }]
 * @param {function} onDateChange - (task, start, end) => void
 * @param {function} onProgressChange - (task, progress) => void
 * @param {'Day'|'Week'|'Month'} viewMode
 */
export default function GanttView({ tasks, onDateChange, onProgressChange, viewMode = 'Week' }) {
  const containerRef = useRef(null);
  const ganttRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !tasks?.length) return;
    ganttRef.current = new Gantt(containerRef.current, tasks, {
      view_mode: viewMode,
      date_format: 'YYYY-MM-DD',
      on_date_change: onDateChange || (() => {}),
      on_progress_change: onProgressChange || (() => {}),
      custom_popup_html: (task) => `
        <div class="details-container p-2 bg-gray-900 text-gray-100 rounded text-sm">
          <h5 class="font-semibold">${task.name}</h5>
          <p>Progression : ${task.progress}%</p>
          <p>${task.start} → ${task.end}</p>
        </div>
      `,
    });
    return () => { ganttRef.current = null; };
  }, [tasks, viewMode, onDateChange, onProgressChange]);

  if (!tasks?.length) {
    return (
      <div className="text-center text-gray-400 py-12">
        Aucune tâche avec dates définies. Ajoutez des dates de début/fin aux tâches.
      </div>
    );
  }

  return <div ref={containerRef} className="gantt-container overflow-x-auto" />;
}
Note CSS : Ajouter dans src/index.css un override minimal pour adapter le thème dark du Gantt (background, couleurs de barres).

Task 4 : Intégrer dans ProjectDetail.jsx
Ajouter un onglet "Gantt" :

Mapper les tasks du projet vers le format frappe-gantt : { id, name, start: task.start_date, end: task.end_date, progress: task.status === 'completed' ? 100 : task.status === 'in_progress' ? 50 : 0 }
Filtrer uniquement les tasks ayant start_date et end_date
Ajouter un sélecteur de granularité (Jour/Semaine/Mois)
Handler onDateChange pour mettre à jour start_date/end_date via supabase.from('tasks').update()
Step : Commit


git add supabase/migrations/ src/components/GanttView.jsx src/pages/ProjectDetail.jsx
git commit -m "feat(projects): add Gantt view with frappe-gantt, start/end dates on tasks"
FEATURE S2-F6 : Comptabilité analytique
Approche : Ajouter des axes analytiques (centre de coût, département, ligne de produit) sur les écritures comptables et une UI de reporting par axe.

Fichiers à créer :

supabase/migrations/YYYYMMDD_analytical_accounting.sql
src/components/accounting/AnalyticalAccounting.jsx
Fichiers à modifier :

src/pages/AccountingIntegration.jsx
Task 1 : Migration SQL

-- Table des axes analytiques
CREATE TABLE IF NOT EXISTS public.accounting_analytical_axes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  axis_type TEXT NOT NULL CHECK (axis_type IN ('cost_center', 'department', 'product_line', 'project', 'custom')),
  axis_code TEXT NOT NULL,
  axis_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.accounting_analytical_axes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own axes" ON public.accounting_analytical_axes FOR ALL USING (auth.uid() = user_id);

-- Colonnes analytiques sur accounting_entries
ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS cost_center   TEXT,   -- Code du centre de coût
  ADD COLUMN IF NOT EXISTS department    TEXT,   -- Code du département
  ADD COLUMN IF NOT EXISTS product_line  TEXT;   -- Code de la ligne de produit

-- Index pour les rapports par axe
CREATE INDEX IF NOT EXISTS idx_entries_cost_center ON public.accounting_entries(cost_center) WHERE cost_center IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entries_department ON public.accounting_entries(department) WHERE department IS NOT NULL;
Task 2 : Composant AnalyticalAccounting.jsx
Le composant affiche :

Gestion des axes : table CRUD des accounting_analytical_axes (cost_center, department, product_line)
Rapport analytique : tableau croisé axis × account_type avec totaux débits/crédits et solde — charger via :

supabase.from('accounting_entries')
  .select('cost_center, department, debit, credit, account_code')
  .eq('user_id', user.id)
  .gte('transaction_date', startDate)
  .lte('transaction_date', endDate)
Afficher un BarChart Recharts par axe (dépenses vs revenus par centre de coût)
Sélecteur de période (réutiliser PeriodSelector.jsx)
Task 3 : Intégrer l'onglet dans AccountingIntegration.jsx
Même pattern que pour FixedAssets.

Step : Commit


git add supabase/migrations/ src/components/accounting/AnalyticalAccounting.jsx src/pages/AccountingIntegration.jsx
git commit -m "feat(accounting): add analytical accounting axes and cost center reporting"
FEATURE S2-F7 : Webhooks étendus (Zapier / Make ready)
Approche : L'infrastructure webhook est déjà en place. Il suffit d'étendre les événements supportés et d'ajouter la documentation d'intégration. Pas de nouvelle table ni Edge Function.

Fichiers à modifier :

src/hooks/useWebhooks.js
supabase/functions/webhooks/index.ts
src/pages/WebhooksPage.jsx (liste d'events enrichie)
Task 1 : Étendre les événements webhook
Dans supabase/functions/webhooks/index.ts, remplacer SUPPORTED_EVENTS :


const SUPPORTED_EVENTS = [
  // Factures
  'invoice.created', 'invoice.updated', 'invoice.sent',
  'invoice.paid', 'invoice.overdue', 'invoice.cancelled',
  // Paiements
  'payment.received', 'payment.refunded',
  // Devis
  'quote.created', 'quote.sent', 'quote.accepted',
  'quote.declined', 'quote.signed',
  // Clients
  'client.created', 'client.updated', 'client.deleted',
  // Dépenses
  'expense.created', 'expense.approved', 'expense.rejected',
  // Projets
  'project.created', 'project.completed', 'project.updated',
  // Tâches
  'task.created', 'task.completed',
  // Feuilles de temps
  'timesheet.created', 'timesheet.invoiced',
];
Répliquer WEBHOOK_EVENTS dans src/hooks/useWebhooks.js.

Task 2 : Ajouter des triggers dans les hooks métier
Dans src/hooks/useInvoices.js, après chaque createInvoice, updateInvoice, déclencher :


// Pattern à répliquer dans chaque hook métier
import { triggerWebhook } from '@/utils/webhookTrigger';
// Après create :
await triggerWebhook('invoice.created', invoiceData);
Fichier src/utils/webhookTrigger.js à créer :


import { supabase } from '@/lib/supabase';

export async function triggerWebhook(event, payload) {
  try {
    await supabase.functions.invoke('webhooks', {
      body: { event, payload },
    });
  } catch (err) {
    console.warn('[webhook] trigger failed silently:', event, err);
    // Ne jamais bloquer l'action principale si le webhook échoue
  }
}
Task 3 : Documentation Zapier/Make dans WebhooksPage.jsx
Ajouter un 3ème onglet "Intégrations" dans WebhooksPage.jsx :

Afficher un guide d'intégration pour Zapier et Make (screenshots, étapes)
Afficher le format exact du payload avec exemple JSON pour chaque event
Copier-coller du code de vérification de signature HMAC (Node.js, Python, PHP)
Badge "Zapier compatible" et "Make compatible"
Step : Commit


git add supabase/functions/webhooks/ src/hooks/useWebhooks.js \
        src/utils/webhookTrigger.js src/pages/WebhooksPage.jsx
git commit -m "feat(webhooks): extend events to 22 triggers, add Zapier/Make integration guide"
FEATURE S2-F8 : Multi-sociétés ⚠️ RISQUE ÉLEVÉ
⚠️ AVERTISSEMENT : Cette fonctionnalité requiert une refactorisation de l'architecture de données fondamentale. Elle doit être réalisée dans un worktree git isolé et testée exhaustivement avant merge. Ne pas paralléliser avec d'autres features.

Approche : Passer de company.user_id (one-to-one) à un modèle user → [company1, company2, ...] avec une notion de "société active" stockée dans les préférences utilisateur.

Fichiers à créer :

supabase/migrations/YYYYMMDD_multi_company.sql
src/contexts/CompanyContext.jsx
src/components/CompanySwitcher.jsx
Fichiers à modifier :

src/hooks/useCompany.js (impact fort)
src/components/MainLayout.jsx ou Navbar (ajouter le switcher)
Toutes les tables et RLS qui utilisent user_id pour isoler les données → ajouter company_id comme dimension secondaire
Task 1 : Migration SQL multi-company

-- Permettre plusieurs sociétés par user
-- 1. Créer la table user_company_preferences
CREATE TABLE IF NOT EXISTS public.user_company_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_company_id UUID REFERENCES public.company(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_company_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User manages own prefs"
  ON public.user_company_preferences FOR ALL USING (auth.uid() = user_id);

-- 2. Supprimer la contrainte UNIQUE sur company.user_id si elle existe
-- (La contrainte actuelle est implicite via maybeSingle() dans le code)
-- Ajouter un index non-unique à la place
CREATE INDEX IF NOT EXISTS idx_company_user_id ON public.company(user_id);

-- 3. Initialiser les préférences existantes
INSERT INTO public.user_company_preferences (user_id, active_company_id)
SELECT user_id, id FROM public.company
ON CONFLICT (user_id) DO NOTHING;
Note importante : Les RLS policies actuelles utilisent user_id = auth.uid(). Pour le multi-sociétés, les données (invoices, clients, etc.) doivent rester isolées par user_id (pas company_id) dans un premier temps. Le tri par société active se fait au niveau du company_id référencé dans chaque entité — mais ce champ n'existe pas encore sur les entités. Un plan de migration progressif est recommandé : d'abord permettre plusieurs sociétés avec sélection, puis dans une V2 ajouter company_id sur les entités.

Task 2 : Hook useCompany.js — adaptation
Modifier fetchCompany() pour retourner TOUTES les sociétés du user, et exposer :


- companies: Company[]          // Toutes les sociétés
- activeCompany: Company         // Société actuellement sélectionnée
- switchCompany(companyId): void // Change la société active
- createCompany(data): Promise   // Crée une nouvelle société
Utiliser user_company_preferences.active_company_id pour déterminer la société active.

Task 3 : Composant CompanySwitcher.jsx

// Dropdown dans la navbar avec :
// - Logo + nom de la société active
// - Liste des autres sociétés avec bouton de switch
// - Bouton "Ajouter une société" (redirige vers la création)
Réutiliser DropdownMenu, Avatar, Badge depuis @/components/ui/.

Task 4 : Intégrer dans le layout
Ajouter <CompanySwitcher /> dans MainLayout.jsx ou la navbar existante, visible seulement si companies.length > 1 ou toujours (pour permettre la création).

Step : Commit


git add supabase/migrations/ src/contexts/CompanyContext.jsx \
        src/components/CompanySwitcher.jsx src/hooks/useCompany.js
git commit -m "feat(multi-company): add company switcher with preferences persistence"
Vérification end-to-end par fonctionnalité
Feature	Test de vérification
Amortissements	Créer une immobilisation de 10 000 € sur 5 ans, vérifier que le tableau d'amortissement génère 60 lignes mensuelles de 166.67 €, cliquer "Comptabiliser" sur la ligne M1 et vérifier qu'une écriture apparaît dans AccountingDashboard avec comptes 6811/2815
Signature devis	Créer un devis, cliquer "Demander signature", entrer un email, vérifier que le status passe à "pending", ouvrir l'URL générée, signer avec la souris, vérifier que status passe à "signed" et que la signature_url est non-null
Paiement Stripe	Créer une facture de test, cliquer "Générer lien de paiement", vérifier qu'une URL Stripe Payment Link est créée, simuler un paiement via stripe trigger payment_intent.succeeded, vérifier que le statut de la facture passe à "paid"
Rentabilité projet	Créer un projet avec budget_hours=40 et hourly_rate=100, créer 3 timesheets (total 20h), créer 1 facture payée de 2000 €, aller sur l'onglet Rentabilité et vérifier : coût=2000 €, CA=2000 €, marge=0 %
Gantt	Ajouter start_date et end_date sur 3 tâches d'un projet, aller sur l'onglet Gantt, vérifier que les barres s'affichent avec les bonnes dates, faire glisser une barre et vérifier que la task est mise à jour en DB
Comptabilité analytique	Créer 2 centres de coût (COMM, TECH), créer des écritures manuelles avec cost_center renseigné, aller sur l'onglet analytique et vérifier que le BarChart affiche les 2 centres
Webhooks étendus	Configurer un endpoint webhook (ex : webhook.site), créer une facture, vérifier que l'event invoice.created est livré avec le bon payload et la signature HMAC
Multi-sociétés	Créer 2 sociétés depuis Settings, vérifier le dropdown CompanySwitcher, switcher entre les 2 et vérifier que les données restent correctement isolées
Ordre d'exécution recommandé
S1-F3 (Lien Stripe) → Quick win, impact immédiat sur les paiements clients
S1-F2 (Signature devis) → Commercial, impact sur conversion
S1-F1 (Amortissements) → Comptabilité, impact sur crédibilité
S2-F4 (Rentabilité projet) → Pas de migration risquée, rapide
S2-F7 (Webhooks étendus) → Juste des ajouts, risque nul
S2-F5 (Gantt) → Migration + UI
S2-F6 (Compta analytique) → Migration + UI
S2-F8 (Multi-sociétés) → En dernier, dans un worktree isolé
Plan rédigé le 3 mars 2026 — Basé sur l'audit fonctionnel (docs/audit-fonctionnel-2026-03-02.md) et l'exploration du code source (commit 2d4ed24).