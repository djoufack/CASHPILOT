import { saveElementAsPdf } from '@/services/pdfExportRuntime';
import { formatDateInput } from '@/utils/dateFormatting';
import DOMPurify from 'dompurify';

const setSafeHtml = (element, html) => {
  element.innerHTML = DOMPurify.sanitize(String(html || ''));
};

/**
 * Export filtered payment transactions list as PDF
 * @param {Array} transactions - List of transactions
 * @param {string} instrumentLabel - Name/label of the payment instrument
 * @param {Object} dateRange - { startDate, endDate } for the filter period
 * @param {Object} options - Export options (currency, etc.)
 */
export const exportPaymentTransactionsPDF = async (transactions, instrumentLabel, dateRange = {}, options = {}) => {
  const currency = options.currency || 'EUR';
  const fmt = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

  const totalInflow = transactions
    .filter(tx => tx.flow_direction === 'inflow' || Number(tx.amount || 0) > 0)
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);

  const totalOutflow = transactions
    .filter(tx => tx.flow_direction === 'outflow' || Number(tx.amount || 0) < 0)
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);

  const net = totalInflow - totalOutflow;

  const statusBadge = (status) => {
    const colors = {
      completed: '#22c55e',
      pending: '#f59e0b',
      failed: '#ef4444',
      cancelled: '#6b7280',
    };
    const bg = colors[status] || '#6b7280';
    return `<span style="padding: 4px 8px; border-radius: 12px; font-size: 11px; background: ${bg}; color: white;">${status || 'N/A'}</span>`;
  };

  const flowBadge = (direction) => {
    if (direction === 'inflow') {
      return `<span style="color: #22c55e; font-weight: 600;">&#9650; Inflow</span>`;
    }
    return `<span style="color: #ef4444; font-weight: 600;">&#9660; Outflow</span>`;
  };

  const periodLabel = [
    dateRange.startDate ? new Date(dateRange.startDate).toLocaleDateString('fr-FR') : null,
    dateRange.endDate ? new Date(dateRange.endDate).toLocaleDateString('fr-FR') : null,
  ].filter(Boolean).join(' - ') || 'All periods';

  const content = `
    <div style="font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">PAYMENT TRANSACTIONS</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">${instrumentLabel || 'All Instruments'}</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${periodLabel}</p>
      </div>

      ${dateRange.startDate || dateRange.endDate ? `
        <div style="background: #f5f3ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #8b5cf6;">
          <p style="margin: 0; color: #5b21b6; font-weight: 600;">Period: ${periodLabel}</p>
        </div>
      ` : ''}

      <div style="background: #0f1528; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #1e293b;">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
          <div>
            <p style="margin: 0; color: #9ca3af; font-size: 12px; font-weight: 600;">TOTAL INFLOW</p>
            <p style="margin: 5px 0 0 0; color: #22c55e; font-size: 24px; font-weight: bold;">${fmt(totalInflow)}</p>
          </div>
          <div>
            <p style="margin: 0; color: #9ca3af; font-size: 12px; font-weight: 600;">TOTAL OUTFLOW</p>
            <p style="margin: 5px 0 0 0; color: #ef4444; font-size: 24px; font-weight: bold;">${fmt(totalOutflow)}</p>
          </div>
          <div>
            <p style="margin: 0; color: #9ca3af; font-size: 12px; font-weight: 600;">NET</p>
            <p style="margin: 5px 0 0 0; color: ${net >= 0 ? '#22c55e' : '#ef4444'}; font-size: 24px; font-weight: bold;">${fmt(net)}</p>
          </div>
          <div>
            <p style="margin: 0; color: #9ca3af; font-size: 12px; font-weight: 600;">TRANSACTIONS</p>
            <p style="margin: 5px 0 0 0; color: #f3f4f6; font-size: 24px; font-weight: bold;">${transactions.length}</p>
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #1f2937;">
            <th style="padding: 12px; text-align: left; color: #8b5cf6; font-weight: 600;">Date</th>
            <th style="padding: 12px; text-align: left; color: #8b5cf6; font-weight: 600;">Counterparty</th>
            <th style="padding: 12px; text-align: left; color: #8b5cf6; font-weight: 600;">Description</th>
            <th style="padding: 12px; text-align: left; color: #8b5cf6; font-weight: 600;">Reference</th>
            <th style="padding: 12px; text-align: right; color: #8b5cf6; font-weight: 600;">Amount</th>
            <th style="padding: 12px; text-align: center; color: #8b5cf6; font-weight: 600;">Flow</th>
            <th style="padding: 12px; text-align: center; color: #8b5cf6; font-weight: 600;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(tx => {
            const amount = Number(tx.amount || 0);
            const direction = tx.flow_direction || (amount >= 0 ? 'inflow' : 'outflow');
            return `
              <tr style="border-bottom: 1px solid #374151;">
                <td style="padding: 10px; color: #374151;">${tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('fr-FR') : (tx.date ? new Date(tx.date).toLocaleDateString('fr-FR') : 'N/A')}</td>
                <td style="padding: 10px; color: #374151; font-weight: 600;">${tx.counterparty || tx.counterparty_name || 'N/A'}</td>
                <td style="padding: 10px; color: #6b7280; font-size: 12px;">${tx.description || tx.label || 'N/A'}</td>
                <td style="padding: 10px; color: #9ca3af; font-family: monospace; font-size: 11px;">${tx.reference || 'N/A'}</td>
                <td style="padding: 10px; text-align: right; color: ${direction === 'inflow' ? '#22c55e' : '#ef4444'}; font-weight: 600; font-family: monospace;">${fmt(Math.abs(amount))}</td>
                <td style="padding: 10px; text-align: center;">${flowBadge(direction)}</td>
                <td style="padding: 10px; text-align: center;">${statusBadge(tx.status)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">Payment Transactions report generated by CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
      </div>
    </div>
  `;

  const tempDiv = document.createElement('div');
  setSafeHtml(tempDiv, content);
  document.body.appendChild(tempDiv);

  const pdfOptions = {
    margin: 10,
    filename: `Payment_Transactions_${instrumentLabel ? instrumentLabel.replace(/\s+/g, '_') + '_' : ''}${formatDateInput()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
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
