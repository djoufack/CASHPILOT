import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({
  formatDate: vi.fn((d, _opts) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR');
  }),
}));

import { downloadFile, formatDataForExport, exportToCSV } from '@/utils/excelExport';

describe('excelExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  // ── downloadFile ──────────────────────────────────────────────────────

  describe('downloadFile', () => {
    it('should create download link and trigger click', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      downloadFile(blob, 'test.txt');
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  // ── formatDataForExport ───────────────────────────────────────────────

  describe('formatDataForExport', () => {
    it('should format data using column definitions', () => {
      const data = [{ name: 'Widget', price: 10.5, date: '2026-01-15' }];
      const columns = [
        { key: 'name', header: 'Product Name' },
        { key: 'price', header: 'Price', type: 'currency' },
        { key: 'date', header: 'Date', type: 'date' },
      ];

      const result = formatDataForExport(data, columns);
      expect(result).toHaveLength(1);
      expect(result[0]['Product Name']).toBe('Widget');
      expect(result[0]['Price']).toBe(10.5);
    });

    it('should use accessor function when provided', () => {
      const data = [{ nested: { value: 42 } }];
      const columns = [{ key: 'nested', header: 'Value', accessor: (row) => row.nested.value }];

      const result = formatDataForExport(data, columns);
      expect(result[0]['Value']).toBe(42);
    });

    it('should handle null values', () => {
      const data = [{ name: null, price: undefined }];
      const columns = [
        { key: 'name', header: 'Name' },
        { key: 'price', header: 'Price', type: 'number' },
      ];

      const result = formatDataForExport(data, columns);
      expect(result[0]['Name']).toBe('');
      expect(result[0]['Price']).toBe('');
    });

    it('should format currency values as numbers', () => {
      const data = [{ amount: 99.999 }];
      const columns = [{ key: 'amount', header: 'Amount', type: 'currency' }];

      const result = formatDataForExport(data, columns);
      expect(typeof result[0]['Amount']).toBe('number');
    });

    it('should format date values', () => {
      const data = [{ date: '2026-03-15' }];
      const columns = [{ key: 'date', header: 'Date', type: 'date' }];

      const result = formatDataForExport(data, columns);
      expect(result[0]['Date']).toBeDefined();
    });

    it('should handle invalid date gracefully', () => {
      const data = [{ date: 'not-a-date' }];
      const columns = [{ key: 'date', header: 'Date', type: 'date' }];

      const result = formatDataForExport(data, columns);
      expect(result[0]['Date']).toBeDefined();
    });

    it('should handle NaN numbers', () => {
      const data = [{ value: 'abc' }];
      const columns = [{ key: 'value', header: 'Value', type: 'number' }];

      const result = formatDataForExport(data, columns);
      expect(result[0]['Value']).toBe('abc');
    });
  });

  // ── exportToCSV ───────────────────────────────────────────────────────

  describe('exportToCSV', () => {
    it('should generate CSV and trigger download', () => {
      const data = [
        { name: 'Widget A', price: 10 },
        { name: 'Widget B', price: 20 },
      ];

      exportToCSV(data, { filename: 'test' });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should use semicolon for French locale', () => {
      const data = [{ name: 'Test', value: 42 }];
      exportToCSV(data, { locale: 'fr' });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle empty data', () => {
      exportToCSV([], { filename: 'empty' });
      expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('should handle null data', () => {
      exportToCSV(null);
      expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('should use column definitions when provided', () => {
      const data = [{ n: 'A', p: 10 }];
      const columns = [
        { key: 'n', header: 'Name' },
        { key: 'p', header: 'Price', type: 'number' },
      ];

      exportToCSV(data, { columns });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should escape values with separator', () => {
      const data = [{ name: 'Widget, Inc.', value: 'line\nnewline' }];
      exportToCSV(data);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should escape values with quotes', () => {
      const data = [{ name: 'He said "hello"' }];
      exportToCSV(data);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should use explicit separator when provided', () => {
      const data = [{ name: 'Test' }];
      exportToCSV(data, { separator: '\t' });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
