import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('@/utils/dateLocale', () => ({
  getLocale: vi.fn(() => 'fr-FR'),
}));

vi.mock('@/utils/dateFormatting', () => ({
  formatDateInput: vi.fn(() => '2026-04-02'),
}));

vi.mock('@/services/databaseCurrencyService', () => ({
  convertAmountWithDatabaseRate: vi.fn(),
  getDatabaseExchangeRate: vi.fn(),
  listAccessibleFxRates: vi.fn(),
}));

vi.mock('@/services/referenceDataService', () => ({
  getCurrencyMetadata: vi.fn((code) => {
    const meta = {
      EUR: { symbol: '\u20ac', name: 'Euro' },
      USD: { symbol: '$', name: 'US Dollar' },
      GBP: { symbol: '\u00a3', name: 'British Pound' },
      XOF: { symbol: 'CFA', name: 'CFA Franc BCEAO' },
    };
    return meta[code] || null;
  }),
}));

import {
  formatCurrency,
  formatCompactCurrency,
  getCurrencySymbol,
  getCurrencyName,
  getCurrencyFlag,
  getRatesLastUpdated,
  convertAmount,
  getExchangeRate,
  getExchangeRates,
} from '@/utils/currencyService';

import {
  convertAmountWithDatabaseRate,
  getDatabaseExchangeRate,
  listAccessibleFxRates,
} from '@/services/databaseCurrencyService';

// ============================================================================
// formatCurrency
// ============================================================================
describe('formatCurrency', () => {
  it('formats EUR amount with locale', () => {
    const result = formatCurrency(1000, 'EUR', 'fr-FR');
    // Intl formats EUR in fr-FR locale — contains the euro symbol
    expect(result).toContain('000');
    expect(result).toMatch(/\u20ac|EUR/);
  });

  it('formats USD amount', () => {
    const result = formatCurrency(2500, 'USD', 'en-US');
    expect(result).toContain('2,500');
    expect(result).toContain('$');
  });

  it('handles zero amount', () => {
    const result = formatCurrency(0, 'EUR', 'fr-FR');
    expect(result).toContain('0');
  });

  it('handles null amount as zero', () => {
    const result = formatCurrency(null, 'EUR', 'fr-FR');
    expect(result).toContain('0');
  });

  it('handles undefined amount as zero', () => {
    const result = formatCurrency(undefined, 'EUR', 'fr-FR');
    expect(result).toContain('0');
  });

  it('uses default currency EUR when none specified', () => {
    const result = formatCurrency(100);
    expect(result).toBeDefined();
  });
});

// ============================================================================
// formatCompactCurrency
// ============================================================================
describe('formatCompactCurrency', () => {
  it('formats thousands with K suffix', () => {
    const result = formatCompactCurrency(5000, 'EUR', 'en-US');
    expect(result).toContain('5');
    expect(result).toContain('K');
  });

  it('formats millions with M suffix', () => {
    const result = formatCompactCurrency(2500000, 'EUR', 'en-US');
    expect(result).toContain('2.5');
    expect(result).toContain('M');
  });

  it('formats billions with Md suffix', () => {
    const result = formatCompactCurrency(3000000000, 'USD', 'en-US');
    expect(result).toContain('3');
    expect(result).toContain('Md');
  });

  it('formats small amounts without suffix', () => {
    const result = formatCompactCurrency(500, 'EUR', 'en-US');
    expect(result).toContain('500');
    expect(result).not.toContain('K');
    expect(result).not.toContain('M');
  });

  it('adds negative sign for negative amounts', () => {
    const result = formatCompactCurrency(-1500, 'EUR', 'en-US');
    expect(result).toContain('-');
    expect(result).toContain('K');
  });

  it('handles zero', () => {
    const result = formatCompactCurrency(0, 'EUR', 'en-US');
    expect(result).toContain('0');
  });

  it('handles null amount', () => {
    const result = formatCompactCurrency(null, 'EUR', 'en-US');
    expect(result).toContain('0');
  });

  it('includes currency symbol', () => {
    const result = formatCompactCurrency(1000, 'USD', 'en-US');
    expect(result).toContain('$');
  });

  it('handles exact boundary at 1000', () => {
    const result = formatCompactCurrency(1000, 'EUR', 'en-US');
    expect(result).toContain('K');
  });

  it('handles exact boundary at 1000000', () => {
    const result = formatCompactCurrency(1000000, 'EUR', 'en-US');
    expect(result).toContain('M');
  });
});

// ============================================================================
// getCurrencySymbol
// ============================================================================
describe('getCurrencySymbol', () => {
  it('returns euro symbol for EUR', () => {
    expect(getCurrencySymbol('EUR')).toBe('\u20ac');
  });

  it('returns dollar sign for USD', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
  });

  it('returns pound sign for GBP', () => {
    expect(getCurrencySymbol('GBP')).toBe('\u00a3');
  });

  it('returns CFA for XOF', () => {
    expect(getCurrencySymbol('XOF')).toBe('CFA');
  });

  it('returns code itself for unknown currency', () => {
    expect(getCurrencySymbol('ZZZ')).toBe('ZZZ');
  });

  it('defaults to EUR when no code provided', () => {
    expect(getCurrencySymbol()).toBe('\u20ac');
  });
});

// ============================================================================
// getCurrencyName
// ============================================================================
describe('getCurrencyName', () => {
  it('returns Euro for EUR', () => {
    expect(getCurrencyName('EUR')).toBe('Euro');
  });

  it('returns US Dollar for USD', () => {
    expect(getCurrencyName('USD')).toBe('US Dollar');
  });

  it('returns code for unknown currency', () => {
    expect(getCurrencyName('UNKNOWN')).toBe('UNKNOWN');
  });

  it('defaults to EUR when no code provided', () => {
    expect(getCurrencyName()).toBe('Euro');
  });
});

// ============================================================================
// getCurrencyFlag
// ============================================================================
describe('getCurrencyFlag', () => {
  it('returns empty string', () => {
    expect(getCurrencyFlag()).toBe('');
    expect(getCurrencyFlag('EUR')).toBe('');
  });
});

// ============================================================================
// getRatesLastUpdated
// ============================================================================
describe('getRatesLastUpdated', () => {
  it('returns null when no rates cached', () => {
    expect(getRatesLastUpdated('CHF')).toBeNull();
  });

  it('returns null for default EUR when not cached', () => {
    expect(getRatesLastUpdated()).toBeNull();
  });
});

// ============================================================================
// convertAmount
// ============================================================================
describe('convertAmount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns same amount when currencies are identical', async () => {
    const result = await convertAmount(100, 'EUR', 'EUR');
    expect(result).toBe(100);
    expect(convertAmountWithDatabaseRate).not.toHaveBeenCalled();
  });

  it('returns 0 for NaN amount', async () => {
    const result = await convertAmount(NaN, 'EUR', 'USD');
    expect(result).toBe(0);
  });

  it('returns 0 for null amount', async () => {
    const result = await convertAmount(null, 'EUR', 'USD');
    expect(result).toBe(0);
  });

  it('returns 0 for zero amount', async () => {
    const result = await convertAmount(0, 'EUR', 'USD');
    expect(result).toBe(0);
  });

  it('calls database service and returns converted value', async () => {
    convertAmountWithDatabaseRate.mockResolvedValue(118.5);
    const result = await convertAmount(100, 'EUR', 'USD');
    expect(result).toBe(118.5);
    expect(convertAmountWithDatabaseRate).toHaveBeenCalledWith({
      amount: 100,
      fromCurrency: 'EUR',
      toCurrency: 'USD',
    });
  });

  it('returns original amount when database returns null', async () => {
    convertAmountWithDatabaseRate.mockResolvedValue(null);
    const result = await convertAmount(100, 'EUR', 'XOF');
    expect(result).toBe(100);
  });
});

// ============================================================================
// getExchangeRate
// ============================================================================
describe('getExchangeRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 1 for same currency', async () => {
    const result = await getExchangeRate('EUR', 'EUR');
    expect(result).toBe(1);
    expect(getDatabaseExchangeRate).not.toHaveBeenCalled();
  });

  it('returns rate from database', async () => {
    getDatabaseExchangeRate.mockResolvedValue({ exchange_rate: 1.185 });
    const result = await getExchangeRate('EUR', 'USD');
    expect(result).toBe(1.185);
  });

  it('returns null when database has no rate', async () => {
    getDatabaseExchangeRate.mockResolvedValue(null);
    const result = await getExchangeRate('EUR', 'ZZZ');
    expect(result).toBeNull();
  });

  it('returns null when exchange_rate is null', async () => {
    getDatabaseExchangeRate.mockResolvedValue({ exchange_rate: null });
    const result = await getExchangeRate('EUR', 'GBP');
    expect(result).toBeNull();
  });
});

// ============================================================================
// getExchangeRates
// Each test uses a unique base currency to avoid cross-test cache pollution.
// ============================================================================
describe('getExchangeRates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds rates map from accessible FX rates', async () => {
    listAccessibleFxRates.mockResolvedValue([
      { base_currency: 'AAA', quote_currency: 'USD', exchange_rate: 1.18 },
      { base_currency: 'AAA', quote_currency: 'GBP', exchange_rate: 0.86 },
      { base_currency: 'USD', quote_currency: 'JPY', exchange_rate: 110 },
    ]);

    const rates = await getExchangeRates('AAA');
    expect(rates.USD).toBe(1.18);
    expect(rates.GBP).toBe(0.86);
    // USD/JPY is not relative to AAA base so should not appear
    expect(rates.JPY).toBeUndefined();
  });

  it('includes inverse rates when quote matches base', async () => {
    listAccessibleFxRates.mockResolvedValue([
      { base_currency: 'USD', quote_currency: 'BBB', exchange_rate: 0.85 },
    ]);

    const rates = await getExchangeRates('BBB');
    // BBB is quote_currency, so USD rate = 1 / 0.85
    expect(rates.USD).toBeCloseTo(1 / 0.85, 5);
  });

  it('skips entries with zero rate', async () => {
    listAccessibleFxRates.mockResolvedValue([
      { base_currency: 'CCC', quote_currency: 'USD', exchange_rate: 0 },
    ]);

    const rates = await getExchangeRates('CCC');
    expect(rates.USD).toBeUndefined();
  });

  it('skips entries where from === to', async () => {
    listAccessibleFxRates.mockResolvedValue([
      { base_currency: 'DDD', quote_currency: 'DDD', exchange_rate: 1 },
    ]);

    const rates = await getExchangeRates('DDD');
    expect(Object.keys(rates)).toHaveLength(0);
  });

  it('normalizes base currency to uppercase', async () => {
    listAccessibleFxRates.mockResolvedValue([
      { base_currency: 'EEE', quote_currency: 'USD', exchange_rate: 1.2 },
    ]);

    const rates = await getExchangeRates('eee');
    expect(rates.USD).toBe(1.2);
  });

  it('returns empty object when no rates match', async () => {
    listAccessibleFxRates.mockResolvedValue([]);
    const rates = await getExchangeRates('FFF');
    expect(rates).toEqual({});
  });
});
