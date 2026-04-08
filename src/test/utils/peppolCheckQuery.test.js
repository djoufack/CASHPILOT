import { describe, expect, it } from 'vitest';
import { detectModeFromQuery, resolvePeppolCheckPayload } from '@/utils/peppolCheckQuery';

describe('peppolCheckQuery.detectModeFromQuery', () => {
  it('detects peppol id query', () => {
    expect(detectModeFromQuery('0208:0123456789')).toBe('peppol_id');
  });

  it('detects vat query', () => {
    expect(detectModeFromQuery('BE 0899.793.180')).toBe('vat_number');
  });

  it('detects company name query', () => {
    expect(detectModeFromQuery('HM IMAGIN')).toBe('company_name');
  });
});

describe('peppolCheckQuery.resolvePeppolCheckPayload', () => {
  it('resolves peppol id from string with prefix', () => {
    expect(resolvePeppolCheckPayload('id:0208:0123456789')).toEqual({
      query_type: 'peppol_id',
      peppol_id: '0208:0123456789',
      query: '0208:0123456789',
    });
  });

  it('resolves vat number from string', () => {
    expect(resolvePeppolCheckPayload('BE 0899.793.180')).toEqual({
      query_type: 'vat_number',
      vat_number: 'BE 0899.793.180',
      query: 'BE 0899.793.180',
    });
  });

  it('resolves company name from object input', () => {
    expect(
      resolvePeppolCheckPayload({
        company_name: 'HM IMAGIN',
        country: 'be',
      })
    ).toEqual({
      query_type: 'company_name',
      company_name: 'HM IMAGIN',
      query: 'HM IMAGIN',
      country: 'BE',
    });
  });

  it('returns null for empty values', () => {
    expect(resolvePeppolCheckPayload('   ')).toBeNull();
    expect(resolvePeppolCheckPayload({})).toBeNull();
  });
});
