const asFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function buildAdminOperationalHealthInsights({ edgeFunctions, webhookSummary } = {}) {
  const edges = Array.isArray(edgeFunctions) ? edgeFunctions : [];
  const totalFunctions = edges.length;
  const healthyCount = edges.filter((entry) => String(entry?.status || '').toLowerCase() === 'healthy').length;
  const degradedCount = edges.filter((entry) =>
    ['degraded', 'down'].includes(String(entry?.status || '').toLowerCase())
  ).length;
  const availabilityPct = totalFunctions > 0 ? (healthyCount / totalFunctions) * 100 : 0;

  const deliveryTotal24h = asFiniteNumber(webhookSummary?.deliveryTotal24h, 0);
  const deliverySuccess24h = asFiniteNumber(webhookSummary?.deliverySuccess24h, 0);
  const deliveryFailure24h = asFiniteNumber(webhookSummary?.deliveryFailure24h, 0);
  const webhookSuccessRatePct = deliveryTotal24h > 0 ? (deliverySuccess24h / deliveryTotal24h) * 100 : 100;

  let status = 'ready';
  if (totalFunctions === 0) {
    status = 'critical';
  } else if (availabilityPct < 85 || webhookSuccessRatePct < 95 || degradedCount > 0 || deliveryFailure24h > 0) {
    status = 'attention';
  }
  if (availabilityPct < 60 || webhookSuccessRatePct < 80) {
    status = 'critical';
  }

  const recommendations = [];
  if (totalFunctions === 0) {
    recommendations.push('Initialiser la supervision des Edge Functions dans le registre sante.');
  }
  if (degradedCount > 0) {
    recommendations.push('Des fonctions sont degradees: planifier une revue des logs et relancer les checks.');
  }
  if (deliveryFailure24h > 0 || webhookSuccessRatePct < 98) {
    recommendations.push('Le taux de livraison webhook est sous cible: verifier endpoints, secret et retries.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Sante operationnelle stable. Continuer la surveillance cadencee.');
  }

  return {
    totalFunctions,
    healthyCount,
    degradedCount,
    availabilityPct,
    deliveryTotal24h,
    deliverySuccess24h,
    deliveryFailure24h,
    webhookSuccessRatePct,
    status,
    recommendations,
  };
}

export default buildAdminOperationalHealthInsights;
