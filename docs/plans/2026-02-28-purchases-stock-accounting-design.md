# Design: Gestionnaire des Achats + Stock + Comptabilite temps reel

**Date**: 2026-02-28
**Status**: Approved

## Context

CashPilot possede des tables `supplier_orders` / `supplier_order_items` et un systeme de stock complet (`products`, `product_stock_history`, `stock_alerts`) mais:
- Aucune page UI pour gerer les commandes fournisseurs (achats)
- Aucun lien entre reception d'une commande et mise a jour du stock
- Aucune ecriture comptable sur les achats / variations de stock
- Les triggers comptables (migration 044) couvrent invoices, payments, expenses, supplier_invoices, credit_notes — mais PAS les commandes fournisseurs

## Approach

**Approche A — Migration SQL + Page React unique** (approuvee)

Logique metier dans un trigger SQL sur `supplier_orders`. Quand `order_status` passe a `received`:
1. Incremente `products.stock_quantity` pour chaque item
2. Insere dans `product_stock_history`
3. Genere les ecritures comptables

Frontend: une seule nouvelle page `PurchasesPage.jsx` basee sur le hook `useSupplierOrders` existant.

## Flow

```
Commande fournisseur          Reception              Stock            Comptabilite
     (draft)        ->  (confirmed)  ->  (received)  ->  +qty  ->  ecritures auto
                                          |                      |
                                   product_stock_history    accounting_entries
                                          |                 (via trigger SQL)
                                     stock_alerts
                                    (si qty < min)
```

## Database Schema

### Existing tables (no changes)

- `supplier_orders`: id, supplier_id, user_id, order_number, order_date, expected_delivery_date, actual_delivery_date, order_status, total_amount
- `supplier_order_items`: id, order_id, product_id (-> supplier_products), quantity, unit_price, total_price
- `products`: id, user_id, product_name, stock_quantity, purchase_price, supplier_id, min_stock_level
- `product_stock_history`: id, product_id, user_product_id, previous_quantity, new_quantity, change_quantity, reason, notes, order_id, created_by

### New column

Add `user_product_id UUID REFERENCES products(id)` on `supplier_order_items` — links a supplier order item to a user's stock product.

### Migration 045: `045_auto_stock_and_purchase_journal.sql`

**A. Column**: `ALTER TABLE supplier_order_items ADD COLUMN IF NOT EXISTS user_product_id UUID REFERENCES products(id)`

**B. Trigger**: `trg_supplier_order_received` AFTER UPDATE on `supplier_orders`

When `order_status` changes to `'received'`:
1. Check `auto_journal_enabled` flag — skip if false
2. Idempotency: skip if accounting_entries already exist for this order
3. For each item with `user_product_id IS NOT NULL`:
   - UPDATE `products SET stock_quantity = stock_quantity + item.quantity`
   - INSERT `product_stock_history` (reason: `purchase_received`, order_id)
   - Check min threshold -> INSERT `stock_alerts` + `notifications` if needed
4. Generate accounting entries (entry_ref: `CF-{order_number}`):
   - **Debit** 601/380 (achats/stock) for total_amount
   - **Credit** 401/440 (fournisseur) for total_amount
   - Journal: `AC` (achats)

## UI: PurchasesPage.jsx

Route: `/app/purchases`

### Main view
- Table of supplier orders: order number, supplier name, date, expected delivery, status, total
- Filters: by status, by supplier, text search
- Color badges: draft (gray), confirmed (blue), received (green), cancelled (red)

### Create order dialog
- Select supplier (from `suppliers`)
- Add items from `supplier_products` of selected supplier
- For each item: optional "Stock product" select (maps to `user_product_id` in `products`)
- Auto-calculated total

### "Mark received" action
- Button on each confirmed order
- Sets `order_status = 'received'` + `actual_delivery_date = now()`
- SQL trigger handles stock + accounting automatically
- Toast confirmation

### Stock indicators (top of page)
- Active stock alerts count
- Link to Stock Management page
- Last auto-generated accounting entry

## Sidebar

Add in "Fournisseurs" category:
```js
{ path: '/app/purchases', label: 'Achats', icon: ShoppingCart }
```

## Files to create/modify

| File | Action |
|------|--------|
| `supabase/migrations/045_auto_stock_and_purchase_journal.sql` | CREATE — trigger + column |
| `src/pages/PurchasesPage.jsx` | CREATE — full page |
| `src/components/Sidebar.jsx` | EDIT — add Achats link |
| `src/App.jsx` | EDIT — add route `/app/purchases` |
| `src/i18n/locales/fr.json` | EDIT — purchases i18n keys |
| `src/i18n/locales/en.json` | EDIT — purchases i18n keys |
| `src/services/accountingInitService.js` | EDIT — add supplier_order mapping |

No modifications to existing hooks (`useSupplierOrders`, `useProducts`, `useStockHistory`).

## Safety

1. `auto_journal_enabled` flag checked first in trigger
2. Idempotent — checks existing entries before insert
3. `user_product_id` is optional — items without it skip stock update
4. `is_auto = true` on all auto-generated entries
5. `DROP TRIGGER IF EXISTS` + `CREATE OR REPLACE FUNCTION` — safe to re-run
