import { formatDate, formatDateTime, formatNumber, getLocale } from '@/utils/dateLocale';

export function formatDisplayCurrency(
  value,
  {
    currency = 'EUR',
    locale,
    fallback = '---',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    style = 'currency',
  } = {}
) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;

  try {
    return new Intl.NumberFormat(locale || getLocale(), {
      style,
      ...(style === 'currency' ? { currency } : {}),
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount);
  } catch {
    return formatNumber(amount, { minimumFractionDigits, maximumFractionDigits }) || fallback;
  }
}

export function formatDisplayDate(value, { fallback = '-', options } = {}) {
  if (!value) return fallback;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return formatDate(parsed, options) || fallback;
}

export function formatDisplayDateTime(value, { fallback = '-', options } = {}) {
  if (!value) return fallback;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return formatDateTime(parsed, options) || fallback;
}
