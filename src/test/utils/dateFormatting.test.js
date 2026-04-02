import { describe, it, expect } from 'vitest';
import {
  formatDateInput,
  formatStartOfYearInput,
  addDaysToDateInput,
} from '@/utils/dateFormatting';

// ============================================================================
// formatDateInput
// ============================================================================
describe('formatDateInput', () => {
  it('should format a Date object to YYYY-MM-DD', () => {
    const date = new Date(2026, 3, 2); // April 2, 2026
    expect(formatDateInput(date)).toBe('2026-04-02');
  });

  it('should format an ISO string to YYYY-MM-DD', () => {
    expect(formatDateInput('2026-04-02')).toBe('2026-04-02');
  });

  it('should handle string dates that are already YYYY-MM-DD', () => {
    expect(formatDateInput('2025-12-25')).toBe('2025-12-25');
  });

  it('should pad single-digit months and days', () => {
    const date = new Date(2026, 0, 5); // January 5
    expect(formatDateInput(date)).toBe('2026-01-05');
  });

  it('should default to current date when no argument', () => {
    const result = formatDateInput();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should return empty string for invalid date', () => {
    expect(formatDateInput('not-a-date')).toBe('');
  });

  it('should handle Date object at midnight', () => {
    const date = new Date(2026, 5, 15, 0, 0, 0);
    expect(formatDateInput(date)).toBe('2026-06-15');
  });

  it('should handle numeric timestamp', () => {
    const timestamp = new Date(2026, 0, 1).getTime();
    const result = formatDateInput(timestamp);
    expect(result).toBe('2026-01-01');
  });
});

// ============================================================================
// formatStartOfYearInput
// ============================================================================
describe('formatStartOfYearInput', () => {
  it('should return January 1st of the given date year', () => {
    expect(formatStartOfYearInput('2026-06-15')).toBe('2026-01-01');
  });

  it('should handle Date object', () => {
    const date = new Date(2025, 8, 20); // September 20, 2025
    expect(formatStartOfYearInput(date)).toBe('2025-01-01');
  });

  it('should default to current year when no argument', () => {
    const result = formatStartOfYearInput();
    const currentYear = new Date().getFullYear();
    expect(result).toBe(`${currentYear}-01-01`);
  });

  it('should return empty string for invalid date', () => {
    expect(formatStartOfYearInput('invalid')).toBe('');
  });
});

// ============================================================================
// addDaysToDateInput
// ============================================================================
describe('addDaysToDateInput', () => {
  it('should add days to a date string', () => {
    expect(addDaysToDateInput('2026-01-01', 10)).toBe('2026-01-11');
  });

  it('should handle month rollover', () => {
    expect(addDaysToDateInput('2026-01-28', 5)).toBe('2026-02-02');
  });

  it('should handle year rollover', () => {
    expect(addDaysToDateInput('2025-12-30', 5)).toBe('2026-01-04');
  });

  it('should handle negative days (subtraction)', () => {
    expect(addDaysToDateInput('2026-01-15', -5)).toBe('2026-01-10');
  });

  it('should handle adding zero days', () => {
    expect(addDaysToDateInput('2026-03-15', 0)).toBe('2026-03-15');
  });

  it('should handle Date object input', () => {
    const date = new Date(2026, 0, 1);
    expect(addDaysToDateInput(date, 30)).toBe('2026-01-31');
  });

  it('should return empty string for invalid date input', () => {
    expect(addDaysToDateInput('not-a-date', 5)).toBe('');
  });

  it('should handle leap year', () => {
    expect(addDaysToDateInput('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('should handle non-leap year', () => {
    expect(addDaysToDateInput('2026-02-28', 1)).toBe('2026-03-01');
  });
});
