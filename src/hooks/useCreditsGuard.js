
import { useState, useCallback } from 'react';
import { useCredits } from '@/hooks/useCredits';

/**
 * Credit costs per action type
 */
export const CREDIT_COSTS = {
  // ÉTATS COMPTABLES (5 crédits) - Génération + Export PDF
  GENERATE_BALANCE_SHEET: 5,
  GENERATE_INCOME_STATEMENT: 5,
  GENERATE_VAT_DECLARATION: 5,
  GENERATE_TAX_ESTIMATION: 5,
  GENERATE_FINANCIAL_DIAGNOSTIC: 5,

  // DOCUMENTS COMMERCIAUX (2 crédits)
  PDF_INVOICE: 2,
  PDF_QUOTE: 2,
  PDF_DELIVERY_NOTE: 2,
  PDF_CREDIT_NOTE: 2,
  PDF_PURCHASE_ORDER: 2,

  // RAPPORTS ANALYTIQUES (3 crédits)
  PDF_REPORT: 3,
  PDF_ANALYTICS: 3,
  PDF_SUPPLIER_REPORT: 3,
  PDF_RECONCILIATION: 3,
  PDF_SCENARIO: 3,

  // EXPORTS COMPLÉMENTAIRES (2 crédits)
  EXPORT_HTML: 2,  // Téléchargement fichier HTML standalone

  // AUTRES (1 crédit)
  PDF_RECEIPT: 1,
  CLOUD_BACKUP: 1,

  // IA
  AI_INVOICE_EXTRACTION: 3,
  AI_CHATBOT: 2,
  AI_CATEGORIZE: 1,
  AI_ANOMALY_DETECT: 3,
  AI_FORECAST: 3,
  AI_REMINDER_SUGGEST: 1,
  AI_REPORT: 5,
};

/**
 * Labels i18n pour affichage dans l'interface
 */
export const CREDIT_COST_LABELS = {
  // États Comptables
  GENERATE_BALANCE_SHEET: 'credits.costs.balanceSheet',
  GENERATE_INCOME_STATEMENT: 'credits.costs.incomeStatement',
  GENERATE_VAT_DECLARATION: 'credits.costs.vatDeclaration',
  GENERATE_TAX_ESTIMATION: 'credits.costs.taxEstimation',
  GENERATE_FINANCIAL_DIAGNOSTIC: 'credits.costs.financialDiagnostic',

  // Documents Commerciaux
  PDF_INVOICE: 'credits.costs.pdfInvoice',
  PDF_QUOTE: 'credits.costs.pdfQuote',
  PDF_DELIVERY_NOTE: 'credits.costs.pdfDeliveryNote',
  PDF_CREDIT_NOTE: 'credits.costs.pdfCreditNote',
  PDF_PURCHASE_ORDER: 'credits.costs.pdfPurchaseOrder',

  // Rapports Analytiques
  PDF_REPORT: 'credits.costs.pdfReport',
  PDF_ANALYTICS: 'credits.costs.pdfAnalytics',
  PDF_SUPPLIER_REPORT: 'credits.costs.pdfSupplierReport',
  PDF_RECONCILIATION: 'credits.costs.pdfReconciliation',
  PDF_SCENARIO: 'credits.costs.pdfScenario',

  // Exports Complémentaires
  EXPORT_HTML: 'credits.costs.exportHtml',

  // Autres
  PDF_RECEIPT: 'credits.costs.pdfReceipt',
  CLOUD_BACKUP: 'credits.costs.cloudBackup',

  // IA
  AI_INVOICE_EXTRACTION: 'credits.costs.aiInvoiceExtraction',
  AI_CHATBOT: 'credits.costs.aiChatbot',
  AI_CATEGORIZE: 'credits.costs.aiCategorize',
  AI_ANOMALY_DETECT: 'credits.costs.aiAnomalyDetect',
  AI_FORECAST: 'credits.costs.aiForecast',
  AI_REMINDER_SUGGEST: 'credits.costs.aiReminderSuggest',
  AI_REPORT: 'credits.costs.aiReport',
};

/**
 * Catégories pour affichage groupé dans "What Costs Credits?"
 */
export const CREDIT_CATEGORIES = {
  FINANCIAL_STATEMENTS: [
    'GENERATE_BALANCE_SHEET',
    'GENERATE_INCOME_STATEMENT',
    'GENERATE_VAT_DECLARATION',
    'GENERATE_TAX_ESTIMATION',
    'GENERATE_FINANCIAL_DIAGNOSTIC',
  ],
  COMMERCIAL_DOCUMENTS: [
    'PDF_INVOICE',
    'PDF_QUOTE',
    'PDF_DELIVERY_NOTE',
    'PDF_CREDIT_NOTE',
    'PDF_PURCHASE_ORDER',
  ],
  ANALYTICAL_REPORTS: [
    'PDF_REPORT',
    'PDF_ANALYTICS',
    'PDF_SUPPLIER_REPORT',
    'PDF_RECONCILIATION',
    'PDF_SCENARIO',
  ],
  ADDITIONAL_EXPORTS: [
    'EXPORT_HTML',
  ],
  OTHER: [
    'PDF_RECEIPT',
    'CLOUD_BACKUP',
  ],
  AI_FEATURES: [
    'AI_INVOICE_EXTRACTION',
    'AI_CHATBOT',
    'AI_CATEGORIZE',
    'AI_ANOMALY_DETECT',
    'AI_FORECAST',
    'AI_REMINDER_SUGGEST',
    'AI_REPORT',
  ],
};

/**
 * Hook that wraps an action with credit consumption.
 * Returns a guard function and modal state.
 *
 * Usage:
 *   const { guardedAction, modalProps } = useCreditsGuard();
 *
 *   const handleExportPDF = () => guardedAction(
 *     CREDIT_COSTS.PDF_INVOICE,
 *     'PDF Export',
 *     async () => { await exportInvoiceToPDF(...) }
 *   );
 *
 *   return <><CreditsGuardModal {...modalProps} />...</>
 */
export const useCreditsGuard = () => {
  const { availableCredits, consumeCredits } = useCredits();
  const [modalState, setModalState] = useState({
    isOpen: false,
    requiredCredits: 0,
    actionLabel: '',
  });

  const closeModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  /**
   * Execute an action only if the user has enough credits.
   * If not, shows the modal. If yes, deducts credits then runs the action.
   *
   * @param {number} cost - Credits required
   * @param {string} label - Human-readable action label
   * @param {Function} action - Async function to execute if credits are available
   * @returns {Promise<boolean>} true if action was executed
   */
  const guardedAction = useCallback(async (cost, label, action) => {
    if (availableCredits < cost) {
      setModalState({
        isOpen: true,
        requiredCredits: cost,
        actionLabel: label,
      });
      return false;
    }

    const consumed = await consumeCredits(cost, label);
    if (!consumed) return false;

    try {
      await action();
      return true;
    } catch (err) {
      console.error('Guarded action failed:', err);
      return false;
    }
  }, [availableCredits, consumeCredits]);

  return {
    guardedAction,
    availableCredits,
    modalProps: {
      isOpen: modalState.isOpen,
      onClose: closeModal,
      requiredCredits: modalState.requiredCredits,
      availableCredits,
      actionLabel: modalState.actionLabel,
    },
  };
};
