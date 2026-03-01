
import { saveElementAsPdf } from '@/services/pdfExportRuntime';
import { resolveAccountingCurrency } from '@/utils/accountingCurrency';

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
    await saveElementAsPdf(element, { ...PDF_OPTIONS, filename });
  } finally {
    document.body.removeChild(element);
  }
}

// ============================================================================
// BALANCE SHEET PDF
// ============================================================================

export async function exportBalanceSheetPDF(balanceSheet, companyInfo, period) {
  const { totalAssets, totalPassif, balanced, syscohada } = balanceSheet;
  const cur = resolveAccountingCurrency(companyInfo);

  function fmtCur(n) {
    try {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
    } catch { return formatAmount(n); }
  }

  const renderSyscohadaSide = (sections) => sections.map(sec => `
    <tr><td colspan="3" style="padding:6px 4px 3px;font-weight:bold;background:#F3F4F6;font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:#374151;">${sec.label}</td>
    <td style="padding:6px 4px 3px;text-align:right;background:#F3F4F6;font-weight:bold;font-family:monospace;font-size:9px;color:#374151;">${fmtCur(sec.total)}</td></tr>
    ${(sec.groups || []).map(g => `
      <tr><td colspan="3" style="padding:4px 4px 2px 10px;font-weight:600;color:#B45309;font-size:8px;text-transform:uppercase;">
        <span style="font-family:monospace;margin-right:4px;">${g.classCode}</span>${g.className}
      </td>
      <td style="padding:4px 4px 2px;text-align:right;font-family:monospace;font-size:8px;color:#B45309;font-weight:600;">${fmtCur(g.subtotal)}</td></tr>
      ${g.accounts.map(a => `
        <tr${a.balance === 0 ? ' style="opacity:0.5;"' : ''}>
          <td style="padding:2px 4px 2px 20px;font-family:monospace;color:#6B7280;font-size:7px;width:10%;">${a.account_code}</td>
          <td colspan="2" style="padding:2px 4px;font-size:8px;color:#1F2937;">${a.account_name}</td>
          <td style="padding:2px 4px;text-align:right;font-family:monospace;font-size:8px;">${fmtCur(a.balance)}</td>
        </tr>
      `).join('')}
    `).join('')}
  `).join('');

  // Company header with full info
  const addr = [companyInfo?.address, companyInfo?.postal_code, companyInfo?.city, companyInfo?.country].filter(Boolean).join(', ');
  const regNum = companyInfo?.registration_number || companyInfo?.siret || '';
  const vatNum = companyInfo?.vat_number || '';
  const now = new Date();

  const html = `
    <div style="margin-bottom:15px;padding-bottom:12px;border-bottom:2px solid #F59E0B;">
      <h1 style="margin:0;font-size:18px;color:#1F2937;">${companyInfo?.company_name || 'Société'}</h1>
      ${addr ? `<p style="margin:2px 0 0;font-size:10px;color:#6B7280;">${addr}</p>` : ''}
      ${regNum ? `<p style="margin:1px 0 0;font-size:9px;color:#9CA3AF;">N° ${regNum}${vatNum ? ` — TVA: ${vatNum}` : ''}</p>` : ''}
      <h2 style="margin:10px 0 0;font-size:16px;color:#1F2937;">BILAN COMPTABLE SYSCOHADA</h2>
      <p style="margin:2px 0 0;font-size:10px;color:#6B7280;">
        Exercice du ${new Date(period.startDate).toLocaleDateString('fr-FR')} au ${new Date(period.endDate).toLocaleDateString('fr-FR')}
      </p>
      <p style="margin:1px 0 0;font-size:8px;color:#9CA3AF;">
        Édité le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')} — Devise: ${cur}
      </p>
    </div>

    ${syscohada ? `
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:8px;">
          <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;">
            <thead><tr style="background:#3B82F6;color:white;">
              <th colspan="3" style="text-align:left;padding:6px;font-size:11px;">ACTIF</th>
              <th style="text-align:right;padding:6px;font-size:11px;font-family:monospace;">${fmtCur(totalAssets)}</th>
            </tr></thead>
            <tbody>${renderSyscohadaSide(syscohada.actif)}</tbody>
            <tfoot><tr style="border-top:2px solid #3B82F6;background:#EFF6FF;">
              <td colspan="3" style="padding:6px;font-weight:bold;font-size:11px;">TOTAL ACTIF</td>
              <td style="padding:6px;text-align:right;font-weight:bold;font-family:monospace;font-size:11px;color:#3B82F6;">${fmtCur(totalAssets)}</td>
            </tr></tfoot>
          </table>
        </td>
        <td style="width:50%;vertical-align:top;padding-left:8px;">
          <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;">
            <thead><tr style="background:#EF4444;color:white;">
              <th colspan="3" style="text-align:left;padding:6px;font-size:11px;">PASSIF</th>
              <th style="text-align:right;padding:6px;font-size:11px;font-family:monospace;">${fmtCur(totalPassif)}</th>
            </tr></thead>
            <tbody>${renderSyscohadaSide(syscohada.passif)}</tbody>
            <tfoot><tr style="border-top:2px solid #EF4444;background:#FEF2F2;">
              <td colspan="3" style="padding:6px;font-weight:bold;font-size:11px;">TOTAL PASSIF</td>
              <td style="padding:6px;text-align:right;font-weight:bold;font-family:monospace;font-size:11px;color:#EF4444;">${fmtCur(totalPassif)}</td>
            </tr></tfoot>
          </table>
        </td>
      </tr>
    </table>
    ` : '<p>Aucune donnée SYSCOHADA disponible</p>'}

    <div style="margin-top:12px;padding:8px;border:1px solid ${balanced ? '#10B981' : '#EF4444'};border-radius:4px;background:${balanced ? '#ECFDF5' : '#FEF2F2'};font-size:10px;">
      <strong>${balanced ? '✓ Bilan équilibré' : '⚠ Bilan déséquilibré'}</strong> —
      Actif: ${fmtCur(totalAssets)} | Passif: ${fmtCur(totalPassif)}
      ${!balanced ? ` | Écart: ${fmtCur(Math.abs(totalAssets - totalPassif))}` : ''}
    </div>
    <p style="margin-top:10px;text-align:center;font-size:7px;color:#9CA3AF;">
      Document généré par CashPilot — ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR')}
    </p>
  `;

  const el = createContainer(html);
  await generatePDF(el, `Bilan_SYSCOHADA_${period?.endDate || 'export'}.pdf`);
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

// ============================================================================
// FINANCIAL ANNEXES PDF (Notes aux états financiers)
// ============================================================================

export async function exportFinancialAnnexesPDF(annexesData, companyInfo, period) {
  const { trialBalance, netIncome } = annexesData || {};
  const tb = trialBalance || [];
  const cur = resolveAccountingCurrency(companyInfo);

  function fmtCur(n) {
    try {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
    } catch { return formatAmount(n); }
  }

  function groupByPrefix(prefix) {
    return tb.filter(t => t.account_code && t.account_code.startsWith(prefix) && Math.abs(t.balance) >= 0.01);
  }

  function renderAccountRows(accounts) {
    if (!accounts || accounts.length === 0) {
      return '<tr><td colspan="3" style="padding:6px;font-style:italic;color:#9CA3AF;">Aucune donnee</td></tr>';
    }
    return accounts.map(a => `
      <tr>
        <td style="padding:4px 6px;font-family:monospace;font-size:9px;color:#6B7280;">${a.account_code}</td>
        <td style="padding:4px 6px;font-size:10px;">${a.account_name || '-'}</td>
        <td style="padding:4px 6px;text-align:right;font-family:monospace;font-size:10px;">${fmtCur(a.balance)}</td>
      </tr>
    `).join('');
  }

  function sectionHeader(num, title, color) {
    return `<h3 style="font-size:13px;color:${color};border-bottom:1px solid ${color};padding-bottom:4px;margin:18px 0 8px;">
      Note ${num} : ${title}
    </h3>`;
  }

  const immobilisations = groupByPrefix('2');
  const stocks = groupByPrefix('3');
  const creances = tb.filter(t => t.account_code?.startsWith('4') && t.account_type === 'asset' && Math.abs(t.balance) >= 0.01);
  const dettes = tb.filter(t => t.account_code?.startsWith('4') && t.account_type === 'liability' && Math.abs(t.balance) >= 0.01);
  const tresorerie = groupByPrefix('5');
  const ca = tb.filter(t => t.account_code?.startsWith('70') && Math.abs(t.balance) >= 0.01);
  const charges = tb.filter(t => t.account_code && ['60','61','62','63','64','65'].some(p => t.account_code.startsWith(p)) && Math.abs(t.balance) >= 0.01);

  const sum = arr => arr.reduce((s, a) => s + (a.balance || 0), 0);
  const planName = companyInfo?.country === 'OHADA' ? 'SYSCOHADA Révisé' : companyInfo?.country === 'BE' ? 'PCMN Belge' : 'PCG Français';

  const tableStyle = 'width:100%;border-collapse:collapse;margin-bottom:10px;';

  const html = `
    ${createHeader('Notes aux États Financiers', companyInfo, period)}

    ${sectionHeader(1, 'Règles et méthodes comptables', '#F59E0B')}
    <table style="${tableStyle}">
      <tr><td style="padding:4px 6px;color:#6B7280;">Plan comptable</td><td style="padding:4px 6px;font-weight:bold;">${planName}</td></tr>
      <tr style="background:#F9FAFB;"><td style="padding:4px 6px;color:#6B7280;">Devise</td><td style="padding:4px 6px;font-weight:bold;">${cur}</td></tr>
      <tr><td style="padding:4px 6px;color:#6B7280;">Méthode d'inventaire</td><td style="padding:4px 6px;">Inventaire permanent</td></tr>
      <tr style="background:#F9FAFB;"><td style="padding:4px 6px;color:#6B7280;">Convention</td><td style="padding:4px 6px;">Coût historique, continuité d'exploitation, prudence</td></tr>
    </table>

    ${sectionHeader(2, 'Immobilisations', '#3B82F6')}
    <table style="${tableStyle}">
      ${renderAccountRows(immobilisations)}
      <tr style="border-top:1px solid #E5E7EB;"><td colspan="2" style="padding:6px;font-weight:bold;">Total</td><td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;">${fmtCur(sum(immobilisations))}</td></tr>
    </table>

    ${sectionHeader(3, 'Stocks et en-cours', '#10B981')}
    <table style="${tableStyle}">
      ${renderAccountRows(stocks)}
      <tr style="border-top:1px solid #E5E7EB;"><td colspan="2" style="padding:6px;font-weight:bold;">Total</td><td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;">${fmtCur(sum(stocks))}</td></tr>
    </table>

    ${sectionHeader(4, 'Créances et dettes', '#8B5CF6')}
    <p style="font-size:11px;font-weight:bold;color:#3B82F6;margin:8px 0 4px;">Créances</p>
    <table style="${tableStyle}">
      ${renderAccountRows(creances)}
      <tr style="border-top:1px solid #E5E7EB;"><td colspan="2" style="padding:6px;font-weight:bold;">Total créances</td><td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;">${fmtCur(sum(creances))}</td></tr>
    </table>
    <p style="font-size:11px;font-weight:bold;color:#EF4444;margin:8px 0 4px;">Dettes</p>
    <table style="${tableStyle}">
      ${renderAccountRows(dettes)}
      <tr style="border-top:1px solid #E5E7EB;"><td colspan="2" style="padding:6px;font-weight:bold;">Total dettes</td><td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;">${fmtCur(sum(dettes))}</td></tr>
    </table>

    ${sectionHeader(5, 'Trésorerie', '#06B6D4')}
    <table style="${tableStyle}">
      ${renderAccountRows(tresorerie)}
      <tr style="border-top:1px solid #E5E7EB;"><td colspan="2" style="padding:6px;font-weight:bold;">Total</td><td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;">${fmtCur(sum(tresorerie))}</td></tr>
    </table>

    ${sectionHeader(6, "Chiffre d'affaires", '#16A34A')}
    <table style="${tableStyle}">
      ${renderAccountRows(ca)}
      <tr style="border-top:1px solid #E5E7EB;"><td colspan="2" style="padding:6px;font-weight:bold;">Total CA</td><td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;color:#16A34A;">${fmtCur(sum(ca))}</td></tr>
    </table>

    ${sectionHeader(7, "Charges d'exploitation", '#DC2626')}
    <table style="${tableStyle}">
      ${renderAccountRows(charges)}
      <tr style="border-top:1px solid #E5E7EB;"><td colspan="2" style="padding:6px;font-weight:bold;">Total charges</td><td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;color:#DC2626;">${fmtCur(sum(charges))}</td></tr>
    </table>

    ${sectionHeader(8, 'Résultat fiscal et impôts', '#F59E0B')}
    <table style="${tableStyle}">
      <tr><td style="padding:6px;">Résultat net</td><td style="padding:6px;text-align:right;font-family:monospace;font-weight:bold;color:${(netIncome || 0) >= 0 ? '#16A34A' : '#DC2626'};">${fmtCur(netIncome)}</td></tr>
    </table>

    ${sectionHeader(9, 'Engagements hors bilan', '#6B7280')}
    <p style="font-size:10px;font-style:italic;color:#9CA3AF;">Néant. Aucun engagement hors bilan identifié à la date de clôture.</p>

    <div style="margin-top:20px;padding-top:10px;border-top:1px solid #E5E7EB;text-align:center;">
      <p style="font-size:8px;color:#9CA3AF;">Notes aux états financiers générées par CashPilot — ${new Date().toLocaleDateString('fr-FR')}</p>
    </div>
  `;

  const el = createContainer(html);
  await generatePDF(el, `Annexes_Comptables_${period?.endDate || 'export'}.pdf`);
}
