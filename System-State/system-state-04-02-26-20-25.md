# Etat du systeme CashPilot - 04/02/2026 20:25

## Vue d'ensemble

CashPilot est une plateforme de gestion financiere construite avec React 18 + Vite 5, Tailwind CSS, Supabase (PostgreSQL), i18n (EN/FR/NL). Le projet compte ~50+ composants, 39+ hooks custom, 19 pages.

---

## 1. Systeme de factures fournisseurs

### Hooks

**`src/hooks/useSupplierInvoices.js`** (125 lignes)
- `fetchInvoices()` : requete Supabase `supplier_invoices` filtree par `supplier_id`
- `uploadInvoice(file)` : upload vers bucket `documents`, path `supplier-invoices/{user.id}/{fileName}`
- `createInvoice(invoiceData, file)` : upload + insert dans `supplier_invoices`
- `deleteInvoice(id)` : suppression
- `updateStatus(id, status)` : mise a jour du statut de paiement

**`src/hooks/useInvoiceUpload.js`** (150 lignes)
- `validateFile(file)` : PDF uniquement, max 10MB
- `uploadInvoice(file, invoiceId, supplierId)` : upload vers bucket `supplier-invoices`, path `{user.id}/{supplierId}/{invoiceId}/{fileName}`
- `downloadInvoice(filePath)` : signed URL (60s)
- `getInvoiceFiles(invoiceId)` : liste des fichiers
- `deleteInvoiceFile(fileId, filePath)` : suppression storage + DB

### Composants

**`src/components/UploadInvoiceModal.jsx`** (220 lignes)
- Dialog modal avec formulaire
- Champs : invoice_number, invoice_date, due_date, total_amount, vat_rate, payment_status
- Zone drag & drop pour PDF uniquement
- Progress bar pendant l'upload
- Validation : PDF only, max 10MB

**`src/components/suppliers/SupplierInvoices.jsx`** (12 lignes)
- PLACEHOLDER : affiche uniquement "Invoice history will be displayed here."
- Non fonctionnel

### Schema DB : `supplier_invoices`

Colonnes existantes (depuis seed-test-data.sql) :
- `id` UUID (PK)
- `supplier_id` UUID (FK vers suppliers)
- `invoice_number` TEXT
- `invoice_date` DATE
- `due_date` DATE
- `total_amount` DECIMAL
- `vat_amount` DECIMAL
- `vat_rate` DECIMAL
- `payment_status` TEXT (pending/paid/overdue)
- `file_url` TEXT
- `created_at` TIMESTAMPTZ

Contraintes :
- UNIQUE (supplier_id, invoice_number) -- migration 001
- RLS active : acces via suppliers.user_id = auth.uid()
- Index sur supplier_id et payment_status

### Schema DB : `supplier_invoice_files`

- `id` UUID (PK)
- `invoice_id` UUID (FK vers supplier_invoices)
- `file_url` TEXT (chemin storage)
- `file_name` TEXT
- `file_size` INTEGER

### Storage Buckets

- `supplier-invoices` : bucket prive pour les PDF de factures
- `documents` : bucket prive general (aussi utilise par useSupplierInvoices)

---

## 2. Pattern Edge Functions (Supabase/Deno)

### `supabase/functions/stripe-checkout/index.ts` (88 lignes)

Pattern de reference :
```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const apiKey = Deno.env.get('STRIPE_SECRET_KEY');
  const body = await req.json();
  // ... logique metier ...
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

### `supabase/functions/stripe-webhook/index.ts` (134 lignes)

- Verification de signature webhook
- Utilise Supabase SDK avec service role key
- Insert/update dans les tables via admin client

---

## 3. Pattern Services (cote client)

### `src/services/stripeService.js` (71 lignes)

Pattern de reference :
```javascript
import { supabaseUrl, supabaseAnonKey } from '@/lib/customSupabaseClient';

export const createCheckoutSession = async (params) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) { throw new Error(...); }
  return response.json();
};
```

---

## 4. Systeme de credits

### `src/hooks/useCreditsGuard.js` (174 lignes)

**CREDIT_COSTS** (constantes) :
- GENERATE_BALANCE_SHEET: 5
- PDF_INVOICE: 2
- PDF_REPORT: 3
- EXPORT_HTML: 2
- PDF_RECEIPT: 1
- CLOUD_BACKUP: 1

**CREDIT_COST_LABELS** : cles i18n pour chaque action
**CREDIT_CATEGORIES** : FINANCIAL_STATEMENTS, COMMERCIAL_DOCUMENTS, ANALYTICAL_REPORTS, ADDITIONAL_EXPORTS, OTHER

**useCreditsGuard()** hook :
- `guardedAction(cost, label, action)` : verifie credits, deduit, execute
- `modalProps` : pour afficher le modal d'insuffisance de credits

### `src/hooks/useCredits.js`

- `availableCredits` : solde courant
- `consumeCredits(amount, label)` : deduction
- `fetchCredits()` / `fetchTransactions()` : lecture
- Tables : `user_credits`, `credit_transactions`, `credit_packages`

---

## 5. Client Supabase

### `src/lib/customSupabaseClient.js` (17 lignes)

```javascript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const customSupabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
export default customSupabaseClient;
export { customSupabaseClient, customSupabaseClient as supabase, supabaseUrl, supabaseAnonKey };
```

### `src/lib/supabase.js` (82 lignes)

- Re-exporte le client
- `validateSupabaseConfig()` : verifie la configuration
- `checkSupabaseConnection()` : diagnostic de connectivite

---

## 6. Internationalisation (i18n)

### Fichiers de traduction

- `src/i18n/locales/en.json` : ~160 cles
- `src/i18n/locales/fr.json` : ~160 cles
- `src/i18n/locales/nl.json` : ~160 cles

### Configuration

- `i18next` ^23.7.6 + `react-i18next` ^13.5.0
- Detection automatique de la langue du navigateur
- Fallback : anglais

---

## 7. Dependances cles (package.json)

### Backend/Data
- `@supabase/supabase-js` ^2.30.0
- `zod` ^3.22.4 (installe mais non utilise)

### PDF
- `@react-pdf/renderer` ^3.1.14
- `jspdf` ^2.5.1
- `html2pdf.js` ^0.10.1
- `pdfjs-dist` ^5.4.530
- `html2canvas` ^1.4.1

### UI
- Radix UI (dialog, select, tabs, accordion, dropdown-menu, popover, etc.)
- `tailwindcss` ^3.3.5
- `framer-motion` ^10.16.4
- `lucide-react` ^0.292.0
- `recharts` ^2.10.3

### Scan/Barcode
- `html5-qrcode` ^2.3.8
- `jsbarcode` ^3.11.6

### LLM/IA
- AUCUNE dependance existante

---

## 8. Migrations existantes

```
001_production_ready.sql
002_enrich_suppliers.sql
003_enrich_clients.sql
004_settings_tables.sql
005_enrich_profiles.sql
006_enrich_company.sql
007_fix_notifications.sql
008_accounting_module.sql
009_bank_reconciliation.sql
010_user_products.sql
011_payments_and_discounts.sql
012_invoice_customization.sql
013_stripe_and_credits.sql
014_backup_settings.sql
015_invoice_enhancements.sql
016_monetization_enhancements.sql
017_debt_manager.sql
018_auto_accounting.sql
019_ohada_support.sql
020_fix_account_code_lookup.sql
025_reverse_accounting.sql
026_financial_scenarios.sql
026_financial_scenarios_safe.sql
```

Prochaine migration disponible : **027**

---

## 9. Variables d'environnement actuelles

### Client (.env.local)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY`

### Vercel (production/preview/development)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY`

### Supabase Edge Functions
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL` (auto)
- `SUPABASE_SERVICE_ROLE_KEY` (auto)

---

## 10. Build & Deploy

- **Build** : `vite build` (Vite 5)
- **Output** : `dist/`
- **Deploiement** : Vercel (vercel.json configure)
- **Derniere build** : 0 erreurs, 32.36s (audit du 04/02/2026)
- **Lint** : 0 erreurs, 66 warnings pre-existants
- **Sourcemaps** : desactives en production
- **Code splitting** : vendor, UI, charts, PDF, supabase, xlsx

---

## 11. Etat git

- **Branche** : main
- **Dernier commit** : `47dbba7` (fix: wire up New Project button)
- **Historique recent** :
  - `cfe874d` : audit securite (10 taches)
  - `47dbba7` : wire up New Project button
  - `dbdd9f3` : add all missing i18n translation keys
  - `7d20f06` : feat: CashPilot v1.0.0 - Production ready
