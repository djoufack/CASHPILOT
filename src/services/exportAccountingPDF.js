
import html2pdf from 'html2pdf.js';

const PDF_OPTIONS = {
  margin: 10,
  filename: 'report.pdf',
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2 },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
};

function createHeader(title, companyInfo, period) {
  const companyName = companyInfo?.company_name || 'Ma Société';
  const periodStr = period
    ? `Du ${new Date(period.startDate).toLocaleDateString('fr-FR')} au ${new Date(period.endDate).toLocaleDateString('fr-FR')}`
    : '';

  return `
    <div style="margin-bottom:20px;padding-bottom:15px;border-bottom:2px solid #F59E0B;">
      <h1 style="margin:0;font-size:22px;color:#1F2937;">${title}</h1>
      <p style="margin:5px 0 0;font-size:14px;color:#6B7280;">${companyName}</p>
      ${periodStr ? `<p style="margin:3px 0 0;font-size:12px;color:#9CA3AF;">${periodStr}</p>` : ''}
      <p style="margin:3px 0 0;font-size:10px;color:#9CA3AF;">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
    </div>
  `;
}

function formatAmount(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
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
// BALANCE SHEET PDF
// ============================================================================

export async function exportBalanceSheetPDF(balanceSheet, companyInfo, period) {
  const { assets, liabilities, equity, totalAssets, totalPassif } = balanceSheet;

  const renderGroups = (groups) => groups.map(g => `
    <tr><td colspan="2" style="padding:8px 5px;font-weight:bold;color:#F59E0B;font-size:11px;text-transform:uppercase;">${g.category}</td></tr>
    ${g.accounts.filter(a => a.balance !== 0).map(a => `
      <tr>
        <td style="padding:4px 5px 4px 20px;"><span style="font-family:monospace;color:#6B7280;font-size:10px;">${a.account_code}</span> ${a.account_name}</td>
        <td style="padding:4px 5px;text-align:right;font-family:monospace;">${formatAmount(a.balance)}</td>
      </tr>
    `).join('')}
  `).join('');

  const html = `
    ${createHeader('Bilan', companyInfo, period)}
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:10px;">
          <h2 style="font-size:14px;color:#3B82F6;border-bottom:1px solid #E5E7EB;padding-bottom:5px;">ACTIF</h2>
          <table style="width:100%;border-collapse:collapse;">${renderGroups(assets)}</table>
          <div style="border-top:2px solid #3B82F6;margin-top:10px;padding-top:8px;text-align:right;font-weight:bold;">
            Total Actif : ${formatAmount(totalAssets)}
          </div>
        </td>
        <td style="width:50%;vertical-align:top;padding-left:10px;">
          <h2 style="font-size:14px;color:#EF4444;border-bottom:1px solid #E5E7EB;padding-bottom:5px;">PASSIF & CAPITAUX PROPRES</h2>
          <table style="width:100%;border-collapse:collapse;">
            ${renderGroups(liabilities)}
            ${renderGroups(equity)}
          </table>
          <div style="border-top:2px solid #EF4444;margin-top:10px;padding-top:8px;text-align:right;font-weight:bold;">
            Total Passif : ${formatAmount(totalPassif)}
          </div>
        </td>
      </tr>
    </table>
  `;

  const el = createContainer(html);
  await generatePDF(el, `Bilan_${period?.endDate || 'export'}.pdf`);
}

// ============================================================================
// INCOME STATEMENT PDF
// ============================================================================

export async function exportIncomeStatementPDF(incomeStatement, companyInfo, period) {
  const { totalRevenue, totalExpenses, netIncome } = incomeStatement;
  const isProfit = netIncome >= 0;

  const html = `
    ${createHeader('Compte de Résultat', companyInfo, period)}
    <table style="width:100%;border-collapse:collapse;">
      <tr style="background:#F0FDF4;">
        <td style="padding:10px;font-weight:bold;color:#16A34A;">PRODUITS</td>
        <td style="padding:10px;text-align:right;font-weight:bold;color:#16A34A;font-family:monospace;">${formatAmount(totalRevenue)}</td>
      </tr>
      <tr style="background:#FEF2F2;">
        <td style="padding:10px;font-weight:bold;color:#DC2626;">CHARGES</td>
        <td style="padding:10px;text-align:right;font-weight:bold;color:#DC2626;font-family:monospace;">${formatAmount(totalExpenses)}</td>
      </tr>
      <tr style="border-top:3px solid ${isProfit ? '#16A34A' : '#DC2626'};">
        <td style="padding:12px;font-weight:bold;font-size:14px;">RÉSULTAT NET (${isProfit ? 'Bénéfice' : 'Perte'})</td>
        <td style="padding:12px;text-align:right;font-weight:bold;font-size:16px;color:${isProfit ? '#16A34A' : '#DC2626'};font-family:monospace;">${formatAmount(netIncome)}</td>
      </tr>
    </table>
  `;

  const el = createContainer(html);
  await generatePDF(el, `Compte_Resultat_${period?.endDate || 'export'}.pdf`);
}

// ============================================================================
// VAT DECLARATION PDF
// ============================================================================

export async function exportVATDeclarationPDF(vatData, companyInfo, period) {
  const { outputVAT, inputVAT, vatPayable } = vatData;

  const html = `
    ${createHeader('Déclaration de TVA', companyInfo, period)}
    <table style="width:100%;border-collapse:collapse;margin-top:10px;">
      <tr style="background:#F0FDF4;">
        <td style="padding:12px;">TVA collectée (sur les ventes)</td>
        <td style="padding:12px;text-align:right;font-family:monospace;font-weight:bold;color:#16A34A;">${formatAmount(outputVAT)}</td>
      </tr>
      <tr style="background:#EFF6FF;">
        <td style="padding:12px;">TVA déductible (sur les achats)</td>
        <td style="padding:12px;text-align:right;font-family:monospace;font-weight:bold;color:#2563EB;">- ${formatAmount(inputVAT)}</td>
      </tr>
      <tr style="border-top:3px solid #F59E0B;">
        <td style="padding:14px;font-weight:bold;font-size:14px;">TVA à payer</td>
        <td style="padding:14px;text-align:right;font-weight:bold;font-size:16px;color:${vatPayable >= 0 ? '#DC2626' : '#16A34A'};font-family:monospace;">${formatAmount(vatPayable)}</td>
      </tr>
    </table>
    ${vatPayable < 0 ? '<p style="margin-top:10px;color:#16A34A;font-style:italic;">Crédit de TVA reportable</p>' : ''}
  `;

  const el = createContainer(html);
  await generatePDF(el, `Declaration_TVA_${period?.endDate || 'export'}.pdf`);
}

// ============================================================================
// TAX ESTIMATION PDF
// ============================================================================

export async function exportTaxEstimationPDF(taxData, companyInfo, period) {
  const { netIncome, taxEstimate } = taxData;

  const detailRows = (taxEstimate?.details || []).map(d => `
    <tr>
      <td style="padding:8px;">${d.label}</td>
      <td style="padding:8px;text-align:right;font-family:monospace;">${formatAmount(d.taxableAmount)}</td>
      <td style="padding:8px;text-align:center;">${(d.rate * 100).toFixed(0)}%</td>
      <td style="padding:8px;text-align:right;font-family:monospace;font-weight:bold;">${formatAmount(d.tax)}</td>
    </tr>
  `).join('');

  const html = `
    ${createHeader("Estimation d'Impôt", companyInfo, period)}
    <p style="font-size:13px;margin-bottom:15px;">Bénéfice imposable : <strong style="font-family:monospace;">${formatAmount(netIncome)}</strong></p>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#F3F4F6;">
          <th style="padding:8px;text-align:left;">Tranche</th>
          <th style="padding:8px;text-align:right;">Base</th>
          <th style="padding:8px;text-align:center;">Taux</th>
          <th style="padding:8px;text-align:right;">Impôt</th>
        </tr>
      </thead>
      <tbody>${detailRows}</tbody>
      <tfoot>
        <tr style="border-top:2px solid #F59E0B;">
          <td colspan="3" style="padding:10px;font-weight:bold;">Total impôt estimé</td>
          <td style="padding:10px;text-align:right;font-weight:bold;font-size:14px;font-family:monospace;color:#F59E0B;">${formatAmount(taxEstimate?.totalTax || 0)}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:8px;color:#6B7280;">Provision trimestrielle</td>
          <td style="padding:8px;text-align:right;font-family:monospace;">${formatAmount(taxEstimate?.quarterlyPayment || 0)}</td>
        </tr>
      </tfoot>
    </table>
  `;

  const el = createContainer(html);
  await generatePDF(el, `Estimation_Impot_${period?.endDate || 'export'}.pdf`);
}
