import { describe, it, expect, vi } from 'vitest';

// Mock dateLocale to avoid import issues
vi.mock('@/utils/dateLocale', () => ({
  formatDate: vi.fn((date, options) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('fr-FR', options);
  }),
}));

import { formatDataForExport } from '@/utils/excelExport';

// ============================================================================
// formatDataForExport
// ============================================================================
describe('formatDataForExport', () => {
  it('should format data using column definitions', () => {
    const data = [
      { id: 1, name: 'Item A', price: 100 },
      { id: 2, name: 'Item B', price: 200 },
    ];
    const columns = [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Product Name' },
      { key: 'price', header: 'Price', type: 'currency' },
    ];

    const result = formatDataForExport(data, columns);
    expect(result).toHaveLength(2);
    expect(result[0]['ID']).toBe(1);
    expect(result[0]['Product Name']).toBe('Item A');
    expect(result[0]['Price']).toBe(100);
  });

  it('should format currency/number types by rounding', () => {
    const data = [{ amount: 99.999 }];
    const columns = [{ key: 'amount', header: 'Amount', type: 'currency' }];
    const result = formatDataForExport(data, columns);
    expect(result[0]['Amount']).toBe(100); // Math.round(99.999 * 100) / 100
  });

  it('should format number types correctly', () => {
    const data = [{ qty: 5.5 }];
    const columns = [{ key: 'qty', header: 'Quantity', type: 'number' }];
    const result = formatDataForExport(data, columns);
    expect(result[0]['Quantity']).toBe(5.5);
  });

  it('should format date types', () => {
    const data = [{ created: '2026-01-15' }];
    const columns = [{ key: 'created', header: 'Created Date', type: 'date' }];
    const result = formatDataForExport(data, columns);
    expect(result[0]['Created Date']).toBeTruthy();
    // Should be some formatted date string
    expect(typeof result[0]['Created Date']).toBe('string');
  });

  it('should use accessor function when provided', () => {
    const data = [
      { client: { name: 'Acme Corp' } },
    ];
    const columns = [
      { key: 'client', header: 'Client Name', accessor: (row) => row.client?.name },
    ];
    const result = formatDataForExport(data, columns);
    expect(result[0]['Client Name']).toBe('Acme Corp');
  });

  it('should handle null/undefined values as empty string', () => {
    const data = [{ name: null, age: undefined }];
    const columns = [
      { key: 'name', header: 'Name' },
      { key: 'age', header: 'Age' },
    ];
    const result = formatDataForExport(data, columns);
    expect(result[0]['Name']).toBe('');
    expect(result[0]['Age']).toBe('');
  });

  it('should handle empty data array', () => {
    const columns = [{ key: 'name', header: 'Name' }];
    const result = formatDataForExport([], columns);
    expect(result).toEqual([]);
  });

  it('should handle non-numeric value for currency type', () => {
    const data = [{ price: 'N/A' }];
    const columns = [{ key: 'price', header: 'Price', type: 'currency' }];
    const result = formatDataForExport(data, columns);
    expect(result[0]['Price']).toBe('N/A');
  });

  it('should handle invalid date gracefully', () => {
    const data = [{ date: 'not-a-date' }];
    const columns = [{ key: 'date', header: 'Date', type: 'date' }];
    const result = formatDataForExport(data, columns);
    expect(result[0]['Date']).toBe('not-a-date');
  });

  it('should pass through default type values unchanged', () => {
    const data = [{ note: 'Hello world' }];
    const columns = [{ key: 'note', header: 'Note' }];
    const result = formatDataForExport(data, columns);
    expect(result[0]['Note']).toBe('Hello world');
  });
});
