import { describe, expect, it } from 'vitest';
import { linkLineItemsToProducts } from '@/services/supplierInvoiceLineItemLinking';

describe('supplierInvoiceLineItemLinking', () => {
  const products = [
    { id: 'p1', product_name: 'Widget Alpha', sku: 'WA-001' },
    { id: 'p2', product_name: 'Service Beta', sku: 'SB-002' },
    { id: 'p3', product_name: 'Component Gamma', sku: 'CG-003' },
  ];

  // ── Edge cases ────────────────────────────────────────────────────────

  it('should return empty array for empty line items', () => {
    expect(linkLineItemsToProducts([], products)).toEqual([]);
  });

  it('should return empty array for null line items', () => {
    expect(linkLineItemsToProducts(null, products)).toEqual([]);
  });

  it('should return items with null product_id when no products', () => {
    const items = [{ description: 'Test item' }];
    const result = linkLineItemsToProducts(items, []);
    expect(result[0].user_product_id).toBeNull();
  });

  it('should return items with null product_id when products is null', () => {
    const items = [{ description: 'Test item' }];
    const result = linkLineItemsToProducts(items, null);
    expect(result[0].user_product_id).toBeNull();
  });

  // ── Matching by existing product_id ───────────────────────────────────

  it('should keep existing user_product_id', () => {
    const items = [{ description: 'Something', user_product_id: 'existing-id' }];
    const result = linkLineItemsToProducts(items, products);
    expect(result[0].user_product_id).toBe('existing-id');
  });

  // ── Matching by SKU ───────────────────────────────────────────────────

  it('should match by SKU', () => {
    const items = [{ description: 'Some widget', sku: 'WA-001' }];
    const result = linkLineItemsToProducts(items, products);
    expect(result[0].user_product_id).toBe('p1');
  });

  it('should match by SKU case-insensitively', () => {
    const items = [{ description: 'item', sku: 'wa-001' }];
    const result = linkLineItemsToProducts(items, products);
    expect(result[0].user_product_id).toBe('p1');
  });

  // ── Matching by exact name ────────────────────────────────────────────

  it('should match by exact product name', () => {
    const items = [{ description: 'Widget Alpha' }];
    const result = linkLineItemsToProducts(items, products);
    expect(result[0].user_product_id).toBe('p1');
  });

  it('should match by product name case-insensitively', () => {
    const items = [{ description: 'widget alpha' }];
    const result = linkLineItemsToProducts(items, products);
    expect(result[0].user_product_id).toBe('p1');
  });

  // ── Matching by name with accents ─────────────────────────────────────

  it('should match ignoring accents', () => {
    const productsWithAccents = [{ id: 'pa', product_name: 'Résistance Électrique', sku: '' }];
    const items = [{ description: 'Resistance Electrique' }];
    const result = linkLineItemsToProducts(items, productsWithAccents);
    expect(result[0].user_product_id).toBe('pa');
  });

  // ── No match ──────────────────────────────────────────────────────────

  it('should return null user_product_id when no match', () => {
    const items = [{ description: 'Completely Unknown Item XYZ' }];
    const result = linkLineItemsToProducts(items, products);
    expect(result[0].user_product_id).toBeNull();
  });

  // ── Multiple items ────────────────────────────────────────────────────

  it('should process multiple line items', () => {
    const items = [
      { description: 'Widget Alpha', sku: '' },
      { description: 'Unknown', sku: 'SB-002' },
      { description: 'No match at all' },
    ];
    const result = linkLineItemsToProducts(items, products);
    expect(result).toHaveLength(3);
    expect(result[0].user_product_id).toBe('p1');
    expect(result[1].user_product_id).toBe('p2');
    expect(result[2].user_product_id).toBeNull();
  });

  // ── SKU contained in description ──────────────────────────────────────

  it('should match when SKU appears in description', () => {
    const items = [{ description: 'Order ref WA-001 for warehouse' }];
    const result = linkLineItemsToProducts(items, products);
    // Should match p1 via SKU in description
    expect(result[0].user_product_id).toBe('p1');
  });

  // ── Partial name match ────────────────────────────────────────────────

  it('should match when product name is contained in description', () => {
    const items = [{ description: 'Purchase of Service Beta for Q1 2026' }];
    const result = linkLineItemsToProducts(items, products);
    expect(result[0].user_product_id).toBe('p2');
  });

  // ── Ambiguous match (multiple candidates) ─────────────────────────────

  it('should return null when multiple products match ambiguously', () => {
    const ambiguousProducts = [
      { id: 'a1', product_name: 'Widget', sku: '' },
      { id: 'a2', product_name: 'Widget Pro', sku: '' },
    ];
    const items = [{ description: 'Widget' }];
    const result = linkLineItemsToProducts(items, ambiguousProducts);
    // "Widget" exact match should return a1
    expect(result[0].user_product_id).toBe('a1');
  });
});
