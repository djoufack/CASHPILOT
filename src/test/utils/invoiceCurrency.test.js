import { describe, it, expect } from 'vitest';
import { resolveInvoiceCurrency } from '@/utils/invoiceCurrency';

describe('resolveInvoiceCurrency', () => {
  it('returns EUR as ultimate fallback', () => {
    expect(resolveInvoiceCurrency(null)).toBe('EUR');
    expect(resolveInvoiceCurrency({})).toBe('EUR');
    expect(resolveInvoiceCurrency(undefined)).toBe('EUR');
  });

  it('resolves from invoice.currency', () => {
    expect(resolveInvoiceCurrency({ currency: 'USD' })).toBe('USD');
  });

  it('resolves from invoice.accounting_currency first', () => {
    expect(resolveInvoiceCurrency({ accounting_currency: 'GBP', currency: 'USD' })).toBe('GBP');
  });

  it('resolves from invoice.preferred_currency', () => {
    expect(resolveInvoiceCurrency({ preferred_currency: 'CHF' })).toBe('CHF');
  });

  it('resolves from related entity', () => {
    expect(resolveInvoiceCurrency({}, { currency: 'XOF' })).toBe('XOF');
  });

  it('resolves from nested client.preferred_currency', () => {
    expect(resolveInvoiceCurrency({ client: { preferred_currency: 'CAD' } })).toBe('CAD');
  });

  it('resolves from nested company.accounting_currency', () => {
    expect(resolveInvoiceCurrency({ company: { accounting_currency: 'XAF' } })).toBe('XAF');
  });

  it('normalizes to uppercase', () => {
    expect(resolveInvoiceCurrency({ currency: 'usd' })).toBe('USD');
  });

  it('rejects non-ISO codes', () => {
    expect(resolveInvoiceCurrency({ currency: 'euro' })).toBe('EUR');
    expect(resolveInvoiceCurrency({ currency: '12' })).toBe('EUR');
    expect(resolveInvoiceCurrency({ currency: '' })).toBe('EUR');
  });

  it('skips null candidates and picks first valid', () => {
    expect(resolveInvoiceCurrency(
      { accounting_currency: null, currency: null },
      { currency: 'JPY' }
    )).toBe('JPY');
  });

  it('handles multiple related entities', () => {
    expect(resolveInvoiceCurrency(
      {},
      { currency: null },
      { preferred_currency: 'SEK' }
    )).toBe('SEK');
  });
});
