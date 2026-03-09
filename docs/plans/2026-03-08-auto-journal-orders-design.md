# Auto-Journal Supplier Orders & Purchase Orders — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Journalize supplier_orders and purchase_orders as off-balance-sheet commitments (classe 8), with automatic reversal when orders reach terminal status.

**Architecture:** PostgreSQL triggers following the existing auto_journal_* pattern. Commitments are recorded in accounts 801/802/809 (engagements hors-bilan). Products already have stock_movement triggers — no new work needed there.

**Tech Stack:** PostgreSQL triggers, plpgsql, existing auto-journal infrastructure (get_user_account_code, reverse_journal_entries, ensure_account_exists, accounting_audit_log)

---

## Pre-Implementation Notes

- Products already have `trg_auto_journal_stock_movement` and `trg_reverse_journal_stock_on_delete` (migration 20260308450000). **No new work needed for products.**
- supplier_order_items don't need separate journals — they're captured in the parent order total.
- The `assign_accounting_entry_company_id` function needs updating to handle new source_types.

## Account Mapping

| Event | Debit | Credit | Journal |
|---|---|---|---|
| supplier_order created/confirmed | 801 (Engagements donnés) | 809 (Contrepartie engagements) | OD |
| supplier_order received/cancelled | 809 (Contrepartie) | 801 (Extourne) | OD |
| supplier_order deleted | reversal entries | | OD |
| purchase_order sent/confirmed | 802 (Engagements reçus) | 809 (Contrepartie engagements) | OD |
| purchase_order draft/cancelled | 809 (Contrepartie) | 802 (Extourne) | OD |
| purchase_order deleted | reversal entries | | OD |

---

### Task 1: Create migration with all trigger functions

**Files:**
- Create: `supabase/migrations/20260308470000_auto_journal_orders.sql`

**Step 1:** Create the migration SQL file with:

1. **auto_journal_supplier_order()** — AFTER INSERT OR UPDATE
   - Guards: auto_journal_enabled, amount > 0, idempotency
   - INSERT with order_status IN ('pending','confirmed'): DEBIT 801, CREDIT 809
   - UPDATE order_status → 'received': extourne (DEBIT 809, CREDIT 801) + audit
   - UPDATE order_status → 'cancelled': extourne
   - UPDATE total_amount changed: delete old entries + re-journal

2. **reverse_journal_supplier_order()** — BEFORE DELETE
   - Call reverse_journal_entries(OLD.user_id, 'supplier_order', OLD.id, 'ANN-SO')
   - Audit log

3. **auto_journal_purchase_order()** — AFTER INSERT OR UPDATE
   - Guards: auto_journal_enabled, total > 0, idempotency
   - INSERT with status IN ('sent','confirmed'): DEBIT 802, CREDIT 809
   - UPDATE status → 'draft': extourne
   - UPDATE total changed: delete old entries + re-journal

4. **reverse_journal_purchase_order()** — BEFORE DELETE
   - Call reverse_journal_entries(OLD.user_id, 'purchase_order', OLD.id, 'ANN-PO')
   - Audit log

5. **Update assign_accounting_entry_company_id** to handle new source_types

6. **Backfill**: Journal existing supplier_orders and purchase_orders

**Step 2:** Apply migration via Supabase execute_sql

**Step 3:** Verify with test queries — check entry counts, balanced debits/credits

**Step 4:** Commit
