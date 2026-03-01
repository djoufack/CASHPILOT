import {
  buildAccountSemanticIndex,
  detectAccountingRegion,
} from './accountTaxonomy.js';

const VALID_ACCOUNT_TYPES = new Set(['asset', 'liability', 'equity', 'revenue', 'expense']);
const CRITICAL_SEVERITY = 'critical';
const WARNING_SEVERITY = 'warning';

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAccountRow(account = {}) {
  return {
    ...account,
    account_code: String(account.account_code || '').trim(),
    account_name: String(account.account_name || '').trim(),
    account_type: String(account.account_type || '').trim().toLowerCase(),
    account_category: account.account_category == null
      ? ''
      : String(account.account_category).trim(),
  };
}

function addIssue(issues, severity, code, message, meta = {}) {
  issues.push({
    severity,
    code,
    message,
    ...meta,
  });
}

function getExpectedAccountTypes(accountCode, region = 'france') {
  const code = String(accountCode || '').trim();
  if (!code) return [];

  const firstDigit = code[0];

  if (firstDigit === '1') {
    return ['liability', 'equity'];
  }
  if (firstDigit === '2' || firstDigit === '3' || firstDigit === '5') {
    return ['asset'];
  }
  if (firstDigit === '4') {
    return ['asset', 'liability'];
  }
  if (firstDigit === '6') {
    return ['expense'];
  }
  if (firstDigit === '7') {
    return ['revenue'];
  }
  if (region === 'ohada' && (firstDigit === '8' || firstDigit === '9')) {
    return ['expense', 'revenue'];
  }

  return [];
}

function mergeAccounts(existingAccounts = [], importedAccounts = []) {
  const merged = new Map();

  existingAccounts.forEach((account) => {
    const normalized = normalizeAccountRow(account);
    if (normalized.account_code) {
      merged.set(normalized.account_code, normalized);
    }
  });

  importedAccounts.forEach((account) => {
    const normalized = normalizeAccountRow(account);
    if (normalized.account_code) {
      merged.set(normalized.account_code, normalized);
    }
  });

  return Array.from(merged.values());
}

function analyzeAccountRows(accounts = [], regionHint = null) {
  const normalizedAccounts = accounts.map(normalizeAccountRow);
  const region = detectAccountingRegion(normalizedAccounts, regionHint);
  const issues = [];
  const duplicates = new Map();
  const invalidTypes = [];
  const missingFields = [];
  const typeMismatchCritical = [];
  const typeMismatchWarning = [];
  let categorizedCount = 0;

  normalizedAccounts.forEach((account) => {
    if (!account.account_code || !account.account_name || !account.account_type) {
      missingFields.push(account.account_code || '(sans code)');
    }

    if (!VALID_ACCOUNT_TYPES.has(account.account_type)) {
      invalidTypes.push({
        account_code: account.account_code || '(sans code)',
        account_type: account.account_type || '(vide)',
      });
    }

    if (account.account_category) {
      categorizedCount += 1;
    }

    const duplicateCount = duplicates.get(account.account_code) || 0;
    duplicates.set(account.account_code, duplicateCount + 1);

    const expectedTypes = getExpectedAccountTypes(account.account_code, region);
    if (expectedTypes.length > 0 && !expectedTypes.includes(account.account_type)) {
      const mismatch = `${account.account_code} (${account.account_type})`;
      const firstDigit = String(account.account_code || '').trim()[0];
      if (['2', '3', '5', '6', '7'].includes(firstDigit)) {
        typeMismatchCritical.push(mismatch);
      } else {
        typeMismatchWarning.push(mismatch);
      }
    }
  });

  const duplicateCodes = Array.from(duplicates.entries())
    .filter(([, count]) => count > 1)
    .map(([code]) => code);

  if (missingFields.length > 0) {
    addIssue(
      issues,
      CRITICAL_SEVERITY,
      'missing_account_fields',
      `Des comptes importés sont incomplets (${missingFields.slice(0, 5).join(', ')}${missingFields.length > 5 ? ', ...' : ''}).`,
      { count: missingFields.length }
    );
  }

  if (invalidTypes.length > 0) {
    addIssue(
      issues,
      CRITICAL_SEVERITY,
      'invalid_account_types',
      `Des comptes utilisent un type comptable invalide (${invalidTypes.slice(0, 5).map((entry) => `${entry.account_code}: ${entry.account_type}`).join(', ')}${invalidTypes.length > 5 ? ', ...' : ''}).`,
      { count: invalidTypes.length }
    );
  }

  if (duplicateCodes.length > 0) {
    addIssue(
      issues,
      CRITICAL_SEVERITY,
      'duplicate_account_codes',
      `Le fichier contient des codes de comptes dupliqués (${duplicateCodes.slice(0, 5).join(', ')}${duplicateCodes.length > 5 ? ', ...' : ''}).`,
      { count: duplicateCodes.length }
    );
  }

  if (typeMismatchCritical.length > 0) {
    addIssue(
      issues,
      CRITICAL_SEVERITY,
      'critical_account_type_mismatch',
      `Des comptes sont classés avec un type incohérent au regard de leur classe (${typeMismatchCritical.slice(0, 6).join(', ')}${typeMismatchCritical.length > 6 ? ', ...' : ''}).`,
      { count: typeMismatchCritical.length }
    );
  }

  if (typeMismatchWarning.length > 0) {
    addIssue(
      issues,
      WARNING_SEVERITY,
      'account_type_mismatch',
      `Certains comptes de classes mixtes méritent une vérification de type (${typeMismatchWarning.slice(0, 6).join(', ')}${typeMismatchWarning.length > 6 ? ', ...' : ''}).`,
      { count: typeMismatchWarning.length }
    );
  }

  const semanticIndex = buildAccountSemanticIndex(normalizedAccounts, region);
  const semanticProfiles = Array.from(semanticIndex.map.values()).map((entry) => entry.profile);
  const summary = {
    region,
    accountCount: normalizedAccounts.length,
    categorizedCount,
    categoryCoverage: normalizedAccounts.length > 0 ? categorizedCount / normalizedAccounts.length : 0,
    cashCount: semanticProfiles.filter((profile) => profile.isCash).length,
    salesRevenueCount: semanticProfiles.filter((profile) => profile.isSalesRevenue).length,
    operatingExpenseCount: semanticProfiles.filter((profile) => profile.isOperatingCashExpense || profile.isNonCashExpense).length,
    receivableCount: semanticProfiles.filter((profile) => profile.isReceivable).length,
    tradePayableCount: semanticProfiles.filter((profile) => profile.isTradePayable).length,
    equityCount: normalizedAccounts.filter((account) => account.account_type === 'equity').length,
    financialDebtCount: semanticProfiles.filter((profile) => profile.isFinancialDebt).length,
  };

  return {
    region,
    accounts: normalizedAccounts,
    semanticIndex,
    summary,
    issues,
  };
}

function evaluateChartCoverage(summary, issues, isFreshChart = false) {
  if (!summary.accountCount) {
    addIssue(issues, CRITICAL_SEVERITY, 'missing_chart', 'Aucun compte comptable n’est disponible.');
    return;
  }

  if (isFreshChart) {
    if (summary.cashCount === 0) {
      addIssue(issues, CRITICAL_SEVERITY, 'missing_cash_accounts', 'Le plan importé ne contient aucun compte de trésorerie exploitable.');
    }
    if (summary.salesRevenueCount === 0) {
      addIssue(issues, CRITICAL_SEVERITY, 'missing_revenue_accounts', 'Le plan importé ne contient aucun compte de chiffre d’affaires exploitable.');
    }
    if (summary.operatingExpenseCount === 0) {
      addIssue(issues, CRITICAL_SEVERITY, 'missing_expense_accounts', 'Le plan importé ne contient aucune charge d’exploitation exploitable.');
    }
    if (summary.equityCount === 0) {
      addIssue(issues, CRITICAL_SEVERITY, 'missing_equity_accounts', 'Le plan importé ne contient aucun compte de capitaux propres.');
    }
  }

  if (summary.receivableCount === 0) {
    addIssue(issues, WARNING_SEVERITY, 'missing_receivable_accounts', 'Aucun compte client exploitable n’a été détecté. Les ratios DSO peuvent devenir indisponibles.');
  }

  if (summary.tradePayableCount === 0) {
    addIssue(issues, WARNING_SEVERITY, 'missing_payable_accounts', 'Aucun compte fournisseur exploitable n’a été détecté. Les ratios DPO peuvent devenir indisponibles.');
  }

  if (summary.categoryCoverage < 0.15) {
    addIssue(issues, WARNING_SEVERITY, 'low_category_coverage', 'Le plan comptable contient très peu de catégories renseignées. Le moteur utilisera davantage les heuristiques de code/libellé.');
  }
}

function buildEntryGroupKey(entry) {
  return entry.entry_ref
    || [entry.transaction_date, entry.source_type, entry.source_id, entry.journal]
      .filter(Boolean)
      .join('|')
    || null;
}

function analyzeEntries(entries = [], accounts = [], regionHint = null) {
  const issues = [];
  const accountCodes = new Set(accounts.map((account) => String(account.account_code || '').trim()));
  const unknownCodes = new Set();
  const groupedEntries = new Map();
  let entriesWithoutReference = 0;

  entries.forEach((entry) => {
    const accountCode = String(entry.account_code || '').trim();
    if (!accountCodes.has(accountCode)) {
      unknownCodes.add(accountCode || '(vide)');
    }

    const groupKey = buildEntryGroupKey(entry);
    if (!groupKey) {
      entriesWithoutReference += 1;
      return;
    }

    const bucket = groupedEntries.get(groupKey) || [];
    bucket.push(entry);
    groupedEntries.set(groupKey, bucket);
  });

  if (unknownCodes.size > 0) {
    addIssue(
      issues,
      CRITICAL_SEVERITY,
      'entries_with_unknown_accounts',
      `Des écritures référencent des comptes absents du plan (${Array.from(unknownCodes).slice(0, 6).join(', ')}${unknownCodes.size > 6 ? ', ...' : ''}).`,
      { count: unknownCodes.size }
    );
  }

  const unbalancedGroups = [];
  groupedEntries.forEach((group, key) => {
    const totalDebit = group.reduce((sum, entry) => sum + toNumber(entry.debit), 0);
    const totalCredit = group.reduce((sum, entry) => sum + toNumber(entry.credit), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      unbalancedGroups.push({
        key,
        difference: totalDebit - totalCredit,
      });
    }
  });

  if (unbalancedGroups.length > 0) {
    addIssue(
      issues,
      CRITICAL_SEVERITY,
      'unbalanced_entry_groups',
      `Des écritures ne respectent pas la partie double (${unbalancedGroups.slice(0, 5).map((group) => `${group.key} (${group.difference.toFixed(2)})`).join(', ')}${unbalancedGroups.length > 5 ? ', ...' : ''}).`,
      { count: unbalancedGroups.length }
    );
  }

  if (entries.length > 0 && entriesWithoutReference / entries.length > 0.2) {
    addIssue(
      issues,
      WARNING_SEVERITY,
      'low_entry_reference_coverage',
      'Une part importante des écritures n’a ni référence ni groupe identifiable. Les contrôles d’intégrité par journal sont partiels.',
      { count: entriesWithoutReference }
    );
  }

  const region = detectAccountingRegion(accounts, regionHint);
  const semanticIndex = buildAccountSemanticIndex(accounts, region);
  const pilotageCriticalEntries = entries.filter((entry) => {
    const classified = semanticIndex.map.get(entry.account_code);
    return Boolean(
      classified?.profile?.isSalesRevenue
      || classified?.profile?.isOperatingCashExpense
      || classified?.profile?.isCash
      || classified?.profile?.isTradePayable
      || classified?.profile?.isReceivable
    );
  });

  if (entries.length > 0 && pilotageCriticalEntries.length === 0) {
    addIssue(
      issues,
      WARNING_SEVERITY,
      'no_pilotage_critical_entries',
      'Les écritures de la période n’alimentent aucun compte critique pour le pilotage (trésorerie, ventes, charges, clients, fournisseurs).'
    );
  }

  return {
    issues,
    summary: {
      entryCount: entries.length,
      entriesWithoutReference,
      unknownAccountCount: unknownCodes.size,
      unbalancedGroupCount: unbalancedGroups.length,
    },
  };
}

function finalizeReport(region, issues, extras = {}) {
  const blockingIssues = issues.filter((issue) => issue.severity === CRITICAL_SEVERITY);
  const warnings = issues.filter((issue) => issue.severity === WARNING_SEVERITY);
  const reliabilityStatus = blockingIssues.length > 0
    ? 'blocked'
    : warnings.length > 0
      ? 'warning'
      : 'ready';

  return {
    region,
    issues,
    blockingIssues,
    warnings,
    canImport: blockingIssues.length === 0,
    canRunPilotage: blockingIssues.length === 0,
    reliabilityStatus,
    summary: {
      blockingCount: blockingIssues.length,
      warningCount: warnings.length,
    },
    ...extras,
  };
}

export function validateChartOfAccountsImport(importedAccounts = [], { existingAccounts = [], regionHint = null } = {}) {
  const imported = importedAccounts.map(normalizeAccountRow);
  const existing = existingAccounts.map(normalizeAccountRow);
  const importedAnalysis = analyzeAccountRows(imported, regionHint);
  const issues = [...importedAnalysis.issues];
  const isFreshChart = existing.length === 0;
  const combinedAccounts = mergeAccounts(existing, imported);
  const combinedAnalysis = analyzeAccountRows(combinedAccounts, importedAnalysis.region);

  if (existing.length > 0) {
    const existingRegion = detectAccountingRegion(existing, regionHint);
    if (importedAnalysis.summary.accountCount >= 10 && existingRegion && importedAnalysis.region && existingRegion !== importedAnalysis.region) {
      addIssue(
        issues,
        CRITICAL_SEVERITY,
        'mixed_accounting_regions',
        `Le fichier ressemble à un plan ${importedAnalysis.region} alors que le dossier courant est ${existingRegion}.`,
        { existingRegion, importedRegion: importedAnalysis.region }
      );
    }
  }

  evaluateChartCoverage(combinedAnalysis.summary, issues, isFreshChart);

  return finalizeReport(combinedAnalysis.region, issues, {
    importSummary: importedAnalysis.summary,
    combinedSummary: combinedAnalysis.summary,
  });
}

export function evaluateAccountingDatasetQuality({ accounts = [], entries = [], regionHint = null } = {}) {
  const chartAnalysis = analyzeAccountRows(accounts, regionHint);
  const issues = [...chartAnalysis.issues];
  evaluateChartCoverage(chartAnalysis.summary, issues, true);

  const entriesAnalysis = analyzeEntries(entries, chartAnalysis.accounts, chartAnalysis.region);
  issues.push(...entriesAnalysis.issues);

  return finalizeReport(chartAnalysis.region, issues, {
    chartSummary: chartAnalysis.summary,
    entriesSummary: entriesAnalysis.summary,
  });
}
