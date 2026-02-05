const ECB_RATES_URL = 'https://api.exchangerate-api.com/v4/latest/EUR';

let cachedRates = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetch latest exchange rates from ECB (via free API)
 * Returns rates relative to EUR
 */
export const fetchExchangeRates = async () => {
  const now = Date.now();
  if (cachedRates && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedRates;
  }

  try {
    const response = await fetch(ECB_RATES_URL);
    if (!response.ok) throw new Error('Failed to fetch exchange rates');
    const data = await response.json();
    cachedRates = data.rates;
    cacheTimestamp = now;
    return cachedRates;
  } catch (err) {
    console.error('fetchExchangeRates error:', err);
    // Return fallback rates if fetch fails
    return cachedRates || FALLBACK_RATES;
  }
};

/**
 * Convert amount from one currency to another
 */
export const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) return amount;

  const rates = await fetchExchangeRates();
  if (!rates) return amount;

  // Convert to EUR first, then to target
  const amountInEUR = fromCurrency === 'EUR' ? amount : amount / (rates[fromCurrency] || 1);
  const converted = toCurrency === 'EUR' ? amountInEUR : amountInEUR * (rates[toCurrency] || 1);

  return Math.round(converted * 100) / 100;
};

/**
 * Format currency amount with symbol
 */
export const formatCurrency = (amount, currency = 'EUR', locale = 'fr-FR') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Get supported currencies list
 */
export const SUPPORTED_CURRENCIES = [
  { code: 'EUR', symbol: '\u20ac', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '\u00a3', name: 'British Pound' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham' },
  { code: 'TND', symbol: 'TND', name: 'Tunisian Dinar' },
  { code: 'XOF', symbol: 'CFA', name: 'CFA Franc BCEAO' },
  { code: 'JPY', symbol: '\u00a5', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '\u00a5', name: 'Chinese Yuan' },
];

// Fallback rates (updated periodically)
const FALLBACK_RATES = {
  USD: 1.08, GBP: 0.86, CHF: 0.94, CAD: 1.47, MAD: 10.8,
  TND: 3.38, XOF: 655.96, JPY: 162.5, CNY: 7.82,
};

export default { fetchExchangeRates, convertCurrency, formatCurrency, SUPPORTED_CURRENCIES };
