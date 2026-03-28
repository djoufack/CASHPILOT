const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pct = (part, total) => {
  const safeTotal = toNumber(total);
  if (safeTotal <= 0) return 0;
  return Number(((toNumber(part) / safeTotal) * 100).toFixed(2));
};

const hasComplianceRisk = (connector) =>
  ['warning', 'non_compliant'].includes(String(connector?.compliance_status || '').toLowerCase());

export function buildPayrollCountryConnectorInsights(connectors = []) {
  const rows = Array.isArray(connectors) ? connectors : [];
  const totalCount = rows.length;
  const connectedCount = rows.filter((connector) => connector?.status === 'connected').length;
  const attentionCount = rows.filter((connector) => connector?.status === 'attention').length;
  const notConnectedCount = rows.filter((connector) => connector?.status === 'not_connected').length;
  const complianceOkCount = rows.filter((connector) => connector?.compliance_status === 'compliant').length;
  const complianceRiskCount = rows.filter(hasComplianceRisk).length;
  const payrollConnectorCount = rows.filter((connector) => connector?.provider_category === 'payroll').length;
  const complianceConnectorCount = rows.filter((connector) => connector?.provider_category === 'compliance').length;

  const coveragePct = pct(connectedCount, totalCount);
  const compliancePct = pct(complianceOkCount, totalCount);

  let status = 'ready';
  if (notConnectedCount > 0 || attentionCount > 0) {
    status = 'attention';
  }
  if (complianceRiskCount > 0 || coveragePct < 50) {
    status = 'critical';
  }

  const recommendations = [];
  if (notConnectedCount > 0) {
    recommendations.push('Connecter les flux paie prioritaires pour eviter les ressaisies manuelles.');
  }
  if (complianceRiskCount > 0) {
    recommendations.push('Traiter les connecteurs en risque conformite avant la prochaine cloture de paie.');
  }
  if (!totalCount) {
    recommendations.push('Configurer les connecteurs du pays actif pour activer la paie et les controles conformite.');
  }

  return {
    totalCount,
    connectedCount,
    attentionCount,
    notConnectedCount,
    complianceOkCount,
    complianceRiskCount,
    payrollConnectorCount,
    complianceConnectorCount,
    coveragePct,
    compliancePct,
    status,
    recommendations,
  };
}

export default buildPayrollCountryConnectorInsights;
