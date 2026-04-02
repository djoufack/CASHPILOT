import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('@/utils/accountingCurrency', () => ({
  resolveAccountingCurrency: vi.fn(() => 'EUR'),
}));
vi.mock('@/services/documentStorage', () => ({
  uploadDocument: vi.fn().mockResolvedValue({}),
}));

import {
  exportSAFT,
  generateSAFTFilename,
  validateSAFTData,
} from '@/services/exportSAFT';

// ============================================================================
// exportSAFT
// ============================================================================
describe('exportSAFT', () => {
  it('should generate valid XML with header', () => {
    const xml = exportSAFT({}, { name: 'Test Company' }, {});
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<AuditFile');
    expect(xml).toContain('<Header>');
    expect(xml).toContain('Test Company');
    expect(xml).toContain('<SoftwareCompanyName>CashPilot</SoftwareCompanyName>');
  });

  it('should include accounts section when accounts are provided', () => {
    const data = {
      accounts: [
        { id: 'acc-1', code: '601000', name: 'Achats', balance: 5000 },
      ],
    };
    const xml = exportSAFT(data, { name: 'Test' }, {});
    expect(xml).toContain('<GeneralLedgerAccounts>');
    expect(xml).toContain('601000');
    expect(xml).toContain('Achats');
  });

  it('should include customers section when customers are provided', () => {
    const data = {
      customers: [
        { id: 'cust-1', companyName: 'Acme Corp', city: 'Paris' },
      ],
    };
    const xml = exportSAFT(data, { name: 'Test' }, {});
    expect(xml).toContain('<Customers>');
    expect(xml).toContain('Acme Corp');
    expect(xml).toContain('Paris');
  });

  it('should include suppliers section when suppliers are provided', () => {
    const data = {
      suppliers: [
        { id: 'sup-1', companyName: 'Parts Ltd', country: 'DE' },
      ],
    };
    const xml = exportSAFT(data, { name: 'Test' }, {});
    expect(xml).toContain('<Suppliers>');
    expect(xml).toContain('Parts Ltd');
  });

  it('should generate entries section with totals', () => {
    const data = {
      entries: [
        {
          id: 'entry-1',
          date: '2026-01-15',
          description: 'Sale',
          lines: [
            { id: 'line-1', debit: 1000, credit: 0, accountId: '411' },
            { id: 'line-2', debit: 0, credit: 1000, accountId: '701' },
          ],
        },
      ],
    };
    const xml = exportSAFT(data, { name: 'Test' }, {});
    expect(xml).toContain('<GeneralLedgerEntries>');
    expect(xml).toContain('<NumberOfEntries>1</NumberOfEntries>');
    expect(xml).toContain('<TotalDebit>1000.00</TotalDebit>');
    expect(xml).toContain('<TotalCredit>1000.00</TotalCredit>');
  });

  it('should handle empty data gracefully', () => {
    const xml = exportSAFT({}, {}, {});
    expect(xml).toContain('<NumberOfEntries>0</NumberOfEntries>');
    expect(xml).not.toContain('<MasterFiles>');
  });

  it('should escape XML special characters in company name', () => {
    const xml = exportSAFT({}, { name: 'Smith & Jones <Co>' }, {});
    expect(xml).toContain('Smith &amp; Jones &lt;Co&gt;');
  });

  it('should determine account type from code', () => {
    const data = {
      accounts: [
        { id: '1', code: '101', name: 'Capital' },
        { id: '2', code: '601', name: 'Achats' },
        { id: '3', code: '701', name: 'Ventes' },
      ],
    };
    const xml = exportSAFT(data, { name: 'Test' }, {});
    expect(xml).toContain('<AccountType>Equity</AccountType>');
    expect(xml).toContain('<AccountType>Expense</AccountType>');
    expect(xml).toContain('<AccountType>Income</AccountType>');
  });
});

// ============================================================================
// generateSAFTFilename
// ============================================================================
describe('generateSAFTFilename', () => {
  it('should generate a filename with company name', () => {
    const filename = generateSAFTFilename({ name: 'My Company' }, {});
    expect(filename).toContain('SAFT_My_Company');
    expect(filename.endsWith('.xml')).toBe(true);
  });

  it('should include SIRET when provided', () => {
    const filename = generateSAFTFilename(
      { name: 'Test', siret: '12345678901234' },
      {}
    );
    expect(filename).toContain('12345678901234');
  });

  it('should include date range when provided', () => {
    const filename = generateSAFTFilename(
      { name: 'Test' },
      { startDate: '2026-01-01', endDate: '2026-12-31' }
    );
    expect(filename).toContain('20260101');
    expect(filename).toContain('20261231');
  });

  it('should handle special characters in company name', () => {
    const filename = generateSAFTFilename({ name: 'Cafe & Co!' }, {});
    expect(filename).toContain('Caf');
    expect(filename).not.toContain('&');
  });

  it('should truncate long company names', () => {
    const filename = generateSAFTFilename(
      { name: 'A Very Long Company Name That Should Be Truncated' },
      {}
    );
    // Company name part should be at most 20 chars
    const companyPart = filename.split('_')[1];
    expect(companyPart.length).toBeLessThanOrEqual(20);
  });
});

// ============================================================================
// validateSAFTData
// ============================================================================
describe('validateSAFTData', () => {
  it('should validate correct data', () => {
    const data = {
      entries: [
        {
          id: 'e1',
          lines: [
            { debit: 100, credit: 0 },
            { debit: 0, credit: 100 },
          ],
        },
      ],
      accounts: [{ code: '601', name: 'Achats' }],
    };
    const result = validateSAFTData(data, { name: 'Test Company' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should report missing company name', () => {
    const result = validateSAFTData({}, {});
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Company name'))).toBe(true);
  });

  it('should report unbalanced entries', () => {
    const data = {
      entries: [
        {
          id: 'e1',
          lines: [
            { debit: 100, credit: 0 },
            { debit: 0, credit: 80 },
          ],
        },
      ],
    };
    const result = validateSAFTData(data, { name: 'Test' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Debits'))).toBe(true);
  });

  it('should report missing account codes', () => {
    const data = {
      accounts: [{ name: 'No Code Account' }],
    };
    const result = validateSAFTData(data, { name: 'Test' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Missing account code'))).toBe(true);
  });

  it('should handle empty data', () => {
    const result = validateSAFTData({}, { name: 'Test Company' });
    expect(result.valid).toBe(true);
  });

  it('should validate entries with items field', () => {
    const data = {
      entries: [
        {
          id: 'e1',
          items: [
            { debitAmount: 500, creditAmount: 0 },
            { debitAmount: 0, creditAmount: 500 },
          ],
        },
      ],
    };
    const result = validateSAFTData(data, { name: 'Test' });
    expect(result.valid).toBe(true);
  });

  it('should accept companyName as alternative to name', () => {
    const result = validateSAFTData({}, { companyName: 'Test Corp' });
    expect(result.valid).toBe(true);
  });
});
