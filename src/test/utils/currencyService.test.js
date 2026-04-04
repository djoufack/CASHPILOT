import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listAccessibleFxRates: vi.fn(),
  convertAmountWithDatabaseRate: vi.fn(),
  getDatabaseExchangeRate: vi.fn(),
  getCurrencyMetadata: vi.fn(),
  formatDateInput: vi.fn(() => '2026-04-04'),
}));

vi.mock('@/utils/dateLocale', () => ({
  getLocale: () => 'fr-FR',
}));

vi.mock('@/utils/dateFormatting', () => ({
  formatDateInput: mocks.formatDateInput,
}));

vi.mock('@/services/databaseCurrencyService', () => ({
  listAccessibleFxRates: mocks.listAccessibleFxRates,
  convertAmountWithDatabaseRate: mocks.convertAmountWithDatabaseRate,
  getDatabaseExchangeRate: mocks.getDatabaseExchangeRate,
}));

vi.mock('@/services/referenceDataService', () => ({
  getCurrencyMetadata: mocks.getCurrencyMetadata,
}));

import {
  convertAmount,
  convertCurrency,
  fetchExchangeRates,
  formatCompactCurrency,
  formatCurrency,
  getCurrencyFlag,
  getCurrencyName,
  getCurrencySymbol,
  getExchangeRate,
  getExchangeRates,
  getRatesLastUpdated,
} from '@/utils/currencyService';

describe('currencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrencyMetadata.mockImplementation((code) => {
      if (code === 'EUR') return { symbol: '€', name: 'Euro' };
      if (code === 'USD') return { symbol: '$', name: 'US Dollar' };
      return null;
    });
  });

  it('loads exchange rates and reuses cache for the same base currency', async () => {
    mocks.listAccessibleFxRates.mockResolvedValue([
      { base_currency: 'EUR', quote_currency: 'USD', exchange_rate: 1.2 },
      { base_currency: 'GBP', quote_currency: 'EUR', exchange_rate: 0.8 },
      { base_currency: 'EUR', quote_currency: 'EUR', exchange_rate: 1 },
      { base_currency: 'EUR', quote_currency: 'XAF', exchange_rate: 655.957 },
    ]);

    const rates = await getExchangeRates(' usd ');
    expect(rates).toMatchObject({
      EUR: 1 / 1.2,
    });

    const cachedRates = await getExchangeRates('USD');
    expect(cachedRates).toEqual(rates);
    expect(mocks.listAccessibleFxRates).toHaveBeenCalledTimes(1);
    expect(getRatesLastUpdated('USD')).toBe('2026-04-04');
  });

  it('supports deprecated fetchExchangeRates alias', async () => {
    mocks.listAccessibleFxRates.mockResolvedValue([
      { base_currency: 'EUR', quote_currency: 'USD', exchange_rate: 1.1 },
    ]);
    const rates = await fetchExchangeRates();
    expect(rates.USD).toBe(1.1);
  });

  it('converts amounts through database rates and handles fallbacks', async () => {
    mocks.convertAmountWithDatabaseRate.mockResolvedValue(220);
    expect(await convertAmount(200, 'EUR', 'USD')).toBe(220);

    mocks.convertAmountWithDatabaseRate.mockResolvedValue(null);
    expect(await convertAmount(200, 'EUR', 'USD')).toBe(200);

    expect(await convertAmount(100, 'EUR', 'EUR')).toBe(100);
    expect(await convertAmount(NaN, 'EUR', 'USD')).toBe(0);
    expect(await convertCurrency(10, 'EUR', 'USD')).toBe(10);
  });

  it('returns exchange rates through database helper', async () => {
    mocks.getDatabaseExchangeRate.mockResolvedValue({ exchange_rate: 1.37 });
    expect(await getExchangeRate('EUR', 'CAD')).toBe(1.37);

    mocks.getDatabaseExchangeRate.mockResolvedValue({ exchange_rate: null });
    expect(await getExchangeRate('EUR', 'CAD')).toBeNull();

    expect(await getExchangeRate('EUR', 'EUR')).toBe(1);
  });

  it('formats currency with Intl and fallback when currency code is invalid', () => {
    expect(formatCurrency(1250, 'EUR', 'fr-FR')).toContain('€');

    const fallback = formatCurrency(1250, 'NOT_A_REAL_CCY', 'fr-FR');
    expect(fallback).toContain('NOT_A_REAL_CCY');
  });

  it('formats compact currency across magnitude ranges', () => {
    expect(formatCompactCurrency(1_500, 'EUR', 'fr-FR')).toContain('K');
    expect(formatCompactCurrency(2_000_000, 'EUR', 'fr-FR')).toContain('M');
    expect(formatCompactCurrency(4_000_000_000, 'EUR', 'fr-FR')).toContain('Md');
    expect(formatCompactCurrency(-250, 'EUR', 'fr-FR').startsWith('-')).toBe(true);
  });

  it('resolves metadata-derived symbol/name and default fallbacks', () => {
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencyName('USD')).toBe('US Dollar');
    expect(getCurrencySymbol('XYZ')).toBe('XYZ');
    expect(getCurrencyName('XYZ')).toBe('XYZ');
    expect(getCurrencyFlag('EUR')).toBe('');
  });
});
