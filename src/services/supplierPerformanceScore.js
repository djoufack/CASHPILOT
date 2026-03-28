const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const normalizeSupplierScore = (value) => {
  const normalized = toFiniteNumber(value);
  if (normalized < 0) return 0;
  if (normalized > 100) return 100;
  return normalized;
};

export const computeSupplierGlobalScore = ({ qualityScore = 0, deliveryScore = 0, costScore = 0 } = {}) => {
  const weightedScore =
    normalizeSupplierScore(qualityScore) * 0.4 +
    normalizeSupplierScore(deliveryScore) * 0.3 +
    normalizeSupplierScore(costScore) * 0.3;

  return Math.round(weightedScore * 100) / 100;
};

export const getSupplierScoreBand = (score) => {
  const normalized = normalizeSupplierScore(score);
  if (normalized >= 90) return 'A';
  if (normalized >= 80) return 'B';
  if (normalized >= 70) return 'C';
  if (normalized >= 60) return 'D';
  return 'E';
};
