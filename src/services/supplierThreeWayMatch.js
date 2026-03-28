const SUPPORTED_STATUSES = new Set(['matched', 'mismatch', 'partial', 'pending', 'unmatched']);

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const normalizeThreeWayMatchStatus = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return SUPPORTED_STATUSES.has(normalized) ? normalized : 'unmatched';
};

export const computeThreeWayMatchStatus = ({
  hasLinkedOrder,
  orderStatus,
  amountVariance,
  quantityVariance,
  amountTolerance = 0.01,
  quantityTolerance = 0.01,
}) => {
  if (!hasLinkedOrder) return 'unmatched';

  const normalizedOrderStatus = String(orderStatus || '')
    .trim()
    .toLowerCase();

  if (normalizedOrderStatus === 'partially_received') {
    return 'partial';
  }

  const normalizedAmountVariance = Math.abs(toNumber(amountVariance));
  const normalizedQuantityVariance = Math.abs(toNumber(quantityVariance));
  const normalizedAmountTolerance = Math.abs(toNumber(amountTolerance));
  const normalizedQuantityTolerance = Math.abs(toNumber(quantityTolerance));

  if (
    normalizedAmountVariance <= normalizedAmountTolerance &&
    normalizedQuantityVariance <= normalizedQuantityTolerance
  ) {
    return 'matched';
  }

  return 'mismatch';
};

export const deriveThreeWayMatchMetrics = (raw = {}) => ({
  orderedTotalAmount: toNumber(raw.orderedTotalAmount),
  receivedTotalAmount: toNumber(raw.receivedTotalAmount),
  invoicedTotalAmount: toNumber(raw.invoicedTotalAmount),
  amountVariance: toNumber(raw.amountVariance),
  orderedTotalQuantity: toNumber(raw.orderedTotalQuantity),
  receivedTotalQuantity: toNumber(raw.receivedTotalQuantity),
  invoicedTotalQuantity: toNumber(raw.invoicedTotalQuantity),
  quantityVariance: toNumber(raw.quantityVariance),
  status: normalizeThreeWayMatchStatus(raw.status),
});

export const getThreeWayMatchPresentation = (status) => {
  switch (normalizeThreeWayMatchStatus(status)) {
    case 'matched':
      return { status: 'matched', tone: 'success' };
    case 'mismatch':
      return { status: 'mismatch', tone: 'danger' };
    case 'partial':
      return { status: 'partial', tone: 'warning' };
    case 'pending':
      return { status: 'pending', tone: 'info' };
    default:
      return { status: 'unmatched', tone: 'muted' };
  }
};
