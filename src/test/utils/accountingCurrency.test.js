import { describe, it, expect } from 'vitest';
import { resolveAccountingCurrency } from '@/utils/accountingCurrency';

describe('resolveAccountingCurrency', () => {
  it('returns EUR as default', () => {
    expect(resolveAccountingCurrency(null)).toBe('EUR');
    expect(resolveAccountingCurrency(undefined)).toBe('EUR');
    expect(resolveAccountingCurrency({})).toBe('EUR');
  });

  it('returns accounting_currency when present', () => {
    expect(resolveAccountingCurrency({ accounting_currency: 'XOF' })).toBe('XOF');
  });

  it('normalizes to uppercase and trims', () => {
    expect(resolveAccountingCurrency({ accounting_currency: '  usd  ' })).toBe('USD');
  });

  it('falls back to EUR for non-string currency', () => {
    expect(resolveAccountingCurrency({ accounting_currency: 123 })).toBe('EUR');
    expect(resolveAccountingCurrency({ accounting_currency: null })).toBe('EUR');
  });

  it('falls back to EUR for empty string', () => {
    expect(resolveAccountingCurrency({ accounting_currency: '   ' })).toBe('EUR');
  });
});
