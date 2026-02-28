# Purchases + Stock + Accounting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Purchases page that manages supplier orders, auto-updates stock on reception, and generates accounting entries in real-time.

**Architecture:** SQL trigger on `supplier_orders` handles stock increment + accounting entries when `order_status` changes to `received`. New React page reuses existing `useSupplierOrders` hook. New column `user_product_id` on `supplier_order_items` links supplier items to user stock products.

**Tech Stack:** PostgreSQL triggers, React 18, Supabase, Tailwind CSS, i18next

---

## Task 1: SQL Migration — Column + Trigger

**Files:**
- Create: `supabase/migrations/045_auto_stock_and_purchase_journal.sql`

**Step 1: Create the migration file**

```sql
-- ============================================================================
-- Migration 045: Auto Stock Update + Purchase Journal
-- When a supplier order is marked "received":
--   1. Update product stock quantities
--   2. Log stock history
--   3. Generate stock alerts if needed
--   4. Create accounting entries (behind auto_journal_enabled flag)
-- ============================================================================

-- ============================================================================
-- A. New column: link supplier_order_items to user products
-- ============================================================================

ALTER TABLE supplier_order_items
ADD COLUMN IF NOT EXISTS user_product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_soi_user_product_id ON supplier_order_items(user_product_id);

-- ============================================================================
-- B. Trigger function: auto_stock_and_journal_on_received
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_stock_and_journal_on_received()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_prev_qty NUMERIC;
  v_new_qty NUMERIC;
  v_auto_enabled BOOLEAN;
  v_debit_code TEXT;
  v_credit_code TEXT;
  v_entry_ref TEXT;
  v_product RECORD;
BEGIN
  -- Only fire when order_status changes TO 'received'
  IF NEW.order_status IS DISTINCT FROM 'received' THEN
    RETURN NEW;
  END IF;
  IF OLD.order_status IS NOT DISTINCT FROM 'received' THEN
    RETURN NEW; -- already received, skip
  END IF;

  -- Set actual delivery date if not already set
  IF NEW.actual_delivery_date IS NULL THEN
    NEW.actual_delivery_date := CURRENT_DATE;
  END IF;

  -- ========================================
  -- PART 1: Stock updates (always runs)
  -- ========================================
  FOR v_item IN
    SELECT soi.*, sp.product_name AS supplier_product_name
    FROM supplier_order_items soi
    LEFT JOIN supplier_products sp ON sp.id = soi.product_id
    WHERE soi.order_id = NEW.id
      AND soi.user_product_id IS NOT NULL
  LOOP
    -- Get current stock
    SELECT stock_quantity, product_name, min_stock_level
    INTO v_product
    FROM products
    WHERE id = v_item.user_product_id;

    IF NOT FOUND THEN
      CONTINUE; -- product deleted, skip
    END IF;

    v_prev_qty := COALESCE(v_product.stock_quantity, 0);
    v_new_qty := v_prev_qty + COALESCE(v_item.quantity, 0);

    -- 1a. Update product stock
    UPDATE products
    SET stock_quantity = v_new_qty,
        updated_at = now()
    WHERE id = v_item.user_product_id;

    -- 1b. Insert stock history
    INSERT INTO product_stock_history (
      product_id, user_product_id,
      previous_quantity, new_quantity, change_quantity,
      reason, notes, order_id, created_by, created_at
    ) VALUES (
      v_item.user_product_id, v_item.user_product_id,
      v_prev_qty, v_new_qty, COALESCE(v_item.quantity, 0),
      'purchase_received',
      'Auto: commande fournisseur ' || COALESCE(NEW.order_number, NEW.id::text),
      NEW.id, NEW.user_id, now()
    );

    -- 1c. Check stock alerts
    IF v_new_qty <= COALESCE(v_product.min_stock_level, 0) THEN
      INSERT INTO stock_alerts (
        product_id, user_product_id, alert_type, is_active
      ) VALUES (
        v_item.user_product_id, v_item.user_product_id,
        CASE WHEN v_new_qty = 0 THEN 'out_of_stock' ELSE 'low_stock' END,
        true
      );

      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (
        NEW.user_id, 'stock_alert',
        'Alerte Stock : ' || COALESCE(v_product.product_name, 'Produit'),
        'Niveau de stock : ' || v_new_qty || ' (Min : ' || COALESCE(v_product.min_stock_level, 0) || ')',
        v_item.user_product_id
      );
    ELSE
      -- Resolve any active low_stock alerts for this product (stock replenished)
      UPDATE stock_alerts
      SET is_active = false, resolved_at = now()
      WHERE user_product_id = v_item.user_product_id
        AND is_active = true
        AND alert_type IN ('low_stock', 'out_of_stock');
    END IF;
  END LOOP;

  -- ========================================
  -- PART 2: Accounting entries (only if enabled)
  -- ========================================
  SELECT COALESCE(auto_journal_enabled, false)
  INTO v_auto_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF NOT COALESCE(v_auto_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Idempotency: skip if already journalized
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE user_id = NEW.user_id
      AND source_type = 'supplier_order'
      AND source_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Skip if zero amount
  IF COALESCE(NEW.total_amount, 0) = 0 THEN
    RETURN NEW;
  END IF;

  v_entry_ref := 'CF-' || COALESCE(NEW.order_number, LEFT(NEW.id::text, 8));

  -- Get mapping for supplier_order
  SELECT debit_account_code, credit_account_code
  INTO v_debit_code, v_credit_code
  FROM accounting_mappings
  WHERE user_id = NEW.user_id
    AND source_type = 'supplier_order'
    AND source_category = 'merchandise'
  LIMIT 1;

  -- Fallback to defaults
  v_debit_code := COALESCE(v_debit_code, '601');
  v_credit_code := COALESCE(v_credit_code, '401');

  -- Debit: Achats/Stock
  INSERT INTO accounting_entries (
    user_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, COALESCE(NEW.actual_delivery_date, CURRENT_DATE),
    v_debit_code, NEW.total_amount, 0,
    'supplier_order', NEW.id, 'AC', v_entry_ref, true,
    'Achat fournisseur ' || COALESCE(NEW.order_number, '')
  );

  -- Credit: Fournisseur
  INSERT INTO accounting_entries (
    user_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, COALESCE(NEW.actual_delivery_date, CURRENT_DATE),
    v_credit_code, 0, NEW.total_amount,
    'supplier_order', NEW.id, 'AC', v_entry_ref, true,
    'Achat fournisseur ' || COALESCE(NEW.order_number, '')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- C. Create trigger
-- ============================================================================

DROP TRIGGER IF EXISTS trg_supplier_order_received ON supplier_orders;
CREATE TRIGGER trg_supplier_order_received
  BEFORE UPDATE ON supplier_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_stock_and_journal_on_received();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION auto_stock_and_journal_on_received() IS
'When supplier_orders.order_status changes to received: updates product stock, logs history, checks alerts, and generates accounting entries (if auto_journal_enabled).';
```

**Step 2: Verify syntax**

Run: `npx vite build`
Expected: Build succeeds (SQL file is not compiled, but ensures nothing else broke).

**Step 3: Commit**

```bash
git add supabase/migrations/045_auto_stock_and_purchase_journal.sql
git commit -m "feat(db): trigger for auto stock update + purchase journal on supplier order received"
```

---

## Task 2: Accounting Init Mappings — supplier_order

**Files:**
- Modify: `src/services/accountingInitService.js`

**Step 1: Add supplier_order mappings**

In `getDefaultMappings(country)`, add after the `stock_variation` section for each country:

**OHADA block** (after line ~305, after TVA):
```js
// ---- Achats fournisseurs (commandes) ----
{ source_type: 'supplier_order', source_category: 'merchandise', debit_account_code: '601', credit_account_code: '401', description: 'Achat de marchandises sur commande fournisseur' },
```

**FR block** (after line ~357, after TVA):
```js
// ---- Achats fournisseurs (commandes) ----
{ source_type: 'supplier_order', source_category: 'merchandise', debit_account_code: '607', credit_account_code: '401', description: 'Achat de marchandises sur commande fournisseur' },
```

**BE block** (after line ~407, after TVA):
```js
// ---- Achats fournisseurs (commandes) ----
{ source_type: 'supplier_order', source_category: 'merchandise', debit_account_code: '604', credit_account_code: '440', description: 'Achat de marchandises sur commande fournisseur' },
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: 280 tests pass.

**Step 3: Commit**

```bash
git add src/services/accountingInitService.js
git commit -m "feat(accounting): add supplier_order purchase mappings for OHADA/FR/BE"
```

---

## Task 3: i18n Keys — Purchases

**Files:**
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/en.json`

**Step 1: Add French keys**

Add a `"purchases"` section in `fr.json`:

```json
"purchases": {
  "title": "Achats Fournisseurs",
  "newOrder": "Nouvelle commande",
  "orderNumber": "N° Commande",
  "supplier": "Fournisseur",
  "orderDate": "Date commande",
  "expectedDelivery": "Livraison prevue",
  "actualDelivery": "Livraison effective",
  "status": "Statut",
  "totalAmount": "Montant total",
  "items": "Articles",
  "addItem": "Ajouter un article",
  "selectSupplier": "Selectionner un fournisseur",
  "selectProduct": "Selectionner un produit",
  "stockProduct": "Produit stock (optionnel)",
  "stockProductHelp": "Relier a votre stock pour mise a jour automatique a reception",
  "quantity": "Quantite",
  "unitPrice": "Prix unitaire",
  "totalPrice": "Prix total",
  "markReceived": "Marquer recu",
  "markConfirmed": "Confirmer",
  "cancel": "Annuler",
  "confirmReceive": "Confirmer la reception ?",
  "confirmReceiveDesc": "Le stock sera automatiquement mis a jour et les ecritures comptables generees.",
  "received": "Recu",
  "confirmed": "Confirme",
  "draft": "Brouillon",
  "cancelled": "Annule",
  "pending": "En attente",
  "stockAlerts": "Alertes stock actives",
  "noOrders": "Aucune commande fournisseur",
  "noOrdersDesc": "Creez votre premiere commande pour commencer",
  "orderCreated": "Commande creee avec succes",
  "orderReceived": "Commande recue — stock et comptabilite mis a jour",
  "searchPlaceholder": "Rechercher par numero, fournisseur..."
}
```

**Step 2: Add English keys**

Add a `"purchases"` section in `en.json`:

```json
"purchases": {
  "title": "Supplier Purchases",
  "newOrder": "New Order",
  "orderNumber": "Order #",
  "supplier": "Supplier",
  "orderDate": "Order Date",
  "expectedDelivery": "Expected Delivery",
  "actualDelivery": "Actual Delivery",
  "status": "Status",
  "totalAmount": "Total Amount",
  "items": "Items",
  "addItem": "Add item",
  "selectSupplier": "Select a supplier",
  "selectProduct": "Select a product",
  "stockProduct": "Stock product (optional)",
  "stockProductHelp": "Link to your stock for automatic update on reception",
  "quantity": "Quantity",
  "unitPrice": "Unit Price",
  "totalPrice": "Total Price",
  "markReceived": "Mark Received",
  "markConfirmed": "Confirm",
  "cancel": "Cancel",
  "confirmReceive": "Confirm reception?",
  "confirmReceiveDesc": "Stock will be automatically updated and accounting entries generated.",
  "received": "Received",
  "confirmed": "Confirmed",
  "draft": "Draft",
  "cancelled": "Cancelled",
  "pending": "Pending",
  "stockAlerts": "Active stock alerts",
  "noOrders": "No supplier orders",
  "noOrdersDesc": "Create your first order to get started",
  "orderCreated": "Order created successfully",
  "orderReceived": "Order received — stock and accounting updated",
  "searchPlaceholder": "Search by number, supplier..."
}
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: 280 tests pass.

**Step 4: Commit**

```bash
git add src/i18n/locales/fr.json src/i18n/locales/en.json
git commit -m "feat(i18n): add purchases section keys for FR and EN"
```

---

## Task 4: PurchasesPage.jsx — Full Page

**Files:**
- Create: `src/pages/PurchasesPage.jsx`

**Context for the implementer:**
- Use `useSupplierOrders` hook (at `src/hooks/useSupplierOrders.js`) — provides `orders, fetchOrders, createOrder, updateOrderStatus, deleteOrder, fetchOrderById`
- Use `useSuppliers` hook (at `src/hooks/useSuppliers.js`) — provides `suppliers`
- Use `useSupplierProducts(supplierId)` hook — provides `products` for selected supplier
- Use `useProducts` hook — provides user's own stock `products` for the `user_product_id` mapping
- Use `useStockAlerts` from `src/hooks/useStockHistory.js` — provides `alerts, fetchAlerts`
- Use `useCompany` hook — provides `company` for currency
- Follow the exact same UI patterns as `PurchaseOrdersPage.jsx` (glassmorphism cards, same component library)
- i18n keys from Task 3: `t('purchases.xxx')`

**Step 1: Create the page**

The page must include:

1. **Header**: Title "Achats Fournisseurs" + "Nouvelle commande" button + stock alerts badge
2. **Filters bar**: Search input + status filter (Select) + supplier filter (Select)
3. **Orders table**: Columns — order_number, supplier.company_name, order_date, expected_delivery_date, order_status (Badge), total_amount. Row actions: View details, Mark confirmed, Mark received, Delete.
4. **Create order dialog**: Select supplier → loads supplier_products → add items with quantity/price → optional user_product_id mapping → auto-total → create
5. **Receive confirmation dialog**: When clicking "Mark received", show AlertDialog explaining stock + accounting will be updated. On confirm, call `updateOrderStatus(id, 'received')` which also sets `actual_delivery_date`.

**Key implementation details:**
- `updateOrderStatus` in the hook currently only updates `order_status`. For the "received" action, the page must call supabase directly to update both `order_status` AND `actual_delivery_date` in one call, so the BEFORE UPDATE trigger fires correctly:

```js
const markAsReceived = async (orderId) => {
  const { error } = await supabase
    .from('supplier_orders')
    .update({
      order_status: 'received',
      actual_delivery_date: new Date().toISOString().split('T')[0]
    })
    .eq('id', orderId);
  if (error) throw error;
  fetchOrders(); // refresh list
};
```

- For the create dialog, when user selects a supplier, load supplier_products via:
```js
const { products: supplierProducts } = useSupplierProducts(selectedSupplierId);
```
But since `useSupplierProducts` takes supplierId as param at init, you need dynamic fetching. Instead, fetch directly:
```js
const fetchSupplierProducts = async (supplierId) => {
  const { data } = await supabase
    .from('supplier_products')
    .select('id, product_name, unit_price, unit, sku')
    .eq('supplier_id', supplierId)
    .order('product_name');
  return data || [];
};
```

- For user stock product mapping, load user's products:
```js
const { products: userProducts } = useProducts();
```

- Status badge colors:
  - `draft` / `pending`: `bg-gray-500/20 text-gray-400`
  - `confirmed`: `bg-blue-500/20 text-blue-400`
  - `received` / `delivered`: `bg-green-500/20 text-green-400`
  - `cancelled`: `bg-red-500/20 text-red-400`

- Use pagination: `usePagination` from `src/hooks/usePagination.js` + `PaginationControls`
- Use `formatCurrency` from `src/utils/calculations.js`
- Use `getCurrencySymbol` from `src/utils/currencyService.js`
- Use `CreditsGuardModal` + `useCreditsGuard` for credit-gated actions

**Step 2: Run build to verify**

Run: `npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/pages/PurchasesPage.jsx
git commit -m "feat: PurchasesPage — supplier order management with stock + accounting integration"
```

---

## Task 5: Route + Sidebar + Lazy Import

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/Sidebar.jsx`

**Step 1: Add lazy import in App.jsx**

After line 75 (`const PeppolGuidePage = ...`), add:
```js
const PurchasesPage = lazyRetry(() => import('./pages/PurchasesPage'));
```

**Step 2: Add route in App.jsx**

After the `purchase-orders` route (line 159), add:
```jsx
<Route path="purchases" element={<Suspense fallback={<PageLoader />}><PurchasesPage /></Suspense>} />
```

**Step 3: Add sidebar link in Sidebar.jsx**

In the `suppliers` category (line 73-81), add before `suppliers/map`:
```js
{ path: '/app/purchases', label: t('purchases.title') || 'Achats', icon: ShoppingCart },
```

Import `ShoppingCart` from lucide-react (add to the existing import on line 12).

**Step 4: Run build**

Run: `npx vite build`
Expected: Build succeeds.

**Step 5: Run tests**

Run: `npx vitest run`
Expected: 280 tests pass.

**Step 6: Commit**

```bash
git add src/App.jsx src/components/Sidebar.jsx
git commit -m "feat: add /app/purchases route and sidebar navigation"
```

---

## Task 6: Final Build + Tests + Push

**Step 1: Full test run**

Run: `npx vitest run`
Expected: All tests pass.

**Step 2: Production build**

Run: `npx vite build`
Expected: Build succeeds.

**Step 3: Commit all (if any unstaged)**

```bash
git add -A
git commit -m "feat: purchases manager with auto stock + accounting — complete"
```

**Step 4: Push and deploy**

```bash
git push origin main
```

Vercel auto-deploys from main.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | SQL migration: column + trigger | `supabase/migrations/045_auto_stock_and_purchase_journal.sql` |
| 2 | Accounting mappings for supplier_order | `src/services/accountingInitService.js` |
| 3 | i18n keys FR + EN | `src/i18n/locales/{fr,en}.json` |
| 4 | PurchasesPage.jsx (full page) | `src/pages/PurchasesPage.jsx` |
| 5 | Route + Sidebar + lazy import | `src/App.jsx`, `src/components/Sidebar.jsx` |
| 6 | Build + Tests + Push | — |

**Parallel execution:** Tasks 1, 2, 3 are fully independent. Task 4 depends on i18n keys (Task 3). Task 5 depends on Task 4. Task 6 depends on all.

**Agent assignment:**
- Agent 1 (SQL): Task 1
- Agent 2 (Frontend): Tasks 2 + 3
- Agent 3 (UI): Task 4 (after Task 3 completes)
- Lead: Task 5 + Task 6
