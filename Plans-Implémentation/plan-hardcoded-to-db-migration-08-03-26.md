# Migration Valeurs Hardcodées → Database — Plan d'Implémentation

**Date** : 2026-03-08
**Statut** : EN COURS
**Contrainte absolue** : Rien de hardcodé dans le frontend/backend. Tout en DB.

---

## DIRECTIVE AGENTS

> **RÈGLE OBLIGATOIRE** : Tout agent travaillant sur ce chantier DOIT lire ce fichier
> en premier, avant toute action. En cas de compaction, perte de contexte, ou
> changement de session, revenir à ce fichier comme source de vérité.
>
> Chemin : `Plans-Implémentation/plan-hardcoded-to-db-migration-08-03-26.md`
>
> Supabase project_id : `rfzvrezrcigzmldgvntz`
> Stack : React 18 + Vite + Supabase + Tailwind
> MCP Server : `mcp-server/` (169 outils)

---

## ARCHITECTURE NON-NÉGOCIABLE

1. **PK-FK d'abord** — Toujours FK avec ON DELETE/UPDATE CASCADE
2. **Triggers** — Uniquement pour logique métier complexe (journaux comptables, mouvements stock)
3. **Règles métier en DB** — CHECK constraints, FK, GENERATED columns, fonctions SQL — PAS dans le frontend
4. **Frontend = affichage seul** — Ne calcule rien, ne valide rien
5. **Zéro valeurs hardcodées** — Tout dans tables config, fonctions SQL, ou edge functions
6. **Données invalides remplacées** par des valeurs valides

---

## P0 — TABLES EXISTANTES, FRONTEND DOIT LIRE (pas de migration SQL)

### P0.1 : Taux de TVA → `accounting_tax_rates`
**Table existe déjà** avec colonnes : id, user_id, account_code, name, rate, tax_type, is_active, is_default, effective_date
**MCP tools** : create/update/delete/get/list_accounting_tax_rates

**Fichiers frontend à modifier :**
| Fichier | Ligne | Valeur hardcodée | Action |
|---------|-------|------------------|--------|
| `src/components/InvoiceGenerator.jsx` | 44 | `useState(20)` | Fetch default tax rate from DB |
| `src/components/QuickInvoice.jsx` | 34 | `useState(21)` | Fetch default tax rate from DB |
| `src/pages/QuotesPage.jsx` | 43 | `tax_rate: 21` | Fetch default tax rate from DB |
| `src/pages/PurchaseOrdersPage.jsx` | 41 | `tax_rate: 21` | Fetch default tax rate from DB |
| `src/pages/CreditNotesPage.jsx` | 48, 87 | `tax_rate: 20` | Fetch default tax rate from DB |
| `src/components/settings/InvoiceCustomization.jsx` | 74 | `tax_rate: 21` | Fetch default tax rate from DB |
| `src/components/ProjectBillingDialog.jsx` | 129 | `tax_rate: 20` | Fetch default tax rate from DB |
| `src/components/accounting/VATDeclaration.jsx` | 16-17 | `0.1925` | Fetch from accounting_tax_rates |

**Pattern d'implémentation :**
```jsx
// Hook réutilisable : src/hooks/useDefaultTaxRate.js
import { useCompany } from '../context/CompanyContext';
import { supabase } from '../lib/supabaseClient';

export function useDefaultTaxRate() {
  const { activeCompany } = useCompany();
  const [defaultRate, setDefaultRate] = useState(0);

  useEffect(() => {
    supabase.from('accounting_tax_rates')
      .select('rate')
      .eq('is_default', true)
      .eq('is_active', true)
      .single()
      .then(({ data }) => { if (data) setDefaultRate(data.rate); });
  }, [activeCompany]);

  return defaultRate;
}
```

### P0.2 : Conditions de paiement → `payment_terms`
**Table existe déjà** avec colonnes : id, user_id, name, days, description

**Fichiers frontend à modifier :**
| Fichier | Ligne | Valeur hardcodée | Action |
|---------|-------|------------------|--------|
| `src/components/InvoiceGenerator.jsx` | 47, 67 | `30` jours | Fetch default payment_terms.days |
| `src/components/QuickInvoice.jsx` | 33, 58 | `30` jours | Fetch default payment_terms.days |
| `src/components/ProjectBillingDialog.jsx` | 127 | `30` jours | Fetch default payment_terms.days |

**Pattern d'implémentation :**
```jsx
// Hook : src/hooks/useDefaultPaymentDays.js
export function useDefaultPaymentDays() {
  const [days, setDays] = useState(30); // fallback
  useEffect(() => {
    supabase.from('payment_terms')
      .select('days')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setDays(data.days); });
  }, []);
  return days;
}
```

---

## P1 — CRÉER TABLES CONFIG MANQUANTES (migration SQL)

### P1.1 : Table `payment_methods`
```sql
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES company(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, code)
);
```
**Seed** : bank_transfer, cash, card, check, paypal, other
**Frontend** : `src/components/PaymentRecorder.jsx` lignes 30-37

### P1.2 : Table `credit_costs`
```sql
CREATE TABLE IF NOT EXISTS credit_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_code TEXT NOT NULL UNIQUE,
  operation_name TEXT NOT NULL,
  cost INTEGER NOT NULL DEFAULT 1 CHECK (cost > 0),
  category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
**Seed** : Tous les coûts de `src/hooks/useCreditsGuard.js` lignes 10-52
**Frontend** : `src/hooks/useCreditsGuard.js`

### P1.3 : Table `accounting_journals`
```sql
CREATE TABLE IF NOT EXISTS accounting_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES company(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  journal_type TEXT NOT NULL CHECK (journal_type IN ('sales','purchases','bank','cash','misc','payroll')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, code)
);
```
**Seed** : VE/Ventes, AC/Achats, BQ/Banque, CA/Caisse, OD/Opérations Diverses, PA/Paie
**Frontend** : `src/services/exportFEC.js` lignes 28-35

---

## P2 — MIGRER VALEURS HARDCODÉES RESTANTES

### P2.1 : Statuts de documents → CHECK constraints (DÉJÀ FAIT)
Les statuts sont maintenant dans des CHECK constraints en DB (migration 20260308250000).
**Frontend** : Lire les statuts depuis les CHECK constraints ou une table `document_statuses`.

### P2.2 : Thèmes de facture → `invoice_themes` table ou `invoice_settings.themes` JSONB
**Fichier** : `src/config/invoiceThemes.js` (20 thèmes, 208 lignes)
**Action** : Stocker dans `invoice_settings` ou nouvelle table

### P2.3 : Couleurs graphiques
**Fichier** : `src/components/accounting/VATDeclaration.jsx` ligne 10
**Action** : Stocker dans company settings ou laisser en CSS (non-critique)

### P2.4 : Liste des pays
**Fichier** : `src/constants/countries.js` (163 lignes)
**Action** : Table `countries` ou edge function (données stables, acceptable en constante)

---

## P3 — INTÉGRITÉ RÉFÉRENTIELLE USER→COMPANY→DATA

### P3.1 : FK company.user_id → auth.users(id) ON DELETE CASCADE
**CRITIQUE** : La table company n'a PAS de FK vers auth.users. Un user supprimé laisse des companies orphelines.

### P3.2 : FK supplier_invoices.user_id → ON DELETE CASCADE
Existe mais sans clause ON DELETE.

### P3.3 : Vérifier toutes les tables avec user_id ont FK vers auth.users

**Migration SQL :**
```sql
-- P3.1 : company.user_id FK
ALTER TABLE company
  ADD CONSTRAINT fk_company_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- P3.2 : supplier_invoices.user_id FK fix
ALTER TABLE supplier_invoices
  DROP CONSTRAINT IF EXISTS supplier_invoices_user_id_fkey;
ALTER TABLE supplier_invoices
  ADD CONSTRAINT fk_supplier_invoices_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

---

## TESTS DE VALIDATION

1. **Vérifier que le frontend charge les taux depuis la DB** (pas de valeurs hardcodées)
2. **Vérifier les nouvelles tables** ont des données seed
3. **Vérifier FK cascade** : supprimer un user → toutes ses données disparaissent
4. **Vérifier CHECK constraints** bloquent les données invalides
5. **Run vitest** : 100% des tests passent

---

## CREDENTIALS DEMO

- FR: pilotage.fr.demo@cashpilot.cloud / PilotageFR#2026!
- BE: pilotage.be.demo@cashpilot.cloud / PilotageBE#2026!
- OHADA: pilotage.ohada.demo@cashpilot.cloud / PilotageOHADA#2026!
