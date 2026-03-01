/**
 * Financial Analysis Calculations Engine
 * Calculs avancés d'analyse financière selon les normes OHADA
 *
 * Classes OHADA:
 * - Classe 1: Capitaux propres et dettes
 * - Classe 2: Actifs immobilisés
 * - Classe 3: Stocks
 * - Classe 4: Créances (41) et Dettes (40, 44)
 * - Classe 5: Trésorerie (52=Banque, 57=Caisse)
 * - Classe 6: Charges
 * - Classe 7: Produits
 */

import { filterByPeriod } from './accountingCalculations';
import {
  calculateCapexFromEntries,
  calculatePreTaxIncome,
  extractFinancialPosition,
} from './financialMetrics';
import {
  buildAccountSemanticIndex,
  getNaturalEntryAmount,
} from './accountTaxonomy';

function sumEntriesByPredicate(entries, accounts, startDate, endDate, predicate, regionHint = null) {
  if (!entries || !accounts) return 0;

  const filtered = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const semanticIndex = buildAccountSemanticIndex(accounts, regionHint);

  return filtered.reduce((sum, entry) => {
    const classified = semanticIndex.map.get(entry.account_code);
    if (!classified?.account || !predicate(classified.profile, classified.account, entry)) {
      return sum;
    }

    return sum + getNaturalEntryAmount(entry, classified.account.account_type);
  }, 0);
}

function getPreviousFinancialPosition(previousPeriodData, regionHint = null) {
  if (!previousPeriodData?.balanceSheet) return null;
  return extractFinancialPosition(previousPeriodData.balanceSheet, regionHint);
}

function averageBalance(currentValue, previousValue) {
  const current = Number(currentValue);
  const previous = Number(previousValue);

  if (!Number.isFinite(current)) return 0;
  if (!Number.isFinite(previous)) return current;
  return (current + previous) / 2;
}

// ============================================================================
// VALIDATION DES DONNÉES
// ============================================================================

/**
 * Valider que les données nécessaires existent pour les calculs
 */
export function validateFinancialData(entries, accounts, balanceSheet) {
  const errors = [];

  if (!entries || entries.length === 0) {
    errors.push('Aucune écriture comptable trouvée');
  }

  if (!accounts || accounts.length === 0) {
    errors.push('Plan comptable non importé');
  }

  if (!balanceSheet || !balanceSheet.balanced) {
    errors.push('Bilan non équilibré');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// ANALYSE DES MARGES
// ============================================================================

/**
 * Calculer la Marge Brute
 * Formule: Chiffre d'affaires - Coût d'achat des marchandises vendues
 * OHADA: Classe 70 (Ventes) - Classe 60 (Achats)
 */
export function calculateGrossMargin(entries, accounts, startDate, endDate, regionHint = null) {
  const sales = sumEntriesByPredicate(
    entries,
    accounts,
    startDate,
    endDate,
    (profile) => profile.isSalesRevenue,
    regionHint
  );

  const directCosts = sumEntriesByPredicate(
    entries,
    accounts,
    startDate,
    endDate,
    (profile) => profile.isDirectCostExpense,
    regionHint
  );

  return sales - directCosts;
}

/**
 * Calculer le pourcentage de Marge Brute
 */
export function calculateGrossMarginPercentage(grossMargin, revenue) {
  if (!revenue || revenue === 0) return 0;
  return (grossMargin / revenue) * 100;
}

/**
 * Calculer l'EBE / EBITDA (Excédent Brut d'Exploitation)
 * Formule: Produits d'exploitation - Charges d'exploitation (hors dotations)
 * OHADA: (Classe 70-76) - (Classe 60-66) [exclure Classe 68: dotations]
 */
export function calculateEBITDA(entries, accounts, startDate, endDate, regionHint = null) {
  const operatingRevenue = sumEntriesByPredicate(
    entries,
    accounts,
    startDate,
    endDate,
    (profile) => profile.isOperatingRevenue,
    regionHint
  );

  const operatingCashExpenses = sumEntriesByPredicate(
    entries,
    accounts,
    startDate,
    endDate,
    (profile) => profile.isOperatingCashExpense,
    regionHint
  );

  return operatingRevenue - operatingCashExpenses;
}

/**
 * Calculer la marge EBITDA en pourcentage
 */
export function calculateEBITDAMargin(ebitda, revenue) {
  if (!revenue || revenue === 0) return 0;
  return (ebitda / revenue) * 100;
}

/**
 * Calculer le Résultat d'Exploitation
 * Formule: EBITDA - Dotations aux amortissements et provisions
 * OHADA: EBITDA - Classe 68 (Dotations)
 */
export function calculateOperatingResult(entries, accounts, startDate, endDate, regionHint = null) {
  const ebitda = calculateEBITDA(entries, accounts, startDate, endDate, regionHint);
  const operatingNonCashCharges = sumEntriesByPredicate(
    entries,
    accounts,
    startDate,
    endDate,
    (profile) => profile.isOperatingNonCashExpense,
    regionHint
  );

  return ebitda - operatingNonCashCharges;
}

/**
 * Calculer la marge opérationnelle en pourcentage
 */
export function calculateOperatingMargin(operatingResult, revenue) {
  if (!revenue || revenue === 0) return 0;
  return (operatingResult / revenue) * 100;
}

/**
 * Analyser la décomposition du chiffre d'affaires (Prix/Volume)
 * Compare les factures entre deux périodes
 */
export function analyzeRevenueBreakdown(currentInvoices, previousInvoices) {
  if (!currentInvoices || !previousInvoices) {
    return {
      currentRevenue: 0,
      previousRevenue: 0,
      revenueChange: 0,
      revenueChangePercent: 0
    };
  }

  const currentRevenue = currentInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (parseFloat(inv.total_ht) || 0), 0);

  const previousRevenue = previousInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (parseFloat(inv.total_ht) || 0), 0);

  const revenueChange = currentRevenue - previousRevenue;
  const revenueChangePercent = previousRevenue !== 0
    ? (revenueChange / previousRevenue) * 100
    : 0;

  return {
    currentRevenue,
    previousRevenue,
    revenueChange,
    revenueChangePercent
  };
}

// ============================================================================
// ANALYSE DU FINANCEMENT
// ============================================================================

/**
 * Calculer la CAF (Capacité d'Autofinancement)
 * Formule: Résultat net + Dotations - Reprises sur provisions
 * OHADA: Résultat net + Classe 68 + Classe 69 - Classe 79
 */
export function calculateCAF(netIncome, entries, accounts, startDate, endDate, regionHint = null) {
  if (!entries || !accounts) return netIncome || 0;

  const nonCashCharges = sumEntriesByPredicate(
    entries,
    accounts,
    startDate,
    endDate,
    (profile) => profile.isNonCashExpense,
    regionHint
  );

  const reversals = sumEntriesByPredicate(
    entries,
    accounts,
    startDate,
    endDate,
    (profile) => profile.isReversalRevenue,
    regionHint
  );

  return (netIncome || 0) + nonCashCharges - reversals;
}

/**
 * Calculer le Fonds de Roulement
 * Formule: Capitaux permanents - Actifs immobilisés
 * OHADA: (Classe 1) - (Classe 2)
 */
export function calculateWorkingCapital(balanceSheet, regionHint = null) {
  if (!balanceSheet) return 0;

  const { permanentCapital, fixedAssets } = extractFinancialPosition(balanceSheet, regionHint);

  return permanentCapital - fixedAssets;
}

/**
 * Calculer le BFR (Besoin en Fonds de Roulement)
 * Formule: (Actifs circulants - Trésorerie) - Dettes à court terme
 * OHADA: (Classe 3 + Classe 41) - (Classe 40 + Classe 44)
 */
export function calculateBFR(balanceSheet, regionHint = null) {
  if (!balanceSheet) return 0;

  const { operatingCurrentAssets, currentLiabilities } = extractFinancialPosition(balanceSheet, regionHint);

  return operatingCurrentAssets - currentLiabilities;
}

/**
 * Calculer la Variation du BFR
 */
export function calculateBFRVariation(currentBFR, previousBFR) {
  return currentBFR - previousBFR;
}

/**
 * Calculer le Flux de Trésorerie d'Exploitation
 * Formule: CAF - Variation du BFR
 */
export function calculateOperatingCashFlow(caf, bfrVariation) {
  return caf - bfrVariation;
}

/**
 * Calculer l'Endettement Net
 * Formule: Dettes financières - Trésorerie
 * OHADA: (Classe 16 + Classe 17) - (Classe 52 + Classe 57)
 */
export function calculateNetDebt(balanceSheet, regionHint = null) {
  if (!balanceSheet) return 0;

  const { financialDebt, cash } = extractFinancialPosition(balanceSheet, regionHint);

  return financialDebt - cash;
}

// ============================================================================
// RATIOS CLÉS
// ============================================================================

/**
 * Calculer le ROE (Return on Equity)
 * Formule: Résultat net / Capitaux propres
 * OHADA: Résultat net / Classe 10
 */
export function calculateROE(netIncome, equity) {
  if (!equity || equity === 0) return 0;
  return (netIncome / equity) * 100;
}

/**
 * Calculer le ROCE (Return on Capital Employed)
 * Formule: Résultat d'exploitation / (Capitaux propres + Dettes long terme)
 * OHADA: Résultat d'exploitation / (Classe 10 + Classe 16)
 */
export function calculateROCE(operatingResult, equity, longTermDebt) {
  const capitalEmployed = equity + longTermDebt;
  if (!capitalEmployed || capitalEmployed === 0) return 0;
  return (operatingResult / capitalEmployed) * 100;
}

/**
 * Calculer le Ratio de Liquidité Générale (Current Ratio)
 * Formule: Actifs circulants / Passifs courants
 * OHADA: (Classe 3 + 4 + 5) / Dettes à court terme
 */
export function calculateCurrentRatio(balanceSheet, regionHint = null) {
  if (!balanceSheet) return 0;

  const { currentAssets, currentLiabilities } = extractFinancialPosition(balanceSheet, regionHint);

  if (!currentLiabilities || currentLiabilities === 0) return 0;
  return currentAssets / currentLiabilities;
}

/**
 * Calculer le Ratio de Liquidité Réduite (Quick Ratio)
 * Formule: (Actifs circulants - Stocks) / Passifs courants
 * OHADA: (Classe 4 + 5) / Dettes à court terme
 */
export function calculateQuickRatio(balanceSheet, regionHint = null) {
  if (!balanceSheet) return 0;

  const { currentAssets, inventory, currentLiabilities } = extractFinancialPosition(balanceSheet, regionHint);
  const quickAssets = currentAssets - inventory;

  if (!currentLiabilities || currentLiabilities === 0) return 0;
  return quickAssets / currentLiabilities;
}

/**
 * Calculer le Ratio de Liquidité Immédiate (Cash Ratio)
 * Formule: Trésorerie / Passifs courants
 * OHADA: (Classe 52 + 57) / Dettes à court terme
 */
export function calculateCashRatio(balanceSheet, regionHint = null) {
  if (!balanceSheet) return 0;

  const { cash, currentLiabilities } = extractFinancialPosition(balanceSheet, regionHint);

  if (!currentLiabilities || currentLiabilities === 0) return 0;
  return cash / currentLiabilities;
}

/**
 * Calculer le Levier Financier (Financial Leverage)
 * Formule: Total dettes / Capitaux propres
 * OHADA: (Classe 16 + 17) / Classe 10
 */
export function calculateFinancialLeverage(totalDebt, equity) {
  if (!equity || equity === 0) return 0;
  return totalDebt / equity;
}

/**
 * Calculer le Debt Service Coverage Ratio
 * Formule: CAF / (Principal + Intérêts)
 */
export function calculateDebtServiceCoverage(caf, debtService) {
  if (!debtService || debtService === 0) return 0;
  return caf / debtService;
}

// ============================================================================
// FONCTION PRINCIPALE: DIAGNOSTIC FINANCIER COMPLET
// ============================================================================

/**
 * Construire un diagnostic financier complet
 * Agrège toutes les analyses de marges, financement et ratios
 */
export function buildFinancialDiagnostic(
  entries,
  accounts,
  balanceSheet,
  incomeStatement,
  startDate,
  endDate,
  previousPeriodData = null,
  regionHint = null
) {
  // Validation des données
  const validation = validateFinancialData(entries, accounts, balanceSheet);
  if (!validation.valid) {
    return {
      valid: false,
      errors: validation.errors,
      margins: null,
      financing: null,
      ratios: null
    };
  }

  // Extraire valeurs de base
  const revenue = sumEntriesByPredicate(
    entries,
    accounts,
    startDate,
    endDate,
    (profile) => profile.isSalesRevenue,
    regionHint
  ) || incomeStatement?.totalRevenue || 0;
  const netIncome = incomeStatement?.netIncome || 0;
  const {
    equity,
    longTermDebt,
    totalDebt,
    totalAssets,
  } = extractFinancialPosition(balanceSheet, regionHint);
  const previousFinancialPosition = getPreviousFinancialPosition(previousPeriodData, regionHint);
  const averageEquity = averageBalance(equity, previousFinancialPosition?.equity);
  const averageTotalAssets = averageBalance(totalAssets, previousFinancialPosition?.totalAssets);
  const averageCapitalEmployed = averageBalance(
    equity + longTermDebt,
    previousFinancialPosition
      ? previousFinancialPosition.equity + previousFinancialPosition.longTermDebt
      : undefined
  );

  // ========== ANALYSE DES MARGES ==========
  const grossMargin = calculateGrossMargin(entries, accounts, startDate, endDate, regionHint);
  const grossMarginPercent = calculateGrossMarginPercentage(grossMargin, revenue);

  const ebitda = calculateEBITDA(entries, accounts, startDate, endDate, regionHint);
  const ebitdaMargin = calculateEBITDAMargin(ebitda, revenue);

  const operatingResult = calculateOperatingResult(entries, accounts, startDate, endDate, regionHint);
  const operatingMargin = calculateOperatingMargin(operatingResult, revenue);

  // ========== ANALYSE DU FINANCEMENT ==========
  const caf = calculateCAF(netIncome, entries, accounts, startDate, endDate, regionHint);
  const workingCapital = calculateWorkingCapital(balanceSheet, regionHint);
  const bfr = calculateBFR(balanceSheet, regionHint);
  const bfrVariation = previousPeriodData
    ? calculateBFRVariation(bfr, previousPeriodData.financing.bfr)
    : 0;
  const operatingCashFlow = calculateOperatingCashFlow(caf, bfrVariation);
  const netDebt = calculateNetDebt(balanceSheet, regionHint);
  const capex = calculateCapexFromEntries(entries, accounts, startDate, endDate, regionHint);
  const preTaxIncome = calculatePreTaxIncome(netIncome, entries, accounts, startDate, endDate, regionHint);

  // ========== RATIOS CLÉS ==========
  const roe = calculateROE(netIncome, averageEquity);
  const roce = calculateROCE(operatingResult, averageCapitalEmployed, 0);
  const roa = averageTotalAssets !== 0 ? (netIncome / averageTotalAssets) * 100 : 0;
  const currentRatio = calculateCurrentRatio(balanceSheet, regionHint);
  const quickRatio = calculateQuickRatio(balanceSheet, regionHint);
  const cashRatio = calculateCashRatio(balanceSheet, regionHint);
  const financialLeverage = calculateFinancialLeverage(totalDebt, equity);

  return {
    valid: true,
    errors: [],
    margins: {
      revenue,
      grossMargin,
      grossMarginPercent,
      ebitda,
      ebitdaMargin,
      operatingResult,
      operatingMargin
    },
    financing: {
      caf,
      workingCapital,
      bfr,
      bfrVariation,
      operatingCashFlow,
      capex,
      netDebt,
      equity,
      totalDebt
    },
    tax: {
      preTaxIncome,
    },
    ratios: {
      profitability: {
        roe,
        roa,
        roce,
        operatingMargin,
        netMargin: revenue !== 0 ? (netIncome / revenue) * 100 : 0
      },
      liquidity: {
        currentRatio,
        quickRatio,
        cashRatio
      },
      leverage: {
        financialLeverage,
        debtToAssets: 0 // À calculer si besoin
      }
    }
  };
}
