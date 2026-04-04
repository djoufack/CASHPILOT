import { describe, expect, it } from 'vitest';
import { addDaysToDateInput, formatDateInput, formatStartOfYearInput } from '@/utils/dateFormatting';

describe('dateFormatting utilities', () => {
  it('formats Date instances and YYYY-MM-DD strings', () => {
    expect(formatDateInput(new Date(2026, 3, 4))).toBe('2026-04-04');
    expect(formatDateInput('2026-12-09')).toBe('2026-12-09');
  });

  it('returns empty string for invalid values', () => {
    expect(formatDateInput('not-a-date')).toBe('');
    expect(formatStartOfYearInput('bad')).toBe('');
    expect(addDaysToDateInput('bad', 1)).toBe('');
  });

  it('computes start of year from date input', () => {
    expect(formatStartOfYearInput(new Date(2026, 8, 22))).toBe('2026-01-01');
    expect(formatStartOfYearInput('2028-03-10')).toBe('2028-01-01');
  });

  it('adds day offsets and handles month rollover', () => {
    expect(addDaysToDateInput('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysToDateInput('2026-03-01', -1)).toBe('2026-02-28');
  });
});
