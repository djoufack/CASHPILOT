# Enseignements des tests de seeding comptable - 10/02/2026

## 1. Bugs corrigés durant la session

| Bug | Gravité | Statut |
|-----|---------|--------|
| `auto_journal_expense()` référence `NEW.date` - colonne inexistante | **Critique** - bloque toute création de dépense quand auto_journal est activé | Corrigé |
| ClientManager/ClientProfile en camelCase vs DB snake_case | **Critique** - impossible de créer/afficher un client | Corrigé (session précédente) |
| InvoiceGenerator fallback order | Mineur | Corrigé (session précédente) |

---

## 2. Incohérences de design à corriger

### A. Format `tax_rate` incohérent entre tables

```
invoices.tax_rate    = 21.00   (pourcentage)
expenses.tax_rate    = 0.21    (décimal, precision 5 scale 4 → max 9.9999)
accounting_tax_rates = 0.2100  (décimal)
```

**Recommandation** : Normaliser sur un format unique. Le décimal (0.21) est plus logique pour les calculs, mais `invoices` utilise le pourcentage (21.00). Il faut choisir et migrer.

### B. Pas de colonne `date` sur `expenses`

- `invoices` → `date` (date)
- `payments` → `payment_date` (date)
- `expenses` → **seulement `created_at`** (timestamptz)

**Recommandation** : Ajouter une colonne `expense_date` (date) à `expenses`. La date d'une dépense n'est pas forcément sa date de création en DB.

### C. Nommage incohérent entre tables similaires

| Concept | `clients` | `suppliers` |
|---------|-----------|-------------|
| Nom | `company_name` | `company_name` |
| Contact | `contact_name` | `contact_person` |
| TVA | `vat_number` | `tax_id` |
| Devise | `preferred_currency` | `currency` |

**Recommandation** : Harmoniser les noms de colonnes entre `clients` et `suppliers`.

### D. Contrainte `profiles_role_check` trop restrictive

Seuls `'admin'` et `'user'` sont autorisés. Un utilisateur "freelance" doit être stocké comme `'user'`, ce qui empêche toute logique métier basée sur le rôle freelance.

**Recommandation** : Étendre la contrainte avec `ALTER TABLE profiles DROP CONSTRAINT profiles_role_check; ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user', 'freelance', 'accountant'));`

---

## 3. Ce qui doit être automatisé

### A. Script de seeding de test

Le processus de seeding a nécessité ~15 requêtes manuelles avec des corrections en cours de route. Il faudrait :

- **Une Edge Function `seed-test-data`** ou un script SQL idempotent qui :
  - Crée les comptes de test
  - Initialise la comptabilité (BE/FR)
  - Génère clients, fournisseurs, factures, paiements, dépenses
  - Désactive/réactive RLS automatiquement
  - Peut être exécuté en un seul appel

### B. Validation des triggers avant déploiement

Le bug `NEW.date` dans le trigger aurait été détecté par un test. Il faudrait :

- **Des tests Vitest** pour chaque trigger auto-journal (insert une ligne → vérifier que les écritures comptables sont créées)
- Un script de validation qui compare les colonnes référencées dans les triggers avec les colonnes réelles des tables

### C. Initialisation comptable côté backend

Le service `accountingInitService.js` gère l'init côté frontend. Mais idéalement, l'initialisation du plan comptable devrait être une **Edge Function** pour :
- Garantir l'atomicité (tout ou rien)
- Éviter les problèmes RLS
- Pouvoir être appelée aussi depuis un script admin

---

## 4. Ce qui doit être amélioré

### A. Politique RLS pour les opérations admin

Les policies `WITH CHECK (auth.uid() = user_id)` empêchent toute insertion via le service role ou un admin. Il faudrait ajouter une policy admin :

```sql
CREATE POLICY "admin_full_access" ON <table>
  FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

### B. Cohérence schema.sql ↔ migrations

Le `schema.sql` avait toutes les FK mais les migrations ne les répliquaient pas. Il faudrait :
- Un **script de drift detection** qui compare le schema attendu (schema.sql) avec le schema réel en production
- Ou abandonner schema.sql et tout piloter par les migrations

### C. Les 3 autres triggers auto-journal à auditer

On a corrigé `auto_journal_expense`. Il faut vérifier :
- `auto_journal_invoice` → utilise `NEW.date` (OK, la colonne existe)
- `auto_journal_payment` → utilise `NEW.payment_date` (OK)
- `auto_journal_credit_note` → **à vérifier** (même risque de bug)

---

## 5. Ce qui devrait être supprimé / nettoyé

| Élément | Raison |
|---------|--------|
| Fichiers de test orphelins dans `mcp-server/` (`fix.cjs`, `hello.cjs`, `gen.js`, etc.) | Fichiers de debug non committés, polluent le repo |
| Références camelCase résiduelles dans le frontend | Chercher `companyName`, `contactName`, `vatNumber` dans tout le codebase |
| Tables isolées détectées lors de l'audit | 3 tables sans FK ni données utiles (à vérifier) |

---

## 6. Résumé priorisé

| Priorité | Action | Effort |
|----------|--------|--------|
| **P0** | Auditer `auto_journal_credit_note` (même bug potentiel) | 10 min |
| **P0** | Ajouter `expense_date` à expenses | 30 min |
| **P1** | Normaliser le format `tax_rate` (décimal partout) | 2h |
| **P1** | Harmoniser nommage `clients` ↔ `suppliers` | 1h |
| **P1** | Étendre `profiles_role_check` (freelance, accountant) | 15 min |
| **P2** | Créer un script de seeding idempotent | 3h |
| **P2** | Ajouter policy RLS admin | 1h |
| **P2** | Tests des triggers auto-journal | 2h |
| **P3** | Drift detection schema.sql vs production | 2h |
| **P3** | Nettoyage fichiers orphelins mcp-server/ | 15 min |

---

## Annexe : Données générées

### SCTE (Comptabilité Belge - PCMN)

| Table | Lignes |
|-------|--------|
| Settings comptables | 1 |
| Plan comptable (PCMN) | 146 comptes |
| Mappings comptables | 23 |
| Taux TVA belges | 7 (21%, 12%, 6%, 0% + déductibles) |
| Clients | 4 |
| Fournisseurs | 2 |
| Factures | 8 (3 payées, 1 partielle, 2 envoyées, 2 brouillons) |
| Lignes de factures | 23 |
| Paiements | 4 |
| Dépenses | 11 |
| **Écritures comptables** | **59** (auto-générées par triggers) |

### Freelance (Comptabilité Française - PCG)

| Table | Lignes |
|-------|--------|
| Settings comptables | 1 |
| Plan comptable (PCG) | 107 comptes |
| Mappings comptables | 23 |
| Taux TVA français | 7 (20%, 10%, 5.5%, 2.1% + déductibles) |
| Clients | 3 |
| Fournisseurs | 2 |
| Factures | 6 (2 payées, 1 partielle, 2 envoyées, 1 brouillon) |
| Lignes de factures | 19 |
| Paiements | 3 |
| Dépenses | 11 |
| **Écritures comptables** | **54** (auto-générées par triggers) |

### Corrections appliquées durant le seeding

- Trigger `auto_journal_expense()` : `NEW.date` → `NEW.created_at::date`
- `expenses.tax_rate` : format décimal (0.21) et non pourcentage (21.00) - overflow numeric(5,4)
- `suppliers.vat_number` n'existe pas → colonne réelle : `tax_id`
- `suppliers.supplier_type` : valeurs autorisées `'service'`/`'product'`/`'both'` (pas `'goods'`/`'services'`)
- RLS désactivé temporairement sur 8 tables pour le seeding, puis réactivé

---

## 7. Questions stratégiques et décisions prises

### Q1 : L'onboarding comptable doit-il être obligatoire ?
**Réponse : Optionnel avec rappel**
L'utilisateur peut sauter et aller au Dashboard, mais un bandeau persistant l'invite à compléter le setup.

### Q2 : Quand un utilisateur uploade son plan comptable Excel, que se passe-t-il ?
**Réponse : Privé uniquement**
Le plan reste privé à l'utilisateur. Seul un admin peut promouvoir un plan en "global".

### Q3 : Comment recueillir les soldes d'ouverture chez des non-comptables ?
**Réponse : Les deux options**
Questions simples par défaut (solde bancaire, factures impayées, capital) + option avancée d'upload pour ceux qui ont un document comptable (PDF/Excel).

### Q4 : Faut-il auto-détecter le plan comptable selon le pays ?
**Réponse : Choix libre toujours**
Montrer tous les plans disponibles sans pré-sélection, l'utilisateur choisit librement.
