const EPSILON = 1e-9;

const SALE_REASONS = new Set(['sale']);

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getEntryProductId = (entry) => entry?.product_id || entry?.user_product_id || null;

const resolveFallbackUnitCost = (product) => {
  const purchasePrice = toNumber(product?.purchase_price, 0);
  if (purchasePrice > 0) return purchasePrice;

  const unitPrice = toNumber(product?.unit_price, 0);
  if (unitPrice > 0) return unitPrice;

  return 0;
};

const orderCostKey = (orderId, productId) => `${orderId || ''}::${productId || ''}`;

const buildInboundOrderCostMap = (supplierOrderItems = []) => {
  const pool = new Map();

  for (const item of supplierOrderItems) {
    const productId = item?.user_product_id || item?.product_id || null;
    const orderId = item?.order_id || null;
    if (!orderId || !productId) continue;

    const quantity = Math.max(0, toNumber(item.quantity, 0));
    if (quantity <= 0) continue;

    const unitCost = Math.max(0, toNumber(item.unit_price, 0));
    const key = orderCostKey(orderId, productId);
    const current = pool.get(key) || { quantity: 0, totalCost: 0 };
    current.quantity += quantity;
    current.totalCost += quantity * unitCost;
    pool.set(key, current);
  }

  const costs = new Map();
  for (const [key, aggregate] of pool.entries()) {
    if (aggregate.quantity > 0) {
      costs.set(key, aggregate.totalCost / aggregate.quantity);
    }
  }

  return costs;
};

const deriveOpeningQuantity = (product, movements) => {
  const currentStock = Math.max(0, toNumber(product?.stock_quantity, 0));
  const netMovement = movements.reduce((sum, movement) => sum + movement.changeQuantity, 0);
  return Math.max(0, currentStock - netMovement);
};

const consumeFifoLayers = (layers, quantity, fallbackUnitCost) => {
  let remaining = quantity;
  let consumedCost = 0;

  while (remaining > EPSILON && layers.length > 0) {
    const layer = layers[0];
    const take = Math.min(remaining, layer.quantity);
    consumedCost += take * layer.unitCost;
    layer.quantity -= take;
    remaining -= take;

    if (layer.quantity <= EPSILON) {
      layers.shift();
    }
  }

  if (remaining > EPSILON) {
    consumedCost += remaining * fallbackUnitCost;
  }

  return consumedCost;
};

const normalizeMovements = (historyEntries = [], productId) => {
  return historyEntries
    .filter((entry) => getEntryProductId(entry) === productId)
    .map((entry) => ({
      id: entry.id || null,
      createdAt: entry.created_at ? new Date(entry.created_at).getTime() : 0,
      changeQuantity: toNumber(entry.change_quantity, 0),
      reason: String(entry.reason || '')
        .trim()
        .toLowerCase(),
      orderId: entry.order_id || null,
      productId,
    }))
    .filter((entry) => Math.abs(entry.changeQuantity) > EPSILON)
    .sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
};

const buildProductValuationRow = ({ product, movements, inboundOrderCosts }) => {
  const fallbackUnitCost = resolveFallbackUnitCost(product);
  const openingQuantity = deriveOpeningQuantity(product, movements);

  const fifoLayers = openingQuantity > EPSILON ? [{ quantity: openingQuantity, unitCost: fallbackUnitCost }] : [];
  let cmupQuantity = openingQuantity;
  let cmupCostPool = openingQuantity * fallbackUnitCost;

  let soldQuantity = 0;
  let fifoCogs = 0;
  let cmupCogs = 0;

  for (const movement of movements) {
    if (movement.changeQuantity > EPSILON) {
      const inboundQty = movement.changeQuantity;
      const inferredInboundCost =
        movement.reason === 'purchase_received' && movement.orderId
          ? inboundOrderCosts.get(orderCostKey(movement.orderId, movement.productId))
          : null;
      const inboundUnitCost = Math.max(0, toNumber(inferredInboundCost, fallbackUnitCost));

      fifoLayers.push({ quantity: inboundQty, unitCost: inboundUnitCost });
      cmupQuantity += inboundQty;
      cmupCostPool += inboundQty * inboundUnitCost;
      continue;
    }

    if (movement.changeQuantity < -EPSILON) {
      const outboundQty = Math.abs(movement.changeQuantity);
      const fifoCost = consumeFifoLayers(fifoLayers, outboundQty, fallbackUnitCost);
      const cmupUnitCost = cmupQuantity > EPSILON ? cmupCostPool / cmupQuantity : fallbackUnitCost;
      const cmupCost = outboundQty * cmupUnitCost;

      cmupQuantity = Math.max(0, cmupQuantity - outboundQty);
      cmupCostPool = Math.max(0, cmupCostPool - cmupCost);

      if (SALE_REASONS.has(movement.reason)) {
        soldQuantity += outboundQty;
        fifoCogs += fifoCost;
        cmupCogs += cmupCost;
      }
    }
  }

  const fifoInventoryValue = fifoLayers.reduce((sum, layer) => sum + layer.quantity * layer.unitCost, 0);
  const cmupInventoryValue = cmupQuantity > EPSILON ? cmupCostPool : 0;
  const currentStock = Math.max(0, toNumber(product.stock_quantity, 0));
  const estimatedRevenue = soldQuantity * Math.max(0, toNumber(product.unit_price, 0));

  return {
    productId: product.id,
    productName: product.product_name || 'Produit',
    sku: product.sku || '',
    stockQuantity: currentStock,
    soldQuantity,
    fifoInventoryValue,
    cmupInventoryValue,
    valuationGap: fifoInventoryValue - cmupInventoryValue,
    fifoCogs,
    cmupCogs,
    fifoUnitCost: currentStock > EPSILON ? fifoInventoryValue / currentStock : 0,
    cmupUnitCost: currentStock > EPSILON ? cmupInventoryValue / currentStock : 0,
    estimatedRevenue,
    fifoGrossMargin: estimatedRevenue - fifoCogs,
    cmupGrossMargin: estimatedRevenue - cmupCogs,
  };
};

export const buildStockValuationDashboard = ({ products = [], historyEntries = [], supplierOrderItems = [] } = {}) => {
  const trackedProducts = products.filter((product) => product?.inventory_tracking_enabled !== false);
  const inboundOrderCosts = buildInboundOrderCostMap(supplierOrderItems);

  const rows = trackedProducts
    .map((product) => {
      const movements = normalizeMovements(historyEntries, product.id);
      return buildProductValuationRow({ product, movements, inboundOrderCosts });
    })
    .sort((a, b) => b.fifoCogs - a.fifoCogs);

  const summary = rows.reduce(
    (accumulator, row) => ({
      totalInventoryFifo: accumulator.totalInventoryFifo + row.fifoInventoryValue,
      totalInventoryCmup: accumulator.totalInventoryCmup + row.cmupInventoryValue,
      totalFifoCogs: accumulator.totalFifoCogs + row.fifoCogs,
      totalCmupCogs: accumulator.totalCmupCogs + row.cmupCogs,
      totalEstimatedRevenue: accumulator.totalEstimatedRevenue + row.estimatedRevenue,
      totalFifoGrossMargin: accumulator.totalFifoGrossMargin + row.fifoGrossMargin,
      totalCmupGrossMargin: accumulator.totalCmupGrossMargin + row.cmupGrossMargin,
      totalSoldQuantity: accumulator.totalSoldQuantity + row.soldQuantity,
    }),
    {
      totalInventoryFifo: 0,
      totalInventoryCmup: 0,
      totalFifoCogs: 0,
      totalCmupCogs: 0,
      totalEstimatedRevenue: 0,
      totalFifoGrossMargin: 0,
      totalCmupGrossMargin: 0,
      totalSoldQuantity: 0,
    }
  );

  return { rows, summary };
};
