const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toLowerText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const isSecurityCriticalFlag = (flag) => {
  const area = toLowerText(flag?.target_area);
  const key = toLowerText(flag?.flag_key);
  return area === 'security' || key.includes('security') || key.includes('traceability');
};

export function buildAdminFeatureFlagInsights(flags) {
  const list = Array.isArray(flags) ? flags : [];
  const totalCount = list.length;
  const enabledCount = list.filter((flag) => Boolean(flag?.is_enabled)).length;
  const disabledCount = totalCount - enabledCount;

  const rolloutAverage =
    totalCount > 0 ? list.reduce((sum, flag) => sum + toFiniteNumber(flag?.rollout_percentage, 0), 0) / totalCount : 0;

  const byArea = list.reduce((acc, flag) => {
    const area = toLowerText(flag?.target_area) || 'uncategorized';
    acc[area] = (acc[area] || 0) + 1;
    return acc;
  }, {});

  const criticalDisabledCount = list.filter((flag) => !flag?.is_enabled && isSecurityCriticalFlag(flag)).length;

  let status = 'ready';
  if (totalCount === 0) {
    status = 'critical';
  } else if (criticalDisabledCount > 0 || disabledCount > Math.ceil(totalCount * 0.5)) {
    status = 'attention';
  }

  const recommendations = [];
  if (totalCount === 0) {
    recommendations.push('Initialisez les feature flags admin pour controler les activations module par module.');
  }
  if (criticalDisabledCount > 0) {
    recommendations.push('Verifier les flags de securite/tracabilite desactives avant le prochain cycle de release.');
  }
  if (rolloutAverage < 75 && totalCount > 0) {
    recommendations.push('Le rollout moyen est faible: valider le plan de generalisation des flags critiques.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Portefeuille feature flags stable. Continuer la revue hebdomadaire.');
  }

  return {
    totalCount,
    enabledCount,
    disabledCount,
    rolloutAverage,
    byArea,
    criticalDisabledCount,
    status,
    recommendations,
  };
}

export default buildAdminFeatureFlagInsights;
