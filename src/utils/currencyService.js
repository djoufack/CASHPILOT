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
 * Get supported currencies list (organized by region)
 */
export const SUPPORTED_CURRENCIES = [
  // Europe
  { code: 'EUR', symbol: '€', name: 'Euro', region: 'Europe' },
  { code: 'GBP', symbol: '£', name: 'British Pound', region: 'Europe' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', region: 'Europe' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', region: 'Europe' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', region: 'Europe' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', region: 'Europe' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', region: 'Europe' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', region: 'Europe' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', region: 'Europe' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu', region: 'Europe' },
  { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev', region: 'Europe' },
  { code: 'HRK', symbol: 'kn', name: 'Croatian Kuna', region: 'Europe' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', region: 'Europe' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia', region: 'Europe' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', region: 'Europe' },
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
  { code: 'VES', symbol: 'Bs.S', name: 'Venezuelan Bolívar', region: 'Americas' },
  { code: 'CRC', symbol: '₡', name: 'Costa Rican Colón', region: 'Americas' },

  // Asia-Pacific
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', region: 'Asia-Pacific' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', region: 'Asia-Pacific' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', region: 'Asia-Pacific' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', region: 'Asia-Pacific' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', region: 'Asia-Pacific' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', region: 'Asia-Pacific' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', region: 'Asia-Pacific' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', region: 'Asia-Pacific' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', region: 'Asia-Pacific' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', region: 'Asia-Pacific' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', region: 'Asia-Pacific' },
  { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar', region: 'Asia-Pacific' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', region: 'Asia-Pacific' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', region: 'Asia-Pacific' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', region: 'Asia-Pacific' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', region: 'Asia-Pacific' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', region: 'Asia-Pacific' },

  // Middle East
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', region: 'Middle East' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', region: 'Middle East' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal', region: 'Middle East' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', region: 'Middle East' },
  { code: 'BHD', symbol: 'د.ب', name: 'Bahraini Dinar', region: 'Middle East' },
  { code: 'OMR', symbol: 'ر.ع', name: 'Omani Rial', region: 'Middle East' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', region: 'Middle East' },
  { code: 'JOD', symbol: 'د.ا', name: 'Jordanian Dinar', region: 'Middle East' },
  { code: 'LBP', symbol: 'ل.ل', name: 'Lebanese Pound', region: 'Middle East' },
  { code: 'IQD', symbol: 'ع.د', name: 'Iraqi Dinar', region: 'Middle East' },

  // Africa
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', region: 'Africa' },
  { code: 'EGP', symbol: '£', name: 'Egyptian Pound', region: 'Africa' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', region: 'Africa' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', region: 'Africa' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi', region: 'Africa' },
  { code: 'MAD', symbol: 'د.م', name: 'Moroccan Dirham', region: 'Africa' },
  { code: 'TND', symbol: 'د.ت', name: 'Tunisian Dinar', region: 'Africa' },
  { code: 'DZD', symbol: 'د.ج', name: 'Algerian Dinar', region: 'Africa' },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc', region: 'Africa' },
  { code: 'XAF', symbol: 'FCFA', name: 'Central African CFA Franc', region: 'Africa' },
  { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr', region: 'Africa' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', region: 'Africa' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', region: 'Africa' },
  { code: 'MUR', symbol: '₨', name: 'Mauritian Rupee', region: 'Africa' },
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

/**
 * Get currency symbol from currency code
 * @param {string} currencyCode - ISO currency code (e.g., 'EUR', 'XAF', 'USD')
 * @returns {string} Currency symbol (e.g., '€', 'FCFA', '$')
 */
export const getCurrencySymbol = (currencyCode = 'EUR') => {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return currency ? currency.symbol : currencyCode;
};

export default { fetchExchangeRates, convertCurrency, formatCurrency, getCurrencySymbol, SUPPORTED_CURRENCIES };
