import { saveElementAsPdf } from '@/services/pdfExportRuntime';
import { formatDateInput } from '@/utils/dateFormatting';
import DOMPurify from 'dompurify';

const setSafeHtml = (element, html) => {
  element.innerHTML = DOMPurify.sanitize(String(html || ''));
};

/**
 * Export Payment Instruments summary as PDF
 * @param {Array} instruments - List of payment instruments
 * @param {string} companyName - Company name
 * @param {Object} options - Export options (currency, etc.)
 */
export const exportPaymentInstrumentsPDF = async (instruments, companyName, options = {}) => {
  const currency = options.currency || 'EUR';
  const fmt = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

  // Group instruments by type
  const groups = {
    bank_account: { label: 'Bank Accounts', color: '#3b82f6', items: [] },
    card: { label: 'Cards', color: '#8b5cf6', items: [] },
    cash: { label: 'Cash', color: '#22c55e', items: [] },
  };

  for (const inst of instruments) {
    const type = inst.instrument_type || 'bank_account';
    if (groups[type]) {
      groups[type].items.push(inst);
    } else {
      // Fallback: put unknown types in bank_account group
      groups.bank_account.items.push(inst);
    }
  }

  const totalBalance = instruments.reduce((sum, inst) => sum + Number(inst.current_balance || 0), 0);
  const activeCount = instruments.filter(inst => inst.status === 'active').length;

  const statusBadge = (status) => {
    const colors = {
      active: '#22c55e',
      inactive: '#6b7280',
      suspended: '#f59e0b',
      closed: '#ef4444',
    };
    const bg = colors[status] || '#6b7280';
    return `<span style="padding: 4px 8px; border-radius: 12px; font-size: 11px; background: ${bg}; color: white;">${status || 'N/A'}</span>`;
  };

  const renderGroup = (key) => {
    const group = groups[key];
    if (group.items.length === 0) return '';

    const groupTotal = group.items.reduce((sum, inst) => sum + Number(inst.current_balance || 0), 0);

    return `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #f3f4f6; margin-bottom: 15px; font-size: 20px; border-bottom: 2px solid ${group.color}; padding-bottom: 10px;">
          ${group.label}
          <span style="float: right; font-family: monospace; font-size: 16px; color: ${group.color};">${fmt(groupTotal)}</span>
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #1f2937;">
              <th style="padding: 12px; text-align: left; color: ${group.color}; font-weight: 600;">Label</th>
              <th style="padding: 12px; text-align: left; color: ${group.color}; font-weight: 600;">Type</th>
              <th style="padding: 12px; text-align: left; color: ${group.color}; font-weight: 600;">Account Code</th>
              <th style="padding: 12px; text-align: center; color: ${group.color}; font-weight: 600;">Currency</th>
              <th style="padding: 12px; text-align: right; color: ${group.color}; font-weight: 600;">Balance</th>
              <th style="padding: 12px; text-align: center; color: ${group.color}; font-weight: 600;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${group.items.map(inst => `
              <tr style="border-bottom: 1px solid #374151;">
                <td style="padding: 10px; color: #f3f4f6; font-weight: 600;">${inst.label || 'N/A'}</td>
                <td style="padding: 10px; color: #9ca3af;">${inst.instrument_type || 'N/A'}</td>
                <td style="padding: 10px; color: #9ca3af; font-family: monospace; font-size: 12px;">${inst.account_code || 'N/A'}</td>
                <td style="padding: 10px; text-align: center; color: #9ca3af;">${inst.currency || currency}</td>
                <td style="padding: 10px; text-align: right; color: ${Number(inst.current_balance || 0) >= 0 ? '#22c55e' : '#ef4444'}; font-weight: 600; font-family: monospace;">${fmt(inst.current_balance)}</td>
                <td style="padding: 10px; text-align: center;">${statusBadge(inst.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const content = `
    <div style="font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">PAYMENT INSTRUMENTS</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">${companyName || 'Your Company'}</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      <div style="background: #0f1528; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #1e293b;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          <div>
            <p style="margin: 0; color: #9ca3af; font-size: 12px; font-weight: 600;">TOTAL BALANCE</p>
            <p style="margin: 5px 0 0 0; color: ${totalBalance >= 0 ? '#22c55e' : '#ef4444'}; font-size: 24px; font-weight: bold;">${fmt(totalBalance)}</p>
          </div>
          <div>
            <p style="margin: 0; color: #9ca3af; font-size: 12px; font-weight: 600;">INSTRUMENTS</p>
            <p style="margin: 5px 0 0 0; color: #f3f4f6; font-size: 24px; font-weight: bold;">${instruments.length}</p>
          </div>
          <div>
            <p style="margin: 0; color: #9ca3af; font-size: 12px; font-weight: 600;">ACTIVE</p>
            <p style="margin: 5px 0 0 0; color: #22c55e; font-size: 24px; font-weight: bold;">${activeCount} / ${instruments.length}</p>
          </div>
        </div>
      </div>

      ${renderGroup('bank_account')}
      ${renderGroup('card')}
      ${renderGroup('cash')}

      <div style="background: #1f2937; padding: 20px; border-radius: 8px; margin-top: 30px; border: 1px solid #374151;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #f3f4f6; font-size: 18px; font-weight: bold;">TOTAL ALL INSTRUMENTS</span>
          <span style="color: ${totalBalance >= 0 ? '#22c55e' : '#ef4444'}; font-size: 24px; font-weight: bold; font-family: monospace;">${fmt(totalBalance)}</span>
        </div>
      </div>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #374151; text-align: center; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">Payment Instruments report generated by CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
      </div>
    </div>
  `;

  const tempDiv = document.createElement('div');
  setSafeHtml(tempDiv, content);
  document.body.appendChild(tempDiv);

  const pdfOptions = {
    margin: 10,
    filename: `Payment_Instruments_${formatDateInput()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await saveElementAsPdf(tempDiv, pdfOptions);
    document.body.removeChild(tempDiv);
    return true;
  } catch (error) {
    document.body.removeChild(tempDiv);
    console.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
};
