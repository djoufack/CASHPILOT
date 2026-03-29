# FIX-11: Credit Note Auto-Journal — Bug Report

**Date:** 2026-03-29
**Agent:** FIX-11
**Branch:** `fix/11-credit-note-journal`
**Migration:** `supabase/migrations/20260329150000_fix_credit_note_auto_journal.sql`

---

## Executive Summary

The `auto_journal_credit_note()` trigger function existed in the database but had **four significant gaps** relative to the ENF-3 requirements and the patterns established by all newer trigger functions. Most critically, it **never wrote to `accounting_audit_log`**, meaning all credit note journalizations were invisible to the audit trail system. A fifth issue was the absence of a cancel-reversal trigger, leaving cancelled credit notes with unreversed accounting entries.

---

## Files Read During Investigation

| File                                                                                      | Purpose                                                                                                         |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useCreditNotes.js`                                                             | Frontend CRUD operations — statuses used: `draft`, `issued`, `applied`, `cancelled`                             |
| `src/pages/CreditNotesPage.jsx`                                                           | Confirms valid statuses: `draft`, `issued`, `applied`, `cancelled` (no `validated` or `sent` in UI transitions) |
| `supabase/migrations/20260308100000_attach_auto_journal_triggers.sql`                     | First definition of trigger + attach — but **no audit log**                                                     |
| `supabase/migrations/20260308110000_auto_journal_enabled_default_true.sql`                | Removed `auto_journal_enabled` check — **no audit log**                                                         |
| `supabase/migrations/20260308450000_fix_auto_journal_company_id_and_gaps.sql`             | Added `company_id` to entries — but still **no audit log**                                                      |
| `supabase/migrations/20260316014947_auto_journal_game_changer.sql`                        | Mobile money, expense reports, intercompany — all include full audit log                                        |
| `supabase/migrations/20260316030002_auto_journal_game_changer.sql`                        | Same as above (duplicate/companion migration)                                                                   |
| `supabase/migrations/20260329035000_fix_accounting_audit_log_company_id.sql`              | Added `company_id` column to `accounting_audit_log` table                                                       |
| `supabase/migrations/20260329030000_buy_fix_expense_operations_account_code.sql`          | Latest `get_user_account_code()` definition — used by credit note trigger                                       |
| `supabase/migrations/20260315023405_hr_accounting_journalization.sql`                     | HR trigger patterns — consistent audit log usage                                                                |
| `supabase/migrations/20260309233000_fix_invoice_journal_rounding_and_demo_categories.sql` | `ensure_account_exists()` function definition                                                                   |
| `supabase/migrations/20260226150558_cashpilot_auto_accounting_engine_v2.sql`              | `accounting_audit_log` table schema                                                                             |

---

## Bugs Found

### BUG-F11-01: Missing `accounting_audit_log` INSERT (CRITICAL — ENF-3 violation)

**Severity:** Critical
**ENF:** ENF-3

**Description:**
The `auto_journal_credit_note()` trigger function (last updated in migration `20260308450000`) never inserted a row into `accounting_audit_log` after journalizing a credit note. All other auto-journal triggers in the codebase (invoices, payments, expenses, mobile money, expense reports, intercompany, payroll, training) correctly log to `accounting_audit_log`.

The ENF-3 requirement explicitly states:

> "Audit: `accounting_audit_log` traces each automatic journalization"

Every credit note that was ever issued/applied since the system was created has no audit trail entry.

**Root Cause:**
The trigger was originally created in early migrations (before `20260308100000`) when `accounting_audit_log` logging was not yet standardized. Later migrations updated the function to add `company_id` to entries but never added the audit log insert.

**Fix:**
Added `INSERT INTO accounting_audit_log` at the end of `auto_journal_credit_note()`, including:

- `user_id`, `company_id` (ENF-2)
- `event_type = 'auto_journal'`
- `source_table = 'credit_notes'`
- `entry_count` (2 or 3 depending on whether VAT applies)
- `total_debit`, `total_credit` (both equal to `total_ttc` — balanced entry)
- `balance_ok = true`
- `details` JSONB with full context

---

### BUG-F11-02: Missing `ensure_account_exists()` calls

**Severity:** Medium

**Description:**
The credit note trigger did not call `ensure_account_exists()` before inserting accounting entries. All newer triggers (mobile money, intercompany, expense reports) call this function to guarantee the accounts referenced exist in `accounting_chart_of_accounts`. Without it, a credit note for a new company could silently reference non-existent accounts, leaving the chart of accounts incomplete.

**Root Cause:**
The `ensure_account_exists()` helper was defined in migration `20260309233000` (after the credit note trigger was created), so it was never backfilled into the credit note trigger.

**Fix:**
Added `PERFORM ensure_account_exists(...)` for all three account codes (`v_revenue_code`, `v_vat_code`, `v_client_code`) before the INSERT statements.

---

### BUG-F11-03: Inconsistent `auto_journal_enabled` handling

**Severity:** Low

**Description:**
Migration `20260308110000` explicitly stripped the `auto_journal_enabled` check from the credit note trigger (comment: "5e. Credit note trigger: remove auto_journal_enabled check"). However, all newer triggers (mobile_money, expense_report, intercompany) consistently check `auto_journal_enabled`. This created an inconsistency where disabling auto-journal in user settings would stop other triggers but not credit notes.

**Fix:**
Re-added the `auto_journal_enabled` check using `COALESCE(auto_journal_enabled, true)` to match the newer pattern. The default is TRUE (consistent with `20260308110000` which set the column default to `true`), so no behavior change for existing users.

---

### BUG-F11-04: `accounting_audit_log.company_id` not populated

**Severity:** Medium — ENF-2 violation

**Description:**
Migration `20260329035000` added a `company_id` column to `accounting_audit_log` (BUG-I007). The credit note trigger never populated this column, making credit note audit entries violate ENF-2 (chain of ownership: user → company → data).

**Root Cause:**
The credit note trigger was never updated after `20260329035000` added the `company_id` column to the audit log.

**Fix:**
The new trigger function passes `company_id` in all `accounting_audit_log` INSERTs.

---

### BUG-F11-05: Missing cancel-reversal trigger

**Severity:** Medium — ENF-3 gap

**Description:**
The codebase has `trg_reverse_journal_credit_note_on_delete` which reverses entries when a credit note is deleted. However, when a credit note's status changes from `issued`/`applied` to `cancelled` (which is the normal workflow — users cancel rather than delete), accounting entries were **never reversed**.

This left cancelled credit notes with permanent debit entries on revenue accounts and credit entries on client/receivable accounts — creating phantom balance sheet distortions.

For comparison: invoices have `trg_reverse_journal_invoice_on_cancel` which handles exactly this pattern.

**Fix:**
Created new function `reverse_journal_credit_note_on_cancel()` and trigger `trg_reverse_journal_credit_note_on_cancel` (BEFORE UPDATE) that calls `reverse_journal_entries()` when status transitions from `issued`/`sent`/`applied` to `cancelled`. Also logs the reversal to `accounting_audit_log`.

---

## What Was Fixed

### Migration: `supabase/migrations/20260329150000_fix_credit_note_auto_journal.sql`

**Part A — Rewrite `auto_journal_credit_note()`:**

- Added `auto_journal_enabled` check (consistent with all newer triggers)
- Added `ensure_account_exists()` calls for all 3 account codes
- Added `accounting_audit_log` INSERT with `company_id` and full details
- Added dynamic `entry_count` calculation (2 without VAT, 3 with VAT)
- Preserved idempotency guard (`EXISTS` check before inserting)
- Preserved `company_id` in all `accounting_entries` rows

**Part B — New cancel-reversal trigger:**

- `reverse_journal_credit_note_on_cancel()` function
- `trg_reverse_journal_credit_note_on_cancel` BEFORE UPDATE trigger
- Fires on status transition: `issued|sent|applied` → `cancelled`
- Calls existing `reverse_journal_entries()` utility (reuses established pattern)
- Logs reversal to `accounting_audit_log`

**Part C — Backfill missing audit log entries:**

- Idempotent DO $$ block
- Inserts `accounting_audit_log` rows for all existing credit notes that have `accounting_entries` but no audit log entry
- Correctly marks `backfilled: true` in details JSONB for traceability

---

## Issues Encountered

### Issue 1: Docker not available for `supabase db diff`

`npx supabase db diff` requires Docker daemon. Used `npx supabase db push --dry-run` instead to verify DB state (confirmed "Remote database is up to date" before applying migration).

### Issue 2: `trg_reverse_journal_credit_note_on_cancel` didn't exist

`DROP TRIGGER IF EXISTS` produced a NOTICE "does not exist, skipping" — this is expected and safe. The trigger was being created for the first time.

### Issue 3: No `validated` status in codebase

The task description mentioned status `validated`. After checking `CreditNotesPage.jsx` and `useCreditNotes.js`, the actual statuses are: `draft`, `issued`, `applied`, `cancelled` (and `sent` is used in the trigger as a transitional state seen in migrations). No `validated` status exists in the CashPilot codebase. The trigger correctly uses `IN ('issued', 'sent', 'applied')`.

---

## Verification

- Migration applied successfully: `Finished supabase db push.`
- Build: `✓ built in 45.72s` — 0 errors
- Lint: `0 errors, 199 warnings` — all warnings are pre-existing, unrelated to this fix

---

## ENF-3 Compliance Summary After Fix

| Flow                       | Trigger                                     | audit_log                  | company_id            | idempotent | cancel-reverse |
| -------------------------- | ------------------------------------------- | -------------------------- | --------------------- | ---------- | -------------- |
| Credit Note issued/applied | `trg_auto_journal_credit_note`              | ✅ Fixed                   | ✅ Fixed              | ✅         | ✅ Fixed       |
| Credit Note cancelled      | `trg_reverse_journal_credit_note_on_cancel` | ✅ New                     | ✅                    | N/A        | ✅ New         |
| Credit Note deleted        | `trg_reverse_journal_credit_note_on_delete` | ⚠️ Existing (no audit log) | ⚠️ (pre-existing gap) | N/A        | ✅             |

> Note: `trg_reverse_journal_credit_note_on_delete` (from `20260308100000`) also lacks an audit log entry but was not modified in this fix to limit scope. This is a follow-up task if needed.
