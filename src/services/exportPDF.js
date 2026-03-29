
import { saveElementAsPdf } from '@/services/pdfExportRuntime';
import { formatDateInput } from '@/utils/dateFormatting';

/**
 * Export invoice to PDF
 * @param {HTMLElement} invoiceElement - The invoice HTML element to convert
 * @param {string} invoiceNumber - Invoice number for filename
 * @returns {Promise} Promise that resolves when PDF is generated
 */
export const exportInvoiceToPDF = async (invoiceElement, invoiceNumber) => {
  if (!invoiceElement) {
    throw new Error('Invoice element not found');
  }

  const options = {
    margin: 10,
    filename: `Invoice_${invoiceNumber}_${formatDateInput()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await saveElementAsPdf(invoiceElement, options);
    return true;
  } catch (error) {
    console.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
};
