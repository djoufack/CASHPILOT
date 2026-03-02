import {
  convertAmountWithDatabaseRate,
  getDatabaseExchangeRate,
  listAccessibleFxRates,
} from '@/services/databaseCurrencyService';
import { getCurrencyMetadata } from '@/services/referenceDataService';
import { formatDateInput } from '@/utils/dateFormatting';

const ratesCache = {};
const CACHE_DURATION = 60 * 60 * 1000;

/**
 * Fetch latest exchange rates for a given base currency from Supabase.
 * Returns rates relative to the requested base currency when available.
 *
 * @param {string} baseCurrency
 * @returns {Promise<Object>}
 */
export const getExchangeRates = async (baseCurrency = 'EUR') => {
  const normalizedBase = String(baseCurrency || 'EUR').trim().toUpperCase();
  const now = Date.now();
  const cached = ratesCache[normalizedBase];

  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.rates;
  }

  const accessibleRates = await listAccessibleFxRates();
  const rates = {};

  for (const row of accessibleRates) {
    const from = String(row.base_currency || '').toUpperCase();
    const to = String(row.quote_currency || '').toUpperCase();
    const rate = Number(row.exchange_rate || 0);

    if (!rate || from === to) {
      continue;
    }

    if (from === normalizedBase) {
      rates[to] = rate;
    } else if (to === normalizedBase) {
      rates[from] = 1 / rate;
    }
  }

  ratesCache[normalizedBase] = {
    rates,
    date: formatDateInput(),
    timestamp: now,
  };

  return rates;
};

/**
 * Fetch latest exchange rates from Supabase relative to EUR.
 * @deprecated Use getExchangeRates(baseCurrency) instead
 */
export const fetchExchangeRates = async () => {
  return getExchangeRates('EUR');
};

/**
 * Get the last update date for cached rates
 *
 * @param {string} baseCurrency
 * @returns {string|null}
 */
export const getRatesLastUpdated = (baseCurrency = 'EUR') => {
  const cached = ratesCache[String(baseCurrency || 'EUR').trim().toUpperCase()];
  return cached ? cached.date : null;
};

/**
 * Convert amount from one currency to another using database FX rates.
 *
 * @param {number} amount
 * @param {string} fromCurrency
 * @param {string} toCurrency
 * @returns {Promise<number>}
 */
export const convertAmount = async (amount, fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) return amount;
  if (!amount || Number.isNaN(amount)) return 0;

  const converted = await convertAmountWithDatabaseRate({
    amount,
    fromCurrency,
    toCurrency,
  });

  return converted == null ? amount : Number(converted);
};

/**
 * Convert amount from one currency to another (alias)
 * @deprecated Use convertAmount instead
 */
export const convertCurrency = convertAmount;

/**
 * Get the exchange rate between two currencies.
 *
 * @param {string} fromCurrency
 * @param {string} toCurrency
 * @returns {Promise<number|null>}
 */
export const getExchangeRate = async (fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) return 1;

  const data = await getDatabaseExchangeRate({
    fromCurrency,
    toCurrency,
  });

  return data?.exchange_rate == null ? null : Number(data.exchange_rate);
};

/**
 * Format currency amount with symbol using Intl.NumberFormat
 *
 * @param {number} amount
 * @param {string} currency
 * @param {string} locale
 * @returns {string}
 */
export const formatCurrency = (amount, currency = 'EUR', locale = 'fr-FR') => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch {
    const symbol = getCurrencySymbol(currency);
    const formatted = Math.round(amount || 0).toLocaleString(locale);
    return `${formatted} ${symbol}`;
  }
};

/**
 * Format currency in compact notation for KPI cards.
 *
 * @param {number} amount
 * @param {string} currency
 * @param {string} locale
 * @returns {string}
 */
export const formatCompactCurrency = (amount, currency = 'EUR', locale = 'fr-FR') => {
  const value = Math.abs(amount || 0);
  const sign = (amount || 0) < 0 ? '-' : '';
  const symbol = getCurrencySymbol(currency);

  let compact;
  if (value >= 1_000_000_000) {
    compact = `${(value / 1_000_000_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}Md`;
  } else if (value >= 1_000_000) {
    compact = `${(value / 1_000_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  } else if (value >= 1_000) {
    compact = `${(value / 1_000).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}K`;
  } else {
    compact = value.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  return `${sign}${compact} ${symbol}`;
};

/**
 * Get currency symbol from currency code.
 *
 * @param {string} currencyCode
 * @returns {string}
 */
export const getCurrencySymbol = (currencyCode = 'EUR') => {
  const currency = getCurrencyMetadata(currencyCode);
  return currency ? currency.symbol : currencyCode;
};

/**
 * Get currency name from currency code.
 *
 * @param {string} currencyCode
 * @returns {string}
 */
export const getCurrencyName = (currencyCode = 'EUR') => {
  const currency = getCurrencyMetadata(currencyCode);
  return currency ? currency.name : currencyCode;
};

/**
 * Get flag emoji for a currency.
 * Currency UI metadata now comes from Supabase; flags are not persisted.
 *
 * @returns {string}
 */
export const getCurrencyFlag = () => '';

export default {
  getExchangeRates,
  fetchExchangeRates,
  convertAmount,
  convertCurrency,
  getExchangeRate,
  getRatesLastUpdated,
  formatCurrency,
  formatCompactCurrency,
  getCurrencySymbol,
  getCurrencyName,
  getCurrencyFlag,
};
