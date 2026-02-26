# Design : Corrections du systeme comptable automatique

**Date :** 2026-02-26
**Statut :** Approuve
**Approche :** Migration incrementale (Approche A)

## Contexte

Le systeme comptable automatique de CashPilot possede 4 triggers (invoices, payments, expenses, credit_notes) avec des fonctions de reversal et un helper `get_user_account_code()`. Six lacunes ont ete identifiees.

## Problemes identifies

1. **Pas de trigger pour `supplier_invoices`** - Les factures fournisseurs ne generent aucune ecriture comptable
2. **Pas de categorie "salary"** dans les mappings comptables
3. **Le trigger payment ne differencie pas cash/cheque/virement** - Ecrit toujours Bank DR
4. **Pas de journalisation retroactive** des anciennes donnees
5. **Pas de table d'audit comptable** pour verifier l'equilibre
6. **Pas de verification d'equilibre automatique** apres insertion

## Architecture : 6 migrations + 1 outil MCP

| Migration | Contenu | Dependances |
|-----------|---------|-------------|
| `040_supplier_invoice_trigger.sql` | Trigger `auto_journal_supplier_invoice()` | Aucune |
| `041_salary_category.sql` | Ajout salary.brut/charges_sociales/net dans `get_user_account_code()` | Aucune |
| `042_payment_method_split.sql` | Routage cash/cheque/bank dans `auto_journal_payment()` | Aucune |
| `043_accounting_audit_table.sql` | Table `accounting_balance_checks` | Aucune |
| `044_auto_balance_check.sql` | Trigger verification equilibre | Depend de 043 |
| `045_backfill_entries.sql` | Fonction backfill + outil MCP | Depend de 040, 041, 042 |

## Design detaille

### 1. Trigger supplier_invoices (040)

Fonction `auto_journal_supplier_invoice()` declenchee AFTER INSERT OR UPDATE sur `supplier_invoices`.

**Quand status passe a 'received' ou 'processed' (Journal AC - Achats) :**
- Debit : Compte charge fournisseur (HT) via `get_user_account_code(user_id, 'expense.general')`
- Debit : TVA deductible (`vat_input`) si `tax_amount > 0`
- Credit : Compte fournisseur (440 BE / 401 FR / 401 OHADA)
- Ref : `SINV-{invoice_number}`

**Quand payment_status passe a 'paid' (Journal BQ - Banque) :**
- Debit : Compte fournisseur (440/401)
- Credit : Banque (550/512/521)
- Ref : `SINV-PAY-{invoice_number}`

**Idempotence :** Verifie existence via source_type='supplier_invoice' + source_id avant insertion.

**Trigger reversal :** Ajouter `reverse_journal_supplier_invoice()` BEFORE DELETE + BEFORE UPDATE quand status revient a 'draft'/'rejected'.

### 2. Categorie salary (041)

Ajout dans `get_user_account_code()` des mappings suivants :

| Mapping key | BE (PCMN) | FR (PCG) | OHADA (SYSCOHADA) | Description |
|-------------|-----------|----------|--------------------|-------------|
| `salary.brut` | 6210 | 6411 | 661 | Remunerations brutes |
| `salary.charges_sociales` | 6211 | 6451 | 664 | Charges sociales patronales |
| `salary.net` | 4530 | 421 | 422 | Remunerations dues (passif) |

Ajout de 'salary' comme categorie valide dans les expenses (pas de CHECK constraint a modifier cote DB car category est TEXT libre).

### 3. Payment method split (042)

Modification de `auto_journal_payment()` pour router le compte de debit selon `payment_method` :

| payment_method | Mapping key | BE | FR | OHADA |
|----------------|-------------|----|----|-------|
| `cash` | `cash` | 570 | 530 | 571 |
| `check` | `check` | 511 | 5112 | 513 |
| `bank_transfer` | `bank` | 550 | 512 | 521 |
| `card` | `bank` | 550 | 512 | 521 |
| `paypal` | `bank` | 550 | 512 | 521 |
| `other` | `bank` | 550 | 512 | 521 |

Ajout du mapping key `check` dans `get_user_account_code()`.

Mise a jour identique dans `auto_journal_invoice()` pour la partie paiement (quand payment_status passe a 'paid').

### 4. Table d'audit comptable (043)

```sql
CREATE TABLE accounting_balance_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    source_type TEXT NOT NULL,
    source_id UUID NOT NULL,
    total_debit NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_credit NUMERIC(15,2) NOT NULL DEFAULT 0,
    is_balanced BOOLEAN NOT NULL DEFAULT false,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

Index sur (user_id), (source_id), (is_balanced) pour requetes de verification rapides.
RLS active : users voient uniquement leurs propres verifications.

### 5. Trigger verification equilibre (044)

Fonction `check_accounting_balance()` declenchee AFTER INSERT sur `accounting_entries`.

Pour chaque nouveau `source_id` insere :
1. Calcule `SUM(debit)` et `SUM(credit)` pour ce source_id
2. Upsert dans `accounting_balance_checks`
3. Si desequilibre : `RAISE WARNING 'Desequilibre comptable: source_id=%, debit=%, credit=%'`

Ne bloque pas l'insertion (WARNING, pas EXCEPTION) pour ne pas casser les triggers existants.

### 6. Backfill + outil MCP (045)

**Fonction SQL :**
```
backfill_accounting_entries(
    p_user_id UUID,
    p_dry_run BOOLEAN DEFAULT true
) RETURNS JSONB
```

Logique :
1. Identifie tous les documents (invoices, expenses, payments, credit_notes, supplier_invoices) qui n'ont pas d'entrees dans `accounting_entries` (LEFT JOIN sur source_type + source_id)
2. En mode dry_run : retourne un JSON avec le decompte par type
3. En mode execution : appelle directement les fonctions trigger pour chaque document manquant (INSERT simulation)

**Outil MCP :** `backfill_journal_entries`
- Parametres : `user_id` (optionnel, defaut = user connecte), `dry_run` (defaut = true)
- Etape 1 : Execute en dry_run, affiche le preview
- Etape 2 : Si confirme, execute en mode reel
- Retourne le nombre d'ecritures creees par type

## Decisions techniques

- **Pas de modification des tables existantes** (sauf ajout de CASE dans les fonctions trigger)
- **Idempotence partout** : chaque trigger verifie l'existence avant insertion
- **WARNING plutot qu'EXCEPTION** pour la balance check (ne pas bloquer)
- **Backfill reutilise la logique des triggers** plutot que de la dupliquer
- **RLS sur toutes les nouvelles tables**
