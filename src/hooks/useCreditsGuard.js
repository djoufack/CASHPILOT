import { useState, useCallback, useEffect } from 'react';
import { useCredits } from '@/hooks/useCredits';
import { useEntitlements } from '@/hooks/useEntitlements';
import { captureError } from '@/services/errorTracking';
import { supabase } from '@/lib/supabase';

const CREDIT_OPERATION_CODES = [
  'GENERATE_BALANCE_SHEET',
  'GENERATE_INCOME_STATEMENT',
  'GENERATE_VAT_DECLARATION',
  'GENERATE_TAX_ESTIMATION',
  'GENERATE_FINANCIAL_DIAGNOSTIC',
  'PDF_INVOICE',
  'PDF_QUOTE',
  'PDF_DELIVERY_NOTE',
  'PDF_CREDIT_NOTE',
  'PDF_PURCHASE_ORDER',
  'PDF_REPORT',
  'PDF_ANALYTICS',
  'PDF_SUPPLIER_REPORT',
  'PDF_RECONCILIATION',
  'PDF_SCENARIO',
  'EXPORT_HTML',
  'PDF_RECEIPT',
  'CLOUD_BACKUP',
  'PEPPOL_CONFIGURATION_OK',
  'PEPPOL_SEND_INVOICE',
  'PEPPOL_RECEIVE_INVOICE',
  'AI_INVOICE_EXTRACTION',
  'AI_CHATBOT',
  'AI_CATEGORIZE',
  'AI_ANOMALY_DETECT',
  'AI_FORECAST',
  'AI_REMINDER_SUGGEST',
  'AI_REPORT',
];

const DEFAULT_CREDIT_COSTS = Object.freeze(
  Object.fromEntries(CREDIT_OPERATION_CODES.map((code) => [code, 0])),
);

// Backward-compatible export for existing imports across pages/components.
// Values are hydrated from the `credit_costs` DB table and mutated in-place.
export const CREDIT_COSTS = { ...DEFAULT_CREDIT_COSTS };

let creditCostsHydrationPromise = null;

const normalizeCreditCosts = (rows) => {
  const normalized = { ...DEFAULT_CREDIT_COSTS };
  for (const row of rows || []) {
    const code = row?.operation_code;
    const cost = Number(row?.cost);
    if (CREDIT_OPERATION_CODES.includes(code) && Number.isFinite(cost) && cost > 0) {
      normalized[code] = cost;
    }
  }
  return normalized;
};

const hydrateCreditCostsCatalog = async ({ force = false } = {}) => {
  if (!supabase) {
    return { ...CREDIT_COSTS };
  }

  if (!force && creditCostsHydrationPromise) {
    return creditCostsHydrationPromise;
  }

  creditCostsHydrationPromise = supabase
    .from('credit_costs')
    .select('operation_code, cost')
    .eq('is_active', true)
    .then(({ data, error }) => {
      if (error) {
        throw error;
      }

      const hydrated = normalizeCreditCosts(data || []);
      Object.assign(CREDIT_COSTS, hydrated);
      return { ...CREDIT_COSTS };
    })
    .catch((error) => {
      // Keep the last known in-memory values if DB is temporarily unreachable.
      console.warn('Failed to hydrate credit costs from DB:', error);
      return { ...CREDIT_COSTS };
    });

  return creditCostsHydrationPromise;
};

// Warm cache as soon as the module is loaded so UI handlers can consume DB values.
void hydrateCreditCostsCatalog();

/**
 * Labels i18n pour affichage dans l'interface
 */
export const CREDIT_COST_LABELS = {
  // Etats Comptables
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

  // Exports Complementaires
  EXPORT_HTML: 'credits.costs.exportHtml',

  // Autres
  PDF_RECEIPT: 'credits.costs.pdfReceipt',
  CLOUD_BACKUP: 'credits.costs.cloudBackup',

  // Peppol
  PEPPOL_CONFIGURATION_OK: 'credits.costs.peppolConfigurationOk',
  PEPPOL_SEND_INVOICE: 'credits.costs.peppolSendInvoice',
  PEPPOL_RECEIVE_INVOICE: 'credits.costs.peppolReceiveInvoice',

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
 * Categories pour affichage groupe dans "What Costs Credits?"
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
  PEPPOL: [
    'PEPPOL_CONFIGURATION_OK',
    'PEPPOL_SEND_INVOICE',
    'PEPPOL_RECEIVE_INVOICE',
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
 */
export const useCreditsGuard = () => {
  const { availableCredits, consumeCredits } = useCredits();
  const { trialActive, fullAccessOverride } = useEntitlements();
  const [costs, setCosts] = useState(() => ({ ...CREDIT_COSTS }));
  const [modalState, setModalState] = useState({
    isOpen: false,
    requiredCredits: 0,
    actionLabel: '',
  });

  useEffect(() => {
    let active = true;

    hydrateCreditCostsCatalog({ force: true }).then((hydrated) => {
      if (!active) return;
      setCosts(hydrated);
    });

    return () => {
      active = false;
    };
  }, []);

  const closeModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const openCreditsModal = useCallback((requiredCredits, actionLabel) => {
    setModalState({
      isOpen: true,
      requiredCredits,
      actionLabel,
    });
  }, []);

  const ensureCredits = useCallback(async (cost, label) => {
    if (!Number.isFinite(cost) || cost <= 0) {
      console.warn('Blocked credit operation due to missing DB credit configuration', { cost, label });
      return false;
    }

    if (!trialActive && !fullAccessOverride && availableCredits < cost) {
      openCreditsModal(cost, label);
      return false;
    }

    return true;
  }, [availableCredits, fullAccessOverride, openCreditsModal, trialActive]);

  const resolveCost = useCallback(async (costOrCode) => {
    if (typeof costOrCode === 'number') {
      if (Number.isFinite(costOrCode) && costOrCode > 0) {
        return costOrCode;
      }
      await hydrateCreditCostsCatalog({ force: true });
      return Number(costOrCode);
    }

    if (typeof costOrCode === 'string' && costOrCode) {
      const current = Number(CREDIT_COSTS[costOrCode] ?? costs[costOrCode]);
      if (Number.isFinite(current) && current > 0) {
        return current;
      }

      const hydrated = await hydrateCreditCostsCatalog({ force: true });
      setCosts(hydrated);
      return Number(hydrated[costOrCode]);
    }

    return Number.NaN;
  }, [costs]);

  /**
   * Execute an action only if the user has enough credits.
   *
   * @param {number|string} costOrCode - Credits required, or operation code in `credit_costs`
   * @param {string} label - Human-readable action label
   * @param {Function} action - Async function to execute if credits are available
   * @returns {Promise<boolean>} true if action was executed
   */
  const guardedAction = useCallback(async (costOrCode, label, action) => {
    const resolvedCost = await resolveCost(costOrCode);

    const hasCredits = await ensureCredits(resolvedCost, label);
    if (!hasCredits) return false;

    const consumed = await consumeCredits(resolvedCost, label);
    if (!consumed) return false;

    try {
      await action();
      return true;
    } catch (err) {
      captureError(err, {
        tags: { scope: 'credits_guard', action: 'guarded_action' },
        extra: { label, costOrCode, resolvedCost },
      });
      console.error('Guarded action failed:', err);
      return false;
    }
  }, [consumeCredits, ensureCredits, resolveCost]);

  return {
    guardedAction,
    ensureCredits,
    openCreditsModal,
    availableCredits,
    costs,
    modalProps: {
      isOpen: modalState.isOpen,
      onClose: closeModal,
      requiredCredits: modalState.requiredCredits,
      availableCredits,
      actionLabel: modalState.actionLabel,
    },
  };
};
