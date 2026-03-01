import { describe, expect, it } from 'vitest';
import {
  normalizePilotageRegion,
  resolvePilotageRegion,
} from '@/utils/pilotagePreferences';

describe('pilotagePreferences', () => {
  it('normalizes direct region aliases and OHADA member countries', () => {
    expect(normalizePilotageRegion('FR')).toBe('france');
    expect(normalizePilotageRegion('BE')).toBe('belgium');
    expect(normalizePilotageRegion('OHADA')).toBe('ohada');
    expect(normalizePilotageRegion('CM')).toBe('ohada');
  });

  it('prefers accounting settings country over company country and fallback', () => {
    expect(
      resolvePilotageRegion({
        accountingCountry: 'BE',
        companyCountry: 'FR',
        fallback: 'ohada',
      })
    ).toEqual({
      region: 'belgium',
      source: 'accounting-settings',
    });
  });

  it('falls back to company country or explicit fallback when accounting settings are absent', () => {
    expect(
      resolvePilotageRegion({
        companyCountry: 'FR',
        fallback: 'ohada',
      })
    ).toEqual({
      region: 'france',
      source: 'company',
    });

    expect(
      resolvePilotageRegion({
        fallback: 'OHADA',
      })
    ).toEqual({
      region: 'ohada',
      source: 'fallback',
    });
  });
});
