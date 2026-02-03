import html2pdf from 'html2pdf.js';

/**
 * Export Expenses List to PDF
 */
export const exportExpensesListPDF = async (expenses, companyInfo, filters = {}) => {
  const total = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

  const content = `
    <div style="font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">LISTE DES DÉPENSES</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">${companyInfo?.name || 'Your Company'}</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      ${filters.startDate || filters.endDate ? `
        <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
          <p style="margin: 0; color: #991b1b; font-weight: 600;">Période: ${filters.startDate ? new Date(filters.startDate).toLocaleDateString('fr-FR') : '...'} - ${filters.endDate ? new Date(filters.endDate).toLocaleDateString('fr-FR') : '...'}</p>
        </div>
      ` : ''}

      <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          <div>
            <p style="margin: 0; color: #991b1b; font-size: 12px; font-weight: 600;">TOTAL DÉPENSES</p>
            <p style="margin: 5px 0 0 0; color: #7f1d1d; font-size: 24px; font-weight: bold;">${total.toFixed(2)} €</p>
          </div>
          <div>
            <p style="margin: 0; color: #991b1b; font-size: 12px; font-weight: 600;">NOMBRE</p>
            <p style="margin: 5px 0 0 0; color: #7f1d1d; font-size: 24px; font-weight: bold;">${expenses.length}</p>
          </div>
          <div>
            <p style="margin: 0; color: #991b1b; font-size: 12px; font-weight: 600;">MOYENNE</p>
            <p style="margin: 5px 0 0 0; color: #7f1d1d; font-size: 24px; font-weight: bold;">${expenses.length > 0 ? (total / expenses.length).toFixed(2) : '0.00'} €</p>
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #1f2937;">
            <th style="padding: 12px; text-align: left; color: #dc2626; font-weight: 600;">Date</th>
            <th style="padding: 12px; text-align: left; color: #dc2626; font-weight: 600;">Catégorie</th>
            <th style="padding: 12px; text-align: left; color: #dc2626; font-weight: 600;">Description</th>
            <th style="padding: 12px; text-align: right; color: #dc2626; font-weight: 600;">Montant</th>
            <th style="padding: 12px; text-align: center; color: #dc2626; font-weight: 600;">Statut</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map(exp => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px; color: #374151;">${exp.date ? new Date(exp.date).toLocaleDateString('fr-FR') : 'N/A'}</td>
              <td style="padding: 10px; color: #374151;">${exp.category || 'N/A'}</td>
              <td style="padding: 10px; color: #374151;">${exp.description || exp.label || 'N/A'}</td>
              <td style="padding: 10px; text-align: right; color: #dc2626; font-weight: 600;">${Number(exp.amount || 0).toFixed(2)} €</td>
              <td style="padding: 10px; text-align: center;"><span style="padding: 4px 8px; border-radius: 12px; font-size: 11px; background: ${exp.status === 'paid' ? '#22c55e' : '#f59e0b'}; color: white;">${exp.status || 'pending'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">Liste des dépenses générée par CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
      </div>
    </div>
  `;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `Expenses_List_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(options).from(tempDiv).save();
    document.body.removeChild(tempDiv);
    return true;
  } catch (error) {
    document.body.removeChild(tempDiv);
    console.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
};

/**
 * Export Stock/Inventory List to PDF
 */
export const exportStockListPDF = async (stockItems, companyInfo) => {
  const totalValue = stockItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
  const totalItems = stockItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const content = `
    <div style="font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">INVENTAIRE STOCK</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">${companyInfo?.name || 'Your Company'}</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      <div style="background: #f5f3ff; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          <div>
            <p style="margin: 0; color: #5b21b6; font-size: 12px; font-weight: 600;">VALEUR TOTALE</p>
            <p style="margin: 5px 0 0 0; color: #4c1d95; font-size: 24px; font-weight: bold;">${totalValue.toFixed(2)} €</p>
          </div>
          <div>
            <p style="margin: 0; color: #5b21b6; font-size: 12px; font-weight: 600;">ARTICLES</p>
            <p style="margin: 5px 0 0 0; color: #4c1d95; font-size: 24px; font-weight: bold;">${stockItems.length}</p>
          </div>
          <div>
            <p style="margin: 0; color: #5b21b6; font-size: 12px; font-weight: 600;">UNITÉS TOTALES</p>
            <p style="margin: 5px 0 0 0; color: #4c1d95; font-size: 24px; font-weight: bold;">${totalItems}</p>
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #1f2937;">
            <th style="padding: 12px; text-align: left; color: #7c3aed; font-weight: 600;">Référence</th>
            <th style="padding: 12px; text-align: left; color: #7c3aed; font-weight: 600;">Nom</th>
            <th style="padding: 12px; text-align: right; color: #7c3aed; font-weight: 600;">Quantité</th>
            <th style="padding: 12px; text-align: right; color: #7c3aed; font-weight: 600;">Prix Unitaire</th>
            <th style="padding: 12px; text-align: right; color: #7c3aed; font-weight: 600;">Valeur</th>
          </tr>
        </thead>
        <tbody>
          ${stockItems.map(item => {
            const itemValue = Number(item.quantity || 0) * Number(item.unit_price || 0);
            return `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; color: #374151; font-family: monospace;">${item.sku || item.reference || 'N/A'}</td>
                <td style="padding: 10px; color: #374151;">${item.name || item.label || 'N/A'}</td>
                <td style="padding: 10px; text-align: right; color: #374151; font-weight: 600;">${item.quantity || 0}</td>
                <td style="padding: 10px; text-align: right; color: #374151;">${Number(item.unit_price || 0).toFixed(2)} €</td>
                <td style="padding: 10px; text-align: right; color: #7c3aed; font-weight: 600;">${itemValue.toFixed(2)} €</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">Inventaire stock généré par CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
      </div>
    </div>
  `;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `Stock_Inventory_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(options).from(tempDiv).save();
    document.body.removeChild(tempDiv);
    return true;
  } catch (error) {
    document.body.removeChild(tempDiv);
    console.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
};

/**
 * Export Timesheets List to PDF
 */
export const exportTimesheetsListPDF = async (timesheets, companyInfo, filters = {}) => {
  const totalMinutes = timesheets.reduce((sum, ts) => sum + Number(ts.duration_minutes || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const content = `
    <div style="font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">FEUILLES DE TEMPS</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">${companyInfo?.name || 'Your Company'}</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      ${filters.startDate || filters.endDate ? `
        <div style="background: #ecfeff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0891b2;">
          <p style="margin: 0; color: #164e63; font-weight: 600;">Période: ${filters.startDate ? new Date(filters.startDate).toLocaleDateString('fr-FR') : '...'} - ${filters.endDate ? new Date(filters.endDate).toLocaleDateString('fr-FR') : '...'}</p>
        </div>
      ` : ''}

      <div style="background: #ecfeff; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          <div>
            <p style="margin: 0; color: #164e63; font-size: 12px; font-weight: 600;">DURÉE TOTALE</p>
            <p style="margin: 5px 0 0 0; color: #0c4a6e; font-size: 24px; font-weight: bold;">${totalHours}h ${remainingMinutes}m</p>
          </div>
          <div>
            <p style="margin: 0; color: #164e63; font-size: 12px; font-weight: 600;">NOMBRE</p>
            <p style="margin: 5px 0 0 0; color: #0c4a6e; font-size: 24px; font-weight: bold;">${timesheets.length}</p>
          </div>
          <div>
            <p style="margin: 0; color: #164e63; font-size: 12px; font-weight: 600;">MOYENNE/JOUR</p>
            <p style="margin: 5px 0 0 0; color: #0c4a6e; font-size: 24px; font-weight: bold;">${timesheets.length > 0 ? Math.round(totalMinutes / timesheets.length / 60 * 10) / 10 : 0}h</p>
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #1f2937;">
            <th style="padding: 12px; text-align: left; color: #0891b2; font-weight: 600;">Date</th>
            <th style="padding: 12px; text-align: left; color: #0891b2; font-weight: 600;">Projet</th>
            <th style="padding: 12px; text-align: left; color: #0891b2; font-weight: 600;">Tâche</th>
            <th style="padding: 12px; text-align: right; color: #0891b2; font-weight: 600;">Durée</th>
            <th style="padding: 12px; text-align: left; color: #0891b2; font-weight: 600;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${timesheets.map(ts => {
            const hours = Math.floor(Number(ts.duration_minutes || 0) / 60);
            const mins = Number(ts.duration_minutes || 0) % 60;
            return `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; color: #374151;">${ts.date ? new Date(ts.date).toLocaleDateString('fr-FR') : 'N/A'}</td>
                <td style="padding: 10px; color: #374151;">${ts.project?.name || 'N/A'}</td>
                <td style="padding: 10px; color: #374151;">${ts.task?.name || ts.description || 'N/A'}</td>
                <td style="padding: 10px; text-align: right; color: #0891b2; font-weight: 600;">${hours}h ${mins}m</td>
                <td style="padding: 10px; color: #6b7280; font-size: 11px;">${ts.notes || '-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">Feuilles de temps générées par CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
      </div>
    </div>
  `;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `Timesheets_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(options).from(tempDiv).save();
    document.body.removeChild(tempDiv);
    return true;
  } catch (error) {
    document.body.removeChild(tempDiv);
    console.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
};

/**
 * Export Projects List to PDF
 */
export const exportProjectsListPDF = async (projects, companyInfo) => {
  const totalBudget = projects.reduce((sum, proj) => sum + Number(proj.budget || 0), 0);
  const activeProjects = projects.filter(p => p.status === 'active').length;

  const content = `
    <div style="font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">LISTE DES PROJETS</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">${companyInfo?.name || 'Your Company'}</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      <div style="background: #fff7ed; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          <div>
            <p style="margin: 0; color: #9a3412; font-size: 12px; font-weight: 600;">BUDGET TOTAL</p>
            <p style="margin: 5px 0 0 0; color: #7c2d12; font-size: 24px; font-weight: bold;">${totalBudget.toFixed(2)} €</p>
          </div>
          <div>
            <p style="margin: 0; color: #9a3412; font-size: 12px; font-weight: 600;">PROJETS ACTIFS</p>
            <p style="margin: 5px 0 0 0; color: #7c2d12; font-size: 24px; font-weight: bold;">${activeProjects} / ${projects.length}</p>
          </div>
          <div>
            <p style="margin: 0; color: #9a3412; font-size: 12px; font-weight: 600;">BUDGET MOYEN</p>
            <p style="margin: 5px 0 0 0; color: #7c2d12; font-size: 24px; font-weight: bold;">${projects.length > 0 ? (totalBudget / projects.length).toFixed(2) : '0.00'} €</p>
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #1f2937;">
            <th style="padding: 12px; text-align: left; color: #ea580c; font-weight: 600;">Nom</th>
            <th style="padding: 12px; text-align: left; color: #ea580c; font-weight: 600;">Client</th>
            <th style="padding: 12px; text-align: right; color: #ea580c; font-weight: 600;">Budget</th>
            <th style="padding: 12px; text-align: center; color: #ea580c; font-weight: 600;">Statut</th>
            <th style="padding: 12px; text-align: left; color: #ea580c; font-weight: 600;">Dates</th>
          </tr>
        </thead>
        <tbody>
          ${projects.map(proj => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px; color: #374151; font-weight: 600;">${proj.name || 'N/A'}</td>
              <td style="padding: 10px; color: #374151;">${proj.client?.company_name || proj.client_name || 'N/A'}</td>
              <td style="padding: 10px; text-align: right; color: #ea580c; font-weight: 600;">${Number(proj.budget || 0).toFixed(2)} €</td>
              <td style="padding: 10px; text-align: center;"><span style="padding: 4px 8px; border-radius: 12px; font-size: 11px; background: ${proj.status === 'active' ? '#22c55e' : proj.status === 'completed' ? '#3b82f6' : '#6b7280'}; color: white;">${proj.status || 'pending'}</span></td>
              <td style="padding: 10px; color: #6b7280; font-size: 11px;">${proj.start_date ? new Date(proj.start_date).toLocaleDateString('fr-FR') : '?'} - ${proj.end_date ? new Date(proj.end_date).toLocaleDateString('fr-FR') : '?'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">Liste des projets générée par CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
      </div>
    </div>
  `;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `Projects_List_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(options).from(tempDiv).save();
    document.body.removeChild(tempDiv);
    return true;
  } catch (error) {
    document.body.removeChild(tempDiv);
    console.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
};

/**
 * Export Debt/Receivables List to PDF
 */
export const exportDebtListPDF = async (debts, companyInfo, type = 'receivables') => {
  const total = debts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
  const paid = debts.reduce((sum, debt) => sum + Number(debt.paid_amount || 0), 0);
  const remaining = total - paid;

  const isReceivables = type === 'receivables';
  const title = isReceivables ? 'CRÉANCES CLIENTS' : 'DETTES FOURNISSEURS';
  const color = isReceivables ? '#16a34a' : '#dc2626';

  const content = `
    <div style="font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${color} 0%, ${isReceivables ? '#22c55e' : '#ef4444'} 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">${title}</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">${companyInfo?.name || 'Your Company'}</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      <div style="background: ${isReceivables ? '#f0fdf4' : '#fef2f2'}; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
          <div>
            <p style="margin: 0; color: ${isReceivables ? '#166534' : '#991b1b'}; font-size: 12px; font-weight: 600;">TOTAL</p>
            <p style="margin: 5px 0 0 0; color: ${isReceivables ? '#14532d' : '#7f1d1d'}; font-size: 24px; font-weight: bold;">${total.toFixed(2)} €</p>
          </div>
          <div>
            <p style="margin: 0; color: ${isReceivables ? '#166534' : '#991b1b'}; font-size: 12px; font-weight: 600;">PAYÉ</p>
            <p style="margin: 5px 0 0 0; color: ${isReceivables ? '#14532d' : '#7f1d1d'}; font-size: 24px; font-weight: bold;">${paid.toFixed(2)} €</p>
          </div>
          <div>
            <p style="margin: 0; color: ${isReceivables ? '#166534' : '#991b1b'}; font-size: 12px; font-weight: 600;">RESTANT</p>
            <p style="margin: 5px 0 0 0; color: ${color}; font-size: 24px; font-weight: bold;">${remaining.toFixed(2)} €</p>
          </div>
          <div>
            <p style="margin: 0; color: ${isReceivables ? '#166534' : '#991b1b'}; font-size: 12px; font-weight: 600;">NOMBRE</p>
            <p style="margin: 5px 0 0 0; color: ${isReceivables ? '#14532d' : '#7f1d1d'}; font-size: 24px; font-weight: bold;">${debts.length}</p>
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #1f2937;">
            <th style="padding: 12px; text-align: left; color: ${color}; font-weight: 600;">${isReceivables ? 'Client' : 'Fournisseur'}</th>
            <th style="padding: 12px; text-align: left; color: ${color}; font-weight: 600;">Référence</th>
            <th style="padding: 12px; text-align: right; color: ${color}; font-weight: 600;">Montant</th>
            <th style="padding: 12px; text-align: right; color: ${color}; font-weight: 600;">Payé</th>
            <th style="padding: 12px; text-align: right; color: ${color}; font-weight: 600;">Restant</th>
            <th style="padding: 12px; text-align: center; color: ${color}; font-weight: 600;">Échéance</th>
          </tr>
        </thead>
        <tbody>
          ${debts.map(debt => {
            const debtRemaining = Number(debt.amount || 0) - Number(debt.paid_amount || 0);
            const isOverdue = debt.due_date && new Date(debt.due_date) < new Date();
            return `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; color: #374151; font-weight: 600;">${debt.client?.company_name || debt.supplier?.name || debt.party_name || 'N/A'}</td>
                <td style="padding: 10px; color: #6b7280; font-family: monospace; font-size: 11px;">${debt.reference || debt.invoice_number || 'N/A'}</td>
                <td style="padding: 10px; text-align: right; color: #374151;">${Number(debt.amount || 0).toFixed(2)} €</td>
                <td style="padding: 10px; text-align: right; color: #22c55e;">${Number(debt.paid_amount || 0).toFixed(2)} €</td>
                <td style="padding: 10px; text-align: right; color: ${color}; font-weight: 600;">${debtRemaining.toFixed(2)} €</td>
                <td style="padding: 10px; text-align: center;"><span style="padding: 4px 8px; border-radius: 12px; font-size: 11px; background: ${isOverdue ? '#dc2626' : '#6b7280'}; color: white;">${debt.due_date ? new Date(debt.due_date).toLocaleDateString('fr-FR') : 'N/A'}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">${title} généré par CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
      </div>
    </div>
  `;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `${isReceivables ? 'Receivables' : 'Payables'}_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };

  try {
    await html2pdf().set(options).from(tempDiv).save();
    document.body.removeChild(tempDiv);
    return true;
  } catch (error) {
    document.body.removeChild(tempDiv);
    console.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
};

// ========== HTML EXPORT FUNCTIONS ==========

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

const generateStandaloneHTML = (title, content) => {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 20px; background: #0f172a; color: #f1f5f9; font-family: Arial, sans-serif; }
    @media print { body { background: white; color: black; } }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
};

/**
 * Export Expenses List to HTML
 */
export const exportExpensesListHTML = (expenses, companyInfo, filters = {}) => {
  const total = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

  const content = `
    <div style="max-width: 1000px; margin: 0 auto;">
      <h1 style="color: #ef4444;">LISTE DES DÉPENSES</h1>
      <p>${companyInfo?.name || 'Your Company'} - ${new Date().toLocaleDateString('fr-FR')}</p>

      <div style="background: #1f2937; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p>Total: <strong style="color: #ef4444;">${total.toFixed(2)} €</strong></p>
        <p>Nombre: <strong>${expenses.length}</strong></p>
      </div>

      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #374151;">
            <th style="padding: 10px; text-align: left;">Date</th>
            <th style="padding: 10px; text-align: left;">Catégorie</th>
            <th style="padding: 10px; text-align: left;">Description</th>
            <th style="padding: 10px; text-align: right;">Montant</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map(exp => `
            <tr style="border-bottom: 1px solid #374151;">
              <td style="padding: 10px;">${exp.date ? new Date(exp.date).toLocaleDateString('fr-FR') : 'N/A'}</td>
              <td style="padding: 10px;">${exp.category || 'N/A'}</td>
              <td style="padding: 10px;">${exp.description || exp.label || 'N/A'}</td>
              <td style="padding: 10px; text-align: right; color: #ef4444; font-weight: bold;">${Number(exp.amount || 0).toFixed(2)} €</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  const html = generateStandaloneHTML('Liste des Dépenses', content);
  downloadHTML(html, `Expenses_${new Date().toISOString().split('T')[0]}`);
};

// Similar HTML export functions for other lists (abbreviated for brevity)
export const exportStockListHTML = (stockItems, companyInfo) => {
  const totalValue = stockItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);

  const content = `<div style="max-width: 1000px; margin: 0 auto;"><h1 style="color: #a78bfa;">INVENTAIRE STOCK</h1><p>${companyInfo?.name || 'Your Company'} - ${new Date().toLocaleDateString('fr-FR')}</p><p>Valeur totale: <strong style="color: #a78bfa;">${totalValue.toFixed(2)} €</strong></p></div>`;

  const html = generateStandaloneHTML('Inventaire Stock', content);
  downloadHTML(html, `Stock_${new Date().toISOString().split('T')[0]}`);
};

export const exportTimesheetsListHTML = (timesheets, companyInfo) => {
  const totalMinutes = timesheets.reduce((sum, ts) => sum + Number(ts.duration_minutes || 0), 0);

  const content = `<div style="max-width: 1000px; margin: 0 auto;"><h1 style="color: #06b6d4;">FEUILLES DE TEMPS</h1><p>${companyInfo?.name || 'Your Company'} - ${new Date().toLocaleDateString('fr-FR')}</p><p>Durée totale: <strong style="color: #06b6d4;">${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m</strong></p></div>`;

  const html = generateStandaloneHTML('Feuilles de Temps', content);
  downloadHTML(html, `Timesheets_${new Date().toISOString().split('T')[0]}`);
};

export const exportProjectsListHTML = (projects, companyInfo) => {
  const totalBudget = projects.reduce((sum, proj) => sum + Number(proj.budget || 0), 0);

  const content = `<div style="max-width: 1000px; margin: 0 auto;"><h1 style="color: #f97316;">LISTE DES PROJETS</h1><p>${companyInfo?.name || 'Your Company'} - ${new Date().toLocaleDateString('fr-FR')}</p><p>Budget total: <strong style="color: #f97316;">${totalBudget.toFixed(2)} €</strong></p></div>`;

  const html = generateStandaloneHTML('Liste des Projets', content);
  downloadHTML(html, `Projects_${new Date().toISOString().split('T')[0]}`);
};

export const exportDebtListHTML = (debts, companyInfo, type = 'receivables') => {
  const total = debts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
  const title = type === 'receivables' ? 'CRÉANCES' : 'DETTES';

  const content = `<div style="max-width: 1000px; margin: 0 auto;"><h1 style="color: ${type === 'receivables' ? '#22c55e' : '#ef4444'};">${title}</h1><p>${companyInfo?.name || 'Your Company'} - ${new Date().toLocaleDateString('fr-FR')}</p><p>Total: <strong>${total.toFixed(2)} €</strong></p></div>`;

  const html = generateStandaloneHTML(title, content);
  downloadHTML(html, `${type === 'receivables' ? 'Receivables' : 'Payables'}_${new Date().toISOString().split('T')[0]}`);
};
