import { getLocale } from '@/utils/dateLocale';
import { resolveAccountingCurrency } from '@/utils/accountingCurrency';

/**
 * Service générique pour export de documents en HTML standalone téléchargeable
 *
 * Ce service permet de générer des fichiers HTML autonomes et lisibles hors ligne
 * pour tous les types de documents et rapports de l'application.
 */

/**
 * Génère un document HTML complet et autonome
 * @param {string} title - Titre du document
 * @param {string} content - Contenu HTML du document
 * @param {string} styles - Styles CSS additionnels (optionnel)
 * @returns {string} HTML complet prêt à être téléchargé
 */
export const generateHTMLDocument = (title, content, styles = '') => {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    /* Reset & Base */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif;
      padding: 40px 20px;
      max-width: 1200px;
      margin: 0 auto;
      background: #ffffff;
      color: #1f2937;
      line-height: 1.6;
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
      color: white;
      padding: 30px;
      margin-bottom: 30px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
      font-weight: 700;
    }
    .header p {
      font-size: 14px;
      opacity: 0.9;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      background: white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    thead tr {
      background: #f3f4f6;
    }
    th {
      padding: 14px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 14px;
    }
    tbody tr:hover {
      background: #f9fafb;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }

    /* Summary boxes */
    .summary {
      background: #f0f9ff;
      padding: 20px;
      margin: 24px 0;
      border-left: 4px solid #3b82f6;
      border-radius: 6px;
    }
    .summary h3 {
      font-size: 16px;
      margin-bottom: 12px;
      color: #1e40af;
    }
    .summary p {
      font-size: 14px;
      color: #1f2937;
    }

    /* Totals */
    .total-row {
      font-weight: 700;
      background: #f9fafb;
      border-top: 2px solid #e5e7eb;
    }
    .total-row td {
      padding: 16px 12px;
      font-size: 15px;
    }

    /* Sections */
    .section {
      margin: 32px 0;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 16px;
      color: #111827;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
    }

    /* Footer */
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }

    /* Print styles */
    @media print {
      body { padding: 20px; }
      .header { background: #1f2937; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }

    /* Custom styles */
    ${styles}
  </style>
</head>
<body>
  ${content}

  <div class="footer">
    <p>Document généré par CashPilot - ${new Date().toLocaleString(getLocale())}</p>
  </div>
</body>
</html>`;
};

/**
 * Télécharge un fichier HTML
 * @param {string} html - Contenu HTML complet
 * @param {string} filename - Nom du fichier (sans extension)
 */
export const downloadHTML = (html, filename) => {
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
 * Export Bilan SYSCOHADA en HTML — miroir exact de l'affichage écran
 * @param {Object} balanceSheet - Données du bilan (avec structure syscohada)
 * @param {Object} companyInfo - Informations société (name, city, country, registration_number, currency, etc.)
 * @param {string} period - Période (ex: "2026-01-01 - 2026-12-31")
 */
export const exportBalanceSheetHTML = (balanceSheet, companyInfo, period) => {
  const currency = resolveAccountingCurrency(companyInfo);
  const fmt = (v) =>
    new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v || 0);

  const periodLabel =
    typeof period === 'string'
      ? period
      : period?.endDate
        ? new Date(period.endDate).toLocaleDateString(getLocale())
        : '';
  const now = new Date();
  const printDate = `${now.toLocaleDateString(getLocale())} à ${now.toLocaleTimeString(getLocale())}`;

  // Render a SYSCOHADA section (e.g., ACTIF IMMOBILISÉ)
  const renderSection = (section) => {
    if (!section.groups || section.groups.length === 0) {
      return `
        <tr>
          <td colspan="3" style="padding:8px 5px;background:#f8f9fa;font-weight:bold;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6B7280;">
            ${section.label}
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:4px 5px 4px 20px;color:#999;font-style:italic;font-size:11px;">Aucun compte</td>
          <td style="padding:4px 5px;text-align:right;font-family:monospace;color:#999;">${fmt(0)}</td>
        </tr>
      `;
    }

    let html = `
      <tr>
        <td colspan="3" style="padding:8px 5px;background:#f8f9fa;font-weight:bold;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#374151;">
          ${section.label}
          <span style="float:right;font-family:monospace;font-size:12px;color:#111;">${fmt(section.total)}</span>
        </td>
      </tr>
    `;

    for (const group of section.groups) {
      // Class group header (2-digit code)
      html += `
        <tr>
          <td colspan="3" style="padding:6px 5px 3px 10px;font-weight:600;color:#D97706;font-size:11px;text-transform:uppercase;letter-spacing:0.03em;border-bottom:1px solid #E5E7EB;">
            <span style="font-family:monospace;margin-right:8px;">${group.classCode}</span>${group.className}
            <span style="float:right;font-family:monospace;font-size:11px;color:#D97706;">${fmt(group.subtotal)}</span>
          </td>
        </tr>
      `;

      // Individual accounts (3+ digit codes)
      for (const account of group.accounts) {
        const isZero = account.balance === 0;
        html += `
          <tr style="${isZero ? 'opacity:0.5;' : ''}">
            <td style="padding:2px 5px 2px 25px;font-family:monospace;color:#6B7280;font-size:11px;width:12%;">${account.account_code}</td>
            <td style="padding:2px 5px;font-size:12px;color:#111;">${account.account_name}</td>
            <td style="padding:2px 5px;text-align:right;font-family:monospace;font-size:12px;${isZero ? 'color:#ccc;' : 'color:#111;'}">${fmt(account.balance)}</td>
          </tr>
        `;
      }
    }

    return html;
  };

  // Render one side (ACTIF or PASSIF)
  const renderSide = (title, color, sections, total) => {
    return `
      <div style="flex:1;min-width:0;">
        <h2 style="color:${color};font-size:14px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;display:flex;justify-content:space-between;align-items:center;">
          <span>${title}</span>
          <span style="font-family:monospace;font-size:15px;">${fmt(total)}</span>
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="border-bottom:2px solid ${color};">
              <th style="width:12%;text-align:left;padding:5px;font-size:10px;color:#888;text-transform:uppercase;">Code</th>
              <th style="text-align:left;padding:5px;font-size:10px;color:#888;text-transform:uppercase;">Libellé</th>
              <th style="width:22%;text-align:right;padding:5px;font-size:10px;color:#888;text-transform:uppercase;">Montant (${currency})</th>
            </tr>
          </thead>
          <tbody>
            ${sections.map(renderSection).join('')}
            <tr style="border-top:2px solid ${color};">
              <td colspan="2" style="padding:10px 5px;font-weight:bold;font-size:14px;">TOTAL ${title}</td>
              <td style="padding:10px 5px;text-align:right;font-weight:bold;font-family:monospace;font-size:14px;color:${color};">${fmt(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  };

  const { totalAssets, totalPassif, balanced, syscohada } = balanceSheet;
  const difference = Math.abs(totalAssets - totalPassif);

  // Company header
  const companyName = companyInfo?.company_name || companyInfo?.name || 'Société';
  const companyDetails = [companyInfo?.city, companyInfo?.country].filter(Boolean).join(', ');

  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="margin:0 0 4px;font-size:22px;color:#111;">${companyName}</h1>
      ${companyDetails ? `<p style="margin:2px 0;font-size:12px;color:#666;">${companyDetails}</p>` : ''}
      ${companyInfo?.registration_number ? `<p style="margin:2px 0;font-size:11px;color:#888;">N° ${companyInfo.registration_number}</p>` : ''}
      ${companyInfo?.phone ? `<p style="margin:2px 0;font-size:11px;color:#888;">Tél: ${companyInfo.phone}</p>` : ''}
      ${companyInfo?.email ? `<p style="margin:2px 0;font-size:11px;color:#888;">${companyInfo.email}</p>` : ''}
      <h2 style="margin:16px 0 4px;font-size:17px;color:#333;text-transform:uppercase;letter-spacing:0.1em;">Bilan Comptable SYSCOHADA</h2>
      ${periodLabel ? `<p style="margin:2px 0;font-size:12px;color:#666;">Exercice du ${periodLabel.replace(' - ', ' au ')}</p>` : ''}
    </div>

    <!-- Equilibre comptable -->
    <div style="margin-bottom:20px;padding:10px 16px;border:2px solid ${balanced ? '#10B981' : '#EF4444'};border-radius:8px;background:${balanced ? '#ECFDF5' : '#FEF2F2'};display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:600;font-size:13px;color:${balanced ? '#059669' : '#DC2626'};">
        ${balanced ? '&#10003; Bilan équilibré — Actif = Passif' : '&#9888; Bilan déséquilibré — Écart : ' + fmt(difference)}
      </span>
      <span style="font-size:12px;color:#666;">
        Total Actif: <strong style="font-family:monospace;color:#3B82F6;">${fmt(totalAssets)}</strong>
        &nbsp;&nbsp;|&nbsp;&nbsp;
        Total Passif: <strong style="font-family:monospace;color:#EF4444;">${fmt(totalPassif)}</strong>
      </span>
    </div>

    <!-- Two columns: ACTIF | PASSIF -->
    <div style="display:flex;gap:24px;align-items:flex-start;">
      ${syscohada ? renderSide('ACTIF', '#3B82F6', syscohada.actif, totalAssets) : '<p>Aucune donnée SYSCOHADA</p>'}
      ${syscohada ? renderSide('PASSIF', '#EF4444', syscohada.passif, totalPassif) : ''}
    </div>

    <!-- Footer -->
    <p style="margin-top:24px;text-align:center;font-size:10px;color:#aaa;">
      Bilan généré le ${printDate} — CashPilot
    </p>
  `;

  const html = generateHTMLDocument(`Bilan SYSCOHADA - ${companyName}`, content);
  downloadHTML(html, `bilan-syscohada-${(periodLabel || 'export').replace(/[\s\/]/g, '-')}`);
};

/**
 * Export Compte de Résultat en HTML
 * @param {Object} incomeStatement - Données du compte de résultat
 * @param {Object} companyInfo - Informations société
 * @param {string} period - Période
 */
export const exportIncomeStatementHTML = (incomeStatement, companyInfo, period) => {
  const revenueRows = Array.isArray(incomeStatement?.revenueItems)
    ? incomeStatement.revenueItems
    : Array.isArray(incomeStatement?.revenues)
      ? incomeStatement.revenues
      : [];
  const expenseRows = Array.isArray(incomeStatement?.expenseItems)
    ? incomeStatement.expenseItems
    : Array.isArray(incomeStatement?.expenses)
      ? incomeStatement.expenses
      : [];
  const totalRevenue = Number(incomeStatement?.totalRevenue ?? incomeStatement?.totalRevenues ?? 0);
  const totalExpenses = Number(incomeStatement?.totalExpenses ?? 0);
  const netIncome = Number(incomeStatement?.netIncome ?? 0);

  const content = `
    <div class="header">
      <h1>${companyInfo.name || 'Société'}</h1>
      <p>Compte de Résultat - Période: ${period}</p>
    </div>

    <div class="section">
      <h2 class="section-title">PRODUITS</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 15%">Code</th>
            <th>Libellé</th>
            <th style="width: 20%; text-align: right">Montant (€)</th>
          </tr>
        </thead>
        <tbody>
          ${
            revenueRows
              .map(
                (revenue) => `
            <tr>
              <td>${revenue.account_code || revenue.code || ''}</td>
              <td>${revenue.account_name || revenue.label || ''}</td>
              <td style="text-align: right">${Number(revenue.amount || revenue.balance || 0).toFixed(2)}</td>
            </tr>
          `
              )
              .join('') || '<tr><td colspan="3">Aucune donnée</td></tr>'
          }
          <tr class="total-row">
            <td colspan="2">TOTAL PRODUITS</td>
            <td style="text-align: right">${totalRevenue.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">CHARGES</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 15%">Code</th>
            <th>Libellé</th>
            <th style="width: 20%; text-align: right">Montant (€)</th>
          </tr>
        </thead>
        <tbody>
          ${
            expenseRows
              .map(
                (expense) => `
            <tr>
              <td>${expense.account_code || expense.code || ''}</td>
              <td>${expense.account_name || expense.label || ''}</td>
              <td style="text-align: right">${Number(expense.amount || expense.balance || 0).toFixed(2)}</td>
            </tr>
          `
              )
              .join('') || '<tr><td colspan="3">Aucune donnée</td></tr>'
          }
          <tr class="total-row">
            <td colspan="2">TOTAL CHARGES</td>
            <td style="text-align: right">${totalExpenses.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="summary">
      <h3>Résultat</h3>
      <p><strong>Total Produits:</strong> ${totalRevenue.toFixed(2)} €</p>
      <p><strong>Total Charges:</strong> ${totalExpenses.toFixed(2)} €</p>
      <p><strong>Résultat Net:</strong> ${netIncome.toFixed(2)} €</p>
      <p style="margin-top: 8px; ${netIncome >= 0 ? 'color: #10b981' : 'color: #ef4444'}">
        ${netIncome >= 0 ? '✓ Bénéfice' : '✗ Perte'}
      </p>
    </div>
  `;

  const html = generateHTMLDocument(`Compte de Résultat - ${period}`, content);
  downloadHTML(html, `compte-resultat-${period.replace(/\//g, '-')}`);
};

/**
 * Export Facture en HTML
 * @param {Object} invoice - Données de la facture
 * @param {Object} client - Informations client
 * @param {Array} items - Lignes de la facture
 */
export const exportInvoiceHTML = (invoice, client, items) => {
  const content = `
    <div class="header">
      <h1>Facture N° ${invoice.invoice_number}</h1>
      <p>Date: ${new Date(invoice.date).toLocaleDateString(getLocale())}</p>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
      <div>
        <h3 style="margin-bottom: 10px; color: #374151;">Client</h3>
        <p><strong>${client.name}</strong></p>
        <p>${client.email || ''}</p>
        <p>${client.phone || ''}</p>
      </div>
      <div>
        <h3 style="margin-bottom: 10px; color: #374151;">Société</h3>
        <p><strong>${invoice.company?.name || 'CashPilot'}</strong></p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="width: 15%; text-align: right">Qté</th>
          <th style="width: 15%; text-align: right">Prix Unit.</th>
          <th style="width: 15%; text-align: right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${
          items
            ?.map(
              (item) => `
          <tr>
            <td>${item.description}</td>
            <td style="text-align: right">${item.quantity}</td>
            <td style="text-align: right">${item.unit_price?.toFixed(2)} €</td>
            <td style="text-align: right">${(item.quantity * item.unit_price)?.toFixed(2)} €</td>
          </tr>
        `
            )
            .join('') || '<tr><td colspan="4">Aucun article</td></tr>'
        }
        <tr class="total-row">
          <td colspan="3">TOTAL TTC</td>
          <td style="text-align: right">${invoice.total_amount?.toFixed(2) || '0.00'} €</td>
        </tr>
      </tbody>
    </table>

    <div class="summary">
      <p><strong>Montant à régler:</strong> ${invoice.total_amount?.toFixed(2) || '0.00'} €</p>
      <p><strong>Statut:</strong> ${invoice.status === 'paid' ? '✓ Payée' : 'En attente'}</p>
    </div>
  `;

  const html = generateHTMLDocument(`Facture ${invoice.invoice_number}`, content);
  downloadHTML(html, `facture-${invoice.invoice_number}`);
};

/**
 * Export Déclaration TVA en HTML
 * @param {Object} vatData - Données TVA (outputVAT, inputVAT, vatPayable)
 * @param {Object} companyInfo - Informations société
 * @param {string} period - Période
 */
export const exportVATDeclarationHTML = (vatData, companyInfo, period) => {
  const { outputVAT, inputVAT, vatPayable } = vatData;

  const content = `
    <div class="header">
      <h1>${companyInfo.name || companyInfo.company_name || 'Société'}</h1>
      <p>Déclaration TVA - Période: ${period}</p>
    </div>

    <div class="section">
      <h2 class="section-title">TVA COLLECTÉE</h2>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="width: 20%; text-align: right">Montant (€)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>TVA sur les ventes</td>
            <td style="text-align: right">${outputVAT?.toFixed(2) || '0.00'}</td>
          </tr>
          <tr class="total-row">
            <td>TOTAL TVA COLLECTÉE</td>
            <td style="text-align: right">${outputVAT?.toFixed(2) || '0.00'}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">TVA DÉDUCTIBLE</h2>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="width: 20%; text-align: right">Montant (€)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>TVA sur les achats</td>
            <td style="text-align: right">${inputVAT?.toFixed(2) || '0.00'}</td>
          </tr>
          <tr class="total-row">
            <td>TOTAL TVA DÉDUCTIBLE</td>
            <td style="text-align: right">${inputVAT?.toFixed(2) || '0.00'}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="summary">
      <h3>TVA À PAYER</h3>
      <p><strong>TVA Collectée:</strong> ${outputVAT?.toFixed(2) || '0.00'} €</p>
      <p><strong>TVA Déductible:</strong> ${inputVAT?.toFixed(2) || '0.00'} €</p>
      <p style="font-size: 18px; margin-top: 12px;"><strong>TVA À REVERSER:</strong> ${vatPayable?.toFixed(2) || '0.00'} €</p>
    </div>
  `;

  const html = generateHTMLDocument(`Déclaration TVA - ${period}`, content);
  downloadHTML(html, `tva-${period.replace(/\s+/g, '-')}`);
};

/**
 * Export Estimation d'Impôt en HTML
 * @param {Object} taxData - Données fiscales (netIncome, taxEstimate)
 * @param {Object} companyInfo - Informations société
 * @param {string} period - Période
 */
export const exportTaxEstimationHTML = (taxData, companyInfo, period) => {
  const { netIncome, taxEstimate } = taxData;

  const content = `
    <div class="header">
      <h1>${companyInfo.name || companyInfo.company_name || 'Société'}</h1>
      <p>Estimation d'Impôt - Période: ${period}</p>
    </div>

    <div class="summary" style="background: #f0f9ff; border-left-color: #3b82f6;">
      <h3 style="color: #1e40af;">Résumé Fiscal</h3>
      <p><strong>Bénéfice Imposable:</strong> ${netIncome?.toFixed(2) || '0.00'} €</p>
      <p><strong>Impôt Estimé:</strong> ${taxEstimate?.total?.toFixed(2) || '0.00'} €</p>
      <p><strong>Taux Effectif:</strong> ${taxEstimate?.effectiveRate ? (taxEstimate.effectiveRate * 100).toFixed(2) : '0.00'}%</p>
    </div>

    ${
      taxEstimate?.brackets?.length > 0
        ? `
    <div class="section">
      <h2 class="section-title">DÉTAIL PAR TRANCHE</h2>
      <table>
        <thead>
          <tr>
            <th>Tranche</th>
            <th style="width: 20%; text-align: right">Base (€)</th>
            <th style="width: 15%; text-align: right">Taux</th>
            <th style="width: 20%; text-align: right">Impôt (€)</th>
          </tr>
        </thead>
        <tbody>
          ${taxEstimate.brackets
            .map(
              (bracket) => `
            <tr>
              <td>${bracket.min || 0} - ${bracket.max || '+'}</td>
              <td style="text-align: right">${bracket.taxableAmount?.toFixed(2) || '0.00'}</td>
              <td style="text-align: right">${bracket.rate ? (bracket.rate * 100).toFixed(0) : '0'}%</td>
              <td style="text-align: right">${bracket.tax?.toFixed(2) || '0.00'}</td>
            </tr>
          `
            )
            .join('')}
          <tr class="total-row">
            <td colspan="3">TOTAL IMPÔT ESTIMÉ</td>
            <td style="text-align: right">${taxEstimate.total?.toFixed(2) || '0.00'}</td>
          </tr>
        </tbody>
      </table>
    </div>
    `
        : ''
    }

    <div class="summary" style="background: #fef3c7; border-left-color: #f59e0b;">
      <h3 style="color: #92400e;">Provision Trimestrielle</h3>
      <p>Pour lisser votre trésorerie, prévoyez:</p>
      <p style="font-size: 18px; margin-top: 8px;"><strong>${((taxEstimate?.total || 0) / 4).toFixed(2)} € par trimestre</strong></p>
    </div>
  `;

  const html = generateHTMLDocument(`Estimation Impôt - ${period}`, content);
  downloadHTML(html, `impot-${period.replace(/\s+/g, '-')}`);
};

/**
 * Export Diagnostic Financier en HTML
 * @param {Object} diagnostic - Données du diagnostic financier
 * @param {Object} companyInfo - Informations société
 * @param {string} period - Période
 */
export const exportFinancialDiagnosticHTML = (diagnostic, companyInfo, period, viewSnapshot = null) => {
  if (!diagnostic || !diagnostic.valid) {
    alert('Données insuffisantes pour générer le diagnostic');
    return;
  }

  const fmtCurrency = (value) => Number(value || 0).toFixed(2);
  const fmtPct = (value) => `${Number(value || 0).toFixed(1)}%`;
  const snapshotCards = Array.isArray(viewSnapshot?.visibleCards) ? viewSnapshot.visibleCards : [];

  const snapshotSection =
    snapshotCards.length > 0
      ? `
      <div class="section">
        <h2 class="section-title">VUE COURANTE EXPORTEE</h2>
        <div class="summary" style="background:#f8fafc;border-left-color:#334155;">
          <p><strong>Mode:</strong> ${viewSnapshot?.mode || 'detail'}</p>
          <p><strong>Comparateur:</strong> ${viewSnapshot?.comparisonLabel || 'N/A'}</p>
          <p><strong>Filtre:</strong> ${viewSnapshot?.sectionFilter || 'all'} | <strong>Tri:</strong> ${viewSnapshot?.sortMode || 'custom'}</p>
          <p><strong>Secteur benchmark:</strong> ${viewSnapshot?.benchmarkSector || 'N/A'}</p>
          <p><strong>Periode:</strong> ${viewSnapshot?.period?.label || period} | <strong>Comparee:</strong> ${viewSnapshot?.period?.comparedLabel || 'N/A'}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Categorie</th>
              <th>Carte</th>
              <th style="width: 18%; text-align: right">Courant</th>
              <th style="width: 18%; text-align: right">Comparatif</th>
              <th style="width: 18%; text-align: right">Benchmark</th>
            </tr>
          </thead>
          <tbody>
            ${snapshotCards
              .map(
                (card) => `
              <tr>
                <td>${card.section || '-'}</td>
                <td>${card.title || '-'}</td>
                <td style="text-align:right">${card.formattedCurrentValue || '-'}</td>
                <td style="text-align:right">${card.formattedComparisonValue || '-'}</td>
                <td style="text-align:right">${card.formattedBenchmarkValue || '-'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
      : '';

  const content = `
    <div class="header">
      <h1>${companyInfo.name || companyInfo.company_name || 'Société'}</h1>
      <p>Diagnostic Financier - Période: ${period}</p>
    </div>

    ${snapshotSection}

    <div class="section">
      <h2 class="section-title">ANALYSE DES MARGES</h2>
      <table>
        <thead>
          <tr>
            <th>Indicateur</th>
            <th style="width: 20%; text-align: right">Montant</th>
            <th style="width: 15%; text-align: right">% CA</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Chiffre d'affaires</td>
            <td style="text-align: right">${fmtCurrency(diagnostic.margins.revenue)}</td>
            <td style="text-align: right">100%</td>
          </tr>
          <tr>
            <td>Marge brute</td>
            <td style="text-align: right">${fmtCurrency(diagnostic.margins.grossMargin)}</td>
            <td style="text-align: right">${fmtPct(diagnostic.margins.grossMarginPercent)}</td>
          </tr>
          <tr>
            <td>EBITDA</td>
            <td style="text-align: right">${fmtCurrency(diagnostic.margins.ebitda)}</td>
            <td style="text-align: right">${fmtPct(diagnostic.margins.ebitdaMargin)}</td>
          </tr>
          <tr class="total-row">
            <td>Résultat d'exploitation</td>
            <td style="text-align: right">${fmtCurrency(diagnostic.margins.operatingResult)}</td>
            <td style="text-align: right">${fmtPct(diagnostic.margins.operatingMargin)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">ANALYSE DU FINANCEMENT</h2>
      <table>
        <thead>
          <tr>
            <th>Indicateur</th>
            <th style="width: 25%; text-align: right">Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Capacité d'Autofinancement (CAF)</td><td style="text-align: right">${fmtCurrency(diagnostic.financing.caf)}</td></tr>
          <tr><td>Fonds de Roulement</td><td style="text-align: right">${fmtCurrency(diagnostic.financing.workingCapital)}</td></tr>
          <tr><td>Besoin en Fonds de Roulement (BFR)</td><td style="text-align: right">${fmtCurrency(diagnostic.financing.bfr)}</td></tr>
          <tr><td>Variation BFR</td><td style="text-align: right">${fmtCurrency(diagnostic.financing.bfrVariation)}</td></tr>
          <tr><td>Flux de Trésorerie d'Exploitation</td><td style="text-align: right">${fmtCurrency(diagnostic.financing.operatingCashFlow)}</td></tr>
          <tr class="total-row"><td>Endettement Net</td><td style="text-align: right">${fmtCurrency(diagnostic.financing.netDebt)}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">RATIOS CLÉS</h2>
      <table>
        <thead>
          <tr>
            <th>Catégorie</th>
            <th>Ratio</th>
            <th style="width: 15%; text-align: right">Valeur</th>
          </tr>
        </thead>
        <tbody>
          <tr><td rowspan="3"><strong>Rentabilité</strong></td><td>ROE</td><td style="text-align: right">${fmtPct(diagnostic.ratios.profitability.roe)}</td></tr>
          <tr><td>ROA</td><td style="text-align: right">${fmtPct(diagnostic.ratios.profitability.roa)}</td></tr>
          <tr><td>ROCE</td><td style="text-align: right">${fmtPct(diagnostic.ratios.profitability.roce)}</td></tr>
          <tr><td rowspan="3"><strong>Liquidité</strong></td><td>Liquidité Générale</td><td style="text-align: right">${Number(diagnostic.ratios.liquidity.currentRatio || 0).toFixed(2)}</td></tr>
          <tr><td>Liquidité Réduite</td><td style="text-align: right">${Number(diagnostic.ratios.liquidity.quickRatio || 0).toFixed(2)}</td></tr>
          <tr><td>Liquidité Immédiate</td><td style="text-align: right">${Number(diagnostic.ratios.liquidity.cashRatio || 0).toFixed(2)}</td></tr>
          <tr><td><strong>Endettement</strong></td><td>Levier Financier</td><td style="text-align: right">${Number(diagnostic.ratios.leverage.financialLeverage || 0).toFixed(2)}</td></tr>
        </tbody>
      </table>
    </div>
  `;

  const html = generateHTMLDocument(`Diagnostic Financier - ${period}`, content);
  downloadHTML(html, `diagnostic-${String(period).replace(/\s+/g, '-')}`);
};
