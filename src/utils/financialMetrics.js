import { filterByPeriod } from './accountingCalculations.js';
import {
  buildAccountSemanticIndex,
  getNaturalEntryAmount,
} from './accountTaxonomy.js';

const OPENING_ENTRY_REGEX = /^(open|opening|ouverture|solde[-_\s]?initial)/i;

function sumBalances(accounts) {
  return (accounts || []).reduce(
    (sum, account) => sum + (parseFloat(account?.balance) || 0),
    0
  );
}

function groupEntriesByReference(entries) {
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

export function getAllBalanceSheetAccounts(balanceSheet) {
  if (!balanceSheet) return [];
  return [
    ...(balanceSheet.assets || []),
    ...(balanceSheet.liabilities || []),
    ...(balanceSheet.equity || []),
  ];
}

export function extractFinancialPosition(balanceSheet, regionHint = null) {
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
  const semanticIndex = buildAccountSemanticIndex(
    [...assets, ...liabilities, ...equityAccounts],
    regionHint
  );

  const fixedAssets = sumBalances(assets.filter((account) => semanticIndex.map.get(account.account_code)?.profile?.isFixedAsset));
  const inventory = sumBalances(assets.filter((account) => semanticIndex.map.get(account.account_code)?.profile?.isInventory));
  const cash = sumBalances(assets.filter((account) => semanticIndex.map.get(account.account_code)?.profile?.isCash));
  const receivables = sumBalances(assets.filter((account) => semanticIndex.map.get(account.account_code)?.profile?.isReceivable));
  const currentAssets = sumBalances(assets.filter((account) => semanticIndex.map.get(account.account_code)?.profile?.isCurrentAsset));

  const financialDebt = sumBalances(liabilities.filter((account) => semanticIndex.map.get(account.account_code)?.profile?.isFinancialDebt));
  const tradePayables = sumBalances(liabilities.filter((account) => semanticIndex.map.get(account.account_code)?.profile?.isTradePayable));
  const taxLiabilities = sumBalances(liabilities.filter((account) => semanticIndex.map.get(account.account_code)?.profile?.isTaxLiability));
  const currentLiabilities = sumBalances(liabilities.filter((account) => semanticIndex.map.get(account.account_code)?.profile?.isCurrentLiability));

  const equity = sumBalances(equityAccounts);
  const longTermDebt = sumBalances(liabilities.filter((account) => semanticIndex.map.get(account.account_code)?.profile?.isLongTermFinancialDebt)) || financialDebt;
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

export function calculateCapexFromEntries(entries, accounts, startDate, endDate, regionHint = null) {
  if (!entries || !accounts) return 0;

  const filteredEntries = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const semanticIndex = buildAccountSemanticIndex(accounts, regionHint);
  const capex = groupEntriesByReference(filteredEntries).reduce((sum, group) => {
    if (isOpeningBalanceGroup(group)) return sum;

    let fixedAssetDebit = 0;
    let fixedAssetCredit = 0;
    let hasExternalCounterpart = false;

    group.lines.forEach((entry) => {
      const classified = semanticIndex.map.get(entry.account_code);
      if (classified?.profile?.isFixedAsset) {
        fixedAssetDebit += parseFloat(entry.debit) || 0;
        fixedAssetCredit += parseFloat(entry.credit) || 0;
      } else if ((parseFloat(entry.debit) || 0) !== 0 || (parseFloat(entry.credit) || 0) !== 0) {
        hasExternalCounterpart = true;
      }
    });

    if (!hasExternalCounterpart) return sum;

    return sum + Math.max(0, fixedAssetDebit - fixedAssetCredit);
  }, 0);

  return capex > 0 ? capex : 0;
}

export function calculateIncomeTaxExpense(entries, accounts, startDate, endDate, regionHint = null) {
  if (!entries || !accounts) return 0;

  const filteredEntries = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const semanticIndex = buildAccountSemanticIndex(accounts, regionHint);

  return filteredEntries.reduce((sum, entry) => {
    const classified = semanticIndex.map.get(entry.account_code);
    if (!classified?.profile?.isIncomeTaxExpense) return sum;
    return sum + getNaturalEntryAmount(entry, classified.account.account_type);
  }, 0);
}

export function calculateIncomeTaxIncome(entries, accounts, startDate, endDate, regionHint = null) {
  if (!entries || !accounts) return 0;

  const filteredEntries = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const semanticIndex = buildAccountSemanticIndex(accounts, regionHint);

  return filteredEntries.reduce((sum, entry) => {
    const classified = semanticIndex.map.get(entry.account_code);
    if (!classified?.profile?.isIncomeTaxIncome) return sum;
    return sum + getNaturalEntryAmount(entry, classified.account.account_type);
  }, 0);
}

export function calculatePreTaxIncome(netIncome, entries, accounts, startDate, endDate, regionHint = null) {
  const normalizedNetIncome = Number(netIncome) || 0;
  const incomeTaxExpense = calculateIncomeTaxExpense(entries, accounts, startDate, endDate, regionHint);
  const incomeTaxIncome = calculateIncomeTaxIncome(entries, accounts, startDate, endDate, regionHint);

  return normalizedNetIncome + incomeTaxExpense - incomeTaxIncome;
}
