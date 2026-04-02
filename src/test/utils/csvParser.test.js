import { describe, it, expect } from 'vitest';
import {
  detectDelimiter,
  mapColumns,
  parseCSV,
  getCSVPreview,
} from '@/utils/csvParser';

// ============================================================================
// detectDelimiter
// ============================================================================
describe('detectDelimiter', () => {
  it('should detect semicolon delimiter', () => {
    expect(detectDelimiter('code;name;type\n101;Banque;asset')).toBe(';');
  });

  it('should detect comma delimiter', () => {
    expect(detectDelimiter('code,name,type\n101,Banque,asset')).toBe(',');
  });

  it('should detect tab delimiter', () => {
    expect(detectDelimiter('code\tname\ttype\n101\tBanque\tasset')).toBe('\t');
  });

  it('should default to semicolon when no delimiters found (semicolons >= others)', () => {
    // When all counts are 0, semicolons >= commas >= tabs, so semicolons win
    expect(detectDelimiter('single_column')).toBe(';');
  });

  it('should prefer semicolon when counts are equal', () => {
    // If semicolons >= commas and >= tabs, semicolons win
    expect(detectDelimiter('a;b,c')).toBe(';');
  });
});

// ============================================================================
// mapColumns
// ============================================================================
describe('mapColumns', () => {
  it('should map standard English column names', () => {
    const mapping = mapColumns(['account_code', 'account_name', 'account_type']);
    expect(mapping.account_code).toBe(0);
    expect(mapping.account_name).toBe(1);
    expect(mapping.account_type).toBe(2);
  });

  it('should map French column aliases', () => {
    const mapping = mapColumns(['code', 'nom', 'classe']);
    expect(mapping.account_code).toBe(0);
    expect(mapping.account_name).toBe(1);
    expect(mapping.account_type).toBe(2);
  });

  it('should map "numero" to account_code', () => {
    const mapping = mapColumns(['numero', 'libelle']);
    expect(mapping.account_code).toBe(0);
    expect(mapping.account_name).toBe(1);
  });

  it('should handle case-insensitive headers', () => {
    const mapping = mapColumns(['CODE', 'NOM', 'Type']);
    expect(mapping.account_code).toBe(0);
    expect(mapping.account_name).toBe(1);
    expect(mapping.account_type).toBe(2);
  });

  it('should handle missing columns', () => {
    const mapping = mapColumns(['foo', 'bar']);
    expect(mapping.account_code).toBeUndefined();
    expect(mapping.account_name).toBeUndefined();
  });

  it('should map parent_code and description', () => {
    const mapping = mapColumns(['code', 'nom', 'parent', 'commentaire']);
    expect(mapping.parent_code).toBe(2);
    expect(mapping.description).toBe(3);
  });
});

// ============================================================================
// parseCSV
// ============================================================================
describe('parseCSV', () => {
  it('should parse a valid CSV with semicolons', () => {
    const csv = 'code;nom;type\n101;Capital social;equity\n601;Achats;expense';
    const result = parseCSV(csv);
    expect(result.accounts).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.accounts[0].account_code).toBe('101');
    expect(result.accounts[0].account_name).toBe('Capital social');
    expect(result.accounts[0].account_type).toBe('equity');
  });

  it('should parse CSV with comma delimiter', () => {
    const csv = 'account_code,account_name,account_type\n101,Capital,equity';
    const result = parseCSV(csv);
    expect(result.accounts).toHaveLength(1);
    expect(result.delimiter).toBe(',');
  });

  it('should auto-detect account type from code when not provided', () => {
    const csv = 'code;nom\n601;Achats\n701;Ventes\n101;Capital\n211;Immobilisations';
    const result = parseCSV(csv);
    expect(result.accounts[0].account_type).toBe('expense');   // Class 6
    expect(result.accounts[1].account_type).toBe('revenue');   // Class 7
    expect(result.accounts[2].account_type).toBe('equity');    // Class 1
    expect(result.accounts[3].account_type).toBe('asset');     // Class 2
  });

  it('should return error for empty content', () => {
    const result = parseCSV('');
    expect(result.accounts).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('vide');
  });

  it('should return error for header-only CSV', () => {
    const result = parseCSV('code;nom');
    expect(result.accounts).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it('should return error when account_code column is missing', () => {
    const csv = 'foo;bar\n1;2';
    const result = parseCSV(csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('account_code');
  });

  it('should return error when account_name column is missing', () => {
    const csv = 'code;foo\n101;2';
    const result = parseCSV(csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('account_name');
  });

  it('should report error for rows with missing code', () => {
    const csv = 'code;nom\n;Achats\n601;Ventes';
    const result = parseCSV(csv);
    expect(result.accounts).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('manquant');
  });

  it('should report error for rows with missing name', () => {
    const csv = 'code;nom\n601;\n701;Ventes';
    const result = parseCSV(csv);
    expect(result.accounts).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  it('should strip BOM from content', () => {
    const csv = '\uFEFFcode;nom\n101;Capital';
    const result = parseCSV(csv);
    expect(result.accounts).toHaveLength(1);
  });

  it('should set is_active to true for all accounts', () => {
    const csv = 'code;nom\n101;Capital';
    const result = parseCSV(csv);
    expect(result.accounts[0].is_active).toBe(true);
  });
});

// ============================================================================
// getCSVPreview
// ============================================================================
describe('getCSVPreview', () => {
  it('should return preview with limited rows', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `${600 + i};Account ${i}`);
    const csv = `code;nom\n${lines.join('\n')}`;
    const preview = getCSVPreview(csv, 5);
    expect(preview.preview).toHaveLength(5);
    expect(preview.totalRows).toBe(20);
  });

  it('should include error count and first 5 errors', () => {
    const csv = 'code;nom\n;Missing1\n;Missing2\n;Missing3\n;Missing4\n;Missing5\n;Missing6';
    const preview = getCSVPreview(csv);
    expect(preview.errorCount).toBe(6);
    expect(preview.errors.length).toBeLessThanOrEqual(5);
  });

  it('should return delimiter info', () => {
    const csv = 'code;nom\n101;Capital';
    const preview = getCSVPreview(csv);
    expect(preview.delimiter).toBe(';');
  });

  it('should return headers', () => {
    const csv = 'code;nom\n101;Capital';
    const preview = getCSVPreview(csv);
    expect(preview.headers).toEqual(['code', 'nom']);
  });
});
