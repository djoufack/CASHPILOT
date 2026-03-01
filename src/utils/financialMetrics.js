import { filterByPeriod } from './accountingCalculations';

const CASH_PREFIXES = ['5', '52', '53', '54', '55', '56', '57', '58'];
const FIXED_ASSET_PREFIXES = ['2'];
const INVENTORY_PREFIXES = ['3'];
const CURRENT_ASSET_PREFIXES = ['3', '4', '5'];
const FINANCIAL_DEBT_PREFIXES = ['16', '17'];

const RECEIVABLE_REGEX = /(client|customer|receivable|debtor|creance)/i;
const PAYABLE_REGEX = /(fournisseur|supplier|vendor|trade payable|dettes? commerciales?)/i;
const TAX_REGEX = /(tva|tax|fiscal|imp[oô]t|etat|social|urssaf|vat)/i;
const CASH_REGEX = /(banque|bank|cash|caisse|tre?sorerie)/i;
const FIXED_ASSET_REGEX = /(immobil|fixed asset|asset held|property|plant|equipment)/i;
const INVENTORY_REGEX = /(stock|inventory|marchandise)/i;
const INCOME_TAX_REGEX = /(imp[oô]t(s)? sur (les )?(benefices|b[eé]n[eé]fices|societes|soci[eé]t[eé]s|resultat|r[eé]sultat|profit)|corporate income tax|income tax|taxe sur le r[eé]sultat|\bis\b)/i;

function getAccountCode(account) {
  return String(account?.account_code || '').trim();
}

function getAccountText(account) {
  return `${account?.account_name || ''} ${account?.account_category || ''}`.trim();
}

function startsWithAny(code, prefixes) {
  return prefixes.some((prefix) => code.startsWith(prefix));
}

function hasTextMatch(account, regex) {
  return regex.test(getAccountText(account));
}

function sumBalances(accounts) {
  return (accounts || []).reduce(
    (sum, account) => sum + (parseFloat(account?.balance) || 0),
    0
  );
}

function buildAccountMap(accounts) {
  const map = new Map();
  (accounts || []).forEach((account) => {
    map.set(account.account_code, account);
  });
  return map;
}

function isFixedAssetAccount(account) {
  const code = getAccountCode(account);
  return (
    account?.account_type === 'asset' &&
    (startsWithAny(code, FIXED_ASSET_PREFIXES) || hasTextMatch(account, FIXED_ASSET_REGEX))
  );
}

function isInventoryAccount(account) {
  const code = getAccountCode(account);
  return (
    account?.account_type === 'asset' &&
    (startsWithAny(code, INVENTORY_PREFIXES) || hasTextMatch(account, INVENTORY_REGEX))
  );
}

function isCashAccount(account) {
  const code = getAccountCode(account);
  return (
    account?.account_type === 'asset' &&
    (startsWithAny(code, CASH_PREFIXES) || hasTextMatch(account, CASH_REGEX))
  );
}

function isReceivableAccount(account) {
  const code = getAccountCode(account);
  return (
    account?.account_type === 'asset' &&
    (
      code.startsWith('41') ||
      (code.startsWith('40') && hasTextMatch(account, RECEIVABLE_REGEX)) ||
      hasTextMatch(account, RECEIVABLE_REGEX)
    )
  );
}

function isFinancialDebtAccount(account) {
  const code = getAccountCode(account);
  return (
    account?.account_type === 'liability' &&
    (
      startsWithAny(code, FINANCIAL_DEBT_PREFIXES) ||
      /(emprunt|loan|borrow|financial debt|dette financiere)/i.test(getAccountText(account))
    )
  );
}

function isTradePayableAccount(account) {
  const code = getAccountCode(account);
  return (
    account?.account_type === 'liability' &&
    (
      code.startsWith('40') ||
      (code.startsWith('44') && hasTextMatch(account, PAYABLE_REGEX)) ||
      hasTextMatch(account, PAYABLE_REGEX)
    )
  );
}

function isTaxLiabilityAccount(account) {
  const code = getAccountCode(account);
  return (
    account?.account_type === 'liability' &&
    (
      code.startsWith('45') ||
      (code.startsWith('44') && hasTextMatch(account, TAX_REGEX)) ||
      hasTextMatch(account, TAX_REGEX)
    )
  );
}

export function getAllBalanceSheetAccounts(balanceSheet) {
  if (!balanceSheet) return [];
  return [
    ...(balanceSheet.assets || []),
    ...(balanceSheet.liabilities || []),
    ...(balanceSheet.equity || []),
  ];
}

export function extractFinancialPosition(balanceSheet) {
  if (!balanceSheet) {
    return {
      assets: [],
      liabilities: [],
      equityAccounts: [],
      equity: 0,
      fixedAssets: 0,
      inventory: 0,
      cash: 0,
      receivables: 0,
      tradePayables: 0,
      taxLiabilities: 0,
      currentAssets: 0,
      currentLiabilities: 0,
      operatingCurrentAssets: 0,
      longTermDebt: 0,
      financialDebt: 0,
      permanentCapital: 0,
      totalAssets: 0,
      totalDebt: 0,
    };
  }

  const assets = balanceSheet.assets || [];
  const liabilities = balanceSheet.liabilities || [];
  const equityAccounts = balanceSheet.equity || [];

  const fixedAssets = sumBalances(assets.filter(isFixedAssetAccount));
  const inventory = sumBalances(assets.filter(isInventoryAccount));
  const cash = sumBalances(assets.filter(isCashAccount));
  const receivables = sumBalances(assets.filter(isReceivableAccount));
  const currentAssets = sumBalances(
    assets.filter((account) => {
      const code = getAccountCode(account);
      return startsWithAny(code, CURRENT_ASSET_PREFIXES) || (!isFixedAssetAccount(account) && account.account_type === 'asset');
    })
  );

  const financialDebt = sumBalances(liabilities.filter(isFinancialDebtAccount));
  const tradePayables = sumBalances(liabilities.filter(isTradePayableAccount));
  const taxLiabilities = sumBalances(liabilities.filter(isTaxLiabilityAccount));
  const currentLiabilities = sumBalances(
    liabilities.filter((account) => {
      const code = getAccountCode(account);
      return code.startsWith('4') || (!isFinancialDebtAccount(account) && (isTradePayableAccount(account) || isTaxLiabilityAccount(account)));
    })
  );

  const equity = sumBalances(equityAccounts);
  const longTermDebt = financialDebt;
  const permanentCapital = equity + longTermDebt;
  const totalAssets = parseFloat(balanceSheet.totalAssets) || sumBalances(assets);
  const totalDebt = financialDebt;
  const operatingCurrentAssets = currentAssets - cash;

  return {
    assets,
    liabilities,
    equityAccounts,
    equity,
    fixedAssets,
    inventory,
    cash,
    receivables,
    tradePayables,
    taxLiabilities,
    currentAssets,
    currentLiabilities,
    operatingCurrentAssets,
    longTermDebt,
    financialDebt,
    permanentCapital,
    totalAssets,
    totalDebt,
  };
}

export function calculateCapexFromEntries(entries, accounts, startDate, endDate) {
  if (!entries || !accounts) return 0;

  const filteredEntries = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const accountMap = buildAccountMap(accounts);

  const capex = filteredEntries.reduce((sum, entry) => {
    const account = accountMap.get(entry.account_code);
    if (!account || !isFixedAssetAccount(account)) return sum;

    const debit = parseFloat(entry.debit) || 0;
    const credit = parseFloat(entry.credit) || 0;
    return sum + (debit - credit);
  }, 0);

  return capex > 0 ? capex : 0;
}

export function calculateIncomeTaxExpense(entries, accounts, startDate, endDate) {
  if (!entries || !accounts) return 0;

  const filteredEntries = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const accountMap = buildAccountMap(accounts);

  return filteredEntries.reduce((sum, entry) => {
    const account = accountMap.get(entry.account_code);
    if (!account || account.account_type !== 'expense') return sum;

    const code = getAccountCode(account);
    if (!code.startsWith('695') && !hasTextMatch(account, INCOME_TAX_REGEX)) {
      return sum;
    }

    return sum + ((parseFloat(entry.debit) || 0) - (parseFloat(entry.credit) || 0));
  }, 0);
}

export function calculateIncomeTaxIncome(entries, accounts, startDate, endDate) {
  if (!entries || !accounts) return 0;

  const filteredEntries = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const accountMap = buildAccountMap(accounts);

  return filteredEntries.reduce((sum, entry) => {
    const account = accountMap.get(entry.account_code);
    if (!account || account.account_type !== 'revenue') return sum;

    if (!hasTextMatch(account, INCOME_TAX_REGEX)) {
      return sum;
    }

    return sum + ((parseFloat(entry.credit) || 0) - (parseFloat(entry.debit) || 0));
  }, 0);
}

export function calculatePreTaxIncome(netIncome, entries, accounts, startDate, endDate) {
  const normalizedNetIncome = Number(netIncome) || 0;
  const incomeTaxExpense = calculateIncomeTaxExpense(entries, accounts, startDate, endDate);
  const incomeTaxIncome = calculateIncomeTaxIncome(entries, accounts, startDate, endDate);

  return normalizedNetIncome + incomeTaxExpense - incomeTaxIncome;
}
