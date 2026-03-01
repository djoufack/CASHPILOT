const REGION_ALIASES = {
  fr: 'france',
  france: 'france',
  be: 'belgium',
  belgium: 'belgium',
  belgique: 'belgium',
  ohada: 'ohada',
  syscohada: 'ohada',
};

const CASH_REGEX = /(banque|bank|cash|caisse|tresorerie)/i;
const RECEIVABLE_REGEX = /(client|customer|receivable|debtor|creance|debiteur)/i;
const PAYABLE_REGEX = /(fournisseur|supplier|vendor|trade payable|dettes? commerciales?)/i;
const TAX_REGEX = /(tva|vat|tax|fiscal|impot|etat|urssaf|social)/i;
const INCOME_TAX_REGEX = /(impot(s)? sur (les )?(benefices|societes|resultat|profit)|income tax|corporate tax|is\b|imf|benefit tax)/i;
const FIXED_ASSET_REGEX = /(immobil|fixed asset|property|plant|equipment|materiel|software|logiciel)/i;
const INVENTORY_REGEX = /(stock|inventory|marchandise|matiere|en-cours)/i;
const LOAN_REGEX = /(emprunt|loan|borrow|credit-bail|credit bail|financial debt|dette financiere|dettes financieres|financement)/i;
const INTEREST_REGEX = /(interet|interest)/i;
const PAYROLL_REGEX = /(personnel|salary|salaire|wage|payroll|remuneration|charges sociales|social charge)/i;
const DEPRECIATION_REGEX = /(amort|depreci|depr[ée]ci|dotation|provision)/i;
const REVERSAL_REGEX = /(reprise|reversal)/i;
const TRANSFER_REGEX = /(transfert|transfer)/i;
const FINANCIAL_REGEX = /(financ|interest|escompte|change)/i;
const EXCEPTIONAL_REGEX = /(exceptionnel|hao|hors activites ordinaires)/i;

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getCode(account) {
  return String(account?.account_code || '').trim();
}

function getCategory(account) {
  return normalizeText(account?.account_category);
}

function getName(account) {
  return normalizeText(account?.account_name);
}

function startsWithAny(code, prefixes = []) {
  return prefixes.some((prefix) => code.startsWith(prefix));
}

function makePrefixMatcher(prefixes = []) {
  return (code) => startsWithAny(code, prefixes);
}

const REGION_RULES = {
  france: {
    salesRevenue: makePrefixMatcher(['70']),
    operatingRevenue: makePrefixMatcher(['70', '71', '72', '73', '74', '75']),
    financialRevenue: makePrefixMatcher(['76']),
    exceptionalRevenue: makePrefixMatcher(['77']),
    reversalRevenue: makePrefixMatcher(['78']),
    transferRevenue: makePrefixMatcher(['79']),
    directCostExpense: makePrefixMatcher(['60']),
    supplierExpense: makePrefixMatcher(['60', '61', '62']),
    operatingCashExpense: makePrefixMatcher(['60', '61', '62', '63', '64', '65']),
    financialExpense: makePrefixMatcher(['66']),
    exceptionalExpense: makePrefixMatcher(['67']),
    operatingNonCashExpense: makePrefixMatcher(['681']),
    nonCashExpense: makePrefixMatcher(['68']),
    incomeTaxExpense: makePrefixMatcher(['695', '696', '698']),
    interestExpense: makePrefixMatcher(['661']),
    financialDebt: makePrefixMatcher(['16', '17', '18']),
    receivable: makePrefixMatcher(['41']),
    tradePayable: makePrefixMatcher(['40']),
  },
  belgium: {
    salesRevenue: makePrefixMatcher(['70']),
    operatingRevenue: makePrefixMatcher(['70', '71', '72', '74', '75']),
    financialRevenue: makePrefixMatcher(['76']),
    exceptionalRevenue: makePrefixMatcher(['77']),
    reversalRevenue: makePrefixMatcher(['78']),
    transferRevenue: makePrefixMatcher(['79']),
    directCostExpense: makePrefixMatcher(['60']),
    supplierExpense: makePrefixMatcher(['60', '61']),
    operatingCashExpense: makePrefixMatcher(['60', '61', '62', '63', '64', '65']),
    financialExpense: makePrefixMatcher(['66']),
    exceptionalExpense: makePrefixMatcher(['67']),
    operatingNonCashExpense: makePrefixMatcher(['681']),
    nonCashExpense: makePrefixMatcher(['68']),
    incomeTaxExpense: makePrefixMatcher(['695', '696', '698']),
    interestExpense: makePrefixMatcher(['661']),
    financialDebt: (code, type, name) =>
      startsWithAny(code, ['17']) ||
      (startsWithAny(code, ['42', '43']) && LOAN_REGEX.test(name)) ||
      LOAN_REGEX.test(name),
    receivable: (code, type, name) =>
      startsWithAny(code, ['40']) || RECEIVABLE_REGEX.test(name),
    tradePayable: (code, type, name) =>
      startsWithAny(code, ['44']) || PAYABLE_REGEX.test(name),
  },
  ohada: {
    salesRevenue: makePrefixMatcher(['70']),
    operatingRevenue: makePrefixMatcher(['70', '71', '72', '73', '74', '75']),
    financialRevenue: makePrefixMatcher(['77']),
    exceptionalRevenue: makePrefixMatcher(['82', '84']),
    reversalRevenue: makePrefixMatcher(['79', '86']),
    transferRevenue: makePrefixMatcher(['78']),
    directCostExpense: makePrefixMatcher(['60']),
    supplierExpense: makePrefixMatcher(['60', '61', '62']),
    operatingCashExpense: makePrefixMatcher(['60', '61', '62', '63', '64', '65', '66']),
    financialExpense: makePrefixMatcher(['67']),
    exceptionalExpense: makePrefixMatcher(['81', '83', '85']),
    operatingNonCashExpense: (code, type, name) =>
      startsWithAny(code, ['68', '69']) && !FINANCIAL_REGEX.test(name),
    nonCashExpense: makePrefixMatcher(['68', '69']),
    incomeTaxExpense: makePrefixMatcher(['89']),
    interestExpense: (code, type, name) =>
      startsWithAny(code, ['671', '672', '674']) || INTEREST_REGEX.test(name),
    financialDebt: makePrefixMatcher(['16', '17', '18']),
    receivable: makePrefixMatcher(['41']),
    tradePayable: makePrefixMatcher(['40']),
  },
};

function getRegionRules(region) {
  return REGION_RULES[normalizeAccountingRegion(region)] || REGION_RULES.france;
}

function invokeRule(rule, code, type, name) {
  if (!rule) return false;
  return Boolean(rule(code, type, name));
}

export function normalizeAccountingRegion(regionHint) {
  return REGION_ALIASES[normalizeText(regionHint)] || null;
}

export function detectAccountingRegion(accounts = [], regionHint = null) {
  const normalizedHint = normalizeAccountingRegion(regionHint);
  if (normalizedHint) return normalizedHint;

  const scores = {
    france: 0,
    belgium: 0,
    ohada: 0,
  };

  (accounts || []).forEach((account) => {
    const code = getCode(account);
    const name = getName(account);
    const type = account?.account_type;

    if (startsWithAny(code, ['81', '82', '83', '84', '85', '86', '87', '88', '89'])) {
      scores.ohada += 3;
    }
    if (startsWithAny(code, ['521', '571']) || /hao/.test(name)) {
      scores.ohada += 2;
    }
    if (startsWithAny(code, ['550', '400', '440', '174'])) {
      scores.belgium += 3;
    }
    if (startsWithAny(code, ['512', '401', '411', '445', '695'])) {
      scores.france += 2;
    }
    if (type === 'expense' && startsWithAny(code, ['66']) && INTEREST_REGEX.test(name)) {
      scores.france += 1;
      scores.belgium += 1;
    }
  });

  const [bestRegion, bestScore] = Object.entries(scores).sort((left, right) => right[1] - left[1])[0];
  return bestScore > 0 ? bestRegion : 'france';
}

export function getAccountSemanticProfile(account, regionHint = null) {
  const code = getCode(account);
  const type = account?.account_type || '';
  const name = getName(account);
  const category = getCategory(account);
  const region = detectAccountingRegion([account], regionHint);
  const rules = getRegionRules(region);
  const fullText = `${name} ${category}`;

  const isCash = type === 'asset' && (code.startsWith('5') || CASH_REGEX.test(fullText));
  const isFixedAsset =
    type === 'asset' &&
    (code.startsWith('2') || FIXED_ASSET_REGEX.test(fullText));
  const isInventory =
    type === 'asset' &&
    (code.startsWith('3') || INVENTORY_REGEX.test(fullText));
  const isReceivable =
    type === 'asset' &&
    !isCash &&
    (invokeRule(rules.receivable, code, type, fullText) || RECEIVABLE_REGEX.test(fullText));

  const isFinancialDebt =
    type === 'liability' &&
    (invokeRule(rules.financialDebt, code, type, fullText) || LOAN_REGEX.test(fullText));
  const isCurrentFinancialDebt =
    isFinancialDebt &&
    (startsWithAny(code, ['42', '43']) || /court terme|a moins d'un an|short term/.test(fullText));
  const isLongTermFinancialDebt = isFinancialDebt && !isCurrentFinancialDebt;

  const isTradePayable =
    type === 'liability' &&
    !isFinancialDebt &&
    (invokeRule(rules.tradePayable, code, type, fullText) || PAYABLE_REGEX.test(fullText));

  const isTaxLiability =
    type === 'liability' &&
    !isFinancialDebt &&
    TAX_REGEX.test(fullText);

  const isIncomeTaxExpense =
    type === 'expense' &&
    (invokeRule(rules.incomeTaxExpense, code, type, fullText) || INCOME_TAX_REGEX.test(fullText));
  const isIncomeTaxIncome =
    type === 'revenue' &&
    INCOME_TAX_REGEX.test(fullText);

  const isFinancialRevenue =
    type === 'revenue' &&
    (invokeRule(rules.financialRevenue, code, type, fullText) ||
      category === 'produits_financiers' ||
      FINANCIAL_REGEX.test(fullText));
  const isExceptionalRevenue =
    type === 'revenue' &&
    (invokeRule(rules.exceptionalRevenue, code, type, fullText) ||
      category === 'hao' ||
      EXCEPTIONAL_REGEX.test(fullText));
  const isReversalRevenue =
    type === 'revenue' &&
    (invokeRule(rules.reversalRevenue, code, type, fullText) ||
      category === 'reprises' ||
      REVERSAL_REGEX.test(fullText));
  const isTransferRevenue =
    type === 'revenue' &&
    (invokeRule(rules.transferRevenue, code, type, fullText) ||
      category === 'transferts' ||
      TRANSFER_REGEX.test(fullText));
  const isSalesRevenue =
    type === 'revenue' &&
    (invokeRule(rules.salesRevenue, code, type, fullText) || category === 'ventes' || category === 'produits') &&
    !isFinancialRevenue &&
    !isExceptionalRevenue &&
    !isReversalRevenue &&
    !isTransferRevenue &&
    !isIncomeTaxIncome;
  const isOperatingRevenue =
    type === 'revenue' &&
    (invokeRule(rules.operatingRevenue, code, type, fullText) ||
      ['ventes', 'subventions', 'production', 'variation_stocks', 'autres_produits', 'subventions_equilibre', 'produits'].includes(category)) &&
    !isFinancialRevenue &&
    !isExceptionalRevenue &&
    !isReversalRevenue &&
    !isTransferRevenue &&
    !isIncomeTaxIncome;

  const isFinancialExpense =
    type === 'expense' &&
    (invokeRule(rules.financialExpense, code, type, fullText) ||
      category === 'charges_financieres' ||
      (FINANCIAL_REGEX.test(fullText) && !isIncomeTaxExpense));
  const isExceptionalExpense =
    type === 'expense' &&
    (invokeRule(rules.exceptionalExpense, code, type, fullText) ||
      category === 'hao' ||
      category === 'charges_exceptionnelles' ||
      EXCEPTIONAL_REGEX.test(fullText));
  const isNonCashExpense =
    type === 'expense' &&
    !isIncomeTaxExpense &&
    (invokeRule(rules.nonCashExpense, code, type, fullText) ||
      category === 'dotations' ||
      DEPRECIATION_REGEX.test(fullText));
  const isOperatingNonCashExpense =
    type === 'expense' &&
    !isIncomeTaxExpense &&
    !isFinancialExpense &&
    !isExceptionalExpense &&
    (invokeRule(rules.operatingNonCashExpense, code, type, fullText) ||
      category === 'dotations' ||
      DEPRECIATION_REGEX.test(fullText));
  const isInterestExpense =
    type === 'expense' &&
    !isIncomeTaxExpense &&
    (invokeRule(rules.interestExpense, code, type, fullText) || INTEREST_REGEX.test(fullText));
  const isDirectCostExpense =
    type === 'expense' &&
    !isIncomeTaxExpense &&
    !isFinancialExpense &&
    !isExceptionalExpense &&
    !isNonCashExpense &&
    invokeRule(rules.directCostExpense, code, type, fullText);
  const isSupplierExpense =
    type === 'expense' &&
    !isIncomeTaxExpense &&
    !isFinancialExpense &&
    !isExceptionalExpense &&
    !isNonCashExpense &&
    (invokeRule(rules.supplierExpense, code, type, fullText) ||
      category === 'achats' ||
      category === 'services_exterieurs');
  const isOperatingCashExpense =
    type === 'expense' &&
    !isIncomeTaxExpense &&
    !isFinancialExpense &&
    !isExceptionalExpense &&
    !isNonCashExpense &&
    (invokeRule(rules.operatingCashExpense, code, type, fullText) ||
      category === 'achats' ||
      category === 'services_exterieurs' ||
      category === 'charges_personnel' ||
      category === 'impots_taxes' ||
      category === 'autres_charges' ||
      PAYROLL_REGEX.test(fullText));

  const isCurrentAsset = type === 'asset' && !isFixedAsset;
  const isCurrentLiability =
    type === 'liability' &&
    (isTradePayable || isTaxLiability || isCurrentFinancialDebt || code.startsWith('4'));

  return {
    region,
    code,
    type,
    isCash,
    isFixedAsset,
    isInventory,
    isReceivable,
    isTradePayable,
    isTaxLiability,
    isCurrentAsset,
    isCurrentLiability,
    isFinancialDebt,
    isCurrentFinancialDebt,
    isLongTermFinancialDebt,
    isSalesRevenue,
    isOperatingRevenue,
    isFinancialRevenue,
    isExceptionalRevenue,
    isReversalRevenue,
    isTransferRevenue,
    isIncomeTaxExpense,
    isIncomeTaxIncome,
    isOperatingCashExpense,
    isSupplierExpense,
    isDirectCostExpense,
    isFinancialExpense,
    isExceptionalExpense,
    isNonCashExpense,
    isOperatingNonCashExpense,
    isInterestExpense,
  };
}

export function buildAccountSemanticIndex(accounts = [], regionHint = null) {
  const region = detectAccountingRegion(accounts, regionHint);
  const map = new Map();

  (accounts || []).forEach((account) => {
    map.set(account.account_code, {
      account,
      profile: getAccountSemanticProfile(account, region),
    });
  });

  return { region, map };
}

export function getNaturalEntryAmount(entry, accountType) {
  const debit = parseFloat(entry?.debit) || 0;
  const credit = parseFloat(entry?.credit) || 0;

  if (['asset', 'expense'].includes(accountType)) {
    return debit - credit;
  }

  return credit - debit;
}
