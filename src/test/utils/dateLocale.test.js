import { describe, it, expect, vi } from 'vitest';

vi.mock('@/i18n/config', () => ({
  default: { resolvedLanguage: 'fr', language: 'fr' },
}));

import { getLocale, formatDate, formatDateTime, formatNumber, formatTime } from '@/utils/dateLocale';

describe('getLocale', () => {
  it('returns fr by default', () => {
    expect(getLocale()).toBe('fr');
  });
});

describe('formatDate', () => {
  it('returns empty string for falsy value', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
  });

  it('formats a valid Date object', () => {
    const result = formatDate(new Date(2026, 0, 15));
    expect(result).toBeTruthy();
    expect(result).toContain('2026');
  });

  it('formats a valid date string', () => {
    const result = formatDate('2026-06-30');
    expect(result).toBeTruthy();
    expect(result).toContain('2026');
  });

  it('returns string representation for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatDateTime', () => {
  it('returns empty string for falsy value', () => {
    expect(formatDateTime(null)).toBe('');
  });

  it('formats a valid datetime', () => {
    const result = formatDateTime(new Date(2026, 5, 15, 14, 30));
    expect(result).toBeTruthy();
    expect(result).toContain('2026');
  });

  it('returns string representation for invalid datetime', () => {
    expect(formatDateTime('invalid')).toBe('invalid');
  });
});

describe('formatNumber', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatNumber(null)).toBe('');
    expect(formatNumber(undefined)).toBe('');
  });

  it('formats numbers', () => {
    const result = formatNumber(1234.56);
    expect(result).toBeTruthy();
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBeTruthy();
  });

  it('accepts options', () => {
    const result = formatNumber(1234.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(result).toBeTruthy();
  });
});

describe('formatTime', () => {
  it('returns empty string for falsy value', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime('')).toBe('');
  });

  it('formats a valid time', () => {
    const result = formatTime(new Date(2026, 0, 1, 14, 30));
    expect(result).toBeTruthy();
  });

  it('returns string for invalid time', () => {
    expect(formatTime('bad')).toBe('bad');
  });
});
