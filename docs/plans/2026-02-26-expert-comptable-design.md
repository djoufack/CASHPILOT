# Design : Expert Comptable - Audit & Validation Comptable

**Date :** 2026-02-26
**Statut :** Approuve
**Approche :** C - Edge Function comme source unique de verite

## Contexte

CashPilot dispose d'un ecosysteme comptable complet (PCG France/Belgique/OHADA, ecritures, balance, TVA, FEC, SAF-T, rapprochement bancaire). Il manque un systeme d'audit automatise permettant de verifier et valider la comptabilite.

## Objectif

Creer un systeme d'audit comptable complet accessible :
1. Depuis l'interface CashPilot (widget Dashboard + page dediee)
2. Via Claude Code (skill expert-comptable)
3. Via le MCP Server (outil run_accounting_audit)

## Architecture

```
                     Edge Function
                  audit-comptable (source unique)
                  /        |        \
                 /         |         \
   Widget Dashboard   Page /audit   MCP Tool
   (score compact)    (audit full)  run_accounting_audit
                                         |
                                    Skill Claude Code
                                    expert-comptable
```

## Livrable 1 : Edge Function `audit-comptable`

**Emplacement :** `supabase/functions/audit-comptable/index.ts`

### Parametres d'entree

```typescript
{
  period_start: string;   // YYYY-MM-DD
  period_end: string;     // YYYY-MM-DD
  categories?: string[];  // ['balance', 'fiscal', 'anomalies'] - defaut: toutes
  country?: string;       // 'FR' | 'BE' | 'OHADA' - auto-detect si absent
}
```

### Controles implementes (17)

#### Categorie 1 : Equilibre & Coherence (7 controles)

| # | Controle | Description | Severite |
|---|----------|-------------|----------|
| 1 | Balance debit/credit | Total debits = Total credits | error |
| 2 | Equilibre bilan | Actif = Passif + Capitaux propres | error |
| 3 | Coherence plan comptable | Chaque ecriture reference un compte existant | error |
| 4 | Sequence ecritures | Pas de trou dans la numerotation | warning |
| 5 | Ecritures a zero | Ecritures avec debit ET credit a 0 | warning |
| 6 | Comptes attente non soldes | Comptes 47x avec solde residuel | warning |
| 7 | Coherence dates | Pas d'ecritures hors exercice | error |

#### Categorie 2 : Conformite Fiscale (5 controles)

| # | Controle | Description | Severite |
|---|----------|-------------|----------|
| 8 | Taux TVA valides | FR: 20/10/5.5/2.1, BE: 21/12/6, OHADA: variable | error |
| 9 | Validation CA3/Intervat | TVA collectee vs deductible | warning |
| 10 | Conformite FEC | 18 colonnes obligatoires renseignees | error |
| 11 | Rapprochement TVA | TVA declaree vs comptabilisee | warning |
| 12 | Factures sans TVA | Factures > seuil sans TVA | warning |

#### Categorie 3 : Detection d'Anomalies (5 controles)

| # | Controle | Description | Severite |
|---|----------|-------------|----------|
| 13 | Doublons | Ecritures identiques (montant, date, compte) | warning |
| 14 | Montants aberrants | > 3 ecarts-types de la moyenne du compte | warning |
| 15 | Chiffres ronds suspects | Montants ronds inhabituels | info |
| 16 | Comptes rarement utilises | 1 seule ecriture sur un compte | info |
| 17 | Rapprochement bancaire incomplet | Transactions non rapprochees | warning |

### Format de sortie

```json
{
  "score": 85,
  "grade": "B+",
  "period": { "start": "2025-01-01", "end": "2025-12-31" },
  "country": "FR",
  "generated_at": "2026-02-26T14:30:00Z",
  "summary": {
    "total_checks": 17,
    "passed": 14,
    "warnings": 2,
    "errors": 1
  },
  "categories": {
    "balance": {
      "score": 100,
      "label": "Equilibre & Coherence",
      "checks": [
        {
          "id": "balance_debit_credit",
          "name": "Balance debit/credit",
          "status": "pass",
          "severity": "error",
          "details": "Total debits: 150,000.00 = Total credits: 150,000.00",
          "recommendation": null
        }
      ]
    },
    "fiscal": { "score": 75, "checks": [...] },
    "anomalies": { "score": 80, "checks": [...] }
  },
  "recommendations": [
    {
      "priority": "high",
      "category": "fiscal",
      "check_id": "vat_rates_valid",
      "message": "2 ecritures utilisent un taux de TVA non standard (18%). Verifier si c'est intentionnel.",
      "action": "Ouvrir les ecritures #1234 et #1235 pour corriger le taux de TVA."
    }
  ]
}
```

### Calcul du score

- Chaque controle a un poids selon sa severite : error=10, warning=5, info=2
- Score = (total_poids - poids_echecs) / total_poids * 100
- Grade : A+ (95-100), A (90-94), B+ (85-89), B (80-84), C (70-79), D (60-69), F (<60)

## Livrable 2 : Frontend

### 2a. Widget Dashboard "Sante Comptable"

**Emplacement :** Composant dans le Dashboard existant

- Jauge circulaire avec score (0-100) et grade
- 3 mini-indicateurs : Equilibre | Fiscal | Anomalies (vert/orange/rouge)
- Bouton "Audit complet" → `/audit-comptable`
- Cache 24h, refresh automatique a chaque visite
- Design : Glassmorphism dark (#0a0e1a, #141c33)

### 2b. Page `/audit-comptable`

**Emplacement :** `src/pages/AuditComptable.jsx`

**En-tete :**
- Selecteur de periode (mois, trimestre, annee, personnalise)
- Bouton "Lancer l'audit" avec animation de progression
- Dernier audit : date + score

**Corps - 3 onglets :**
- Equilibre & Coherence
- Conformite Fiscale
- Detection d'Anomalies

Chaque onglet : score categorie + liste des controles (pass/warn/fail) + details + recommandations

**Pied :**
- Telecharger rapport (PDF/Markdown)
- Historique audits (graphique evolution du score)

## Livrable 3 : Skill Claude Code

**Emplacement :** `~/.claude/skills/expert-comptable/SKILL.md`

### Declenchement

"Use when user asks to verify, audit, validate, or review accounting data, financial statements, or tax compliance in CashPilot"

### Deux modes

1. **Mode rapide** - Appelle l'Edge Function, resume conversationnel + recommandations prioritaires
2. **Mode expert** - Audit complet + analyse approfondie avec vocabulaire expert-comptable + investigations MCP complementaires

### Outils MCP utilises

- `run_accounting_audit` (nouveau) - audit principal
- `get_trial_balance` - investigation balance
- `get_accounting_entries` - detail ecritures
- `get_profit_and_loss` - compte de resultat
- `get_balance_sheet` - bilan
- `get_tax_summary` - resume TVA
- `get_aging_report` - balance agee

## Livrable 4 : Outil MCP `run_accounting_audit`

**Emplacement :** `mcp-server/src/tools/accounting.ts`

Proxy vers l'Edge Function. Parametres : `period_start`, `period_end`, `categories?`.

## Referentiels supportes

| Pays | Plan comptable | TVA | Export fiscal |
|------|---------------|-----|---------------|
| France | PCG (classes 1-7) | 20/10/5.5/2.1% | FEC |
| Belgique | PCMN | 21/12/6% | SAF-T |
| OHADA | SYSCOHADA | Variable | - |

## Stack technique

- Edge Function : Deno/TypeScript (Supabase)
- Frontend : React 18 + Tailwind + Radix/Shadcn
- MCP : TypeScript (existant)
- Skill : Markdown
- Tests : Vitest
