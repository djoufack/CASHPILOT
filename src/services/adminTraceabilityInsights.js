const toLower = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

export function buildAdminTraceabilityInsights(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const totalCount = list.length;
  const criticalCount = list.filter((entry) => toLower(entry?.severity) === 'critical').length;
  const warningCount = list.filter((entry) => toLower(entry?.severity) === 'warning').length;
  const failureCount = list.filter((entry) => toLower(entry?.operation_status) === 'failure').length;
  const successCount = list.filter((entry) => toLower(entry?.operation_status) === 'success').length;
  const successRatePct = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

  let status = 'ready';
  if (criticalCount > 0 || failureCount > 0) {
    status = 'critical';
  } else if (totalCount === 0 || warningCount > 0) {
    status = 'attention';
  }

  const recommendations = [];
  if (totalCount === 0) {
    recommendations.push('Aucune trace admin recente: verifier que la journalisation detaillee est active.');
  }
  if (criticalCount > 0) {
    recommendations.push('Des operations critiques ont ete detectees: effectuer une revue de gouvernance.');
  }
  if (failureCount > 0) {
    recommendations.push('Des operations admin en echec existent: verifier les details et corriger les droits.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Traceabilite admin saine. Continuer la revue periodique.');
  }

  return {
    totalCount,
    criticalCount,
    warningCount,
    failureCount,
    successCount,
    successRatePct,
    status,
    recommendations,
  };
}

export default buildAdminTraceabilityInsights;
