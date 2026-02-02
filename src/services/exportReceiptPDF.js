
import html2pdf from 'html2pdf.js';

/**
 * Export payment receipt to PDF
 * @param {HTMLElement} receiptElement - The receipt HTML element to convert
 * @param {string} receiptNumber - Receipt number for filename
 * @param {string} date - Payment date for filename
 * @returns {Promise} Promise that resolves when PDF is generated
 */
export const exportReceiptToPDF = async (receiptElement, receiptNumber, date) => {
  if (!receiptElement) {
    throw new Error('Receipt element not found');
  }

  const formattedDate = date || new Date().toISOString().split('T')[0];

  const options = {
    margin: 10,
    filename: `Receipt_${receiptNumber}_${formattedDate}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(options).from(receiptElement).save();
    return true;
  } catch (error) {
    console.error('Receipt PDF export failed:', error);
    throw new Error('Failed to export receipt PDF');
  }
};
