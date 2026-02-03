
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
    <p>Document généré par CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
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
 * Export Bilan en HTML
 * @param {Object} balanceSheet - Données du bilan
 * @param {Object} companyInfo - Informations société
 * @param {string} period - Période
 */
export const exportBalanceSheetHTML = (balanceSheet, companyInfo, period) => {
  const content = `
    <div class="header">
      <h1>${companyInfo.name || 'Société'}</h1>
      <p>Bilan - Période: ${period}</p>
    </div>

    <div class="section">
      <h2 class="section-title">ACTIF</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 15%">Code</th>
            <th>Libellé</th>
            <th style="width: 20%; text-align: right">Montant (€)</th>
          </tr>
        </thead>
        <tbody>
          ${balanceSheet.assets?.map(asset => `
            <tr>
              <td>${asset.code}</td>
              <td>${asset.label}</td>
              <td style="text-align: right">${asset.amount?.toFixed(2) || '0.00'}</td>
            </tr>
          `).join('') || '<tr><td colspan="3">Aucune donnée</td></tr>'}
          <tr class="total-row">
            <td colspan="2">TOTAL ACTIF</td>
            <td style="text-align: right">${balanceSheet.totalAssets?.toFixed(2) || '0.00'}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">PASSIF</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 15%">Code</th>
            <th>Libellé</th>
            <th style="width: 20%; text-align: right">Montant (€)</th>
          </tr>
        </thead>
        <tbody>
          ${balanceSheet.liabilities?.map(liability => `
            <tr>
              <td>${liability.code}</td>
              <td>${liability.label}</td>
              <td style="text-align: right">${liability.amount?.toFixed(2) || '0.00'}</td>
            </tr>
          `).join('') || '<tr><td colspan="3">Aucune donnée</td></tr>'}
          <tr class="total-row">
            <td colspan="2">TOTAL PASSIF</td>
            <td style="text-align: right">${balanceSheet.totalLiabilities?.toFixed(2) || '0.00'}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="summary">
      <h3>Équilibre Comptable</h3>
      <p><strong>Total Actif:</strong> ${balanceSheet.totalAssets?.toFixed(2) || '0.00'} €</p>
      <p><strong>Total Passif:</strong> ${balanceSheet.totalLiabilities?.toFixed(2) || '0.00'} €</p>
      <p><strong>Différence:</strong> ${(balanceSheet.totalAssets - balanceSheet.totalLiabilities)?.toFixed(2) || '0.00'} €</p>
    </div>
  `;

  const html = generateHTMLDocument(`Bilan - ${period}`, content);
  downloadHTML(html, `bilan-${period.replace(/\//g, '-')}`);
};

/**
 * Export Compte de Résultat en HTML
 * @param {Object} incomeStatement - Données du compte de résultat
 * @param {Object} companyInfo - Informations société
 * @param {string} period - Période
 */
export const exportIncomeStatementHTML = (incomeStatement, companyInfo, period) => {
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
          ${incomeStatement.revenues?.map(revenue => `
            <tr>
              <td>${revenue.code}</td>
              <td>${revenue.label}</td>
              <td style="text-align: right">${revenue.amount?.toFixed(2) || '0.00'}</td>
            </tr>
          `).join('') || '<tr><td colspan="3">Aucune donnée</td></tr>'}
          <tr class="total-row">
            <td colspan="2">TOTAL PRODUITS</td>
            <td style="text-align: right">${incomeStatement.totalRevenues?.toFixed(2) || '0.00'}</td>
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
          ${incomeStatement.expenses?.map(expense => `
            <tr>
              <td>${expense.code}</td>
              <td>${expense.label}</td>
              <td style="text-align: right">${expense.amount?.toFixed(2) || '0.00'}</td>
            </tr>
          `).join('') || '<tr><td colspan="3">Aucune donnée</td></tr>'}
          <tr class="total-row">
            <td colspan="2">TOTAL CHARGES</td>
            <td style="text-align: right">${incomeStatement.totalExpenses?.toFixed(2) || '0.00'}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="summary">
      <h3>Résultat</h3>
      <p><strong>Total Produits:</strong> ${incomeStatement.totalRevenues?.toFixed(2) || '0.00'} €</p>
      <p><strong>Total Charges:</strong> ${incomeStatement.totalExpenses?.toFixed(2) || '0.00'} €</p>
      <p><strong>Résultat Net:</strong> ${incomeStatement.netIncome?.toFixed(2) || '0.00'} €</p>
      <p style="margin-top: 8px; ${incomeStatement.netIncome >= 0 ? 'color: #10b981' : 'color: #ef4444'}">
        ${incomeStatement.netIncome >= 0 ? '✓ Bénéfice' : '✗ Perte'}
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
      <p>Date: ${new Date(invoice.date).toLocaleDateString('fr-FR')}</p>
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
        ${items?.map(item => `
          <tr>
            <td>${item.description}</td>
            <td style="text-align: right">${item.quantity}</td>
            <td style="text-align: right">${item.unit_price?.toFixed(2)} €</td>
            <td style="text-align: right">${(item.quantity * item.unit_price)?.toFixed(2)} €</td>
          </tr>
        `).join('') || '<tr><td colspan="4">Aucun article</td></tr>'}
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

    ${taxEstimate?.brackets?.length > 0 ? `
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
          ${taxEstimate.brackets.map(bracket => `
            <tr>
              <td>${bracket.min || 0} - ${bracket.max || '+'}</td>
              <td style="text-align: right">${bracket.taxableAmount?.toFixed(2) || '0.00'}</td>
              <td style="text-align: right">${bracket.rate ? (bracket.rate * 100).toFixed(0) : '0'}%</td>
              <td style="text-align: right">${bracket.tax?.toFixed(2) || '0.00'}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3">TOTAL IMPÔT ESTIMÉ</td>
            <td style="text-align: right">${taxEstimate.total?.toFixed(2) || '0.00'}</td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

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
export const exportFinancialDiagnosticHTML = (diagnostic, companyInfo, period) => {
  if (!diagnostic) {
    alert('Données insuffisantes pour générer le diagnostic');
    return;
  }

  const content = `
    <div class="header">
      <h1>${companyInfo.name || companyInfo.company_name || 'Société'}</h1>
      <p>Diagnostic Financier - Période: ${period}</p>
    </div>

    <div class="section">
      <h2 class="section-title">ANALYSE DES MARGES</h2>
      <table>
        <thead>
          <tr>
            <th>Indicateur</th>
            <th style="width: 20%; text-align: right">Montant (€)</th>
            <th style="width: 15%; text-align: right">% CA</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Chiffre d'affaires</td>
            <td style="text-align: right">${diagnostic.revenue?.toFixed(2) || '0.00'}</td>
            <td style="text-align: right">100%</td>
          </tr>
          <tr>
            <td>Marge brute</td>
            <td style="text-align: right">${diagnostic.grossMargin?.toFixed(2) || '0.00'}</td>
            <td style="text-align: right">${diagnostic.grossMarginRate ? (diagnostic.grossMarginRate * 100).toFixed(1) : '0.0'}%</td>
          </tr>
          <tr>
            <td>EBITDA</td>
            <td style="text-align: right">${diagnostic.ebitda?.toFixed(2) || '0.00'}</td>
            <td style="text-align: right">${diagnostic.ebitdaRate ? (diagnostic.ebitdaRate * 100).toFixed(1) : '0.0'}%</td>
          </tr>
          <tr class="total-row">
            <td>Résultat d'exploitation</td>
            <td style="text-align: right">${diagnostic.operatingResult?.toFixed(2) || '0.00'}</td>
            <td style="text-align: right">${diagnostic.operatingMarginRate ? (diagnostic.operatingMarginRate * 100).toFixed(1) : '0.0'}%</td>
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
            <th style="width: 25%; text-align: right">Montant (€)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Capacité d'Autofinancement (CAF)</td>
            <td style="text-align: right">${diagnostic.caf?.toFixed(2) || '0.00'}</td>
          </tr>
          <tr>
            <td>Fonds de Roulement</td>
            <td style="text-align: right">${diagnostic.workingCapital?.toFixed(2) || '0.00'}</td>
          </tr>
          <tr>
            <td>Besoin en Fonds de Roulement (BFR)</td>
            <td style="text-align: right">${diagnostic.bfr?.toFixed(2) || '0.00'}</td>
          </tr>
          <tr>
            <td>Flux de Trésorerie d'Exploitation</td>
            <td style="text-align: right">${diagnostic.operatingCashFlow?.toFixed(2) || '0.00'}</td>
          </tr>
          <tr class="total-row">
            <td>Endettement Net</td>
            <td style="text-align: right">${diagnostic.netDebt?.toFixed(2) || '0.00'}</td>
          </tr>
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
          <tr>
            <td rowspan="2"><strong>Rentabilité</strong></td>
            <td>ROE (Return on Equity)</td>
            <td style="text-align: right">${diagnostic.roe ? (diagnostic.roe * 100).toFixed(1) : '0.0'}%</td>
          </tr>
          <tr>
            <td>ROCE (Return on Capital Employed)</td>
            <td style="text-align: right">${diagnostic.roce ? (diagnostic.roce * 100).toFixed(1) : '0.0'}%</td>
          </tr>
          <tr>
            <td rowspan="3"><strong>Liquidité</strong></td>
            <td>Ratio de Liquidité Générale</td>
            <td style="text-align: right">${diagnostic.currentRatio?.toFixed(2) || '0.00'}</td>
          </tr>
          <tr>
            <td>Ratio de Liquidité Réduite</td>
            <td style="text-align: right">${diagnostic.quickRatio?.toFixed(2) || '0.00'}</td>
          </tr>
          <tr>
            <td>Ratio de Liquidité Immédiate</td>
            <td style="text-align: right">${diagnostic.cashRatio?.toFixed(2) || '0.00'}</td>
          </tr>
          <tr>
            <td><strong>Endettement</strong></td>
            <td>Levier Financier (Dette/CP)</td>
            <td style="text-align: right">${diagnostic.financialLeverage?.toFixed(2) || '0.00'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const html = generateHTMLDocument(`Diagnostic Financier - ${period}`, content);
  downloadHTML(html, `diagnostic-${period.replace(/\s+/g, '-')}`);
};
