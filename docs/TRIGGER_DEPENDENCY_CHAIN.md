# CashPilot — Trigger Dependency Chain

> Generated 2026-03-08. Documentation only — based on analysis of all SQL migrations in `supabase/migrations/`.

---

## Table of Contents

1. [Summary Table](#summary-table)
2. [Dependency Chains by Table](#dependency-chains-by-table)
3. [Cross-Table Cascading Effects](#cross-table-cascading-effects)
4. [Race Conditions & Ordering Issues](#race-conditions--ordering-issues)
5. [Recommendations](#recommendations)

---

## Summary Table

### Legend

- **Timing**: `B` = BEFORE, `A` = AFTER
- **Event**: `I` = INSERT, `U` = UPDATE, `D` = DELETE
- **Category**: `journal` = auto-accounting, `reversal` = undo accounting, `company` = company_id assignment, `updated_at` = timestamp maintenance, `guard` = validation/security, `data` = data enrichment/sync, `stock` = inventory management, `audit` = audit trail

| Table | Trigger Name | Timing | Event | Function | Category | Description |
|-------|-------------|--------|-------|----------|----------|-------------|
| **accounting_entries** | `trg_validate_accounting_entry` | B | I | `validate_accounting_entry()` | guard | Rejects negative amounts, dual debit+credit, and duplicates |
| **accounting_entries** | `trg_assign_accounting_entry_company_id` | B | I,U | `assign_accounting_entry_company_id()` | company | Resolves company_id from source document (invoice, expense, etc.) |
| **accounting_entries** | `trg_check_balance` | A | I | `check_accounting_balance()` | guard | Checks debit/credit balance per source_id, writes to `accounting_balance_checks` |
| **accounting_entries** | `trg_check_entry_balance` | A | I | `check_entry_balance()` | guard | Checks debit/credit balance per entry_ref, writes to `accounting_health` |
| **accounting_analytical_axes** | `trg_analytical_axes_updated_at` | B | U | `update_updated_at_column()` | updated_at | Touches updated_at timestamp |
| **accounting_fixed_assets** | `trg_fixed_assets_updated_at` | B | U | `update_updated_at_column()` | updated_at | Touches updated_at timestamp |
| **accounting_fixed_assets** | `trg_assign_accounting_fixed_asset_company_id` | B | I,U | `assign_accounting_fixed_asset_company_id()` | company | Auto-assigns company_id |
| **accounting_depreciation_schedule** | `trg_assign_depreciation_schedule_company_id` | B | I,U | `assign_depreciation_schedule_company_id()` | company | Auto-assigns company_id |
| **accounting_integrations** | `trg_accounting_integrations_touch_updated_at` | B | U | `update_updated_at_column()` | updated_at | Touches updated_at timestamp |
| **accounting_integrations** | `trg_assign_accounting_integration_company_id` | B | I,U | `assign_accounting_integration_company_id()` | company | Auto-assigns company_id |
| **auth.users** | `on_auth_user_created_profile` | A | I | `handle_new_user()` | data | Auto-creates profile row on user signup |
| **bank_connections** | `trg_assign_bank_connection_company_id` | B | I,U | `assign_bank_connection_company_id()` | company | Auto-assigns company_id |
| **bank_statement_lines** | `trg_auto_journal_bsl_reconciled` | A | U | `auto_journal_bank_statement_line_reconciled()` | journal | Creates bank/suspense journal entries when reconciliation_status changes |
| **bank_sync_history** | `trg_assign_bank_sync_history_company_id` | B | I,U | `assign_bank_sync_history_company_id()` | company | Auto-assigns company_id |
| **bank_transactions** | `trg_assign_bank_transaction_company_id` | B | I,U | `assign_bank_transaction_company_id()` | company | Auto-assigns company_id |
| **bank_transactions** | `trg_reverse_journal_bank_transaction` | B | U | `reverse_journal_bank_transaction()` | reversal | Reverses entries when reconciliation_status leaves 'matched' |
| **bank_transactions** | `trg_auto_journal_bank_transaction` | A | U | `auto_journal_bank_transaction()` | journal | Creates bank journal entries when reconciliation_status becomes 'matched' |
| **bank_transactions** | `trg_reverse_journal_bank_transaction_on_delete` | B | D | `reverse_journal_bank_transaction_on_delete()` | reversal | Reverses entries on delete |
| **clients** | `trg_snapshot_before_client_delete` | B | D | `snapshot_before_client_delete()` | audit | Archives client + related invoices/quotes/expenses to `deleted_data_snapshots` |
| **company** | `trg_company_sync_currency_fields` | B | I,U | `sync_company_currency_fields()` | data | Normalizes accounting_currency and syncs legacy currency column |
| **credit_notes** | `trg_assign_credit_note_company_id` | B | I,U | `assign_credit_note_company_id()` | company | Auto-assigns company_id |
| **credit_notes** | `trg_auto_journal_credit_note` | A | I,U | `auto_journal_credit_note()` | journal | Creates VE journal entries (revenue reversal) when credit note is issued |
| **credit_notes** | `trg_reverse_journal_credit_note_on_delete` | B | D | `reverse_journal_credit_note()` | reversal | Reverses credit note journal entries on delete |
| **dashboard_snapshots** | `trg_assign_dashboard_snapshot_company_id` | B | I,U | `assign_dashboard_snapshot_company_id()` | company | Auto-assigns company_id |
| **debt_payments** | `trg_assign_debt_payment_company_id` | B | I,U | `assign_debt_payment_company_id()` | company | Auto-assigns company_id |
| **delivery_notes** | `trg_assign_delivery_note_company_id` | B | I,U | `assign_delivery_note_company_id()` | company | Auto-assigns company_id |
| **expenses** | `trg_update_journal_expense` | B | U | `update_journal_expense()` | reversal | Deletes old auto-entries when amount/category/date changes (prepares for re-journal) |
| **expenses** | `trg_auto_journal_expense` | A | I | `auto_journal_expense()` | journal | Creates AC journal entries (expense debit, VAT, bank credit) |
| **expenses** | `trg_auto_journal_expense_on_update` | A | U | `auto_journal_expense()` | journal | Re-creates journal entries after BEFORE UPDATE deleted them |
| **expenses** | `trg_reverse_journal_expense_on_delete` | B | D | `reverse_journal_expense()` | reversal | Reverses expense journal entries on delete |
| **financial_scenarios** | `trg_assign_financial_scenario_company_id` | B | I,U | `assign_financial_scenario_company_id()` | company | Auto-assigns company_id |
| **fx_rates** | `trg_fx_rates_touch_updated_at` | B | U | `update_updated_at_column()` | updated_at | Touches updated_at timestamp |
| **invoice_items** | `trg_auto_stock_decrement` | A | I,D | `auto_stock_decrement()` | stock | Decrements product stock on INSERT, restores on DELETE; writes stock history |
| **invoices** | `trg_reverse_journal_invoice_on_cancel` | B | U | `reverse_journal_invoice_on_cancel()` | reversal | Reverses entries when status reverts to draft/cancelled |
| **invoices** | `trg_auto_journal_invoice` | A | I,U | `auto_journal_invoice()` | journal | Creates VE journal entries (client debit, revenue credit, VAT) + payment entries |
| **invoices** | `trg_reverse_journal_invoice_on_delete` | B | D | `reverse_journal_invoice()` | reversal | Reverses all invoice + payment entries on delete |
| **payables** | `trg_assign_payable_company_id` | B | I,U | `assign_payable_company_id()` | company | Auto-assigns company_id |
| **payables** | `trg_auto_journal_payable` | A | I,U | `auto_journal_payable()` | journal | Creates journal entries for debt/payable records |
| **payables** | `trg_reverse_journal_payable_on_delete` | B | D | `reverse_journal_payable()` | reversal | Reverses payable journal entries on delete |
| **payments** | `trg_auto_journal_payment` | A | I | `auto_journal_payment()` | journal | Creates BQ journal entries (bank/cash debit, client credit) |
| **payments** | `trg_auto_journal_payment_on_update` | A | U | `auto_journal_payment()` | journal | Re-journals payment on update |
| **payments** | `trg_reverse_journal_payment_on_delete` | B | D | `reverse_journal_payment()` | reversal | Reverses payment journal entries on delete |
| **payment_reminder_logs** | `trg_assign_payment_reminder_log_company_id` | B | I,U | `assign_payment_reminder_log_company_id()` | company | Auto-assigns company_id |
| **payment_reminder_rules** | `trg_assign_payment_reminder_rule_company_id` | B | I,U | `assign_payment_reminder_rule_company_id()` | company | Auto-assigns company_id |
| **peppol_transmission_log** | `trg_assign_peppol_transmission_log_company_id` | B | I,U | `assign_peppol_transmission_log_company_id()` | company | Auto-assigns company_id |
| **product_categories** | `trg_assign_product_category_company_id` | B | I,U | `assign_product_category_company_id()` | company | Auto-assigns company_id |
| **product_stock_history** | `trg_assign_product_stock_history_company_id` | B | I,U | `assign_product_stock_history_company_id()` | company | Auto-assigns company_id |
| **products** | `trg_assign_product_company_id` | B | I,U | `assign_product_company_id()` | company | Auto-assigns company_id |
| **products** | `trg_auto_journal_stock_movement` | A | I,U | `auto_journal_stock_movement()` | journal | Creates stock valuation journal entries (31/603) when stock_quantity changes |
| **products** | `trg_reverse_journal_stock_on_delete` | B | D | `reverse_journal_stock_on_delete()` | reversal | Deletes stock_movement entries and writes audit log on product delete |
| **purchase_orders** | `trg_assign_purchase_order_company_id` | B | I,U | `assign_purchase_order_company_id()` | company | Auto-assigns company_id |
| **receivables** | `trg_assign_receivable_company_id` | B | I,U | `assign_receivable_company_id()` | company | Auto-assigns company_id |
| **receivables** | `trg_auto_journal_receivable` | A | I,U | `auto_journal_receivable()` | journal | Creates journal entries for receivable records |
| **receivables** | `trg_reverse_journal_receivable_on_delete` | B | D | `reverse_journal_receivable()` | reversal | Reverses receivable journal entries on delete |
| **recurring_invoices** | `trg_assign_recurring_invoice_company_id` | B | I,U | `assign_recurring_invoice_company_id()` | company | Auto-assigns company_id |
| **recurring_invoices** | `trg_sync_recurring_invoice_dates` | B | I,U | `sync_recurring_invoice_dates()` | data | Syncs next_generation_date and next_date columns |
| **report_builder_templates** | `trg_assign_report_builder_template_company_id` | B | I,U | `assign_report_builder_template_company_id()` | company | Auto-assigns company_id |
| **report_builder_templates** | `trg_report_builder_templates_touch_updated_at` | B | U | `update_updated_at_column()` | updated_at | Touches updated_at timestamp |
| **scenario_comparisons** | `trg_assign_scenario_comparison_company_id` | B | I,U | `assign_scenario_comparison_company_id()` | company | Auto-assigns company_id |
| **service_categories** | `update_service_categories_modtime` | B | U | `update_updated_at_column()` | updated_at | Touches updated_at timestamp |
| **services** | `update_services_modtime` | B | U | `update_updated_at_column()` | updated_at | Touches updated_at timestamp |
| **stock_alerts** | `trg_assign_stock_alert_company_id` | B | I,U | `assign_stock_alert_company_id()` | company | Auto-assigns company_id |
| **supplier_invoice_line_items** | `trg_set_sil_user_id` | B | I | `set_sil_user_id()` | data | Auto-populates user_id from supplier_invoices -> suppliers chain |
| **supplier_invoices** | `trg_assign_supplier_invoice_company_id` | B | I,U | `assign_supplier_invoice_company_id()` | company | Auto-assigns company_id |
| **supplier_invoices** | `trg_assign_supplier_invoice_user_id` | B | I | `assign_supplier_invoice_user_id()` | data | Auto-sets user_id from supplier |
| **supplier_invoices** | `01_trg_sync_supplier_invoice_approval_metadata` | B | I,U(approval_status,...) | `sync_supplier_invoice_approval_metadata()` | data | Auto-fills approved_at, approved_by, clears rejected_reason based on approval_status |
| **supplier_invoices** | `02_trg_enforce_supplier_invoice_approval_role_guard` | B | I,U(approval_status,...) | `enforce_supplier_invoice_approval_role_guard()` | guard | Rejects approval changes from non-admin/accountant users |
| **supplier_invoices** | `trg_reverse_supplier_invoice_on_cancel` | B | U | `reverse_journal_supplier_invoice()` | reversal | Reverses entries when status reverts from received/processed to draft/rejected |
| **supplier_invoices** | `trg_auto_journal_supplier_invoice` | A | I,U | `auto_journal_supplier_invoice()` | journal | Creates AC journal entries (expense, VAT, supplier debt) + BQ payment entries |
| **supplier_invoices** | `trg_reverse_journal_supplier_invoice_on_delete` | B | D | `reverse_journal_supplier_invoice()` | reversal | Reverses all supplier invoice entries on delete |
| **supplier_locations** | `trg_assign_supplier_location_company_id` | B | I,U | `assign_supplier_location_company_id()` | company | Auto-assigns company_id |
| **supplier_orders** | `trg_assign_supplier_order_company_id` | B | I,U | `assign_supplier_order_company_id()` | company | Auto-assigns company_id |
| **supplier_orders** | `trg_supplier_order_received` | B | U | `auto_stock_and_journal_on_received()` | stock+journal | On status -> 'received': increments product stock, writes stock history, resolves alerts, creates AC purchase journal entry |
| **supplier_product_categories** | `trg_assign_supplier_product_category_company_id` | B | I,U | `assign_supplier_product_category_company_id()` | company | Auto-assigns company_id |
| **supplier_products** | `trg_assign_supplier_product_company_id` | B | I,U | `assign_supplier_product_company_id()` | company | Auto-assigns company_id |
| **supplier_reports_cache** | `trg_assign_supplier_report_cache_company_id` | B | I,U | `assign_supplier_report_cache_company_id()` | company | Auto-assigns company_id |
| **supplier_services** | `trg_assign_supplier_service_company_id` | B | I,U | `assign_supplier_service_company_id()` | company | Auto-assigns company_id |
| **suppliers** | `trg_assign_supplier_company_id` | B | I,U | `assign_supplier_company_id()` | company | Auto-assigns company_id |
| **user_roles** | `trg_user_roles_touch_updated_at` | B | U | `update_updated_at_column()` | updated_at | Touches updated_at timestamp |

---

## Dependency Chains by Table

### `accounting_entries` (the critical chain)

Every auto-journal trigger in the system inserts rows into `accounting_entries`. This table has its own trigger chain:

```
INSERT into accounting_entries
  |
  +-- [BEFORE] trg_validate_accounting_entry()
  |     Validates: no negatives, no dual debit+credit, no duplicates
  |     Can RAISE EXCEPTION → aborts the INSERT
  |
  +-- [BEFORE] trg_assign_accounting_entry_company_id()
  |     Resolves company_id from source document (invoice, expense, supplier_invoice, etc.)
  |     Falls back to resolve_preferred_company_id()
  |
  +-- [ROW INSERTED]
  |
  +-- [AFTER] trg_check_balance()
  |     Sums debit/credit for source_id → writes to accounting_balance_checks
  |     RAISE WARNING on imbalance (non-blocking)
  |
  +-- [AFTER] trg_check_entry_balance()
        Sums debit/credit for entry_ref → writes to accounting_health
        Non-blocking warning
```

**Key**: PostgreSQL fires BEFORE triggers in alphabetical order by trigger name, and AFTER triggers in alphabetical order by trigger name. Both BEFORE triggers fire in correct order (`trg_assign...` before `trg_validate...` alphabetically — but note `trg_assign` fires before `trg_validate` which means company_id is set before validation runs).

### `invoices`

```
UPDATE on invoices
  |
  +-- [BEFORE] trg_reverse_journal_invoice_on_cancel()
  |     If status: non-draft → draft/cancelled: inserts reversal entries into accounting_entries
  |     If payment_status: paid → not-paid: inserts payment reversal entries
  |     → CASCADES into accounting_entries trigger chain
  |
  +-- [ROW UPDATED]
  |
  +-- [AFTER] trg_auto_journal_invoice()
        If status is sent/paid/overdue (not draft/cancelled): creates VE journal entries
        If payment_status becomes 'paid': creates BQ payment entries
        → CASCADES into accounting_entries trigger chain

DELETE on invoices
  |
  +-- [BEFORE] trg_reverse_journal_invoice_on_delete()
  |     Reverses all 'invoice' and 'invoice_payment' entries
  |     → CASCADES into accounting_entries trigger chain
  |
  +-- [ROW DELETED]
```

### `expenses`

```
INSERT on expenses
  |
  +-- [ROW INSERTED]
  |
  +-- [AFTER] trg_auto_journal_expense()
        Creates AC entries: expense debit, VAT debit, bank credit
        → CASCADES into accounting_entries trigger chain

UPDATE on expenses
  |
  +-- [BEFORE] trg_update_journal_expense()
  |     If amount/category/date changed: DELETES old auto entries from accounting_entries
  |
  +-- [ROW UPDATED]
  |
  +-- [AFTER] trg_auto_journal_expense_on_update()
        Re-creates entries via auto_journal_expense()
        → CASCADES into accounting_entries trigger chain

DELETE on expenses
  |
  +-- [BEFORE] trg_reverse_journal_expense_on_delete()
  |     Inserts reversal entries
  |     → CASCADES into accounting_entries trigger chain
  |
  +-- [ROW DELETED]
```

### `payments`

```
INSERT on payments
  |
  +-- [ROW INSERTED]
  |
  +-- [AFTER] trg_auto_journal_payment()
        Creates BQ entries: bank/cash debit, client credit
        → CASCADES into accounting_entries trigger chain

UPDATE on payments
  |
  +-- [ROW UPDATED]
  |
  +-- [AFTER] trg_auto_journal_payment_on_update()
        Re-runs auto_journal_payment() (idempotent)
        → CASCADES into accounting_entries trigger chain

DELETE on payments
  |
  +-- [BEFORE] trg_reverse_journal_payment_on_delete()
        → CASCADES into accounting_entries trigger chain
```

### `supplier_invoices` (most complex)

```
INSERT on supplier_invoices
  |
  +-- [BEFORE] trg_assign_supplier_invoice_company_id()  — sets company_id
  +-- [BEFORE] trg_assign_supplier_invoice_user_id()     — sets user_id from supplier
  +-- [BEFORE] 01_trg_sync_supplier_invoice_approval_metadata()  — fills approval fields
  +-- [BEFORE] 02_trg_enforce_supplier_invoice_approval_role_guard()  — role check
  |
  +-- [ROW INSERTED]
  |
  +-- [AFTER] trg_auto_journal_supplier_invoice()
        If status is received/processed: creates AC entries (expense, VAT, supplier debt)
        → CASCADES into accounting_entries trigger chain

UPDATE on supplier_invoices
  |
  +-- [BEFORE] trg_assign_supplier_invoice_company_id()
  +-- [BEFORE] 01_trg_sync_supplier_invoice_approval_metadata()
  +-- [BEFORE] 02_trg_enforce_supplier_invoice_approval_role_guard()
  +-- [BEFORE] trg_reverse_supplier_invoice_on_cancel()
  |     If received/processed → draft/rejected: inserts reversal entries
  |     → CASCADES into accounting_entries trigger chain
  |
  +-- [ROW UPDATED]
  |
  +-- [AFTER] trg_auto_journal_supplier_invoice()
        If status is received/processed: creates AC entries
        If payment_status becomes 'paid': creates BQ payment entries
        → CASCADES into accounting_entries trigger chain

DELETE on supplier_invoices
  |
  +-- [BEFORE] trg_reverse_journal_supplier_invoice_on_delete()
  |     Reverses all supplier_invoice entries
  |     → CASCADES into accounting_entries trigger chain
  |
  +-- [ROW DELETED]
```

### `invoice_items` → `products` (stock chain)

```
INSERT on invoice_items (product)
  |
  +-- [ROW INSERTED]
  |
  +-- [AFTER] trg_auto_stock_decrement()
        UPDATEs products.stock_quantity (decrement)
        Inserts product_stock_history row
        |
        +-- UPDATE on products triggers:
            +-- [BEFORE] trg_assign_product_company_id()
            +-- [AFTER] trg_auto_journal_stock_movement()
                  Creates stock valuation entries (31/603)
                  → CASCADES into accounting_entries trigger chain
```

### `supplier_orders` → `products` (purchase receipt chain)

```
UPDATE on supplier_orders (status → 'received')
  |
  +-- [BEFORE] trg_assign_supplier_order_company_id()
  +-- [BEFORE] trg_supplier_order_received()
  |     1. UPDATEs products.stock_quantity for each line item (increment)
  |        → triggers trg_auto_journal_stock_movement on products
  |     2. Writes product_stock_history rows
  |     3. Manages stock_alerts (resolves/creates)
  |     4. Creates AC purchase journal entry
  |        → CASCADES into accounting_entries trigger chain
  |
  +-- [ROW UPDATED]
```

### `bank_transactions` (reconciliation chain)

```
UPDATE on bank_transactions (reconciliation_status → 'matched')
  |
  +-- [BEFORE] trg_assign_bank_transaction_company_id()
  +-- [BEFORE] trg_reverse_journal_bank_transaction()
  |     If leaving 'matched' status: reverses previous bank journal entries
  |
  +-- [ROW UPDATED]
  |
  +-- [AFTER] trg_auto_journal_bank_transaction()
        Creates BQ journal entries based on matched source (invoice/supplier_invoice)
        → CASCADES into accounting_entries trigger chain
```

### `clients` (delete audit chain)

```
DELETE on clients
  |
  +-- [BEFORE] trg_snapshot_before_client_delete()
  |     Archives client, invoices, quotes, expenses as JSON snapshots
  |
  +-- [ROW DELETED]
  |     CASCADE deletes fire on invoices, quotes, expenses
  |     → Each cascaded delete fires its own reversal triggers
```

---

## Cross-Table Cascading Effects

These are the most important cascading chains where a single operation touches multiple tables:

### Chain 1: Invoice Item Created (Sale)
```
invoice_items INSERT
  → products UPDATE (stock decrement via trg_auto_stock_decrement)
    → accounting_entries INSERT (stock valuation via trg_auto_journal_stock_movement)
      → accounting_balance_checks UPSERT (via trg_check_balance)
      → accounting_health UPSERT (via trg_check_entry_balance)
  → product_stock_history INSERT
```

### Chain 2: Invoice Finalized
```
invoices UPDATE (status → 'sent')
  → accounting_entries INSERT x3+ (client debit, revenue credits, VAT via trg_auto_journal_invoice)
    → accounting_balance_checks UPSERT
    → accounting_health UPSERT
```

### Chain 3: Supplier Order Received
```
supplier_orders UPDATE (status → 'received')
  → products UPDATE (stock increment, PER line item)
    → accounting_entries INSERT (stock valuation, PER product)
  → product_stock_history INSERT (PER line item)
  → stock_alerts INSERT/UPDATE (PER product)
  → accounting_entries INSERT x2 (purchase journal entry)
    → accounting_balance_checks UPSERT
    → accounting_health UPSERT
```

### Chain 4: Client Deleted (Cascade Nuke)
```
clients DELETE
  → deleted_data_snapshots INSERT (client + invoices + quotes + expenses)
  → invoices DELETE (CASCADE) per invoice:
    → accounting_entries INSERT (reversals via trg_reverse_journal_invoice_on_delete)
    → invoice_items DELETE (CASCADE) per item:
      → products UPDATE (stock restore via trg_auto_stock_decrement)
        → accounting_entries INSERT (stock valuation)
  → expenses DELETE (CASCADE) per expense:
    → accounting_entries INSERT (reversals via trg_reverse_journal_expense_on_delete)
```

---

## Race Conditions & Ordering Issues

### 1. CRITICAL: Two Balance-Check AFTER Triggers on `accounting_entries`

Both `trg_check_balance` and `trg_check_entry_balance` fire AFTER INSERT on `accounting_entries`. They write to different tables (`accounting_balance_checks` and `accounting_health`), so there is no direct data conflict. However:

- **Problem**: Both triggers query `accounting_entries` to sum debits/credits. Since they fire in alphabetical order (`trg_check_balance` before `trg_check_entry_balance`), and a single accounting event typically inserts multiple rows (debit + credit), the balance check on the FIRST inserted row will always see an imbalanced state (only one side of the entry exists).
- **Impact**: `accounting_balance_checks` and `accounting_health` will momentarily show imbalanced state until the last row of a multi-row entry_ref group is inserted. The last row's trigger fires will finally show balanced.
- **Severity**: LOW — the final state is correct, but intermediate checks are misleading. No blocking error is raised (only WARNING).

### 2. MODERATE: Expense Update Double-Trigger Pattern

The expense UPDATE chain uses a two-step pattern:
1. `trg_update_journal_expense` (BEFORE UPDATE) — deletes old entries
2. `trg_auto_journal_expense_on_update` (AFTER UPDATE) — re-creates entries

- **Problem**: Step 1 DELETEs from `accounting_entries`, which could theoretically trigger balance check recalculations. The DELETE does not have its own triggers, so this is safe. However, there is a brief window between DELETE and re-INSERT where the accounting state is incomplete.
- **Impact**: If a concurrent read of `accounting_balance_checks` happens between the two trigger phases, it may see stale balanced/unbalanced data.
- **Severity**: LOW — all within a single transaction, so external readers will not see the intermediate state.

### 3. MODERATE: Supplier Invoice BEFORE Triggers Ordering

On `supplier_invoices`, multiple BEFORE triggers fire on INSERT/UPDATE:
- `01_trg_sync_supplier_invoice_approval_metadata` (explicitly ordered with `01_` prefix)
- `02_trg_enforce_supplier_invoice_approval_role_guard` (explicitly ordered with `02_` prefix)
- `trg_assign_supplier_invoice_company_id`
- `trg_assign_supplier_invoice_user_id` (INSERT only)
- `trg_reverse_supplier_invoice_on_cancel` (UPDATE only)

PostgreSQL fires BEFORE triggers alphabetically. The `01_` and `02_` prefixes ensure sync fires before guard. However, `trg_assign_*` and `trg_reverse_*` triggers are not explicitly ordered relative to the approval triggers.

- **Current order** (alphabetical): `01_trg_sync...` → `02_trg_enforce...` → `trg_assign_supplier_invoice_company_id` → `trg_assign_supplier_invoice_user_id` → `trg_reverse_supplier_invoice_on_cancel`
- **Problem**: `trg_assign_supplier_invoice_user_id` fires AFTER the approval guard, which checks `auth.uid()`. If user_id is null at the time the guard runs, the guard still works (it checks auth.uid(), not NEW.user_id).
- **Severity**: LOW — the approval guard uses `auth.uid()` not `NEW.user_id`, so ordering is not an issue.

### 4. LOW: Stock Decrement vs Stock Journal Race

When `trg_auto_stock_decrement` fires on `invoice_items` INSERT:
1. It UPDATEs `products.stock_quantity`
2. This triggers `trg_auto_journal_stock_movement` on `products`

Since step 1 is a single UPDATE statement within the trigger function, step 2 fires synchronously within the same transaction. No race condition exists.

### 5. LOW: Client Delete Cascade Depth

Deleting a client cascades through invoices → invoice_items → products (stock restore) → accounting_entries (stock journal + reversal journal). This is a deep cascade (4+ levels) that could be slow for clients with many invoices.

- **Severity**: LOW for data correctness, but HIGH for performance on large datasets.

### 6. INFO: `trg_auto_journal_stock_movement` Changed to Fire on INSERT

Migration `20260308450000` changed `trg_auto_journal_stock_movement` from `AFTER UPDATE` to `AFTER INSERT OR UPDATE`. This means:
- Product creation with initial stock_quantity > 0 will now generate a stock journal entry
- The OLD reference is NULL for INSERT operations — the function handles this with `OLD.stock_quantity IS NOT DISTINCT FROM NEW.stock_quantity` which works correctly (NULL IS DISTINCT FROM non-null = true, so it will fire)

---

## Recommendations

### 1. Consolidate Balance-Check Triggers

`trg_check_balance` (writes to `accounting_balance_checks`) and `trg_check_entry_balance` (writes to `accounting_health`) serve overlapping purposes. Consider:
- Merging them into a single AFTER INSERT trigger to reduce overhead
- Or making them CONSTRAINT INITIALLY DEFERRED triggers so they fire at commit time when all rows of a multi-entry batch exist

### 2. Add WHEN Clauses to Journal Triggers Where Missing

Several AFTER triggers fire on every UPDATE regardless of whether relevant columns changed:
- `trg_auto_journal_invoice` — fires on ALL updates, but only acts on status/payment_status changes. Add: `WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status)`
- `trg_auto_journal_supplier_invoice` — similarly, add WHEN clause for status/payment_status
- `trg_auto_journal_payment_on_update` — fires on all payment updates

Adding WHEN clauses would significantly reduce unnecessary trigger invocations.

### 3. Explicit Trigger Ordering for `supplier_invoices`

While the current alphabetical ordering happens to work, consider adding numeric prefixes to ALL triggers on `supplier_invoices` (not just the approval pair) to make the ordering explicit and resilient to future additions.

### 4. Guard Against Deep Cascade on Client Delete

Consider implementing a maximum cascade depth check or converting the client delete cascade into a batch operation (e.g., an RPC function that processes in chunks) to avoid timeout on clients with thousands of related records.

### 5. Missing UPDATE Trigger on `credit_notes`

`trg_auto_journal_credit_note` fires on INSERT OR UPDATE, but there is no BEFORE UPDATE reversal trigger for credit notes (unlike invoices which have `trg_reverse_journal_invoice_on_cancel`). If a credit note status is reverted from 'issued' to 'draft', the original journal entries remain and no reversal is created.

### 6. Missing Reversal Trigger on `payables` and `receivables` for Status Changes

`trg_reverse_journal_payable_on_delete` and `trg_reverse_journal_receivable_on_delete` only fire on DELETE. There are no BEFORE UPDATE triggers to reverse entries when a payable/receivable status changes (e.g., from active to cancelled). The AFTER UPDATE triggers (`trg_auto_journal_payable`/`trg_auto_journal_receivable`) handle re-journaling by deleting old entries inline, but this pattern is inconsistent with the reversal approach used elsewhere.

### 7. `trg_auto_stock_decrement` Does Not Handle UPDATE on `invoice_items`

If an invoice item's quantity is updated (not deleted and recreated), the stock adjustment is not triggered. The trigger only fires on INSERT and DELETE. Consider adding UPDATE handling or documenting that quantity changes require delete+re-insert.
