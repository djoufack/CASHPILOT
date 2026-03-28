const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const buildWarehouseLotSummary = ({ warehouses = [], lots = [] } = {}) => {
  const normalizedWarehouses = Array.isArray(warehouses) ? warehouses : [];
  const normalizedLots = Array.isArray(lots) ? lots : [];

  const byWarehouse = normalizedWarehouses
    .map((warehouse) => {
      const warehouseLots = normalizedLots.filter((lot) => lot.warehouse_id === warehouse.id);
      const quantity = warehouseLots.reduce((sum, lot) => sum + Math.max(0, toNumber(lot.quantity, 0)), 0);
      const serialTrackedCount = warehouseLots.filter(
        (lot) => String(lot.serial_number || '').trim().length > 0
      ).length;
      const activeLotsCount = warehouseLots.filter((lot) => String(lot.status || 'active') !== 'consumed').length;

      return {
        warehouseId: warehouse.id,
        warehouseCode: warehouse.warehouse_code || '',
        warehouseName: warehouse.warehouse_name || 'Entrepot',
        quantity,
        serialTrackedCount,
        activeLotsCount,
      };
    })
    .sort((a, b) => b.quantity - a.quantity);

  const totalQuantity = normalizedLots.reduce((sum, lot) => sum + Math.max(0, toNumber(lot.quantity, 0)), 0);
  const totalSerialTrackedLots = normalizedLots.filter(
    (lot) => String(lot.serial_number || '').trim().length > 0
  ).length;
  const totalActiveLots = normalizedLots.filter((lot) => String(lot.status || 'active') !== 'consumed').length;

  return {
    totalWarehouses: normalizedWarehouses.length,
    totalLots: normalizedLots.length,
    totalQuantity,
    totalSerialTrackedLots,
    totalActiveLots,
    byWarehouse,
  };
};
