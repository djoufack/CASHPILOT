import { saveElementAsPdf } from '@/services/pdfExportRuntime';
import { formatDateInput } from '@/utils/dateFormatting';
import { escapeHTML as escapeHtml, setSafeHtml } from '@/utils/sanitize';

const formatCurrency = (value, currency = 'EUR') => {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR');
};

const buildReportContent = (payload) => {
  const project = payload?.project || {};
  const currency = payload?.currency || 'EUR';
  const kpi = payload?.kpi || {};
  const milestones = payload?.milestones || [];
  const resources = payload?.resources || [];
  const baselines = payload?.baselines || [];
  const financialCurve = payload?.financialCurve || [];

  const baselineRows = baselines
    .map(
      (baseline) => `
    <tr>
      <td>${escapeHtml(baseline.baseline_label || `Baseline v${baseline.version || ''}`)}</td>
      <td>${baseline.version || '—'}</td>
      <td>${formatDate(baseline.planned_start_date)}</td>
      <td>${formatDate(baseline.planned_end_date)}</td>
      <td>${baseline.planned_budget_hours ?? '—'}</td>
      <td>${formatCurrency(baseline.planned_budget_amount, currency)}</td>
      <td>${baseline.is_active ? 'Active' : 'Archive'}</td>
    </tr>
  `
    )
    .join('');

  const milestoneRows = milestones
    .map(
      (milestone) => `
    <tr>
      <td>${escapeHtml(milestone.title || '—')}</td>
      <td>${formatDate(milestone.planned_date)}</td>
      <td>${formatDate(milestone.actual_date)}</td>
      <td>${escapeHtml(milestone.status || 'planned')}</td>
      <td>${formatCurrency(milestone.planned_amount, currency)}</td>
      <td>${formatCurrency(milestone.adjustment, currency)}</td>
      <td>${formatCurrency(milestone.net_amount, currency)}</td>
    </tr>
  `
    )
    .join('');

  const resourceRows = resources
    .map(
      (resource) => `
    <tr>
      <td>${escapeHtml(resource.resource_type || 'human')}</td>
      <td>${escapeHtml(resource.display_name || resource.resource_name || '—')}</td>
      <td>${resource.planned_quantity ?? 0} ${escapeHtml(resource.unit || '')}</td>
      <td>${resource.actual_quantity ?? 0} ${escapeHtml(resource.unit || '')}</td>
      <td>${formatCurrency(resource.planned_cost, currency)}</td>
      <td>${formatCurrency(resource.actual_cost, currency)}</td>
      <td>${escapeHtml(resource.status || 'planned')}</td>
    </tr>
  `
    )
    .join('');

  const financeRows = financialCurve
    .map(
      (row) => `
    <tr>
      <td>${escapeHtml(row.period)}</td>
      <td>${formatCurrency(row.monthRevenue, currency)}</td>
      <td>${formatCurrency(row.monthCost, currency)}</td>
      <td>${formatCurrency(row.monthMargin, currency)}</td>
      <td>${formatCurrency(row.revenue, currency)}</td>
      <td>${formatCurrency(row.cost, currency)}</td>
      <td>${formatCurrency(row.margin, currency)}</td>
    </tr>
  `
    )
    .join('');

  return `
    <div class="cp-report">
      <header class="cp-header">
        <h1>Rapport de pilotage projet</h1>
        <p class="muted">${escapeHtml(project.name || 'Projet')}</p>
        <p class="muted">${escapeHtml(project.client_name || 'Client non défini')} • Généré le ${formatDate(new Date())}</p>
      </header>

      <section class="cp-kpis">
        <article class="cp-kpi">
          <h3>Avancement tâches</h3>
          <p>${kpi.taskCompletionRate ?? 0}%</p>
        </article>
        <article class="cp-kpi">
          <h3>Jalons atteints</h3>
          <p>${kpi.milestonesAchieved ?? 0} / ${kpi.totalMilestones ?? 0}</p>
        </article>
        <article class="cp-kpi">
          <h3>Coût cumulé</h3>
          <p>${formatCurrency(kpi.totalCost, currency)}</p>
        </article>
        <article class="cp-kpi">
          <h3>Revenu cumulé</h3>
          <p>${formatCurrency(kpi.totalRevenue, currency)}</p>
        </article>
      </section>

      <section>
        <h2>Baselines</h2>
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Version</th>
              <th>Début prévu</th>
              <th>Fin prévue</th>
              <th>Heures prévues</th>
              <th>Budget prévu</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>${baselineRows || '<tr><td colspan="7">Aucune baseline</td></tr>'}</tbody>
        </table>
      </section>

      <section>
        <h2>Jalons & bonus/malus</h2>
        <table>
          <thead>
            <tr>
              <th>Jalon</th>
              <th>Prévu</th>
              <th>Réel</th>
              <th>Statut</th>
              <th>Montant de base</th>
              <th>Bonus/Malus</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>${milestoneRows || '<tr><td colspan="7">Aucun jalon</td></tr>'}</tbody>
        </table>
      </section>

      <section>
        <h2>Ressources (humaines & matérielles)</h2>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Ressource</th>
              <th>Planifié</th>
              <th>Réel</th>
              <th>Coût planifié</th>
              <th>Coût réel</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>${resourceRows || '<tr><td colspan="7">Aucune ressource</td></tr>'}</tbody>
        </table>
      </section>

      <section>
        <h2>Suivi financier mensuel</h2>
        <table>
          <thead>
            <tr>
              <th>Période</th>
              <th>CA mois</th>
              <th>Coût mois</th>
              <th>Marge mois</th>
              <th>CA cumulé</th>
              <th>Coût cumulé</th>
              <th>Marge cumulée</th>
            </tr>
          </thead>
          <tbody>${financeRows || '<tr><td colspan="7">Aucune donnée financière</td></tr>'}</tbody>
        </table>
      </section>
    </div>
  `;
};

const buildStandaloneHtml = (payload) => {
  const content = buildReportContent(payload);
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rapport pilotage projet</title>
  <style>
    body { margin: 0; padding: 24px; background: #020617; color: #e2e8f0; font-family: "Inter", Arial, sans-serif; }
    .cp-report { max-width: 1100px; margin: 0 auto; }
    .cp-header { background: linear-gradient(120deg, #0f172a, #1e293b); border: 1px solid #334155; border-radius: 14px; padding: 18px; margin-bottom: 16px; }
    .cp-header h1 { margin: 0 0 8px 0; color: #f8fafc; }
    .muted { margin: 0; color: #94a3b8; }
    .cp-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
    .cp-kpi { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 12px; }
    .cp-kpi h3 { margin: 0 0 6px 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .cp-kpi p { margin: 0; color: #f8fafc; font-size: 20px; font-weight: 700; }
    section { margin-bottom: 16px; background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 12px; }
    h2 { margin: 0 0 10px 0; color: #f8fafc; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #1e293b; padding: 8px; font-size: 13px; text-align: left; }
    th { color: #f59e0b; font-weight: 700; }
    td { color: #cbd5e1; }
    @media print {
      body { background: white; color: #0f172a; }
      .cp-header, section, .cp-kpi { border-color: #d1d5db; background: white; }
      th { color: #b45309; }
      td { color: #111827; }
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>
  `;
};

export const exportProjectControlHTML = (payload) => {
  const html = buildStandaloneHtml(payload);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Project_Control_${formatDateInput()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportProjectControlPDF = async (payload) => {
  const content = buildReportContent(payload);
  const temp = document.createElement('div');
  temp.style.background = '#020617';
  temp.style.color = '#e2e8f0';
  temp.style.padding = '16px';
  temp.style.width = '1100px';
  setSafeHtml(temp, content);
  document.body.appendChild(temp);

  try {
    await saveElementAsPdf(temp, {
      margin: 8,
      filename: `Project_Control_${formatDateInput()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    });
  } finally {
    document.body.removeChild(temp);
  }
};
