const COVERAGE_BY_CLASS = {
  A: 30,
  B: 21,
  C: 14,
};

const PRIORITY_WEIGHT = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeProductId = (entry) => entry?.id || entry?.product_id || entry?.user_product_id || null;

const toDate = (value, fallbackDate) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  return fallbackDate;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatDate = (date) => {
  const safeDate = date instanceof Date ? date : new Date(date);
  return safeDate.toISOString().slice(0, 10);
};

const resolvePriority = ({ reorderQuantity, stockQuantity, minStockLevel, daysOfCover, leadTimeDays }) => {
  if (reorderQuantity <= 0) return 'low';
  if (stockQuantity <= 0) return 'critical';
  if (Number.isFinite(daysOfCover) && daysOfCover <= leadTimeDays) return 'critical';
  if (stockQuantity <= minStockLevel || (Number.isFinite(daysOfCover) && daysOfCover <= leadTimeDays + 3))
    return 'high';
  return 'medium';
};

const resolveNextAction = (priority, reorderQuantity) => {
  if (priority === 'critical') {
    return `Commander aujourd'hui (${reorderQuantity} unités)`;
  }
  if (priority === 'high') {
    return `Commander cette semaine (${reorderQuantity} unités)`;
  }
  return `Préparer la commande (${reorderQuantity} unités)`;
};

const computeConfidenceScore = ({ demandEvents, unitCost, minStockLevel, supplierName }) => {
  let score = 20;
  if (demandEvents >= 3) score += 40;
  else if (demandEvents > 0) score += 25;
  if (unitCost > 0) score += 25;
  if (minStockLevel > 0) score += 10;
  if (supplierName) score += 10;
  return Math.min(100, score);
};

const buildDemandStats = (historyEntries, referenceDate, demandWindowDays) => {
  const now = toDate(referenceDate, new Date());
  const windowStart = addDays(now, -Math.max(1, toNumber(demandWindowDays, 60)));
  const demandMap = new Map();

  for (const entry of historyEntries || []) {
    const productId = normalizeProductId(entry);
    if (!productId) continue;

    const changeQty = toNumber(entry?.change_quantity, 0);
    if (changeQty >= 0) continue;

    const eventDate = toDate(entry?.created_at, now);
    if (eventDate < windowStart || eventDate > now) continue;

    const current = demandMap.get(productId) || {
      demandUnits: 0,
      demandEvents: 0,
      firstDate: eventDate,
    };

    current.demandUnits += Math.abs(changeQty);
    current.demandEvents += 1;
    if (eventDate < current.firstDate) {
      current.firstDate = eventDate;
    }
    demandMap.set(productId, current);
  }

  return demandMap;
};

const buildSupplierCostMap = (supplierOrderItems) => {
  const supplierMap = new Map();

  for (const item of supplierOrderItems || []) {
    const productId = normalizeProductId(item);
    if (!productId) continue;

    const quantity = toNumber(item?.quantity, 0);
    const unitPrice = toNumber(item?.unit_price, 0);
    if (quantity <= 0 || unitPrice <= 0) continue;

    const current = supplierMap.get(productId) || { totalQty: 0, totalValue: 0 };
    current.totalQty += quantity;
    current.totalValue += quantity * unitPrice;
    supplierMap.set(productId, current);
  }

  return supplierMap;
};

export const buildReplenishmentRecommendations = ({
  products = [],
  historyEntries = [],
  supplierOrderItems = [],
  referenceDate = new Date(),
  demandWindowDays = 60,
  defaultLeadTimeDays = 7,
} = {}) => {
  const now = toDate(referenceDate, new Date());
  const demandMap = buildDemandStats(historyEntries, now, demandWindowDays);
  const supplierCostMap = buildSupplierCostMap(supplierOrderItems);

  const recommendations = [];

  for (const product of products || []) {
    if (product?.inventory_tracking_enabled === false) continue;

    const productId = normalizeProductId(product);
    if (!productId) continue;

    const stockQuantity = toNumber(product?.stockQuantity ?? product?.stock_quantity, 0);
    const minStockLevel = toNumber(product?.minStockLevel ?? product?.min_stock_level, 0);
    const abcClass = String(product?.abcClass || product?.abc_class || 'B').toUpperCase();
    const targetCoverageDays = COVERAGE_BY_CLASS[abcClass] || COVERAGE_BY_CLASS.B;
    const leadTimeDays = Math.max(1, toNumber(product?.lead_time_days, defaultLeadTimeDays));
    const supplierName = product?.supplier?.company_name || product?.supplier_name || null;

    const demandStats = demandMap.get(productId) || { demandUnits: 0, demandEvents: 0, firstDate: now };
    const demandSpanDays = Math.max(1, Math.ceil((now - demandStats.firstDate) / 86400000));
    const demandPeriodDays = Math.min(Math.max(1, toNumber(demandWindowDays, 60)), demandSpanDays);
    const dailyDemand = demandStats.demandUnits > 0 ? demandStats.demandUnits / demandPeriodDays : 0;

    const projectedTarget = dailyDemand > 0 ? Math.ceil(dailyDemand * (leadTimeDays + targetCoverageDays)) : 0;
    const recommendedStockLevel = Math.max(minStockLevel, projectedTarget);
    const reorderQuantity = Math.max(0, Math.ceil(recommendedStockLevel - stockQuantity));

    if (reorderQuantity <= 0) continue;

    const supplierCost = supplierCostMap.get(productId);
    const supplierUnitCost =
      supplierCost && supplierCost.totalQty > 0 ? supplierCost.totalValue / supplierCost.totalQty : 0;
    const unitCost =
      toNumber(product?.purchasePrice ?? product?.purchase_price, 0) > 0
        ? toNumber(product?.purchasePrice ?? product?.purchase_price, 0)
        : supplierUnitCost;

    const daysOfCover = dailyDemand > 0 ? stockQuantity / dailyDemand : Number.POSITIVE_INFINITY;
    const priority = resolvePriority({
      reorderQuantity,
      stockQuantity,
      minStockLevel,
      daysOfCover,
      leadTimeDays,
    });

    let suggestedOrderDate = formatDate(now);
    if (priority === 'medium' && Number.isFinite(daysOfCover)) {
      const daysBeforeOrder = Math.max(0, Math.floor(daysOfCover - leadTimeDays));
      suggestedOrderDate = formatDate(addDays(now, daysBeforeOrder));
    }

    const recommendedOrderValue = reorderQuantity * unitCost;
    const confidenceScore = computeConfidenceScore({
      demandEvents: demandStats.demandEvents,
      unitCost,
      minStockLevel,
      supplierName,
    });

    recommendations.push({
      productId,
      productName: product?.product_name || product?.productName || 'Produit',
      sku: product?.sku || null,
      abcClass,
      supplierName,
      priority,
      stockQuantity,
      minStockLevel,
      dailyDemand,
      daysOfCover,
      reorderQuantity,
      recommendedStockLevel,
      leadTimeDays,
      targetCoverageDays,
      unitCost,
      recommendedOrderValue,
      suggestedOrderDate,
      nextAction: resolveNextAction(priority, reorderQuantity),
      confidenceScore,
    });
  }

  recommendations.sort((left, right) => {
    const priorityDiff = (PRIORITY_WEIGHT[right.priority] || 0) - (PRIORITY_WEIGHT[left.priority] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    if (right.recommendedOrderValue !== left.recommendedOrderValue) {
      return right.recommendedOrderValue - left.recommendedOrderValue;
    }
    return right.reorderQuantity - left.reorderQuantity;
  });

  const summary = recommendations.reduce(
    (accumulator, recommendation) => {
      accumulator.totalRecommendations += 1;
      accumulator.totalOrderValue += recommendation.recommendedOrderValue;
      if (recommendation.priority === 'critical') accumulator.criticalCount += 1;
      if (recommendation.priority === 'high') accumulator.highCount += 1;
      if (recommendation.priority === 'medium') accumulator.mediumCount += 1;
      return accumulator;
    },
    {
      totalRecommendations: 0,
      totalOrderValue: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
    }
  );

  return {
    recommendations,
    summary,
  };
};
