import { describe, expect, it } from 'vitest';
import { buildStockValuationDashboard } from '@/services/stockValuationAnalytics';

describe('stockValuationAnalytics', () => {
  it('computes FIFO/CMUP inventory and COGS from inbound/outbound movements', () => {
    const products = [
      {
        id: 'prod-1',
        product_name: 'Widget A',
        stock_quantity: 8,
        purchase_price: 11,
        unit_price: 20,
        inventory_tracking_enabled: true,
      },
    ];

    const historyEntries = [
      {
        product_id: 'prod-1',
        user_product_id: 'prod-1',
        change_quantity: 10,
        reason: 'purchase_received',
        order_id: 'order-1',
        created_at: '2026-01-01T10:00:00.000Z',
      },
      {
        product_id: 'prod-1',
        user_product_id: 'prod-1',
        change_quantity: -6,
        reason: 'sale',
        created_at: '2026-01-10T10:00:00.000Z',
      },
      {
        product_id: 'prod-1',
        user_product_id: 'prod-1',
        change_quantity: 5,
        reason: 'purchase_received',
        order_id: 'order-2',
        created_at: '2026-01-20T10:00:00.000Z',
      },
      {
        product_id: 'prod-1',
        user_product_id: 'prod-1',
        change_quantity: -1,
        reason: 'sale',
        created_at: '2026-01-25T10:00:00.000Z',
      },
    ];

    const supplierOrderItems = [
      { order_id: 'order-1', user_product_id: 'prod-1', quantity: 10, unit_price: 10 },
      { order_id: 'order-2', user_product_id: 'prod-1', quantity: 5, unit_price: 12 },
    ];

    const dashboard = buildStockValuationDashboard({ products, historyEntries, supplierOrderItems });
    const row = dashboard.rows[0];

    expect(dashboard.rows).toHaveLength(1);
    expect(row.productId).toBe('prod-1');
    expect(row.soldQuantity).toBeCloseTo(7, 6);
    expect(row.fifoInventoryValue).toBeCloseTo(90, 6);
    expect(row.cmupInventoryValue).toBeCloseTo(88.8889, 3);
    expect(row.fifoCogs).toBeCloseTo(70, 6);
    expect(row.cmupCogs).toBeCloseTo(71.1111, 3);
    expect(dashboard.summary.totalInventoryFifo).toBeCloseTo(90, 6);
    expect(dashboard.summary.totalInventoryCmup).toBeCloseTo(88.8889, 3);
  });

  it('uses opening stock fallback when no movement history exists', () => {
    const products = [
      {
        id: 'prod-2',
        product_name: 'Gadget B',
        stock_quantity: 5,
        purchase_price: 42,
        unit_price: 60,
        inventory_tracking_enabled: true,
      },
    ];

    const dashboard = buildStockValuationDashboard({
      products,
      historyEntries: [],
      supplierOrderItems: [],
    });

    const row = dashboard.rows[0];
    expect(row.fifoInventoryValue).toBeCloseTo(210, 6);
    expect(row.cmupInventoryValue).toBeCloseTo(210, 6);
    expect(row.fifoCogs).toBe(0);
    expect(row.cmupCogs).toBe(0);
  });
});
