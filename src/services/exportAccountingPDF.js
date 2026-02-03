
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

// ============================================================================
// BANK RECONCILIATION PDF
// ============================================================================

export async function exportReconciliationPDF(reconciliationData, companyInfo, period) {
  const {
    bankName, accountNumber,
    openingBalance, closingBalance,
    totalLines, matchedLines, unmatchedLines, ignoredLines,
    totalCredits, totalDebits, matchedCredits, matchedDebits,
    difference, unmatchedDetails = []
  } = reconciliationData;

  const matchRate = totalLines > 0 ? Math.round((matchedLines / totalLines) * 1000) / 10 : 0;

  const unmatchedRows = unmatchedDetails.slice(0, 30).map(line => `
    <tr>
      <td style="padding:6px 5px;font-size:10px;">${line.transaction_date ? new Date(line.transaction_date).toLocaleDateString('fr-FR') : '—'}</td>
      <td style="padding:6px 5px;font-size:10px;max-width:250px;overflow:hidden;text-overflow:ellipsis;">${line.description || '—'}</td>
      <td style="padding:6px 5px;text-align:right;font-family:monospace;font-size:10px;color:${line.amount >= 0 ? '#16A34A' : '#DC2626'};">
        ${formatAmount(line.amount)}
      </td>
    </tr>
  `).join('');

  const html = `
    ${createHeader('Rapport de Rapprochement Bancaire', companyInfo, period)}

    <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
      <tr style="background:#F3F4F6;">
        <td style="padding:10px;font-weight:bold;width:50%;">Banque</td>
        <td style="padding:10px;">${bankName || '—'}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold;">Compte</td>
        <td style="padding:10px;">${accountNumber || '—'}</td>
      </tr>
      ${openingBalance != null ? `<tr style="background:#F3F4F6;"><td style="padding:10px;font-weight:bold;">Solde initial</td><td style="padding:10px;font-family:monospace;">${formatAmount(openingBalance)}</td></tr>` : ''}
      ${closingBalance != null ? `<tr><td style="padding:10px;font-weight:bold;">Solde final</td><td style="padding:10px;font-family:monospace;">${formatAmount(closingBalance)}</td></tr>` : ''}
    </table>

    <h2 style="font-size:14px;color:#F59E0B;margin:15px 0 8px;">Résumé du rapprochement</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
      <tr style="background:#F0FDF4;">
        <td style="padding:8px;">Lignes rapprochées</td>
        <td style="padding:8px;text-align:right;font-weight:bold;color:#16A34A;">${matchedLines} / ${totalLines} (${matchRate}%)</td>
      </tr>
      <tr style="background:#FFFBEB;">
        <td style="padding:8px;">Lignes non rapprochées</td>
        <td style="padding:8px;text-align:right;font-weight:bold;color:#D97706;">${unmatchedLines}</td>
      </tr>
      <tr style="background:#F3F4F6;">
        <td style="padding:8px;">Lignes ignorées</td>
        <td style="padding:8px;text-align:right;color:#6B7280;">${ignoredLines}</td>
      </tr>
      <tr>
        <td style="padding:8px;">Total crédits</td>
        <td style="padding:8px;text-align:right;font-family:monospace;color:#16A34A;">${formatAmount(totalCredits)}</td>
      </tr>
      <tr style="background:#F3F4F6;">
        <td style="padding:8px;">Total débits</td>
        <td style="padding:8px;text-align:right;font-family:monospace;color:#DC2626;">${formatAmount(totalDebits)}</td>
      </tr>
      <tr style="border-top:2px solid #F59E0B;">
        <td style="padding:10px;font-weight:bold;font-size:13px;">Écart non rapproché</td>
        <td style="padding:10px;text-align:right;font-weight:bold;font-size:14px;font-family:monospace;color:${difference === 0 ? '#16A34A' : '#D97706'};">${formatAmount(difference)}</td>
      </tr>
    </table>

    ${unmatchedDetails.length > 0 ? `
      <h2 style="font-size:14px;color:#F59E0B;margin:15px 0 8px;">Détail des lignes non rapprochées</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#F3F4F6;">
            <th style="padding:6px 5px;text-align:left;font-size:10px;">Date</th>
            <th style="padding:6px 5px;text-align:left;font-size:10px;">Libellé</th>
            <th style="padding:6px 5px;text-align:right;font-size:10px;">Montant</th>
          </tr>
        </thead>
        <tbody>${unmatchedRows}</tbody>
      </table>
      ${unmatchedDetails.length > 30 ? `<p style="font-size:9px;color:#9CA3AF;margin-top:5px;">... et ${unmatchedDetails.length - 30} autres lignes</p>` : ''}
    ` : ''}
  `;

  const el = createContainer(html);
  await generatePDF(el, `Rapprochement_Bancaire_${period?.endDate || 'export'}.pdf`);
}

// ============================================================================
// FINANCIAL DIAGNOSTIC PDF
// ============================================================================

export async function exportFinancialDiagnosticPDF(diagnostic, companyInfo, period) {
  if (!diagnostic || !diagnostic.valid) {
    console.error('Diagnostic invalide pour l\'export PDF');
    return;
  }

  const { margins, financing, ratios } = diagnostic;

  const html = `
    ${createHeader('Diagnostic Financier', companyInfo, period)}

    <!-- Section 1: Analyse des Marges -->
    <h2 style="font-size:16px;color:#3B82F6;border-bottom:2px solid #3B82F6;padding-bottom:5px;margin:20px 0 10px;">
      Analyse des Marges
    </h2>

    <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
      <thead>
        <tr style="background:#F3F4F6;">
          <th style="padding:8px;text-align:left;font-size:11px;">Indicateur</th>
          <th style="padding:8px;text-align:right;font-size:11px;">Montant</th>
          <th style="padding:8px;text-align:right;font-size:11px;">% du CA</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:8px;font-weight:bold;">Chiffre d'affaires</td>
          <td style="padding:8px;text-align:right;font-family:monospace;font-weight:bold;">${formatAmount(margins.revenue)}</td>
          <td style="padding:8px;text-align:right;font-family:monospace;">100.0%</td>
        </tr>
        <tr style="background:#F9FAFB;">
          <td style="padding:8px;">Marge brute</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:${margins.grossMargin >= 0 ? '#10B981' : '#EF4444'};">${formatAmount(margins.grossMargin)}</td>
          <td style="padding:8px;text-align:right;font-family:monospace;">${margins.grossMarginPercent.toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="padding:8px;">EBE / EBITDA</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:${margins.ebitda >= 0 ? '#10B981' : '#EF4444'};">${formatAmount(margins.ebitda)}</td>
          <td style="padding:8px;text-align:right;font-family:monospace;">${margins.ebitdaMargin.toFixed(1)}%</td>
        </tr>
        <tr style="background:#F9FAFB;">
          <td style="padding:8px;">Résultat d'exploitation</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:${margins.operatingResult >= 0 ? '#10B981' : '#EF4444'};">${formatAmount(margins.operatingResult)}</td>
          <td style="padding:8px;text-align:right;font-family:monospace;">${margins.operatingMargin.toFixed(1)}%</td>
        </tr>
      </tbody>
    </table>

    <!-- Section 2: Analyse du Financement -->
    <h2 style="font-size:16px;color:#8B5CF6;border-bottom:2px solid #8B5CF6;padding-bottom:5px;margin:20px 0 10px;">
      Analyse du Financement
    </h2>

    <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
      <tbody>
        <tr>
          <td style="padding:8px;font-weight:bold;">Capacité d'Autofinancement (CAF)</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:${financing.caf >= 0 ? '#10B981' : '#EF4444'};font-weight:bold;">${formatAmount(financing.caf)}</td>
        </tr>
        <tr style="background:#F9FAFB;">
          <td style="padding:8px;">Fonds de Roulement</td>
          <td style="padding:8px;text-align:right;font-family:monospace;">${formatAmount(financing.workingCapital)}</td>
        </tr>
        <tr>
          <td style="padding:8px;">Besoin en Fonds de Roulement (BFR)</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:${financing.bfr >= 0 ? '#F59E0B' : '#10B981'};">${formatAmount(financing.bfr)}</td>
        </tr>
        <tr style="background:#F9FAFB;">
          <td style="padding:8px;padding-left:20px;font-size:10px;">Variation du BFR</td>
          <td style="padding:8px;text-align:right;font-family:monospace;font-size:10px;">${financing.bfrVariation >= 0 ? '+' : ''}${formatAmount(financing.bfrVariation)}</td>
        </tr>
        <tr>
          <td style="padding:8px;font-weight:bold;">Flux de Trésorerie d'Exploitation</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:${financing.operatingCashFlow >= 0 ? '#10B981' : '#EF4444'};font-weight:bold;">${formatAmount(financing.operatingCashFlow)}</td>
        </tr>
        <tr style="background:#F9FAFB;">
          <td style="padding:8px;">Endettement Net</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:${financing.netDebt >= 0 ? '#F59E0B' : '#10B981'};">${formatAmount(financing.netDebt)}</td>
        </tr>
        <tr>
          <td style="padding:8px;padding-left:20px;font-size:10px;">Capitaux Propres</td>
          <td style="padding:8px;text-align:right;font-family:monospace;font-size:10px;">${formatAmount(financing.equity)}</td>
        </tr>
        <tr style="background:#F9FAFB;">
          <td style="padding:8px;padding-left:20px;font-size:10px;">Dettes Totales</td>
          <td style="padding:8px;text-align:right;font-family:monospace;font-size:10px;">${formatAmount(financing.totalDebt)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Section 3: Ratios Clés -->
    <h2 style="font-size:16px;color:#6366F1;border-bottom:2px solid #6366F1;padding-bottom:5px;margin:20px 0 10px;">
      Ratios Clés
    </h2>

    <h3 style="font-size:13px;color:#10B981;margin:15px 0 8px;">Rentabilité</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
      <tbody>
        <tr>
          <td style="padding:6px;">ROE (Return on Equity)</td>
          <td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;">${ratios.profitability.roe.toFixed(2)}%</td>
          <td style="padding:6px;text-align:right;font-size:10px;color:${ratios.profitability.roe >= 15 ? '#10B981' : ratios.profitability.roe >= 10 ? '#F59E0B' : '#EF4444'};">
            ${ratios.profitability.roe >= 15 ? 'Excellent' : ratios.profitability.roe >= 10 ? 'Bon' : 'Moyen'}
          </td>
        </tr>
        <tr style="background:#F9FAFB;">
          <td style="padding:6px;">ROCE (Return on Capital Employed)</td>
          <td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;">${ratios.profitability.roce.toFixed(2)}%</td>
          <td style="padding:6px;text-align:right;font-size:10px;color:${ratios.profitability.roce >= 10 ? '#10B981' : ratios.profitability.roce >= 7 ? '#F59E0B' : '#EF4444'};">
            ${ratios.profitability.roce >= 10 ? 'Bon' : ratios.profitability.roce >= 7 ? 'Moyen' : 'Faible'}
          </td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-size:13px;color:#3B82F6;margin:15px 0 8px;">Liquidité</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
      <tbody>
        <tr>
          <td style="padding:6px;">Ratio de Liquidité Générale</td>
          <td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;">${ratios.liquidity.currentRatio.toFixed(2)}</td>
          <td style="padding:6px;text-align:right;font-size:10px;color:${ratios.liquidity.currentRatio >= 1.5 ? '#10B981' : ratios.liquidity.currentRatio >= 1.0 ? '#F59E0B' : '#EF4444'};">
            ${ratios.liquidity.currentRatio >= 1.5 ? 'Bon' : ratios.liquidity.currentRatio >= 1.0 ? 'Acceptable' : 'Risque'}
          </td>
        </tr>
        <tr style="background:#F9FAFB;">
          <td style="padding:6px;">Ratio de Liquidité Réduite</td>
          <td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;">${ratios.liquidity.quickRatio.toFixed(2)}</td>
          <td style="padding:6px;text-align:right;font-size:10px;color:${ratios.liquidity.quickRatio >= 1.0 ? '#10B981' : ratios.liquidity.quickRatio >= 0.75 ? '#F59E0B' : '#EF4444'};">
            ${ratios.liquidity.quickRatio >= 1.0 ? 'Bon' : ratios.liquidity.quickRatio >= 0.75 ? 'Correct' : 'Attention'}
          </td>
        </tr>
        <tr>
          <td style="padding:6px;">Ratio de Liquidité Immédiate</td>
          <td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;">${ratios.liquidity.cashRatio.toFixed(2)}</td>
          <td style="padding:6px;text-align:right;font-size:10px;color:${ratios.liquidity.cashRatio >= 0.3 ? '#10B981' : ratios.liquidity.cashRatio >= 0.2 ? '#F59E0B' : '#EF4444'};">
            ${ratios.liquidity.cashRatio >= 0.3 ? 'Excellent' : ratios.liquidity.cashRatio >= 0.2 ? 'Suffisant' : 'Limité'}
          </td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-size:13px;color:#F59E0B;margin:15px 0 8px;">Structure Financière</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
      <tbody>
        <tr>
          <td style="padding:6px;">Levier Financier (Dette/Capitaux Propres)</td>
          <td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;">${ratios.leverage.financialLeverage.toFixed(2)}</td>
          <td style="padding:6px;text-align:right;font-size:10px;color:${ratios.leverage.financialLeverage < 1.0 ? '#10B981' : ratios.leverage.financialLeverage < 2.0 ? '#F59E0B' : '#EF4444'};">
            ${ratios.leverage.financialLeverage < 1.0 ? 'Faible' : ratios.leverage.financialLeverage < 2.0 ? 'Modéré' : 'Élevé'}
          </td>
        </tr>
        <tr style="background:#F9FAFB;">
          <td style="padding:6px;">Autonomie Financière</td>
          <td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;">${(1 / (1 + ratios.leverage.financialLeverage) * 100).toFixed(1)}%</td>
          <td style="padding:6px;text-align:right;font-size:10px;color:${ratios.leverage.financialLeverage < 1.0 ? '#10B981' : ratios.leverage.financialLeverage < 2.0 ? '#F59E0B' : '#EF4444'};">
            ${ratios.leverage.financialLeverage < 1.0 ? 'Indépendant' : ratios.leverage.financialLeverage < 2.0 ? 'Acceptable' : 'Dépendant'}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Footer -->
    <div style="margin-top:25px;padding-top:10px;border-top:1px solid #E5E7EB;font-size:9px;color:#9CA3AF;">
      <p style="margin:0;"><strong>Note:</strong> Ce diagnostic financier est basé sur les données comptables selon les normes OHADA.
      Les ratios et indicateurs sont calculés automatiquement et doivent être interprétés dans le contexte spécifique de votre activité.</p>
    </div>
  `;

  const el = createContainer(html);
  await generatePDF(el, `Diagnostic_Financier_${period?.endDate || 'export'}.pdf`);
}
