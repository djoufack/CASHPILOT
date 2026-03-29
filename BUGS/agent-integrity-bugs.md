# CashPilot — Agent INTEGRITY Bug Report

**Date:** 2026-03-29 | **Branch:** audit/integrity | **Agent:** INTEGRITY

---

## BUG-I001 | src/components/UploadInvoiceModal.jsx | HIGH | FIXED

**ENF-1 — Hardcoded TVA rate 20%**

Three occurrences of hardcoded `vat_rate: '20'` in the upload modal form initial state, AI extraction fallback, and close-reset handler. Violated ENF-1: all rates must come from DB.

**Fix:** Added `useDefaultTaxRate` hook import and replaced all `'20'` with `String(defaultRate || 0)`.

---

## BUG-I002 | src/pages/QuotesPage.jsx | MEDIUM | FIXED

**ENF-1 — Hardcoded DEFAULT_TAX_RATE_FALLBACK = 20**

`QuotesPage` used `const DEFAULT_TAX_RATE_FALLBACK = 20` as a fallback while `useDefaultTaxRate()` loads. The fallback propagated into newly created quote items before the DB rate was fetched.

**Fix:** Changed to `const DEFAULT_TAX_RATE_FALLBACK = 0` with a comment. The real rate is always overwritten by `useDefaultTaxRate()` once loaded.

---

## BUG-I003 | src/components/accounting/FixedAssets.jsx | MEDIUM | FIXED

**ENF-1 — Hardcoded account codes 2154/2815/6811 (PCG France only)**

`EMPTY_FORM` had hardcoded French PCG account codes as defaults for the new fixed asset form. These codes are wrong for PCMN (Belgium) and SYSCOHADA (Africa) companies.

**Fix:**

- Added `useAccounting` import to load `accounting_mappings` from DB.
- Changed `EMPTY_FORM` to use empty strings for account codes.
- In `FixedAssets` (main component), computed `defaultEmptyForm` by looking up the `fixed_asset` mapping in `accounting_mappings` and extracting `debit_account`, `credit_account`, `expense_account`.
- Passed `defaultEmptyForm` as `initialForm` prop to `NewAssetDialog`.
- Fixed post-submit reset to use `initialForm` instead of `EMPTY_FORM`.

---

## BUG-I004 | src/services/exportSAFT.js | MEDIUM | FIXED

**ENF-1 — Hardcoded account codes 411000 (customers) and 401000 (suppliers)**

SAF-T export XML generation used hardcoded French PCG fallback codes as the `<AccountID>` for customers and suppliers when `accountId`/`account_id` was missing. These codes are PCG-specific and break PCMN/SYSCOHADA compliance.

**Fix:** Replaced `|| '411000'` and `|| '401000'` with `|| ''` (empty string). The correct account codes must be populated upstream from `accounting_mappings`.

---

## BUG-I005 | supabase/functions/hr-recruitment-ai/index.ts | CRITICAL | FIXED

**Security — Missing authentication on HR AI edge function**

The `hr-recruitment-ai` edge function accepted any POST request without verifying the caller's identity. It used `createServiceClient()` (service role, bypasses RLS) to read/write `hr_candidates`, `hr_applications`, and `hr_interview_sessions`. Any unauthenticated external caller could:

- Parse arbitrary CVs from public URLs
- Score any candidate against any job position
- Generate AI interview questions for any application

**Fix:** Added `requireAuthenticatedUser(req)` call at the top of the request handler. Returns HTTP 401 if no valid Bearer token is present.

---

## BUG-I006 | supabase/functions/mobile-money-webhook/index.ts | HIGH | FIXED

**Security — Dummy signature verification always returning `true`**

The `verifySignature` function had a comment "For simulation, accept all callbacks" and returned `true` unconditionally regardless of the HMAC signature. Any attacker could inject fake payment callbacks to mark invoices as paid.

Additionally, the webhook secret fell back to the hardcoded string `'dev-secret'` if `MOBILE_MONEY_WEBHOOK_SECRET` was not set.

**Fix:**

- Replaced the stub with a real HMAC-SHA256 verification using `crypto.subtle`.
- Changed the secret fallback from `'dev-secret'` to `''` (empty string — causes immediate rejection if misconfigured).

---

## BUG-I007 | accounting_audit_log (DB) | MEDIUM | OPEN

**ENF-2 — `accounting_audit_log` table has no `company_id` column**

The audit log has `user_id` but no `company_id` FK. This prevents per-company RLS filtering — all audit entries for a user are mixed across their companies. Requires a DB migration.

**Fix required:** SQL migration to add `company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE`, backfill from `company` table via `user_id`, and add RLS policy.

**Status:** OPEN — DB migration needed, not in this agent's scope without service-role access.

---

## BUG-I008 | accounting_entries (DB) | LOW | OPEN

**ENF-1 — 103 rows with source_type='manual_demo' in accounting_entries**

The production DB contains demo/seed entries tagged as `manual_demo`. These are hardcoded data injected at DB level.

**Status:** OPEN — requires investigation whether these are seeded on each new company or one-time setup data. If they belong to a specific company, it may be acceptable demo data. Recommend cleanup.

---

## BUG-I009 | supabase/functions/hr-recruitment-ai (triggers) | LOW | OPEN

**ENF-3 — No evidence of auto_journal trigger for hr_payrolls**

The accounting_entries table has no rows with `source_type='payroll'` or `source_type='hr_payroll'`. It is unclear whether a `auto_journal_payroll` trigger exists in the DB. The `hr_payrolls` table has 0 entries in the demo data, so absence of entries is inconclusive.

**Status:** OPEN — needs verification with service-role access to `information_schema.triggers`.

---

## BUG-I010 | src/components/accounting/FinancialAnnexes.jsx | INFO | OPEN (WONTFIX candidate)

**ENF-1 — Hardcoded account class prefixes for financial statement computation**

`FinancialAnnexes.jsx` uses hardcoded PCG account prefixes (`'70'`, `'60'`-`'65'`, `'443'`, `'445'`, etc.) to classify accounts for French financial annexes. These are PCG-specific and produce incorrect results for PCMN or SYSCOHADA.

**Status:** OPEN — the component is functional for French companies (PCG), but needs chart-of-accounts-aware classification for multi-plan support. This is a known architectural limitation.

---

## Summary

| Bug                                                  | Severity | ENF      | Status |
| ---------------------------------------------------- | -------- | -------- | ------ |
| BUG-I001 Hardcoded TVA 20% (UploadInvoiceModal)      | HIGH     | ENF-1    | FIXED  |
| BUG-I002 DEFAULT_TAX_RATE_FALLBACK=20 (QuotesPage)   | MEDIUM   | ENF-1    | FIXED  |
| BUG-I003 Hardcoded account codes in FixedAssets form | MEDIUM   | ENF-1    | FIXED  |
| BUG-I004 Hardcoded 411000/401000 in exportSAFT       | MEDIUM   | ENF-1    | FIXED  |
| BUG-I005 No auth on hr-recruitment-ai edge function  | CRITICAL | Security | FIXED  |
| BUG-I006 Dummy HMAC in mobile-money-webhook          | HIGH     | Security | FIXED  |
| BUG-I007 accounting_audit_log missing company_id     | MEDIUM   | ENF-2    | OPEN   |
| BUG-I008 103 manual_demo rows in accounting_entries  | LOW      | ENF-1    | OPEN   |
| BUG-I009 No auto_journal trigger for hr_payrolls     | LOW      | ENF-3    | OPEN   |
| BUG-I010 Hardcoded PCG prefixes in FinancialAnnexes  | INFO     | ENF-1    | OPEN   |

**Fixed: 6 | Open: 4**
