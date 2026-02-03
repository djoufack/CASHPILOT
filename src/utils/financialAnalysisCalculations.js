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

// ============================================================================
// HELPER FUNCTIONS - EXTRACTION DE COMPTES
// ============================================================================

/**
 * Extraire les comptes d'un bilan par préfixe
 */
function extractAccountsByPrefix(balanceSheet, prefix) {
  if (!balanceSheet) return [];

  const allAccounts = [
    ...(balanceSheet.assets || []),
    ...(balanceSheet.liabilities || []),
    ...(balanceSheet.equity || [])
  ];

  return allAccounts.filter(acc =>
    acc.account_code && acc.account_code.startsWith(prefix)
  );
}

/**
 * Sommer les soldes des comptes par préfixe
 */
function sumAccountsByPrefix(balanceSheet, prefixes) {
  if (!balanceSheet) return 0;

  const allAccounts = [
    ...(balanceSheet.assets || []),
    ...(balanceSheet.liabilities || []),
    ...(balanceSheet.equity || [])
  ];

  return allAccounts
    .filter(acc => {
      if (!acc.account_code) return false;
      return prefixes.some(prefix => acc.account_code.startsWith(prefix));
    })
    .reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
}

/**
 * Extraire et sommer les écritures comptables par classe de compte
 */
function sumEntriesByAccountClass(entries, accounts, classes, startDate, endDate, debitOrCredit = 'both') {
  if (!entries || !accounts) return 0;

  const filtered = filterByPeriod(entries, startDate, endDate, 'transaction_date');

  return filtered.reduce((sum, entry) => {
    const account = accounts.find(a => a.account_code === entry.account_code);
    if (!account) return sum;

    const matchesClass = classes.some(cls => account.account_code.startsWith(cls));
    if (!matchesClass) return sum;

    if (debitOrCredit === 'debit') {
      return sum + (parseFloat(entry.debit_amount) || 0);
    } else if (debitOrCredit === 'credit') {
      return sum + (parseFloat(entry.credit_amount) || 0);
    } else {
      return sum + (parseFloat(entry.debit_amount) || 0) - (parseFloat(entry.credit_amount) || 0);
    }
  }, 0);
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
export function calculateGrossMargin(entries, accounts, startDate, endDate) {
  if (!entries || !accounts) return 0;

  // Produits des ventes (Classe 70)
  const sales = sumEntriesByAccountClass(entries, accounts, ['70'], startDate, endDate, 'credit');

  // Achats de marchandises (Classe 60)
  const purchases = sumEntriesByAccountClass(entries, accounts, ['60'], startDate, endDate, 'debit');

  return sales - purchases;
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
export function calculateEBITDA(entries, accounts, startDate, endDate) {
  if (!entries || !accounts) return 0;

  // Produits d'exploitation (Classes 70 à 76, hors 77 produits financiers)
  const operatingRevenue = sumEntriesByAccountClass(
    entries,
    accounts,
    ['70', '71', '72', '73', '74', '75', '76'],
    startDate,
    endDate,
    'credit'
  );

  // Charges d'exploitation (Classes 60 à 66, hors 68 dotations)
  const operatingExpenses = sumEntriesByAccountClass(
    entries,
    accounts,
    ['60', '61', '62', '63', '64', '65', '66'],
    startDate,
    endDate,
    'debit'
  );

  return operatingRevenue - operatingExpenses;
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
export function calculateOperatingResult(entries, accounts, startDate, endDate) {
  const ebitda = calculateEBITDA(entries, accounts, startDate, endDate);

  // Dotations aux amortissements et provisions (Classe 68)
  const depreciation = sumEntriesByAccountClass(
    entries,
    accounts,
    ['68'],
    startDate,
    endDate,
    'debit'
  );

  return ebitda - depreciation;
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
export function calculateCAF(netIncome, entries, accounts, startDate, endDate) {
  if (!entries || !accounts) return netIncome || 0;

  // Dotations aux amortissements (Classe 68)
  const depreciation = sumEntriesByAccountClass(
    entries,
    accounts,
    ['68'],
    startDate,
    endDate,
    'debit'
  );

  // Dotations aux provisions (Classe 69)
  const provisions = sumEntriesByAccountClass(
    entries,
    accounts,
    ['69'],
    startDate,
    endDate,
    'debit'
  );

  // Reprises sur provisions (Classe 79)
  const reversals = sumEntriesByAccountClass(
    entries,
    accounts,
    ['79'],
    startDate,
    endDate,
    'credit'
  );

  return (netIncome || 0) + depreciation + provisions - reversals;
}

/**
 * Calculer le Fonds de Roulement
 * Formule: Capitaux permanents - Actifs immobilisés
 * OHADA: (Classe 1) - (Classe 2)
 */
export function calculateWorkingCapital(balanceSheet) {
  if (!balanceSheet) return 0;

  // Capitaux permanents (Classe 1: capitaux propres + dettes à long terme)
  const permanentCapital = sumAccountsByPrefix(balanceSheet, ['1']);

  // Actifs immobilisés (Classe 2)
  const fixedAssets = sumAccountsByPrefix(balanceSheet, ['2']);

  return permanentCapital - fixedAssets;
}

/**
 * Calculer le BFR (Besoin en Fonds de Roulement)
 * Formule: (Actifs circulants - Trésorerie) - Dettes à court terme
 * OHADA: (Classe 3 + Classe 41) - (Classe 40 + Classe 44)
 */
export function calculateBFR(balanceSheet) {
  if (!balanceSheet) return 0;

  // Actifs circulants hors trésorerie
  // Classe 3: Stocks
  const inventory = sumAccountsByPrefix(balanceSheet, ['3']);

  // Classe 41: Clients et comptes rattachés
  const receivables = sumAccountsByPrefix(balanceSheet, ['41']);

  // Dettes à court terme
  // Classe 40: Fournisseurs et comptes rattachés
  const payables = sumAccountsByPrefix(balanceSheet, ['40']);

  // Classe 44: État et collectivités publiques (TVA, impôts)
  const taxLiabilities = sumAccountsByPrefix(balanceSheet, ['44']);

  return (inventory + receivables) - (payables + taxLiabilities);
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
export function calculateNetDebt(balanceSheet) {
  if (!balanceSheet) return 0;

  // Dettes financières
  // Classe 16: Emprunts et dettes assimilées
  // Classe 17: Dettes rattachées à des participations
  const financialDebt = sumAccountsByPrefix(balanceSheet, ['16', '17']);

  // Trésorerie
  // Classe 52: Banques
  // Classe 57: Caisse
  const cash = sumAccountsByPrefix(balanceSheet, ['52', '57']);

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
export function calculateCurrentRatio(balanceSheet) {
  if (!balanceSheet) return 0;

  // Actifs circulants
  const currentAssets = sumAccountsByPrefix(balanceSheet, ['3', '4', '5']);

  // Passifs courants (dettes à court terme)
  // Classe 40: Fournisseurs
  // Classe 44: État
  // Plus une partie des dettes CT (simplification: on prend les 40 et 44)
  const currentLiabilities = sumAccountsByPrefix(balanceSheet, ['40', '44']);

  if (!currentLiabilities || currentLiabilities === 0) return 0;
  return currentAssets / currentLiabilities;
}

/**
 * Calculer le Ratio de Liquidité Réduite (Quick Ratio)
 * Formule: (Actifs circulants - Stocks) / Passifs courants
 * OHADA: (Classe 4 + 5) / Dettes à court terme
 */
export function calculateQuickRatio(balanceSheet) {
  if (!balanceSheet) return 0;

  // Actifs circulants hors stocks
  const quickAssets = sumAccountsByPrefix(balanceSheet, ['4', '5']);

  // Passifs courants
  const currentLiabilities = sumAccountsByPrefix(balanceSheet, ['40', '44']);

  if (!currentLiabilities || currentLiabilities === 0) return 0;
  return quickAssets / currentLiabilities;
}

/**
 * Calculer le Ratio de Liquidité Immédiate (Cash Ratio)
 * Formule: Trésorerie / Passifs courants
 * OHADA: (Classe 52 + 57) / Dettes à court terme
 */
export function calculateCashRatio(balanceSheet) {
  if (!balanceSheet) return 0;

  // Trésorerie
  const cash = sumAccountsByPrefix(balanceSheet, ['52', '57']);

  // Passifs courants
  const currentLiabilities = sumAccountsByPrefix(balanceSheet, ['40', '44']);

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
  previousPeriodData = null
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
  const revenue = incomeStatement?.totalRevenue || 0;
  const netIncome = incomeStatement?.netIncome || 0;
  const equity = sumAccountsByPrefix(balanceSheet, ['10']);
  const longTermDebt = sumAccountsByPrefix(balanceSheet, ['16']);
  const totalDebt = sumAccountsByPrefix(balanceSheet, ['16', '17']);

  // ========== ANALYSE DES MARGES ==========
  const grossMargin = calculateGrossMargin(entries, accounts, startDate, endDate);
  const grossMarginPercent = calculateGrossMarginPercentage(grossMargin, revenue);

  const ebitda = calculateEBITDA(entries, accounts, startDate, endDate);
  const ebitdaMargin = calculateEBITDAMargin(ebitda, revenue);

  const operatingResult = calculateOperatingResult(entries, accounts, startDate, endDate);
  const operatingMargin = calculateOperatingMargin(operatingResult, revenue);

  // ========== ANALYSE DU FINANCEMENT ==========
  const caf = calculateCAF(netIncome, entries, accounts, startDate, endDate);
  const workingCapital = calculateWorkingCapital(balanceSheet);
  const bfr = calculateBFR(balanceSheet);
  const bfrVariation = previousPeriodData
    ? calculateBFRVariation(bfr, previousPeriodData.financing.bfr)
    : 0;
  const operatingCashFlow = calculateOperatingCashFlow(caf, bfrVariation);
  const netDebt = calculateNetDebt(balanceSheet);

  // ========== RATIOS CLÉS ==========
  const roe = calculateROE(netIncome, equity);
  const roce = calculateROCE(operatingResult, equity, longTermDebt);
  const currentRatio = calculateCurrentRatio(balanceSheet);
  const quickRatio = calculateQuickRatio(balanceSheet);
  const cashRatio = calculateCashRatio(balanceSheet);
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
      netDebt,
      equity,
      totalDebt
    },
    ratios: {
      profitability: {
        roe,
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
