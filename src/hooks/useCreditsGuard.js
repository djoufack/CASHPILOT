
import { useState, useCallback } from 'react';
import { useCredits } from '@/hooks/useCredits';

/**
 * Credit costs per action type
 */
export const CREDIT_COSTS = {
  PDF_INVOICE: 2,
  PDF_CREDIT_NOTE: 2,
  PDF_DELIVERY_NOTE: 2,
  PDF_QUOTE: 2,
  PDF_RECEIPT: 1,
  PDF_REPORT: 3,
  PDF_BALANCE_SHEET: 3,
  PDF_INCOME_STATEMENT: 3,
  PDF_VAT: 3,
  PDF_TAX: 3,
  PDF_RECONCILIATION: 3,
  CLOUD_BACKUP: 1,
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
