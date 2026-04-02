import { describe, it, expect } from 'vitest';
import {
  normalizeAccountingRegion,
  detectAccountingRegion,
  getAccountSemanticProfile,
  buildAccountSemanticIndex,
  getNaturalEntryAmount,
} from '@/utils/accountTaxonomy';

describe('normalizeAccountingRegion', () => {
  it('normalizes fr → france', () => {
    expect(normalizeAccountingRegion('fr')).toBe('france');
    expect(normalizeAccountingRegion('FR')).toBe('france');
    expect(normalizeAccountingRegion('France')).toBe('france');
  });

  it('normalizes be → belgium', () => {
    expect(normalizeAccountingRegion('be')).toBe('belgium');
    expect(normalizeAccountingRegion('belgium')).toBe('belgium');
    expect(normalizeAccountingRegion('Belgique')).toBe('belgium');
  });

  it('normalizes ohada/syscohada', () => {
    expect(normalizeAccountingRegion('ohada')).toBe('ohada');
    expect(normalizeAccountingRegion('SYSCOHADA')).toBe('ohada');
  });

  it('returns null for unknown region', () => {
    expect(normalizeAccountingRegion('us')).toBe(null);
    expect(normalizeAccountingRegion(null)).toBe(null);
    expect(normalizeAccountingRegion('')).toBe(null);
  });
});

describe('detectAccountingRegion', () => {
  it('returns region from hint if valid', () => {
    expect(detectAccountingRegion([], 'fr')).toBe('france');
    expect(detectAccountingRegion([], 'be')).toBe('belgium');
    expect(detectAccountingRegion([], 'ohada')).toBe('ohada');
  });

  it('defaults to france with no accounts and no hint', () => {
    expect(detectAccountingRegion([])).toBe('france');
    expect(detectAccountingRegion(null)).toBe('france');
  });

  it('detects OHADA from class 8 accounts', () => {
    const accounts = [
      { account_code: '812', account_name: 'Charges HAO' },
      { account_code: '841', account_name: 'Produits HAO' },
      { account_code: '521', account_name: 'Banques locales' },
    ];
    expect(detectAccountingRegion(accounts)).toBe('ohada');
  });

  it('detects Belgium from typical PCMN accounts', () => {
    const accounts = [
      { account_code: '550', account_name: 'Banque compte courant' },
      { account_code: '400', account_name: 'Fournisseurs' },
      { account_code: '440', account_name: 'Clients' },
      { account_code: '174', account_name: 'Pret a terme' },
    ];
    expect(detectAccountingRegion(accounts)).toBe('belgium');
  });

  it('detects France from typical PCG accounts', () => {
    const accounts = [
      { account_code: '512', account_name: 'Banque' },
      { account_code: '411', account_name: 'Clients' },
      { account_code: '401', account_name: 'Fournisseurs' },
      { account_code: '445', account_name: 'TVA' },
      { account_code: '695', account_name: 'Impots sur les benefices' },
    ];
    expect(detectAccountingRegion(accounts)).toBe('france');
  });
});

describe('getAccountSemanticProfile', () => {
  it('classifies cash account', () => {
    const profile = getAccountSemanticProfile(
      { account_code: '512', account_type: 'asset', account_name: 'Banque' },
      'france'
    );
    expect(profile.isCash).toBe(true);
    expect(profile.isCurrentAsset).toBe(true);
  });

  it('classifies fixed asset', () => {
    const profile = getAccountSemanticProfile(
      { account_code: '2183', account_type: 'asset', account_name: 'Materiel informatique' },
      'france'
    );
    expect(profile.isFixedAsset).toBe(true);
  });

  it('classifies inventory', () => {
    const profile = getAccountSemanticProfile(
      { account_code: '31', account_type: 'asset', account_name: 'Stock de marchandises' },
      'france'
    );
    expect(profile.isInventory).toBe(true);
  });

  it('classifies receivable', () => {
    const profile = getAccountSemanticProfile(
      { account_code: '411', account_type: 'asset', account_name: 'Clients' },
      'france'
    );
    expect(profile.isReceivable).toBe(true);
  });

  it('classifies financial debt', () => {
    const profile = getAccountSemanticProfile(
      { account_code: '164', account_type: 'liability', account_name: 'Emprunts bancaires' },
      'france'
    );
    expect(profile.isFinancialDebt).toBe(true);
    expect(profile.isLongTermFinancialDebt).toBe(true);
  });

  it('classifies trade payable', () => {
    const profile = getAccountSemanticProfile(
      { account_code: '401', account_type: 'liability', account_name: 'Fournisseurs' },
      'france'
    );
    expect(profile.isTradePayable).toBe(true);
  });

  it('classifies tax liability', () => {
    const profile = getAccountSemanticProfile(
      { account_code: '44571', account_type: 'liability', account_name: 'TVA collectee' },
      'france'
    );
    expect(profile.isTaxLiability).toBe(true);
  });

  it('classifies income tax expense', () => {
    const profile = getAccountSemanticProfile(
      { account_code: '695', account_type: 'expense', account_name: 'Impots sur les benefices' },
      'france'
    );
    expect(profile.isIncomeTaxExpense).toBe(true);
  });

  it('classifies revenue accounts', () => {
    const profile = getAccountSemanticProfile(
      { account_code: '706', account_type: 'revenue', account_name: 'Prestations de services' },
      'france'
    );
    expect(profile.isSalesRevenue).toBe(true);
    expect(profile.isOperatingRevenue).toBe(true);
  });
});

describe('buildAccountSemanticIndex', () => {
  it('builds index from list of accounts', () => {
    const accounts = [
      { account_code: '512', account_type: 'asset', account_name: 'Banque' },
      { account_code: '411', account_type: 'asset', account_name: 'Clients' },
    ];
    const index = buildAccountSemanticIndex(accounts, 'france');
    expect(index.map.size).toBe(2);
    expect(index.map.get('512').profile.isCash).toBe(true);
    expect(index.map.get('411').profile.isReceivable).toBe(true);
  });

  it('returns empty map for null input', () => {
    const index = buildAccountSemanticIndex(null);
    expect(index.map.size).toBe(0);
  });

  it('returns detected region', () => {
    const accounts = [
      { account_code: '512', account_type: 'asset', account_name: 'Banque' },
    ];
    const index = buildAccountSemanticIndex(accounts, 'france');
    expect(index.region).toBe('france');
  });
});

describe('getNaturalEntryAmount', () => {
  it('returns debit - credit for expense accounts (natural debit)', () => {
    const amount = getNaturalEntryAmount({ debit: 1000, credit: 0 }, 'expense');
    expect(amount).toBe(1000);
  });

  it('returns credit - debit for revenue accounts (natural credit)', () => {
    const amount = getNaturalEntryAmount({ debit: 0, credit: 5000 }, 'revenue');
    expect(amount).toBe(5000);
  });

  it('returns debit - credit for asset accounts', () => {
    const amount = getNaturalEntryAmount({ debit: 3000, credit: 500 }, 'asset');
    expect(amount).toBe(2500);
  });

  it('returns credit - debit for liability accounts', () => {
    const amount = getNaturalEntryAmount({ debit: 200, credit: 1000 }, 'liability');
    expect(amount).toBe(800);
  });

  it('handles missing debit/credit', () => {
    expect(getNaturalEntryAmount({}, 'expense')).toBe(0);
    expect(getNaturalEntryAmount({ debit: 100 }, 'expense')).toBe(100);
  });
});
