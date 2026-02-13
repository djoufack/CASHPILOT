const ECB_RATES_URL = 'https://api.exchangerate-api.com/v4/latest/';

// Cache per base currency
const ratesCache = {};
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetch latest exchange rates for a given base currency
 * @param {string} baseCurrency - ISO 4217 code (default: 'EUR')
 * @returns {Promise<Object>} Object with currency codes as keys and rates as values
 */
export const getExchangeRates = async (baseCurrency = 'EUR') => {
  const now = Date.now();
  const cached = ratesCache[baseCurrency];

  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.rates;
  }

  try {
    const response = await fetch(`${ECB_RATES_URL}${baseCurrency}`);
    if (!response.ok) throw new Error('Failed to fetch exchange rates');
    const data = await response.json();
    ratesCache[baseCurrency] = {
      rates: data.rates,
      date: data.date,
      timestamp: now,
    };
    return data.rates;
  } catch (err) {
    console.error('getExchangeRates error:', err);
    // Return cached data even if stale
    if (cached) return cached.rates;
    // Return fallback rates only for EUR base
    if (baseCurrency === 'EUR') return FALLBACK_RATES;
    return null;
  }
};

/**
 * Fetch latest exchange rates from ECB (via free API)
 * Returns rates relative to EUR
 * @deprecated Use getExchangeRates(baseCurrency) instead
 */
export const fetchExchangeRates = async () => {
  return getExchangeRates('EUR');
};

/**
 * Get the last update date for cached rates
 * @param {string} baseCurrency - Base currency code
 * @returns {string|null} Date string or null
 */
export const getRatesLastUpdated = (baseCurrency = 'EUR') => {
  const cached = ratesCache[baseCurrency];
  return cached ? cached.date : null;
};

/**
 * Convert amount from one currency to another
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @returns {Promise<number>} Converted amount rounded to 2 decimals
 */
export const convertAmount = async (amount, fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) return amount;
  if (!amount || isNaN(amount)) return 0;

  const rates = await getExchangeRates('EUR');
  if (!rates) return amount;

  // Convert via EUR as intermediary
  const amountInEUR = fromCurrency === 'EUR'
    ? amount
    : amount / (rates[fromCurrency] || 1);
  const converted = toCurrency === 'EUR'
    ? amountInEUR
    : amountInEUR * (rates[toCurrency] || 1);

  return Math.round(converted * 100) / 100;
};

/**
 * Convert amount from one currency to another (alias)
 * @deprecated Use convertAmount instead
 */
export const convertCurrency = convertAmount;

/**
 * Get the exchange rate between two currencies
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @returns {Promise<number|null>} Exchange rate or null if unavailable
 */
export const getExchangeRate = async (fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) return 1;

  const rates = await getExchangeRates('EUR');
  if (!rates) return null;

  const fromRate = fromCurrency === 'EUR' ? 1 : (rates[fromCurrency] || null);
  const toRate = toCurrency === 'EUR' ? 1 : (rates[toCurrency] || null);

  if (!fromRate || !toRate) return null;

  return Math.round((toRate / fromRate) * 1000000) / 1000000;
};

/**
 * Format currency amount with symbol using Intl.NumberFormat
 * @param {number} amount - Amount to format
 * @param {string} currency - ISO 4217 currency code (default: 'EUR')
 * @param {string} locale - Locale for formatting (default: 'fr-FR')
 * @returns {string} Formatted currency string (e.g., "1 234,56 EUR")
 */
export const formatCurrency = (amount, currency = 'EUR', locale = 'fr-FR') => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    // Fallback if Intl doesn't know the currency
    const symbol = getCurrencySymbol(currency);
    const formatted = (amount || 0).toFixed(2);
    return `${formatted} ${symbol}`;
  }
};

/**
 * Get currency symbol from currency code
 * @param {string} currencyCode - ISO currency code (e.g., 'EUR', 'XAF', 'USD')
 * @returns {string} Currency symbol (e.g., '€', 'FCFA', '$')
 */
export const getCurrencySymbol = (currencyCode = 'EUR') => {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return currency ? currency.symbol : currencyCode;
};

/**
 * Get currency name from currency code
 * @param {string} currencyCode - ISO currency code
 * @returns {string} Currency name or the code itself
 */
export const getCurrencyName = (currencyCode = 'EUR') => {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return currency ? currency.name : currencyCode;
};

/**
 * Get flag emoji for a currency (based on common mapping)
 * @param {string} currencyCode - ISO currency code
 * @returns {string} Flag emoji or empty string
 */
export const getCurrencyFlag = (currencyCode) => {
  const flagMap = {
    EUR: '\u{1F1EA}\u{1F1FA}', USD: '\u{1F1FA}\u{1F1F8}', GBP: '\u{1F1EC}\u{1F1E7}',
    CHF: '\u{1F1E8}\u{1F1ED}', CAD: '\u{1F1E8}\u{1F1E6}', AUD: '\u{1F1E6}\u{1F1FA}',
    NZD: '\u{1F1F3}\u{1F1FF}', JPY: '\u{1F1EF}\u{1F1F5}', CNY: '\u{1F1E8}\u{1F1F3}',
    HKD: '\u{1F1ED}\u{1F1F0}', SGD: '\u{1F1F8}\u{1F1EC}', KRW: '\u{1F1F0}\u{1F1F7}',
    INR: '\u{1F1EE}\u{1F1F3}', BRL: '\u{1F1E7}\u{1F1F7}', MXN: '\u{1F1F2}\u{1F1FD}',
    ZAR: '\u{1F1FF}\u{1F1E6}', NGN: '\u{1F1F3}\u{1F1EC}', KES: '\u{1F1F0}\u{1F1EA}',
    GHS: '\u{1F1EC}\u{1F1ED}', MAD: '\u{1F1F2}\u{1F1E6}', TND: '\u{1F1F9}\u{1F1F3}',
    DZD: '\u{1F1E9}\u{1F1FF}', EGP: '\u{1F1EA}\u{1F1EC}', AED: '\u{1F1E6}\u{1F1EA}',
    SAR: '\u{1F1F8}\u{1F1E6}', TRY: '\u{1F1F9}\u{1F1F7}', NOK: '\u{1F1F3}\u{1F1F4}',
    SEK: '\u{1F1F8}\u{1F1EA}', DKK: '\u{1F1E9}\u{1F1F0}', PLN: '\u{1F1F5}\u{1F1F1}',
    CZK: '\u{1F1E8}\u{1F1FF}', HUF: '\u{1F1ED}\u{1F1FA}', RON: '\u{1F1F7}\u{1F1F4}',
    BGN: '\u{1F1E7}\u{1F1EC}', XOF: '\u{1F30D}', XAF: '\u{1F30D}',
    IDR: '\u{1F1EE}\u{1F1E9}', MYR: '\u{1F1F2}\u{1F1FE}', THB: '\u{1F1F9}\u{1F1ED}',
    PHP: '\u{1F1F5}\u{1F1ED}', VND: '\u{1F1FB}\u{1F1F3}', PKR: '\u{1F1F5}\u{1F1F0}',
    ILS: '\u{1F1EE}\u{1F1F1}', QAR: '\u{1F1F6}\u{1F1E6}', KWD: '\u{1F1F0}\u{1F1FC}',
    COP: '\u{1F1E8}\u{1F1F4}', PEN: '\u{1F1F5}\u{1F1EA}', ARS: '\u{1F1E6}\u{1F1F7}',
    CLP: '\u{1F1E8}\u{1F1F1}',
  };
  return flagMap[currencyCode] || '';
};

/**
 * Get supported currencies list (organized by region)
 */
export const SUPPORTED_CURRENCIES = [
  // Europe
  { code: 'EUR', symbol: '\u20AC', name: 'Euro', region: 'Europe' },
  { code: 'GBP', symbol: '\u00A3', name: 'British Pound', region: 'Europe' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', region: 'Europe' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', region: 'Europe' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', region: 'Europe' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', region: 'Europe' },
  { code: 'PLN', symbol: 'z\u0142', name: 'Polish Zloty', region: 'Europe' },
  { code: 'CZK', symbol: 'K\u010D', name: 'Czech Koruna', region: 'Europe' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', region: 'Europe' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu', region: 'Europe' },
  { code: 'BGN', symbol: '\u043B\u0432', name: 'Bulgarian Lev', region: 'Europe' },
  { code: 'HRK', symbol: 'kn', name: 'Croatian Kuna', region: 'Europe' },
  { code: 'RUB', symbol: '\u20BD', name: 'Russian Ruble', region: 'Europe' },
  { code: 'UAH', symbol: '\u20B4', name: 'Ukrainian Hryvnia', region: 'Europe' },
  { code: 'TRY', symbol: '\u20BA', name: 'Turkish Lira', region: 'Europe' },
  { code: 'ISK', symbol: 'kr', name: 'Icelandic Krona', region: 'Europe' },

  // Americas
  { code: 'USD', symbol: '$', name: 'US Dollar', region: 'Americas' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', region: 'Americas' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso', region: 'Americas' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', region: 'Americas' },
  { code: 'ARS', symbol: '$', name: 'Argentine Peso', region: 'Americas' },
  { code: 'CLP', symbol: '$', name: 'Chilean Peso', region: 'Americas' },
  { code: 'COP', symbol: '$', name: 'Colombian Peso', region: 'Americas' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', region: 'Americas' },
  { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso', region: 'Americas' },
  { code: 'VES', symbol: 'Bs.S', name: 'Venezuelan Bol\u00EDvar', region: 'Americas' },
  { code: 'CRC', symbol: '\u20A1', name: 'Costa Rican Col\u00F3n', region: 'Americas' },

  // Asia-Pacific
  { code: 'JPY', symbol: '\u00A5', name: 'Japanese Yen', region: 'Asia-Pacific' },
  { code: 'CNY', symbol: '\u00A5', name: 'Chinese Yuan', region: 'Asia-Pacific' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', region: 'Asia-Pacific' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', region: 'Asia-Pacific' },
  { code: 'KRW', symbol: '\u20A9', name: 'South Korean Won', region: 'Asia-Pacific' },
  { code: 'INR', symbol: '\u20B9', name: 'Indian Rupee', region: 'Asia-Pacific' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', region: 'Asia-Pacific' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', region: 'Asia-Pacific' },
  { code: 'THB', symbol: '\u0E3F', name: 'Thai Baht', region: 'Asia-Pacific' },
  { code: 'PHP', symbol: '\u20B1', name: 'Philippine Peso', region: 'Asia-Pacific' },
  { code: 'VND', symbol: '\u20AB', name: 'Vietnamese Dong', region: 'Asia-Pacific' },
  { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar', region: 'Asia-Pacific' },
  { code: 'PKR', symbol: '\u20A8', name: 'Pakistani Rupee', region: 'Asia-Pacific' },
  { code: 'BDT', symbol: '\u09F3', name: 'Bangladeshi Taka', region: 'Asia-Pacific' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', region: 'Asia-Pacific' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', region: 'Asia-Pacific' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', region: 'Asia-Pacific' },

  // Middle East
  { code: 'AED', symbol: '\u062F.\u0625', name: 'UAE Dirham', region: 'Middle East' },
  { code: 'SAR', symbol: '\u0631.\u0633', name: 'Saudi Riyal', region: 'Middle East' },
  { code: 'QAR', symbol: '\u0631.\u0642', name: 'Qatari Riyal', region: 'Middle East' },
  { code: 'KWD', symbol: '\u062F.\u0643', name: 'Kuwaiti Dinar', region: 'Middle East' },
  { code: 'BHD', symbol: '\u062F.\u0628', name: 'Bahraini Dinar', region: 'Middle East' },
  { code: 'OMR', symbol: '\u0631.\u0639', name: 'Omani Rial', region: 'Middle East' },
  { code: 'ILS', symbol: '\u20AA', name: 'Israeli Shekel', region: 'Middle East' },
  { code: 'JOD', symbol: '\u062F.\u0627', name: 'Jordanian Dinar', region: 'Middle East' },
  { code: 'LBP', symbol: '\u0644.\u0644', name: 'Lebanese Pound', region: 'Middle East' },
  { code: 'IQD', symbol: '\u0639.\u062F', name: 'Iraqi Dinar', region: 'Middle East' },

  // Africa
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', region: 'Africa' },
  { code: 'EGP', symbol: '\u00A3', name: 'Egyptian Pound', region: 'Africa' },
  { code: 'NGN', symbol: '\u20A6', name: 'Nigerian Naira', region: 'Africa' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', region: 'Africa' },
  { code: 'GHS', symbol: '\u20B5', name: 'Ghanaian Cedi', region: 'Africa' },
  { code: 'MAD', symbol: '\u062F.\u0645', name: 'Moroccan Dirham', region: 'Africa' },
  { code: 'TND', symbol: '\u062F.\u062A', name: 'Tunisian Dinar', region: 'Africa' },
  { code: 'DZD', symbol: '\u062F.\u062C', name: 'Algerian Dinar', region: 'Africa' },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc', region: 'Africa' },
  { code: 'XAF', symbol: 'FCFA', name: 'Central African CFA Franc', region: 'Africa' },
  { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr', region: 'Africa' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', region: 'Africa' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', region: 'Africa' },
  { code: 'MUR', symbol: '\u20A8', name: 'Mauritian Rupee', region: 'Africa' },
];

// Fallback rates (relative to EUR, updated periodically)
const FALLBACK_RATES = {
  // Europe
  GBP: 0.86, CHF: 0.94, NOK: 11.45, SEK: 11.52, DKK: 7.45,
  PLN: 4.32, CZK: 24.72, HUF: 391.50, RON: 4.97, BGN: 1.96,
  HRK: 7.53, RUB: 95.70, UAH: 43.50, TRY: 35.20, ISK: 149.80,
  // Americas
  USD: 1.08, CAD: 1.47, MXN: 18.45, BRL: 5.42, ARS: 1050.00,
  CLP: 990.50, COP: 4250.00, PEN: 4.08, UYU: 42.30, VES: 39.50,
  CRC: 550.20,
  // Asia-Pacific
  JPY: 162.50, CNY: 7.82, HKD: 8.45, SGD: 1.45, KRW: 1450.00,
  INR: 90.25, IDR: 17250.00, MYR: 4.98, THB: 38.50, PHP: 61.50,
  VND: 26850.00, TWD: 34.70, PKR: 298.50, BDT: 118.50, LKR: 318.00,
  AUD: 1.68, NZD: 1.82,
  // Middle East
  AED: 3.97, SAR: 4.05, QAR: 3.93, KWD: 0.33, BHD: 0.41,
  OMR: 0.42, ILS: 3.95, JOD: 0.77, LBP: 97000.00, IQD: 1415.00,
  // Africa
  ZAR: 20.15, EGP: 53.50, NGN: 1620.00, KES: 139.50, GHS: 16.85,
  MAD: 10.80, TND: 3.38, DZD: 146.20, XOF: 655.96, XAF: 655.96,
  ETB: 131.50, TZS: 2750.00, UGX: 4050.00, MUR: 49.80,
};

export default {
  getExchangeRates,
  fetchExchangeRates,
  convertAmount,
  convertCurrency,
  getExchangeRate,
  getRatesLastUpdated,
  formatCurrency,
  getCurrencySymbol,
  getCurrencyName,
  getCurrencyFlag,
  SUPPORTED_CURRENCIES,
};
