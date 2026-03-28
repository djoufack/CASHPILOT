const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pct = (part, total) => {
  const safeTotal = toNumber(total);
  if (safeTotal <= 0) return 0;
  return Number(((toNumber(part) / safeTotal) * 100).toFixed(2));
};

export function buildIntegrationAutomationPackInsights(packs = []) {
  const rows = Array.isArray(packs) ? packs : [];
  const totalCount = rows.length;
  const installedCount = rows.filter((pack) => pack?.status === 'installed').length;
  const readyCount = rows.filter((pack) => pack?.status === 'ready').length;
  const disabledCount = rows.filter((pack) => pack?.status === 'disabled').length;
  const byProvider = rows.reduce(
    (acc, pack) => {
      const provider = String(pack?.provider || '').toLowerCase();
      if (provider === 'make') acc.make += 1;
      else acc.zapier += 1;
      return acc;
    },
    { zapier: 0, make: 0 }
  );

  const readinessPct = pct(installedCount, totalCount);

  let status = 'ready';
  if (totalCount === 0 || installedCount === 0) {
    status = 'critical';
  } else if (installedCount < totalCount || disabledCount > 0 || readyCount > 0) {
    status = 'attention';
  }

  const recommendations = [];
  if (totalCount === 0) {
    recommendations.push('Initialiser les packs Zapier/Make pour activer des automatisations pre-configurees.');
  }
  if (installedCount < totalCount) {
    recommendations.push('Installer les packs restants pour couvrir ventes, achats et comptabilite.');
  }
  if (disabledCount > 0) {
    recommendations.push('Reactiver les packs desactives ou confirmer leur retrait dans la gouvernance integrateurs.');
  }

  return {
    totalCount,
    installedCount,
    readyCount,
    disabledCount,
    byProvider,
    readinessPct,
    status,
    recommendations,
  };
}

export default buildIntegrationAutomationPackInsights;
