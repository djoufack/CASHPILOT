import { describe, it, expect } from 'vitest';
import { validateDate, optionalNumber, requireString, optionalString, coerceNumbers, validateDatesInRecord } from '../validation';

describe('validateDate', () => {
  it('accepts valid YYYY-MM-DD dates', () => {
    expect(validateDate('2026-01-15', 'date')).toBe('2026-01-15');
    expect(validateDate('2025-12-31', 'date')).toBe('2025-12-31');
    expect(validateDate('2000-02-29', 'date')).toBe('2000-02-29'); // leap year
  });

  it('rejects invalid date formats', () => {
    expect(() => validateDate('15-01-2026', 'date')).toThrow();
    expect(() => validateDate('2026/01/15', 'date')).toThrow();
    expect(() => validateDate('not-a-date', 'date')).toThrow();
  });

  it('rejects non-existent calendar dates', () => {
    expect(() => validateDate('2025-02-30', 'date')).toThrow('not a valid calendar date');
    expect(() => validateDate('2025-13-01', 'date')).toThrow();
  });

  it('rejects empty or non-string values', () => {
    expect(() => validateDate('', 'date')).toThrow('required');
    expect(() => validateDate(null, 'date')).toThrow('required');
    expect(() => validateDate(undefined, 'date')).toThrow('required');
  });
});

describe('optionalNumber', () => {
  it('coerces string numbers to numbers', () => {
    expect(optionalNumber('42')).toBe(42);
    expect(optionalNumber('3.14')).toBeCloseTo(3.14);
  });

  it('returns undefined for null/undefined/empty', () => {
    expect(optionalNumber(null)).toBeUndefined();
    expect(optionalNumber(undefined)).toBeUndefined();
    expect(optionalNumber('')).toBeUndefined();
  });

  it('returns default value for NaN', () => {
    expect(optionalNumber('abc', 10)).toBe(10);
    expect(optionalNumber('abc')).toBeUndefined();
  });

  it('passes through actual numbers', () => {
    expect(optionalNumber(99)).toBe(99);
    expect(optionalNumber(0)).toBe(0);
  });
});

describe('requireString', () => {
  it('returns trimmed string for valid input', () => {
    expect(requireString('hello', 'name')).toBe('hello');
    expect(requireString('  spaced  ', 'name')).toBe('spaced');
  });

  it('throws for empty or non-string input', () => {
    expect(() => requireString('', 'name')).toThrow('required');
    expect(() => requireString('   ', 'name')).toThrow('required');
    expect(() => requireString(null, 'name')).toThrow('required');
    expect(() => requireString(123, 'name')).toThrow('required');
  });
});

describe('optionalString', () => {
  it('returns trimmed string or undefined', () => {
    expect(optionalString('hello')).toBe('hello');
    expect(optionalString('  spaced  ')).toBe('spaced');
    expect(optionalString(null)).toBeUndefined();
    expect(optionalString(undefined)).toBeUndefined();
    expect(optionalString('')).toBeUndefined();
  });
});

describe('coerceNumbers', () => {
  it('converts string values to numbers for specified fields', () => {
    const record = { amount: '100.50', name: 'Test', quantity: '3' };
    const result = coerceNumbers(record, ['amount', 'quantity']);
    expect(result.amount).toBe(100.5);
    expect(result.quantity).toBe(3);
    expect(result.name).toBe('Test');
  });

  it('leaves non-numeric strings untouched', () => {
    const record = { amount: 'abc' };
    const result = coerceNumbers(record, ['amount']);
    expect(result.amount).toBe('abc');
  });

  it('skips null/undefined/empty fields', () => {
    const record = { amount: null, qty: undefined, price: '' };
    const result = coerceNumbers(record, ['amount', 'qty', 'price']);
    expect(result.amount).toBeNull();
    expect(result.qty).toBeUndefined();
    expect(result.price).toBe('');
  });
});

describe('validateDatesInRecord', () => {
  it('returns null for valid date fields', () => {
    const record = { date: '2026-01-15', due_date: '2026-02-15', name: 'Test' };
    expect(validateDatesInRecord(record)).toBeNull();
  });

  it('returns error string for invalid date fields', () => {
    const record = { date: 'invalid' };
    const result = validateDatesInRecord(record);
    expect(result).toContain("Parameter 'date'");
  });

  it('ignores non-date fields', () => {
    const record = { name: 'not-a-date-field', amount: 42 };
    expect(validateDatesInRecord(record)).toBeNull();
  });
});
