import { formatDateInput } from '@/utils/dateFormatting';

/**
 * Télécharge un fichier HTML
 * @param {string} html - Contenu HTML complet
 * @param {string} filename - Nom du fichier (sans extension)
 */
const downloadHTML = (html, filename) => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Export interactive HTML report for payment statistics
 * @param {Object} stats - Payment statistics data
 * @param {string} companyName - Company name
 * @param {Object} options - Export options (currency, etc.)
 */
export const exportPaymentStatsHTML = (stats, companyName, options = {}) => {
  const currency = options.currency || 'EUR';
  const fmtCurrency = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

  const volumeByMethod = stats.volumeByMethod || [];
  const cashFlowSummary = stats.cashFlowSummary || {};
  const balanceSummary = stats.balanceSummary || [];

  const totalVolume = volumeByMethod.reduce((sum, m) => sum + Number(m.volume || m.total || 0), 0);
  const totalInflow = Number(cashFlowSummary.totalInflow || 0);
  const totalOutflow = Number(cashFlowSummary.totalOutflow || 0);
  const net = totalInflow - totalOutflow;
  const totalBalance = balanceSummary.reduce((sum, b) => sum + Number(b.balance || b.current_balance || 0), 0);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Statistics - ${companyName || 'CashPilot'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif;
      padding: 40px 20px;
      max-width: 1200px;
      margin: 0 auto;
      background: #0a0e1a;
      color: #f1f5f9;
      line-height: 1.6;
    }

    .header {
      background: linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%);
      color: white;
      padding: 30px;
      margin-bottom: 30px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(14, 165, 233, 0.3);
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 8px;
      font-weight: 700;
    }
    .header p {
      font-size: 14px;
      opacity: 0.9;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 30px;
    }
    .kpi-card {
      background: #0f1528;
      padding: 20px;
      border-radius: 10px;
      border: 1px solid #1e293b;
    }
    .kpi-card .label {
      color: #64748b;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .kpi-card .value {
      font-size: 24px;
      font-weight: 700;
      margin-top: 6px;
      font-family: 'Courier New', monospace;
    }
    .kpi-card .value.green { color: #22c55e; }
    .kpi-card .value.red { color: #ef4444; }
    .kpi-card .value.blue { color: #3b82f6; }
    .kpi-card .value.purple { color: #a78bfa; }

    .section {
      margin: 32px 0;
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
      color: #e2e8f0;
      border-bottom: 2px solid #1e293b;
      padding-bottom: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: #0f1528;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #1e293b;
    }
    thead tr {
      background: #141c33;
    }
    th {
      padding: 14px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      border-bottom: 2px solid #1e293b;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #1e293b;
      font-size: 14px;
      color: #cbd5e1;
    }
    tbody tr:hover {
      background: #141c33;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
    .total-row {
      font-weight: 700;
      background: #141c33;
    }
    .total-row td {
      padding: 16px 12px;
      font-size: 15px;
      color: #f1f5f9;
      border-top: 2px solid #1e293b;
    }

    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .mono { font-family: 'Courier New', monospace; }

    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 2px solid #1e293b;
      text-align: center;
      color: #475569;
      font-size: 12px;
    }

    @media print {
      body { background: white; color: #1f2937; padding: 20px; }
      .header { background: #1f2937 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .kpi-card { background: #f8fafc; border-color: #e2e8f0; }
      .kpi-card .label { color: #6b7280; }
      .kpi-card .value { color: #111827; }
      .kpi-card .value.green { color: #16a34a; }
      .kpi-card .value.red { color: #dc2626; }
      .kpi-card .value.blue { color: #2563eb; }
      .kpi-card .value.purple { color: #7c3aed; }
      table { background: white; border-color: #e5e7eb; }
      thead tr { background: #f3f4f6; }
      th { color: #374151; border-color: #e5e7eb; }
      td { color: #1f2937; border-color: #f3f4f6; }
      tbody tr:hover { background: #f9fafb; }
      .total-row { background: #f3f4f6; }
      .total-row td { color: #111827; border-color: #e5e7eb; }
      .section-title { color: #111827; border-color: #e5e7eb; }
      .footer { color: #6b7280; border-color: #e5e7eb; }
    }

    @media (max-width: 768px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>PAYMENT STATISTICS</h1>
    <p>${companyName || 'Your Company'} - ${new Date().toLocaleDateString('fr-FR')}</p>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="label">Total Volume</div>
      <div class="value purple">${fmtCurrency(totalVolume)}</div>
    </div>
    <div class="kpi-card">
      <div class="label">Total Inflow</div>
      <div class="value green">${fmtCurrency(totalInflow)}</div>
    </div>
    <div class="kpi-card">
      <div class="label">Total Outflow</div>
      <div class="value red">${fmtCurrency(totalOutflow)}</div>
    </div>
    <div class="kpi-card">
      <div class="label">Net Cash Flow</div>
      <div class="value ${net >= 0 ? 'green' : 'red'}">${fmtCurrency(net)}</div>
    </div>
  </div>

  ${volumeByMethod.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Volume by Payment Method</h2>
    <table>
      <thead>
        <tr>
          <th>Method</th>
          <th class="text-right">Transaction Count</th>
          <th class="text-right">Volume</th>
          <th class="text-right">% of Total</th>
        </tr>
      </thead>
      <tbody>
        ${volumeByMethod.map(m => {
          const vol = Number(m.volume || m.total || 0);
          const pct = totalVolume > 0 ? ((vol / totalVolume) * 100).toFixed(1) : '0.0';
          return `
            <tr>
              <td style="font-weight: 600;">${m.method || m.payment_method || 'N/A'}</td>
              <td class="text-right">${m.count || m.transaction_count || 0}</td>
              <td class="text-right mono" style="color: #a78bfa;">${fmtCurrency(vol)}</td>
              <td class="text-right">${pct}%</td>
            </tr>
          `;
        }).join('')}
        <tr class="total-row">
          <td>TOTAL</td>
          <td class="text-right">${volumeByMethod.reduce((sum, m) => sum + Number(m.count || m.transaction_count || 0), 0)}</td>
          <td class="text-right mono">${fmtCurrency(totalVolume)}</td>
          <td class="text-right">100%</td>
        </tr>
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="section">
    <h2 class="section-title">Cash Flow Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-weight: 600;">Total Inflow</td>
          <td class="text-right mono" style="color: #22c55e;">${fmtCurrency(totalInflow)}</td>
        </tr>
        <tr>
          <td style="font-weight: 600;">Total Outflow</td>
          <td class="text-right mono" style="color: #ef4444;">${fmtCurrency(totalOutflow)}</td>
        </tr>
        <tr class="total-row">
          <td>NET CASH FLOW</td>
          <td class="text-right mono" style="color: ${net >= 0 ? '#22c55e' : '#ef4444'};">${fmtCurrency(net)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${balanceSummary.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Balance Summary by Instrument</h2>
    <table>
      <thead>
        <tr>
          <th>Instrument</th>
          <th>Type</th>
          <th class="text-center">Currency</th>
          <th class="text-right">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${balanceSummary.map(b => {
          const bal = Number(b.balance || b.current_balance || 0);
          return `
            <tr>
              <td style="font-weight: 600;">${b.label || b.instrument_label || 'N/A'}</td>
              <td>${b.type || b.instrument_type || 'N/A'}</td>
              <td class="text-center">${b.currency || currency}</td>
              <td class="text-right mono" style="color: ${bal >= 0 ? '#22c55e' : '#ef4444'};">${fmtCurrency(bal)}</td>
            </tr>
          `;
        }).join('')}
        <tr class="total-row">
          <td colspan="3">TOTAL BALANCE</td>
          <td class="text-right mono" style="color: ${totalBalance >= 0 ? '#22c55e' : '#ef4444'};">${fmtCurrency(totalBalance)}</td>
        </tr>
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>Payment Statistics report generated by CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
  </div>
</body>
</html>`;

  downloadHTML(html, `Payment_Stats_${formatDateInput()}`);
};
