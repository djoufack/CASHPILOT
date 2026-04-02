import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  prepareForExport,
} from '@/utils/exportService';

// ============================================================================
// prepareForExport
// ============================================================================
describe('prepareForExport', () => {
  it('should flatten data using column definitions', () => {
    const items = [
      { id: 1, client: { name: 'Acme' }, total: 500 },
      { id: 2, client: { name: 'Beta' }, total: 300 },
    ];
    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'client', label: 'Client Name', accessor: (item) => item.client?.name },
      { key: 'total', label: 'Total' },
    ];

    const result = prepareForExport(items, columns);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ ID: 1, 'Client Name': 'Acme', Total: 500 });
    expect(result[1]).toEqual({ ID: 2, 'Client Name': 'Beta', Total: 300 });
  });

  it('should use column key as label if label is missing', () => {
    const items = [{ name: 'Test' }];
    const columns = [{ key: 'name' }];
    const result = prepareForExport(items, columns);
    expect(result[0]).toEqual({ name: 'Test' });
  });

  it('should replace null/undefined values with empty string', () => {
    const items = [{ name: null, age: undefined }];
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
    ];
    const result = prepareForExport(items, columns);
    expect(result[0]).toEqual({ Name: '', Age: '' });
  });

  it('should handle empty items array', () => {
    const result = prepareForExport([], [{ key: 'name', label: 'Name' }]);
    expect(result).toEqual([]);
  });

  it('should handle accessor functions', () => {
    const items = [{ nested: { deep: { value: 42 } } }];
    const columns = [
      { key: 'value', label: 'Deep Value', accessor: (item) => item.nested?.deep?.value },
    ];
    const result = prepareForExport(items, columns);
    expect(result[0]['Deep Value']).toBe(42);
  });
});

// ============================================================================
// exportToCSV (test CSV content generation without download)
// ============================================================================
describe('exportToCSV content generation', () => {
  // We can't test the download trigger in jsdom, but we can test the data flow
  // by testing prepareForExport which is the core data transformation

  it('should handle data with special CSV characters', () => {
    const items = [
      { name: 'Company, Inc.', description: 'Has "quotes"' },
    ];
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
    ];
    const result = prepareForExport(items, columns);
    expect(result[0].Name).toBe('Company, Inc.');
    expect(result[0].Description).toBe('Has "quotes"');
  });
});
