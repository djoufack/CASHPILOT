/**
 * PDF Export Service for Financial Scenarios
 * Generates PDF reports for simulation results and comparisons
 */

import html2pdf from 'html2pdf.js';

const PDF_OPTIONS = {
  margin: 10,
  filename: 'scenario-report.pdf',
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2 },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
};

function createHeader(title, scenarioName, period) {
  const periodStr = period
    ? `Du ${new Date(period.base_date).toLocaleDateString('fr-FR')} au ${new Date(period.end_date).toLocaleDateString('fr-FR')}`
    : '';

  return `
    <div style="margin-bottom:20px;padding-bottom:15px;border-bottom:2px solid #3B82F6;">
      <h1 style="margin:0;font-size:22px;color:#1F2937;">${title}</h1>
      <p style="margin:5px 0 0;font-size:14px;color:#6B7280;">${scenarioName}</p>
      ${periodStr ? `<p style="margin:3px 0 0;font-size:12px;color:#9CA3AF;">${periodStr}</p>` : ''}
      <p style="margin:3px 0 0;font-size:10px;color:#9CA3AF;">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
    </div>
  `;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount || 0);
}

function formatPercent(value) {
  return `${(value || 0).toFixed(1)}%`;
}

function createContainer(html) {
  const el = document.createElement('div');
  el.style.fontFamily = 'Arial, sans-serif';
  el.style.fontSize = '12px';
  el.style.color = '#1F2937';
  el.style.padding = '15px';
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

async function generatePDF(element, filename) {
  try {
    await html2pdf().set({ ...PDF_OPTIONS, filename }).from(element).save();
  } finally {
    document.body.removeChild(element);
  }
}

// ============================================================================
// SCENARIO SIMULATION PDF
// ============================================================================

export async function exportScenarioSimulationPDF(scenario, results, assumptions) {
  if (!results || results.length === 0) {
    throw new Error('Aucun résultat de simulation disponible');
  }

  const firstPeriod = results[0];
  const lastPeriod = results[results.length - 1];

  // Summary metrics
  const revenueGrowth = ((lastPeriod.revenue - firstPeriod.revenue) / firstPeriod.revenue) * 100;
  const cashChange = lastPeriod.cashBalance - firstPeriod.cashBalance;

  const html = `
    ${createHeader('Rapport de Simulation Financière', scenario.name, scenario)}

    <!-- Description -->
    ${scenario.description ? `
      <div style="margin-bottom:20px;padding:10px;background:#F3F4F6;border-left:4px solid #3B82F6;">
        <p style="margin:0;font-size:12px;color:#4B5563;">${scenario.description}</p>
      </div>
    ` : ''}

    <!-- Summary Section -->
    <h2 style="font-size:16px;color:#1F2937;margin:20px 0 10px;border-bottom:2px solid #E5E7EB;padding-bottom:5px;">
      Résumé Exécutif
    </h2>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
      <div style="padding:12px;background:#EFF6FF;border-left:4px solid #3B82F6;">
        <p style="margin:0;font-size:10px;color:#1E40AF;font-weight:600;">CROISSANCE DU CA</p>
        <p style="margin:5px 0 0;font-size:18px;font-weight:bold;color:${revenueGrowth >= 0 ? '#10B981' : '#EF4444'};">
          ${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%
        </p>
        <p style="margin:3px 0 0;font-size:9px;color:#6B7280;">
          ${formatCurrency(firstPeriod.revenue)} → ${formatCurrency(lastPeriod.revenue)}
        </p>
      </div>
      <div style="padding:12px;background:#F0FDF4;border-left:4px solid #10B981;">
        <p style="margin:0;font-size:10px;color:#15803D;font-weight:600;">TRÉSORERIE FINALE</p>
        <p style="margin:5px 0 0;font-size:18px;font-weight:bold;color:#1F2937;">
          ${formatCurrency(lastPeriod.cashBalance)}
        </p>
        <p style="margin:3px 0 0;font-size:9px;color:${cashChange >= 0 ? '#10B981' : '#EF4444'};">
          ${cashChange >= 0 ? '+' : ''}${formatCurrency(cashChange)}
        </p>
      </div>
      <div style="padding:12px;background:#FEF3C7;border-left:4px solid #F59E0B;">
        <p style="margin:0;font-size:10px;color:#92400E;font-weight:600;">MARGE EBITDA</p>
        <p style="margin:5px 0 0;font-size:18px;font-weight:bold;color:#1F2937;">
          ${formatPercent(lastPeriod.ebitdaMargin)}
        </p>
        <p style="margin:3px 0 0;font-size:9px;color:#6B7280;">
          ${formatPercent(lastPeriod.netMargin)} marge nette
        </p>
      </div>
    </div>

    <!-- Assumptions Section -->
    ${assumptions && assumptions.length > 0 ? `
      <h2 style="font-size:16px;color:#1F2937;margin:20px 0 10px;border-bottom:2px solid #E5E7EB;padding-bottom:5px;">
        Hypothèses Appliquées
      </h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr style="background:#F9FAFB;">
            <th style="padding:8px;text-align:left;font-size:11px;color:#6B7280;">Hypothèse</th>
            <th style="padding:8px;text-align:left;font-size:11px;color:#6B7280;">Catégorie</th>
            <th style="padding:8px;text-align:left;font-size:11px;color:#6B7280;">Type</th>
            <th style="padding:8px;text-align:left;font-size:11px;color:#6B7280;">Paramètres</th>
          </tr>
        </thead>
        <tbody>
          ${assumptions.map((assumption, index) => `
            <tr style="${index % 2 === 0 ? 'background:#F9FAFB;' : ''}">
              <td style="padding:8px;font-size:11px;">${assumption.name}</td>
              <td style="padding:8px;font-size:11px;">${assumption.category}</td>
              <td style="padding:8px;font-size:11px;">${assumption.assumption_type}</td>
              <td style="padding:8px;font-size:11px;font-family:monospace;">
                ${JSON.stringify(assumption.parameters)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    <!-- Results Table -->}
    <h2 style="font-size:16px;color:#1F2937;margin:20px 0 10px;border-bottom:2px solid #E5E7EB;padding-bottom:5px;">
      Projection Mois par Mois
    </h2>
    <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:20px;">
      <thead>
        <tr style="background:#1F2937;color:#FFF;">
          <th style="padding:6px 4px;text-align:left;">Période</th>
          <th style="padding:6px 4px;text-align:right;">CA</th>
          <th style="padding:6px 4px;text-align:right;">Dépenses</th>
          <th style="padding:6px 4px;text-align:right;">EBITDA</th>
          <th style="padding:6px 4px;text-align:right;">Marge %</th>
          <th style="padding:6px 4px;text-align:right;">Résultat Net</th>
          <th style="padding:6px 4px;text-align:right;">Trésorerie</th>
        </tr>
      </thead>
      <tbody>
        ${results.map((period, index) => `
          <tr style="${index % 2 === 0 ? 'background:#F9FAFB;' : ''}">
            <td style="padding:4px;font-weight:${index === results.length - 1 ? 'bold' : 'normal'};">
              ${period.period_label}
            </td>
            <td style="padding:4px;text-align:right;font-family:monospace;">
              ${formatCurrency(period.revenue)}
            </td>
            <td style="padding:4px;text-align:right;font-family:monospace;">
              ${formatCurrency(period.expenses)}
            </td>
            <td style="padding:4px;text-align:right;font-family:monospace;color:${period.ebitda >= 0 ? '#10B981' : '#EF4444'};">
              ${formatCurrency(period.ebitda)}
            </td>
            <td style="padding:4px;text-align:right;font-family:monospace;">
              ${formatPercent(period.ebitdaMargin)}
            </td>
            <td style="padding:4px;text-align:right;font-family:monospace;color:${period.netIncome >= 0 ? '#10B981' : '#EF4444'};">
              ${formatCurrency(period.netIncome)}
            </td>
            <td style="padding:4px;text-align:right;font-family:monospace;font-weight:${index === results.length - 1 ? 'bold' : 'normal'};">
              ${formatCurrency(period.cashBalance)}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Key Ratios Section -->
    <h2 style="font-size:16px;color:#1F2937;margin:20px 0 10px;border-bottom:2px solid #E5E7EB;padding-bottom:5px;">
      Ratios Clés (Période Finale)
    </h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
      <div>
        <h3 style="font-size:12px;color:#6B7280;margin:0 0 8px;">Rentabilité</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:4px;font-size:10px;">ROE</td>
            <td style="padding:4px;text-align:right;font-size:10px;font-weight:bold;">
              ${formatPercent(lastPeriod.roe)}
            </td>
          </tr>
          <tr style="background:#F9FAFB;">
            <td style="padding:4px;font-size:10px;">ROCE</td>
            <td style="padding:4px;text-align:right;font-size:10px;font-weight:bold;">
              ${formatPercent(lastPeriod.roce)}
            </td>
          </tr>
          <tr>
            <td style="padding:4px;font-size:10px;">Marge Opérationnelle</td>
            <td style="padding:4px;text-align:right;font-size:10px;font-weight:bold;">
              ${formatPercent(lastPeriod.operatingMargin)}
            </td>
          </tr>
        </table>
      </div>
      <div>
        <h3 style="font-size:12px;color:#6B7280;margin:0 0 8px;">Liquidité</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:4px;font-size:10px;">Ratio de liquidité générale</td>
            <td style="padding:4px;text-align:right;font-size:10px;font-weight:bold;">
              ${lastPeriod.currentRatio.toFixed(2)}
            </td>
          </tr>
          <tr style="background:#F9FAFB;">
            <td style="padding:4px;font-size:10px;">Ratio de liquidité réduite</td>
            <td style="padding:4px;text-align:right;font-size:10px;font-weight:bold;">
              ${lastPeriod.quickRatio.toFixed(2)}
            </td>
          </tr>
          <tr>
            <td style="padding:4px;font-size:10px;">Dette / Capitaux Propres</td>
            <td style="padding:4px;text-align:right;font-size:10px;font-weight:bold;">
              ${lastPeriod.debtToEquity.toFixed(2)}
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top:30px;padding-top:15px;border-top:1px solid #E5E7EB;text-align:center;">
      <p style="margin:0;font-size:9px;color:#9CA3AF;">
        Ce rapport de simulation financière a été généré automatiquement par CashPilot<br/>
        Les projections sont basées sur les hypothèses définies et ne constituent pas des garanties de performance future
      </p>
    </div>
  `;

  const el = createContainer(html);
  await generatePDF(el, `Simulation_${scenario.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ============================================================================
// SCENARIO COMPARISON PDF
// ============================================================================

export async function exportScenarioComparisonPDF(scenario1, scenario2, results1, results2, comparison) {
  if (!comparison) {
    throw new Error('Données de comparaison manquantes');
  }

  const html = `
    ${createHeader('Comparaison de Scénarios', `${scenario1.name} vs ${scenario2.name}`, null)}

    <!-- Summary Comparison -->
    <h2 style="font-size:16px;color:#1F2937;margin:20px 0 10px;border-bottom:2px solid #E5E7EB;padding-bottom:5px;">
      Résumé de la Comparaison
    </h2>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
      <div style="padding:12px;background:#EFF6FF;border-left:4px solid #3B82F6;">
        <p style="margin:0;font-size:10px;color:#1E40AF;font-weight:600;">DIFF. CA FINAL</p>
        <p style="margin:5px 0 0;font-size:18px;font-weight:bold;color:${comparison.summary.finalRevenueDiff >= 0 ? '#10B981' : '#EF4444'};">
          ${comparison.summary.finalRevenueDiff >= 0 ? '+' : ''}${formatCurrency(comparison.summary.finalRevenueDiff)}
        </p>
      </div>
      <div style="padding:12px;background:#F0FDF4;border-left:4px solid #10B981;">
        <p style="margin:0;font-size:10px;color:#15803D;font-weight:600;">DIFF. TRÉSORERIE</p>
        <p style="margin:5px 0 0;font-size:18px;font-weight:bold;color:${comparison.summary.finalCashDiff >= 0 ? '#10B981' : '#EF4444'};">
          ${comparison.summary.finalCashDiff >= 0 ? '+' : ''}${formatCurrency(comparison.summary.finalCashDiff)}
        </p>
      </div>
      <div style="padding:12px;background:#FEF3C7;border-left:4px solid #F59E0B;">
        <p style="margin:0;font-size:10px;color:#92400E;font-weight:600;">DIFF. RÉSULTAT NET</p>
        <p style="margin:5px 0 0;font-size:18px;font-weight:bold;color:${comparison.summary.finalProfitDiff >= 0 ? '#10B981' : '#EF4444'};">
          ${comparison.summary.finalProfitDiff >= 0 ? '+' : ''}${formatCurrency(comparison.summary.finalProfitDiff)}
        </p>
      </div>
    </div>

    <!-- Detailed Comparison Table -->
    <h2 style="font-size:16px;color:#1F2937;margin:20px 0 10px;border-bottom:2px solid #E5E7EB;padding-bottom:5px;">
      Comparaison Détaillée
    </h2>
    <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:20px;">
      <thead>
        <tr style="background:#1F2937;color:#FFF;">
          <th style="padding:6px 4px;text-align:left;">Période</th>
          <th style="padding:6px 4px;text-align:right;" colspan="2">Chiffre d'Affaires</th>
          <th style="padding:6px 4px;text-align:right;" colspan="2">Trésorerie</th>
          <th style="padding:6px 4px;text-align:right;" colspan="2">Résultat Net</th>
        </tr>
        <tr style="background:#374151;color:#FFF;">
          <th style="padding:4px;"></th>
          <th style="padding:4px;text-align:right;">${scenario1.name}</th>
          <th style="padding:4px;text-align:right;">${scenario2.name}</th>
          <th style="padding:4px;text-align:right;">${scenario1.name}</th>
          <th style="padding:4px;text-align:right;">${scenario2.name}</th>
          <th style="padding:4px;text-align:right;">${scenario1.name}</th>
          <th style="padding:4px;text-align:right;">${scenario2.name}</th>
        </tr>
      </thead>
      <tbody>
        ${results1.map((r1, index) => {
          const r2 = results2[index];
          return `
            <tr style="${index % 2 === 0 ? 'background:#F9FAFB;' : ''}">
              <td style="padding:4px;">${r1.period_label}</td>
              <td style="padding:4px;text-align:right;font-family:monospace;">${formatCurrency(r1.revenue)}</td>
              <td style="padding:4px;text-align:right;font-family:monospace;">${formatCurrency(r2.revenue)}</td>
              <td style="padding:4px;text-align:right;font-family:monospace;">${formatCurrency(r1.cashBalance)}</td>
              <td style="padding:4px;text-align:right;font-family:monospace;">${formatCurrency(r2.cashBalance)}</td>
              <td style="padding:4px;text-align:right;font-family:monospace;">${formatCurrency(r1.netIncome)}</td>
              <td style="padding:4px;text-align:right;font-family:monospace;">${formatCurrency(r2.netIncome)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- Footer -->
    <div style="margin-top:30px;padding-top:15px;border-top:1px solid #E5E7EB;text-align:center;">
      <p style="margin:0;font-size:9px;color:#9CA3AF;">
        Ce rapport de comparaison a été généré automatiquement par CashPilot<br/>
        Les différences sont calculées comme ${scenario1.name} moins ${scenario2.name}
      </p>
    </div>
  `;

  const el = createContainer(html);
  await generatePDF(el, `Comparaison_${new Date().toISOString().split('T')[0]}.pdf`);
}

export default {
  exportScenarioSimulationPDF,
  exportScenarioComparisonPDF,
};
