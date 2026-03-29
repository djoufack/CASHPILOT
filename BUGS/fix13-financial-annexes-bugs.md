# fix/13 — FinancialAnnexes ENF-1 Audit

**Branch:** `fix/13-financial-annexes`
**Date:** 2026-03-29
**Status:** CLOSED — Bug A fixed, Bug B documented

---

## Bug A — FinancialAnnexes.jsx hardcoded account class prefixes

### Symptom (ENF-1 violation)

`src/components/accounting/FinancialAnnexes.jsx` contained two hardcoded prefix sets:

```js
// Note 6 (CA) — hardcoded single prefix
const ca = tb.filter(t => t.account_code.startsWith('70') && ...);

// Note 7 (Charges) — hardcoded array
const chargesPrefixes = ['60', '61', '62', '63', '64', '65'];
```

These arrays were FR-PCG-centric. For Belgium (PCMN) and OHADA (SYSCOHADA Révisé)
the revenue and expense class structures differ:

| Plan              | Revenue classes                   | Operating expense classes      |
| ----------------- | --------------------------------- | ------------------------------ |
| PCG (FR)          | 70–75, 76 (fin.), 77 (except.)    | 60–65, 66 (fin.), 67 (except.) |
| PCMN (BE)         | 70–72, 74–75, 76, 77              | 60–65, 66, 67                  |
| SYSCOHADA (OHADA) | 70–75, 77 (fin.), 82/84 (except.) | 60–67, 68–69 (non-cash)        |

Hardcoding `'70'` (single prefix) missed accounts `71–75` for Belgium and OHADA users.
Hardcoding `['60'–'65']` missed `'66'` and `'67'` for OHADA.

### Root Cause

The `accounting_account_taxonomy` reference table (migrated in
`20260308130000_accounting_sql_foundation.sql`) already stores the correct
regional prefix→semantic_role mappings for all three plans. It was never
consumed by the frontend.

### DB Evidence

```sql
SELECT region, code_prefix, semantic_role
FROM accounting_account_taxonomy
WHERE semantic_role IN ('sales_revenue','operating_revenue',
                        'operating_cash_expense','supplier_expense','direct_cost_expense')
ORDER BY region, code_prefix;
-- 116 rows covering france / belgium / ohada
```

### Fix

1. **New hook:** `src/hooks/useAccountingTaxonomy.js`
   - Queries `accounting_account_taxonomy` filtered by `region` (derived from company country)
   - Exposes `caAccountPrefixes` (sales_revenue + operating_revenue) and
     `chargesAccountPrefixes` (operating_cash_expense + supplier_expense + direct_cost_expense)
   - In-memory cache per region to avoid redundant DB round-trips
   - Graceful degradation: if DB is unreachable, returns safe fallback prefixes
     (these are NOT ENF-1 data — they are last-resort defensive code path)

2. **Modified component:** `src/components/accounting/FinancialAnnexes.jsx`
   - Imports and calls `useAccountingTaxonomy(country)`
   - Notes 6 (CA) and 7 (Charges) now use DB-sourced prefixes
   - Added `taxonomyLoading` skeleton state guard
   - `useMemo` dependencies updated to include `caAccountPrefixes, chargesAccountPrefixes`

### Files Changed

```
src/hooks/useAccountingTaxonomy.js          (NEW)
src/components/accounting/FinancialAnnexes.jsx  (MODIFIED)
```

---

## WONTFIX — Balance sheet structural prefixes (classes 2, 3, 4, 5)

### Why these are NOT ENF-1 violations

The following prefixes remain hardcoded in `FinancialAnnexes.jsx`:

```js
groupByClass(cumTB, '2', 'Immobilisations')   // Note 2
groupByClass(cumTB, '3', 'Stocks')             // Note 3
t.account_code.startsWith('4') ...             // Note 4
groupByClass(cumTB, '5', 'Tresorerie')         // Note 5
```

**Justification:**

These are **structural constants of the double-entry bookkeeping chart framework**,
not configurable business data:

| Prefix | Represents         | PCG      | PCMN (BE) | SYSCOHADA |
| ------ | ------------------ | -------- | --------- | --------- |
| `2`    | Immobilisations    | classe 2 | classe 2  | classe 2  |
| `3`    | Stocks             | classe 3 | classe 3  | classe 3  |
| `4`    | Comptes de tiers   | classe 4 | classe 4  | classe 4  |
| `5`    | Comptes financiers | classe 5 | classe 5  | classe 5  |

All three plans (PCG/PCMN/SYSCOHADA) use **identical class numbers** for
balance sheet structure. This is not a coincidence — it reflects the international
accounting convention inherited from the original OCAM plan.

ENF-1 states: "No hardcoded **business data**". These prefixes are not business
data — they are the mathematical structure of the plan comptable itself,
analogous to the debit/credit rule: immutable and not configurable per company.

**Comparison with TVA prefixes (which ARE country-specific):**
The `resolveTvaPrefixes(country)` function already handles true country variation
in class 4 sub-accounts (TVA 4457/4510/4431 etc.) where FR/BE/OHADA genuinely differ.

**Conclusion:** WONTFIX — these 4 prefixes are intentional constants, not ENF-1 violations.

---

## Bug B — accounting_entries 'manual_demo' rows (2343 rows)

### Symptom

The `accounting_entries` table contained 2343 rows with `source_type = 'manual_demo'`.
This raised concerns about:

1. Whether they could corrupt totals (ENF-1: wrong UI data)
2. Whether they are orphaned (ENF-2: company_id integrity)

### Investigation

**Total entries in table:** 10,808

**Full source_type distribution:**
| source_type | count |
|---|---|
| invoice | 1,202 |
| credit_note | 462 |
| expense | 779 |
| depreciation | 330 |
| manual_demo | 2,343 |
| invoice_payment | 72 |
| fixed_asset | 120 |
| invoice_payment_reversal | 12 |
| invoice_reversal | 39 |
| expense_reversal | 6 |
| bank_transaction | 6 |
| bank_transaction_reversal | 6 |

**What are `manual_demo` entries?**

Inspection of sample rows reveals:

- `journal = 'DEMO'`
- `is_auto = false`
- `entry_ref` pattern: `DEP-BE-2026-003-C03` (seeded demo depreciation schedules)
- All have valid `company_id` values (demo portfolio companies)
- Descriptions: "Dotation aux amortissements", depreciation entries for the BE demo portfolio

These are **legitimate demo seed data** inserted by migration
`20260312201000_seed_demo_timesheets_financial_pack.sql` and related seed migrations
for the CashPilot demo account (portfolio of companies for demo/testing purposes).

### VAT calculations: already correctly handled

Migration `20260313173000_exclude_manual_demo_from_vat_summary.sql` explicitly
excludes `manual_demo` entries from `f_vat_summary()` and `f_vat_breakdown()`:

```sql
AND COALESCE(ae.source_type, '') <> 'manual_demo'
```

This is correct behavior: demo entries should not contaminate VAT declarations.

### Trial balance: included (intentional)

The `f_trial_balance()` function (defined in `20260308130000_accounting_sql_foundation.sql`)
does **NOT** filter out `manual_demo` entries. This is **intentional**:
demo entries represent real accounting operations (depreciation, invoices, etc.)
for the demo companies. They must appear in the balance sheet and P&L of those
demo companies. Filtering them would produce incorrect financial statements for
demo accounts.

### Orphaned entries: handled by migration

Migration `20260329035001_cleanup_orphan_manual_demo_entries.sql` (already applied)
deletes `manual_demo` entries whose `company_id` no longer exists in `company`:

```sql
DELETE FROM public.accounting_entries
WHERE source_type = 'manual_demo'
  AND company_id NOT IN (SELECT id FROM public.company);
```

The remaining 2,343 entries all have valid `company_id` references → ENF-2 satisfied.

### Conclusion: NO BUG — legitimate seed data, correctly handled

| Concern                               | Status                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| ENF-1: Do they show wrong data in UI? | No — f_trial_balance includes them correctly for demo companies                |
| ENF-2: Are they orphaned?             | No — migration 20260329035001 cleaned orphans; remaining have valid company_id |
| ENF-3: Do they affect journalization? | No — they ARE journalization entries (correctly structured debit/credit)       |
| VAT contamination?                    | No — excluded from f_vat_summary / f_vat_breakdown                             |

**Verdict: WONTFIX / NO ACTION REQUIRED**
The 2,343 `manual_demo` rows are valid demo seed data for the CashPilot demo portfolio.
They are correctly scoped by `company_id`, correctly excluded from VAT calculations,
and correctly included in balance sheet / P&L for their respective demo companies.

---

## Summary

| Item                                    | Classification | Action                                                   |
| --------------------------------------- | -------------- | -------------------------------------------------------- |
| Bug A — hardcoded CA prefix `'70'`      | **ENF-1 BUG**  | **FIXED** — DB-driven via `useAccountingTaxonomy`        |
| Bug A — hardcoded charges `['60'-'65']` | **ENF-1 BUG**  | **FIXED** — DB-driven via `useAccountingTaxonomy`        |
| WONTFIX — structural prefixes 2,3,4,5   | **Not ENF-1**  | **WONTFIX** — universal plan comptable constants         |
| Bug B — 2343 `manual_demo` rows         | **Not a bug**  | **DOCUMENTED** — legitimate seed data, correctly handled |
