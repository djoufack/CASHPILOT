import { describe, expect, it } from 'vitest';
import {
  isGenericServiceName,
  validateInvoiceCatalogConsistency,
  validateServiceCatalogPayload,
} from '@/utils/serviceCatalogQuality';

describe('serviceCatalogQuality', () => {
  it('detects generic service names', () => {
    expect(isGenericServiceName('Service 1')).toBe(true);
    expect(isGenericServiceName('Prestation')).toBe(true);
    expect(isGenericServiceName('Support infra mensuel')).toBe(false);
  });

  it('validates a correct client service payload', () => {
    const result = validateServiceCatalogPayload({
      service_name: 'Support infra mensuel',
      pricing_type: 'hourly',
      hourly_rate: 120,
      unit: 'heure',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects generic or incomplete supplier service payloads', () => {
    const result = validateServiceCatalogPayload(
      {
        service_name: 'Service 2',
        pricing_type: 'fixed',
        fixed_price: 0,
      },
      { context: 'supplier' }
    );

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects invoice service lines without catalog link', () => {
    const result = validateInvoiceCatalogConsistency([
      {
        item_type: 'service',
        description: 'Intervention',
        quantity: 1,
        unit_price: 500,
      },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Ligne 1');
  });

  it('rejects product lines without product link', () => {
    const result = validateInvoiceCatalogConsistency([
      {
        item_type: 'product',
        description: 'Produit',
        quantity: 1,
        unit_price: 100,
      },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('produit');
  });
});

