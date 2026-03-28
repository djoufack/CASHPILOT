import { describe, expect, it } from 'vitest';
import { buildReplenishmentRecommendations } from '@/services/stockReplenishmentRecommendations';

describe('stockReplenishmentRecommendations', () => {
  it('computes critical recommendation from observed demand velocity', () => {
    const products = [
      {
        id: 'prod-1',
        product_name: 'Widget A',
        sku: 'WID-001',
        stock_quantity: 3,
        min_stock_level: 10,
        purchase_price: 9,
        inventory_tracking_enabled: true,
        abcClass: 'A',
        supplier: { company_name: 'WidgetCo' },
      },
    ];

    const historyEntries = [
      { product_id: 'prod-1', change_quantity: -4, created_at: '2026-03-20T08:00:00.000Z' },
      { product_id: 'prod-1', change_quantity: -5, created_at: '2026-03-23T08:00:00.000Z' },
      { product_id: 'prod-1', change_quantity: -5, created_at: '2026-03-26T08:00:00.000Z' },
    ];

    const dashboard = buildReplenishmentRecommendations({
      products,
      historyEntries,
      supplierOrderItems: [],
      referenceDate: '2026-03-27T00:00:00.000Z',
    });

    expect(dashboard.recommendations).toHaveLength(1);
    const recommendation = dashboard.recommendations[0];
    expect(recommendation.productId).toBe('prod-1');
    expect(recommendation.priority).toBe('critical');
    expect(recommendation.reorderQuantity).toBeGreaterThan(0);
    expect(recommendation.suggestedOrderDate).toBe('2026-03-27');
    expect(recommendation.nextAction).toMatch(/Commander aujourd'hui/i);
    expect(dashboard.summary.criticalCount).toBe(1);
    expect(dashboard.summary.totalOrderValue).toBeCloseTo(recommendation.recommendedOrderValue, 4);
  });

  it('falls back to minimum gap and supplier unit price when demand history is missing', () => {
    const products = [
      {
        id: 'prod-2',
        product_name: 'Gadget B',
        stock_quantity: 2,
        min_stock_level: 5,
        purchase_price: 0,
        inventory_tracking_enabled: true,
        abcClass: 'C',
      },
    ];

    const supplierOrderItems = [{ user_product_id: 'prod-2', quantity: 10, unit_price: 7 }];

    const dashboard = buildReplenishmentRecommendations({
      products,
      historyEntries: [],
      supplierOrderItems,
      referenceDate: '2026-03-27T00:00:00.000Z',
    });

    expect(dashboard.recommendations).toHaveLength(1);
    const recommendation = dashboard.recommendations[0];
    expect(recommendation.reorderQuantity).toBe(3);
    expect(recommendation.recommendedOrderValue).toBe(21);
    expect(recommendation.priority).toBe('high');
    expect(recommendation.suggestedOrderDate).toBe('2026-03-27');
  });
});
