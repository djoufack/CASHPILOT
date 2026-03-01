/**
 * Pilotage Ecosystem - Financial Ratio Calculations
 * Ratios complementaires pour le pilotage financier avance
 *
 * Ces calculs completent financialAnalysisCalculations.js
 * (qui couvre deja: grossMargin, EBITDA, operatingResult, CAF,
 *  workingCapital, BFR, netDebt, ROE, ROCE, currentRatio,
 *  quickRatio, cashRatio, financialLeverage, DSCR)
 *
 * Classes OHADA utilisees:
 * - Classe 1: Capitaux propres (10) et dettes (16, 17)
 * - Classe 2: Actifs immobilises
 * - Classe 3: Stocks
 * - Classe 4: Creances (41) et Dettes (40)
 * - Classe 5: Tresorerie (52=Banque, 57=Caisse)
 * - Classe 6: Charges (60=Achats, 67=Charges financieres)
 * - Classe 7: Produits (70=Ventes)
 */

import {
  calculateBFR,
  calculateNetDebt,
  calculateWorkingCapital
} from '@/utils/financialAnalysisCalculations';
import {
  calculateCapexFromEntries,
  extractFinancialPosition,
} from '@/utils/financialMetrics';
import {
  buildAccountSemanticIndex,
} from '@/utils/accountTaxonomy';
import { getTaxConfig } from '@/utils/taxCalculations';

// ============================================================================
// HELPER - EXTRACTION DE COMPTES
// ============================================================================

function normalizeAmount(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const OPENING_ENTRY_REGEX = /^(open|opening|ouverture|solde[-_\s]?initial)/i;

function formatMonthFromKey(key, fallbackLabel = null) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}$/.test(key)) {
    return fallbackLabel || key;
  }

  const [, month] = key.split('-');
  const monthIndex = Number(month) - 1;
  const labels = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

  return labels[monthIndex] || fallbackLabel || key;
}

export function buildPilotageMonthlySeries(accountingMonthlyData = [], cashFlowData = []) {
  const seriesByKey = new Map();

  (accountingMonthlyData || []).forEach((item) => {
    if (!item?.key) return;
    const revenue = normalizeAmount(item.revenue);
    const expense = normalizeAmount(item.expense);

    seriesByKey.set(item.key, {
      key: item.key,
      month: formatMonthFromKey(item.key, item.name || item.label || item.key),
      revenue,
      expense,
      net: revenue - expense,
      cashIn: 0,
      cashOut: 0,
      cashNet: 0,
    });
  });

  (cashFlowData || []).forEach((item) => {
    if (!item?.key) return;
    const existing = seriesByKey.get(item.key) || {
      key: item.key,
      month: formatMonthFromKey(item.key, item.label || item.month || item.key),
      revenue: 0,
      expense: 0,
      net: 0,
      cashIn: 0,
      cashOut: 0,
      cashNet: 0,
    };

    existing.month = formatMonthFromKey(item.key, item.label || existing.month);
    existing.cashIn = normalizeAmount(item.income);
    existing.cashOut = normalizeAmount(item.expenses);
    existing.cashNet = normalizeAmount(item.net);
    seriesByKey.set(item.key, existing);
  });

  let cumulativeCashFlow = 0;

  return Array.from(seriesByKey.values())
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((item) => {
      cumulativeCashFlow += item.cashNet;
      return {
        ...item,
        cumulativeCashFlow,
        cumulativeCashNet: cumulativeCashFlow,
      };
    });
}

function averageValue(currentValue, previousValue) {
  const current = Number(currentValue);
  const previous = Number(previousValue);

  if (!Number.isFinite(current)) return 0;
  if (!Number.isFinite(previous)) return current;
  return (current + previous) / 2;
}

function groupEntriesByReference(entries = []) {
  const groups = new Map();

  (entries || []).forEach((entry) => {
    const key = entry.entry_ref || entry.id;
    const group = groups.get(key) || {
      entry_ref: entry.entry_ref || '',
      lines: [],
    };

    group.lines.push(entry);
    groups.set(key, group);
  });

  return Array.from(groups.values());
}

function isOpeningBalanceGroup(group) {
  if (OPENING_ENTRY_REGEX.test(String(group?.entry_ref || '').trim())) {
    return true;
  }

  return (group?.lines || []).every((line) =>
    OPENING_ENTRY_REGEX.test(String(line?.description || '').trim())
  );
}

function calculateInterestExpenseFromEntries(entries, accounts, startDate, endDate, regionHint) {
  if (!entries || !accounts) return 0;
  const semanticIndex = buildAccountSemanticIndex(accounts, regionHint);
  return (entries || []).reduce((sum, entry) => {
    const date = entry?.transaction_date;
    if (startDate && date < startDate) return sum;
    if (endDate && date > endDate) return sum;

    const classified = semanticIndex.map.get(entry.account_code);
    if (!classified?.profile?.isInterestExpense) return sum;

    return sum + (parseFloat(entry.debit) || 0) - (parseFloat(entry.credit) || 0);
  }, 0);
}

function calculateAnnualDebtServiceFromEntries(entries, accounts, startDate, endDate, regionHint) {
  if (!entries || !accounts) return null;
  const semanticIndex = buildAccountSemanticIndex(accounts, regionHint);
  const filteredEntries = (entries || []).filter((entry) => {
    const date = entry?.transaction_date;
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  });

  let totalDebtService = 0;

  groupEntriesByReference(filteredEntries).forEach((group) => {
    if (isOpeningBalanceGroup(group)) return;

    let cashOut = 0;
    let principalRepayment = 0;
    let interestPaid = 0;

    group.lines.forEach((entry) => {
      const classified = semanticIndex.map.get(entry.account_code);
      if (!classified) return;

      const debit = parseFloat(entry.debit) || 0;
      const credit = parseFloat(entry.credit) || 0;

      if (classified.profile.isCash) {
        cashOut += Math.max(0, credit - debit);
      }
      if (classified.profile.isFinancialDebt) {
        principalRepayment += Math.max(0, debit - credit);
      }
      if (classified.profile.isInterestExpense) {
        interestPaid += Math.max(0, debit - credit);
      }
    });

    if (cashOut <= 0) return;
    totalDebtService += principalRepayment + interestPaid;
  });

  return totalDebtService > 0 ? totalDebtService : null;
}

// ============================================================================
// RATIOS DE ROTATION / ACTIVITE
// ============================================================================

/**
 * DSO (Days Sales Outstanding) - Delai moyen de recouvrement clients
 * Formule: (Creances clients / CA) * 365
 * @param {number} receivables - Creances clients
 * @param {number} revenue - Chiffre d'affaires
 * @returns {number} Nombre de jours
 */
export function calculateDSO(receivables, revenue) {
  const r = parseFloat(receivables);
  const rev = parseFloat(revenue);
  if (isNaN(r) || isNaN(rev)) return null;
  if (rev === 0) return r === 0 ? 0 : null;
  return (r / rev) * 365;
}

/**
 * DPO (Days Payable Outstanding) - Delai moyen de paiement fournisseurs
 * Formule: (Dettes fournisseurs / Achats) * 365
 * @param {number} payables - Dettes fournisseurs
 * @param {number} purchases - Achats de la periode
 * @returns {number} Nombre de jours
 */
export function calculateDPO(payables, purchases) {
  const p = parseFloat(payables);
  const pur = parseFloat(purchases);
  if (isNaN(p) || isNaN(pur)) return null;
  if (pur === 0) return p === 0 ? 0 : null;
  return (p / pur) * 365;
}

/**
 * Rotation des stocks en jours
 * Formule: (Stocks / Cout des marchandises vendues) * 365
 * @param {number} inventory - Valeur des stocks
 * @param {number} cogs - Cout des marchandises vendues
 * @returns {number} Nombre de jours
 */
export function calculateStockRotationDays(inventory, cogs) {
  const inv = parseFloat(inventory);
  const c = parseFloat(cogs);
  if (isNaN(inv) || isNaN(c)) return null;
  if (c === 0) return inv === 0 ? 0 : null;
  return (inv / c) * 365;
}

/**
 * CCC (Cash Conversion Cycle) - Cycle de conversion de tresorerie
 * Formule: DSO + Rotation Stocks - DPO
 * @param {number} dso - Days Sales Outstanding
 * @param {number} stockRotationDays - Rotation des stocks en jours
 * @param {number} dpo - Days Payable Outstanding
 * @returns {number} Nombre de jours
 */
export function calculateCCC(dso, stockRotationDays, dpo) {
  if (dso == null || stockRotationDays == null || dpo == null) return null;
  const d = parseFloat(dso) || 0;
  const s = parseFloat(stockRotationDays) || 0;
  const p = parseFloat(dpo) || 0;
  return d + s - p;
}

// ============================================================================
// RATIOS DE STRUCTURE / BFR
// ============================================================================

/**
 * Intensite BFR - BFR rapporte au CA
 * Formule: (BFR / CA) * 100
 * @param {number} bfr - Besoin en Fonds de Roulement
 * @param {number} revenue - Chiffre d'affaires
 * @returns {number} Pourcentage
 */
export function calculateBFRToRevenue(bfr, revenue) {
  const b = parseFloat(bfr);
  const rev = parseFloat(revenue);
  if (isNaN(b) || isNaN(rev)) return null;
  if (rev === 0) return b === 0 ? 0 : null;
  return (b / rev) * 100;
}

// ============================================================================
// RATIOS DE RENTABILITE
// ============================================================================

/**
 * ROA (Return on Assets) - Rentabilite des actifs
 * Formule: (Resultat net / Total Actif) * 100
 * @param {number} netIncome - Resultat net
 * @param {number} totalAssets - Total de l'actif
 * @returns {number} Pourcentage
 */
export function calculateROA(netIncome, totalAssets) {
  const ni = parseFloat(netIncome);
  const ta = parseFloat(totalAssets);
  if (isNaN(ni) || isNaN(ta)) return null;
  if (ta === 0) return ni === 0 ? 0 : null;
  return (ni / ta) * 100;
}

/**
 * EVA (Economic Value Added) - Valeur economique ajoutee
 * Formule: NOPAT - (WACC * Capital Employe)
 * Ou NOPAT = Resultat d'exploitation * (1 - taux IS)
 * @param {number} operatingResult - Resultat d'exploitation (EBIT)
 * @param {number} taxRate - Taux d'imposition (ex: 0.25 pour 25%)
 * @param {number} wacc - Cout moyen pondere du capital (ex: 0.10 pour 10%)
 * @param {number} capitalEmployed - Capital employe (capitaux propres + dettes financieres)
 * @returns {number} Montant EVA
 */
export function calculateEVA(operatingResult, taxRate, wacc, capitalEmployed) {
  const or_ = parseFloat(operatingResult);
  const tr = parseFloat(taxRate);
  const w = parseFloat(wacc);
  const ce = parseFloat(capitalEmployed);
  if (isNaN(or_) || isNaN(tr) || isNaN(w) || isNaN(ce)) return 0;
  const nopat = or_ * (1 - tr);
  return nopat - (w * ce);
}

// ============================================================================
// RATIOS DE COUVERTURE
// ============================================================================

/**
 * ICR (Interest Coverage Ratio) - Couverture des charges financieres
 * Formule: EBIT / Charges financieres
 * @param {number} ebit - Resultat d'exploitation
 * @param {number} interestExpense - Charges financieres
 * @returns {number} Ratio
 */
export function calculateInterestCoverage(ebit, interestExpense) {
  const e = parseFloat(ebit);
  const ie = parseFloat(interestExpense);
  if (isNaN(e) || isNaN(ie) || ie === 0) return null;
  return e / ie;
}

/**
 * DSCR (Debt Service Coverage Ratio) - Ratio de couverture du service de la dette
 * Formule: EBITDA / (Principal + Interets annuels)
 * @param {number} ebitda - EBITDA
 * @param {number} annualDebtService - Service annuel de la dette (principal + interets)
 * @returns {number} Ratio
 */
export function calculateDSCR(ebitda, annualDebtService) {
  const eb = parseFloat(ebitda);
  const ads = parseFloat(annualDebtService);
  if (isNaN(eb) || isNaN(ads) || ads === 0) return null;
  return eb / ads;
}

// ============================================================================
// RATIOS DE TRESORERIE
// ============================================================================

/**
 * Free Cash Flow
 * Formule: Cash-flow operationnel - CAPEX
 * @param {number} operatingCashFlow - Flux de tresorerie operationnel
 * @param {number} capex - Depenses d'investissement
 * @returns {number} Montant FCF
 */
export function calculateFreeCashFlow(operatingCashFlow, capex) {
  const ocf = parseFloat(operatingCashFlow);
  const cx = parseFloat(capex);
  if (isNaN(ocf)) return 0;
  return ocf - (isNaN(cx) ? 0 : cx);
}

/**
 * Cash Flow / Dette nette
 * Formule: Cash-flow operationnel / Dette nette
 * @param {number} operatingCashFlow - Flux de tresorerie operationnel
 * @param {number} netDebt - Endettement net
 * @returns {number} Ratio
 */
export function calculateCashFlowToDebt(operatingCashFlow, netDebt) {
  const ocf = parseFloat(operatingCashFlow);
  const nd = parseFloat(netDebt);
  if (isNaN(ocf) || isNaN(nd) || nd === 0) return null;
  return ocf / nd;
}

// ============================================================================
// RATIOS DE STRUCTURE FINANCIERE
// ============================================================================

/**
 * Independance Financiere - Autonomie financiere
 * Formule: (Capitaux propres / Total Bilan) * 100
 * @param {number} equity - Capitaux propres
 * @param {number} totalBalance - Total du bilan
 * @returns {number} Pourcentage
 */
export function calculateFinancialIndependence(equity, totalBalance) {
  const eq = parseFloat(equity);
  const tb = parseFloat(totalBalance);
  if (isNaN(eq) || isNaN(tb) || tb === 0) return null;
  return (eq / tb) * 100;
}

/**
 * Couverture des emplois stables
 * Formule: Capitaux permanents / Actifs immobilises
 * @param {number} permanentCapital - Capitaux permanents (classe 1)
 * @param {number} fixedAssets - Actifs immobilises (classe 2)
 * @returns {number} Ratio
 */
export function calculateStableAssetCoverage(permanentCapital, fixedAssets) {
  const pc = parseFloat(permanentCapital);
  const fa = parseFloat(fixedAssets);
  if (isNaN(pc) || isNaN(fa) || fa === 0) return null;
  return pc / fa;
}

// ============================================================================
// FONCTION PRINCIPALE: CALCUL DE TOUS LES RATIOS DE PILOTAGE
// ============================================================================

/**
 * Compute all pilotage ratios from accounting data
 *
 * @param {Object} params
 * @param {Object} params.balanceSheet - Bilan comptable { assets, liabilities, equity, totalAssets }
 * @param {Object} params.incomeStatement - Compte de resultat { totalRevenue, totalExpenses, netIncome }
 * @param {Array} params.entries - Ecritures comptables
 * @param {Array} params.accounts - Plan comptable
 * @param {string} params.startDate - Date debut periode
 * @param {string} params.endDate - Date fin periode
 * @param {Object} [params.financialDiagnostic] - Diagnostic issu de buildFinancialDiagnostic
 * @returns {Object} Tous les ratios calcules
 */
export function computePilotageRatios(params) {
  const {
    balanceSheet,
    incomeStatement,
    entries,
    accounts,
    startDate,
    endDate,
    financialDiagnostic,
    previousBalanceSheet,
    region = 'france',
  } = params || {};

  const financialPosition = extractFinancialPosition(balanceSheet, region);
  const previousFinancialPosition = previousBalanceSheet
    ? extractFinancialPosition(previousBalanceSheet, region)
    : null;

  // --- Extraction des valeurs du bilan ---
  const receivables = averageValue(financialPosition.receivables, previousFinancialPosition?.receivables);
  const payables = averageValue(financialPosition.tradePayables, previousFinancialPosition?.tradePayables);
  const inventory = averageValue(financialPosition.inventory, previousFinancialPosition?.inventory);
  const equity = averageValue(financialPosition.equity, previousFinancialPosition?.equity);
  const fixedAssets = financialPosition.fixedAssets;
  const permanentCapital = financialPosition.permanentCapital;
  const financialDebt = financialPosition.financialDebt;
  const cash = financialPosition.cash;

  // Total actif
  const totalAssets = averageValue(financialPosition.totalAssets, previousFinancialPosition?.totalAssets);
  const totalBalance = totalAssets;

  // --- Valeurs du diagnostic financier existant ---
  const diagnosticMargins = financialDiagnostic?.margins || {};
  const diagnosticFinancing = financialDiagnostic?.financing || {};

  // --- Extraction des valeurs du compte de resultat ---
  const revenue = parseFloat(diagnosticMargins.revenue ?? incomeStatement?.totalRevenue) || 0;
  const netIncome = parseFloat(incomeStatement?.netIncome) || 0;

  const semanticIndex = buildAccountSemanticIndex(accounts || [], region);

  // Base fournisseurs: achats + services fournisseurs, pas seulement classe 60
  const purchases = (entries || []).reduce((sum, entry) => {
    const classified = semanticIndex.map.get(entry.account_code);
    if (!classified?.profile?.isSupplierExpense) return sum;
    return sum + Math.max(0, (parseFloat(entry.debit) || 0) - (parseFloat(entry.credit) || 0));
  }, 0);

  const cogs = (entries || []).reduce((sum, entry) => {
    const classified = semanticIndex.map.get(entry.account_code);
    if (!classified?.profile?.isDirectCostExpense) return sum;
    return sum + Math.max(0, (parseFloat(entry.debit) || 0) - (parseFloat(entry.credit) || 0));
  }, 0);

  const interestExpense = calculateInterestExpenseFromEntries(entries, accounts, startDate, endDate, region);
  const annualDebtService =
    calculateAnnualDebtServiceFromEntries(entries, accounts, startDate, endDate, region);

  const ebitda = parseFloat(diagnosticMargins.ebitda) || 0;
  const operatingResult = parseFloat(diagnosticMargins.operatingResult) || 0;
  const operatingCashFlow = parseFloat(diagnosticFinancing.operatingCashFlow) || 0;
  const capex = parseFloat(diagnosticFinancing.capex) || calculateCapexFromEntries(entries, accounts, startDate, endDate, region);

  // --- Reuse from financialAnalysisCalculations ---
  const bfr = balanceSheet ? calculateBFR(balanceSheet, region) : 0;
  const netDebt = balanceSheet ? calculateNetDebt(balanceSheet, region) : 0;
  const workingCapital = balanceSheet ? calculateWorkingCapital(balanceSheet, region) : 0;

  // Capital employe: capitaux propres + dettes financieres
  const capitalEmployed = averageValue(
    financialPosition.equity + financialPosition.financialDebt,
    previousFinancialPosition
      ? previousFinancialPosition.equity + previousFinancialPosition.financialDebt
      : undefined
  );

  // --- Calcul des ratios ---

  // Ratios de rotation / activite
  const dso = calculateDSO(receivables, revenue);
  const dpo = calculateDPO(payables, purchases);
  const stockRotationDays = calculateStockRotationDays(inventory, cogs);
  const ccc = calculateCCC(dso, stockRotationDays, dpo);
  const bfrToRevenue = calculateBFRToRevenue(bfr, revenue);

  // Ratios de rentabilite
  const roa = calculateROA(netIncome, totalAssets);

  // EVA - taux IS aligne sur la zone fiscale selectionnee
  const defaultTaxRate = getTaxConfig(region).corporateRate;
  const defaultWacc = 0.10;
  const eva = calculateEVA(operatingResult, defaultTaxRate, defaultWacc, capitalEmployed);

  // Ratios de couverture
  const interestCoverage = calculateInterestCoverage(operatingResult, interestExpense);
  const dscr = calculateDSCR(operatingCashFlow + capex, annualDebtService);

  // Ratios de tresorerie
  const freeCashFlow = calculateFreeCashFlow(operatingCashFlow, capex);
  const cashFlowToDebt = calculateCashFlowToDebt(operatingCashFlow, netDebt);

  // Ratios de structure financiere
  const financialIndependence = calculateFinancialIndependence(equity, totalBalance);
  const stableAssetCoverage = calculateStableAssetCoverage(permanentCapital, fixedAssets);

  // Gearing: dette nette / capitaux propres
  const gearing = equity !== 0 ? netDebt / equity : 0;

  return {
    // Valeurs extraites
    extracted: {
      receivables,
      payables,
      inventory,
      equity,
      fixedAssets,
      permanentCapital,
      financialDebt,
      cash,
      totalAssets,
      revenue,
      netIncome,
      purchases,
      cogs,
      interestExpense,
      annualDebtService,
      capitalEmployed,
      capex
    },

    // Ratios de rotation / activite
    activity: {
      dso,
      dpo,
      stockRotationDays,
      ccc,
      bfrToRevenue
    },

    // Ratios de rentabilite
    profitability: {
      roa,
      eva
    },

    // Ratios de couverture
    coverage: {
      interestCoverage,
      dscr
    },

    // Ratios de tresorerie
    cashFlow: {
      freeCashFlow,
      cashFlowToDebt,
      operatingCashFlow
    },

    // Ratios de structure financiere
    structure: {
      financialIndependence,
      stableAssetCoverage,
      gearing,
      workingCapital,
      bfr,
      netDebt
    }
  };
}

// ============================================================================
// ALERTES FINANCIERES
// ============================================================================

/**
 * Detect financial alerts based on computed ratios
 * Returns array of alert objects for the pilotage dashboard
 *
 * @param {Object} ratios - Resultat de computePilotageRatios
 * @param {Object} [financialDiagnostic] - Diagnostic issu de buildFinancialDiagnostic
 * @returns {Array<{type: string, severity: string, message: string, value: number, threshold: number}>}
 */
export function computeAlerts(ratios, financialDiagnostic) {
  const alerts = [];

  if (!ratios) return alerts;

  const extracted = ratios.extracted || {};
  const coverage = ratios.coverage || {};
  const activity = ratios.activity || {};
  const cashFlow = ratios.cashFlow || {};
  const structure = ratios.structure || {};

  // 1. Capitaux propres negatifs
  if (extracted.equity < 0) {
    alerts.push({
      type: 'negative_equity',
      severity: 'critical',
      message: 'Capitaux propres negatifs : situation de faillite potentielle',
      value: extracted.equity,
      threshold: 0
    });
  }

  // 2. ICR < 1 : l'entreprise ne couvre pas ses charges financieres
  if (coverage.interestCoverage > 0 && coverage.interestCoverage < 1) {
    alerts.push({
      type: 'low_interest_coverage',
      severity: 'critical',
      message: 'Couverture des interets insuffisante (ICR < 1)',
      value: coverage.interestCoverage,
      threshold: 1
    });
  }

  // 3. DSCR < 1.2 : service de la dette peu couvert
  if (coverage.dscr > 0 && coverage.dscr < 1.2) {
    alerts.push({
      type: 'low_dscr',
      severity: 'warning',
      message: 'Couverture du service de la dette fragile (DSCR < 1.2)',
      value: coverage.dscr,
      threshold: 1.2
    });
  }

  // 4. Derive du BFR : intensite BFR > 30% du CA
  if (activity.bfrToRevenue > 30) {
    alerts.push({
      type: 'bfr_drift',
      severity: 'warning',
      message: 'BFR excessif par rapport au chiffre d\'affaires (> 30%)',
      value: activity.bfrToRevenue,
      threshold: 30
    });
  }

  // 5. Cash-flow operationnel negatif
  if (cashFlow.operatingCashFlow < 0) {
    alerts.push({
      type: 'negative_operating_cashflow',
      severity: 'critical',
      message: 'Flux de tresorerie operationnel negatif',
      value: cashFlow.operatingCashFlow,
      threshold: 0
    });
  }

  // 6. Gearing > 1 : endettement net superieur aux capitaux propres
  if (structure.gearing > 1) {
    alerts.push({
      type: 'high_gearing',
      severity: 'warning',
      message: 'Endettement net superieur aux capitaux propres (gearing > 1)',
      value: structure.gearing,
      threshold: 1
    });
  }

  // 7. Resultat net negatif
  if (extracted.netIncome < 0) {
    alerts.push({
      type: 'negative_net_income',
      severity: 'warning',
      message: 'Resultat net negatif sur la periode',
      value: extracted.netIncome,
      threshold: 0
    });
  }

  // Additional context from financialDiagnostic if available
  if (financialDiagnostic) {
    const financing = financialDiagnostic.financing || {};

    // Working capital negative
    if (financing.workingCapital < 0) {
      alerts.push({
        type: 'negative_working_capital',
        severity: 'warning',
        message: 'Fonds de roulement negatif : les emplois stables ne sont pas couverts',
        value: financing.workingCapital,
        threshold: 0
      });
    }
  }

  return alerts;
}
