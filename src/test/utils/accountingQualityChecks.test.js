import { describe, expect, it } from 'vitest';
import {
  evaluateAccountingDatasetQuality,
  validateChartOfAccountsImport,
} from '@/utils/accountingQualityChecks';

describe('validateChartOfAccountsImport', () => {
  it('blocks an import when account types contradict clear chart classes', () => {
    const report = validateChartOfAccountsImport([
      { account_code: '512', account_name: 'Banque', account_type: 'asset', account_category: 'cash' },
      { account_code: '701', account_name: 'Ventes', account_type: 'asset', account_category: 'ventes' },
      { account_code: '601', account_name: 'Achats', account_type: 'expense', account_category: 'achats' },
      { account_code: '101', account_name: 'Capital', account_type: 'equity', account_category: 'capital' },
    ], { regionHint: 'france' });

    expect(report.canImport).toBe(false);
    expect(report.blockingIssues.some((issue) => issue.code === 'critical_account_type_mismatch')).toBe(true);
  });

  it('warns when the chart is heuristics-driven but does not block the import', () => {
    const report = validateChartOfAccountsImport([
      { account_code: '101', account_name: 'Capital social', account_type: 'equity' },
      { account_code: '411', account_name: 'Clients', account_type: 'asset' },
      { account_code: '512', account_name: 'Banque', account_type: 'asset' },
      { account_code: '401', account_name: 'Fournisseurs', account_type: 'liability' },
      { account_code: '706', account_name: 'Prestations', account_type: 'revenue' },
      { account_code: '622', account_name: 'Honoraires', account_type: 'expense' },
    ], { regionHint: 'france' });

    expect(report.canImport).toBe(true);
    expect(report.warnings.some((issue) => issue.code === 'low_category_coverage')).toBe(true);
  });
});

describe('evaluateAccountingDatasetQuality', () => {
  it('blocks pilotage when entries reference unknown accounts or are unbalanced', () => {
    const report = evaluateAccountingDatasetQuality({
      accounts: [
        { account_code: '101', account_name: 'Capital social', account_type: 'equity', account_category: 'capital' },
        { account_code: '411', account_name: 'Clients', account_type: 'asset', account_category: 'creances_clients' },
        { account_code: '401', account_name: 'Fournisseurs', account_type: 'liability', account_category: 'dettes_fournisseurs' },
        { account_code: '512', account_name: 'Banque', account_type: 'asset', account_category: 'cash' },
        { account_code: '706', account_name: 'Prestations', account_type: 'revenue', account_category: 'ventes' },
        { account_code: '622', account_name: 'Honoraires', account_type: 'expense', account_category: 'services_exterieurs' },
      ],
      entries: [
        { entry_ref: 'SALES-001', transaction_date: '2026-01-10', account_code: '411', debit: '1000', credit: '0' },
        { entry_ref: 'SALES-001', transaction_date: '2026-01-10', account_code: '706', debit: '0', credit: '900' },
        { entry_ref: 'BROKEN-001', transaction_date: '2026-01-11', account_code: '999999', debit: '0', credit: '100' },
      ],
      regionHint: 'france',
    });

    expect(report.canRunPilotage).toBe(false);
    expect(report.blockingIssues.some((issue) => issue.code === 'entries_with_unknown_accounts')).toBe(true);
    expect(report.blockingIssues.some((issue) => issue.code === 'unbalanced_entry_groups')).toBe(true);
    expect(report.reliabilityStatus).toBe('blocked');
  });
});
