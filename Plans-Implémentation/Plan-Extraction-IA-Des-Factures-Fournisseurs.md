# Plan : Extraction IA des factures fournisseurs

## Objectif

Permettre aux utilisateurs d'uploader une facture fournisseur (PDF ou photo) et d'en extraire automatiquement les donnees structurees via un LLM, pour pre-remplir le formulaire au lieu de tout saisir manuellement.

---

## 1. Choix du LLM : Google Gemini 2.0 Flash

| Critere | Google Gemini 2.0 Flash | Mistral Pixtral |
|---------|------------------------|-----------------|
| PDF natif | Oui (base64 inline) | Non (conversion image requise) |
| JSON structure | `responseMimeType: "application/json"` | Moins fiable |
| Prix / 1M tokens | $0.10 input / $0.40 output | $2.00 / $6.00 (20x plus cher) |
| Deno compatible | Oui (simple `fetch()`) | Oui |
| Documents scannes | Excellent | Correct |

**Recommandation : Gemini 2.0 Flash** — support PDF natif (pas de conversion), 20x moins cher, JSON structure fiable, simple REST API sans SDK.

---

## 2. Architecture

```
Utilisateur
  1. Selectionne un fichier (PDF/JPG/PNG) dans le modal
  2. Clique "Extraire avec l'IA"
  3. Le fichier est uploade vers Supabase Storage (bucket supplier-invoices)
  |
  v
Client (invoiceExtractionService.js)
  4. Appelle POST ${supabaseUrl}/functions/v1/extract-invoice
     avec { filePath, fileType, userId }
  |
  v
Edge Function (extract-invoice/index.ts)
  5. Verifie les credits utilisateur (service role)
  6. Telecharge le fichier depuis Supabase Storage
  7. Encode en base64
  8. Appelle Gemini API avec le document + prompt d'extraction
  9. Deduit les credits
  10. Retourne le JSON structure
  |
  v
Client (UploadInvoiceModal.jsx)
  11. Pre-remplit le formulaire avec les donnees extraites
  12. L'utilisateur verifie, corrige si besoin, et sauvegarde
```

---

## 3. Fichiers a creer (4 fichiers)

### 3a. `supabase/functions/extract-invoice/index.ts` (NOUVEAU)

Edge function Deno suivant le pattern exact de `supabase/functions/stripe-checkout/index.ts` :

- **CORS** : memes headers que stripe-checkout
- **Auth** : verifie le JWT via header Authorization
- **Credits** : verifie `user_credits` via service role, deduit 3 credits, log dans `credit_transactions`
- **Download** : telecharge le fichier depuis `supabase.storage.from('supplier-invoices').download(filePath)`
- **Gemini** : appel REST direct (pas de SDK) :
  ```
  POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}
  ```
  Body: `inlineData` (base64 + mimeType) + prompt d'extraction + `responseMimeType: "application/json"`
- **Prompt d'extraction** : demande invoice_number, invoice_date, due_date, supplier_name, total_ht, total_tva, total_ttc, tva_rate, currency, line_items[], payment_terms, iban, bic, confidence
- **Erreurs** : 402 (credits insuffisants), 404 (fichier introuvable), 422 (extraction echouee), 502 (Gemini indisponible)
- **Refund** : si Gemini echoue apres deduction, re-credite l'utilisateur

### 3b. `src/services/invoiceExtractionService.js` (NOUVEAU)

Pattern identique a `src/services/stripeService.js` :

```js
import { supabaseUrl, supabaseAnonKey } from '@/lib/customSupabaseClient';

export const extractInvoiceData = async ({ filePath, fileType, userId }) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/extract-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ filePath, fileType, userId }),
  });
  if (!response.ok) { /* gestion erreur */ }
  return response.json();
};
```

### 3c. `src/hooks/useInvoiceExtraction.js` (NOUVEAU)

Hook React avec gestion d'etat :

```js
export const useInvoiceExtraction = () => {
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [extractionError, setExtractionError] = useState(null);

  const extractInvoice = async (filePath, fileType, userId) => { ... };
  const clearExtraction = () => { ... };

  return { extractInvoice, extracting, extractedData, extractionError, clearExtraction };
};
```

### 3d. `migrations/027_ai_invoice_extraction.sql` (NOUVEAU)

**Nouvelles colonnes sur `supplier_invoices`** :

```sql
ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS total_ht DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS total_ttc DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS supplier_name_extracted TEXT,
  ADD COLUMN IF NOT EXISTS supplier_address_extracted TEXT,
  ADD COLUMN IF NOT EXISTS supplier_vat_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS bic TEXT,
  ADD COLUMN IF NOT EXISTS ai_extracted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS ai_raw_response JSONB,
  ADD COLUMN IF NOT EXISTS ai_extracted_at TIMESTAMPTZ;
```

**Nouvelle table `supplier_invoice_line_items`** avec RLS :

```sql
CREATE TABLE supplier_invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit_price DECIMAL(14,2),
  total DECIMAL(14,2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- + RLS policies + index sur invoice_id
```

---

## 4. Fichiers a modifier (8 fichiers)

### 4a. `src/components/UploadInvoiceModal.jsx`

1. Accepter images (PDF/JPG/PNG)
2. Bouton "Extraire avec l'IA" (3 credits)
3. Etat d'extraction (spinner + message)
4. Pre-remplissage du formulaire
5. Indicateur de confiance (badge colore)
6. Champs supplementaires dans Accordion "Details avances"
7. Tableau des lignes extraites
8. Credits guard integration

### 4b. `src/hooks/useInvoiceUpload.js`

Ajouter `image/jpeg` et `image/png` aux types acceptes

### 4c. `src/hooks/useSupplierInvoices.js`

Ajouter les champs AI dans `createInvoice()` + nouvelle methode `createLineItems()`

### 4d. `src/hooks/useCreditsGuard.js`

Ajouter `AI_INVOICE_EXTRACTION: 3` + label i18n + categorie AI_FEATURES

### 4e. `src/components/suppliers/SupplierInvoices.jsx`

Transformer le placeholder en composant complet (liste, upload, badges AI)

### 4f-h. `src/i18n/locales/en.json`, `fr.json`, `nl.json`

Ajouter les cles `invoiceExtraction.*` et `credits.costs.aiInvoiceExtraction`

---

## 5. Variables d'environnement

| Variable | Ou | Comment l'obtenir |
|----------|-----|-------------------|
| `GEMINI_API_KEY` | Supabase Edge Function Secrets | https://aistudio.google.com/apikey |

Commande : `supabase secrets set GEMINI_API_KEY=your_key_here`

---

## 6. Ordre d'implementation

### Phase 1 : Backend
1. Migration SQL 027
2. Edge function extract-invoice

### Phase 2 : Services & Hooks
3. invoiceExtractionService.js
4. useInvoiceExtraction.js
5. useInvoiceUpload.js (images)
6. useSupplierInvoices.js (champs AI)
7. useCreditsGuard.js (cout AI)

### Phase 3 : UI
8. i18n (en/fr/nl)
9. UploadInvoiceModal.jsx
10. SupplierInvoices.jsx

---

## 7. Verification

- Build : `npm run build` sans erreurs
- Lint : `npm run lint` sans nouvelles erreurs
- Test full flow : upload -> extraction -> pre-remplissage -> sauvegarde
- Test image JPG scannee
- Test credits insuffisants (402)
- Test RLS sur line_items
