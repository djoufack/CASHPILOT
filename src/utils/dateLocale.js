/**
 * dateLocale.js — Locale-aware date and number formatting utilities
 *
 * Wraps Intl.DateTimeFormat and Intl.NumberFormat to format values using the user's current language.
 */
import i18n from '@/i18n/config';

export function getLocale() {
  return i18n.resolvedLanguage || i18n.language || 'fr';
}

/**
 * Format a Date value using the current i18n language and Intl.DateTimeFormat options.
 *
 * @param {Date|string|number} value - The date to format
 * @param {Intl.DateTimeFormatOptions} [options] - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return '';
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(getLocale(), options).format(date);
  } catch {
    return String(value);
  }
}

/**
 * Format a Date value as a date+time string using the current i18n language.
 *
 * @param {Date|string|number} value - The date to format
 * @param {Intl.DateTimeFormatOptions} [options] - Intl.DateTimeFormat options
 * @returns {string} Formatted datetime string
 */
export function formatDateTime(
  value,
  options = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
) {
  if (!value) return '';
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(getLocale(), options).format(date);
  } catch {
    return String(value);
  }
}

/**
 * Format a number using the current i18n language and Intl.NumberFormat options.
 *
 * @param {number} value - The number to format
 * @param {Intl.NumberFormatOptions} [options] - Intl.NumberFormat options
 * @returns {string} Formatted number string
 */
export function formatNumber(value, options = {}) {
  if (value === null || value === undefined) return '';
  try {
    return new Intl.NumberFormat(getLocale(), options).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Format a Date value as a time string using the current i18n language.
 *
 * @param {Date|string|number} value - The date/time to format
 * @param {Intl.DateTimeFormatOptions} [options] - Intl.DateTimeFormat options
 * @returns {string} Formatted time string
 */
export function formatTime(value, options = { hour: '2-digit', minute: '2-digit' }) {
  if (!value) return '';
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(getLocale(), options).format(date);
  } catch {
    return String(value);
  }
}
