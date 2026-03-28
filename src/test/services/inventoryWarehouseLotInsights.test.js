import { describe, expect, it } from 'vitest';
import { buildWarehouseLotSummary } from '@/services/inventoryWarehouseLotInsights';

describe('inventoryWarehouseLotInsights', () => {
  it('aggregates lots and serial coverage by warehouse', () => {
    const warehouses = [
      { id: 'w-main', warehouse_code: 'MAIN', warehouse_name: 'Entrepot principal' },
      { id: 'w-sec', warehouse_code: 'SEC', warehouse_name: 'Entrepot secondaire' },
    ];

    const lots = [
      { id: 'l-1', warehouse_id: 'w-main', quantity: 12, serial_number: null, status: 'active' },
      { id: 'l-2', warehouse_id: 'w-main', quantity: 3, serial_number: 'SN-001', status: 'reserved' },
      { id: 'l-3', warehouse_id: 'w-sec', quantity: 5, serial_number: 'SN-002', status: 'active' },
    ];

    const summary = buildWarehouseLotSummary({ warehouses, lots });

    expect(summary.totalWarehouses).toBe(2);
    expect(summary.totalLots).toBe(3);
    expect(summary.totalSerialTrackedLots).toBe(2);
    expect(summary.totalQuantity).toBeCloseTo(20, 6);
    expect(summary.byWarehouse).toHaveLength(2);
    expect(summary.byWarehouse[0].warehouseId).toBe('w-main');
    expect(summary.byWarehouse[0].quantity).toBeCloseTo(15, 6);
  });
});
