import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validateTimeFormat,
  validateDateRange,
  validateInvoiceItems,
  validateTimeRange,
} from '@/utils/validation';

// ============================================================================
// validateEmail
// ============================================================================
describe('validateEmail', () => {
  it('should accept a valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('should accept email with subdomain', () => {
    expect(validateEmail('user@mail.example.com')).toBe(true);
  });

  it('should accept email with plus sign', () => {
    expect(validateEmail('user+tag@example.com')).toBe(true);
  });

  it('should accept email with dots in local part', () => {
    expect(validateEmail('first.last@example.com')).toBe(true);
  });

  it('should reject email without @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('should reject email without domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('should reject email without local part', () => {
    expect(validateEmail('@example.com')).toBe(false);
  });

  it('should reject email with spaces', () => {
    expect(validateEmail('user @example.com')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(validateEmail('')).toBe(false);
  });

  it('should reject email without TLD', () => {
    expect(validateEmail('user@example')).toBe(false);
  });
});

// ============================================================================
// validateTimeFormat
// ============================================================================
describe('validateTimeFormat', () => {
  it('should accept valid time 09:00', () => {
    expect(validateTimeFormat('09:00')).toBe(true);
  });

  it('should accept midnight 00:00', () => {
    expect(validateTimeFormat('00:00')).toBe(true);
  });

  it('should accept 23:59', () => {
    expect(validateTimeFormat('23:59')).toBe(true);
  });

  it('should accept single digit hour 9:00', () => {
    expect(validateTimeFormat('9:00')).toBe(true);
  });

  it('should reject hour 24:00', () => {
    expect(validateTimeFormat('24:00')).toBe(false);
  });

  it('should reject minutes 60', () => {
    expect(validateTimeFormat('12:60')).toBe(false);
  });

  it('should reject invalid format without colon', () => {
    expect(validateTimeFormat('1200')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(validateTimeFormat('')).toBe(false);
  });

  it('should reject alphabetic input', () => {
    expect(validateTimeFormat('ab:cd')).toBe(false);
  });

  it('should reject time with seconds', () => {
    expect(validateTimeFormat('12:00:00')).toBe(false);
  });
});

// ============================================================================
// validateDateRange
// ============================================================================
describe('validateDateRange', () => {
  it('should accept valid date range', () => {
    expect(validateDateRange('2024-01-01', '2024-12-31')).toBe(true);
  });

  it('should accept same start and end date', () => {
    expect(validateDateRange('2024-06-15', '2024-06-15')).toBe(true);
  });

  it('should reject end date before start date', () => {
    expect(validateDateRange('2024-12-31', '2024-01-01')).toBe(false);
  });

  it('should reject null start date', () => {
    expect(validateDateRange(null, '2024-12-31')).toBe(false);
  });

  it('should reject null end date', () => {
    expect(validateDateRange('2024-01-01', null)).toBe(false);
  });

  it('should reject empty strings', () => {
    expect(validateDateRange('', '')).toBe(false);
  });

  it('should accept dates across years', () => {
    expect(validateDateRange('2023-12-01', '2024-01-31')).toBe(true);
  });
});

// ============================================================================
// validateInvoiceItems
// ============================================================================
describe('validateInvoiceItems', () => {
  it('should accept valid items', () => {
    const items = [
      { description: 'Service A', quantity: 2, unitPrice: 100 },
      { description: 'Service B', quantity: 1, unitPrice: 50 },
    ];
    const result = validateInvoiceItems(items);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject empty items array', () => {
    const result = validateInvoiceItems([]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one item is required');
  });

  it('should reject null items', () => {
    const result = validateInvoiceItems(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one item is required');
  });

  it('should reject undefined items', () => {
    const result = validateInvoiceItems(undefined);
    expect(result.valid).toBe(false);
  });

  it('should reject item without description', () => {
    const items = [{ quantity: 1, unitPrice: 100 }];
    const result = validateInvoiceItems(items);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Item 1: Description is required');
  });

  it('should reject item with empty description', () => {
    const items = [{ description: '   ', quantity: 1, unitPrice: 100 }];
    const result = validateInvoiceItems(items);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Item 1: Description is required');
  });

  it('should reject item with zero quantity', () => {
    const items = [{ description: 'Test', quantity: 0, unitPrice: 100 }];
    const result = validateInvoiceItems(items);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Item 1: Quantity must be greater than 0');
  });

  it('should reject item with negative quantity', () => {
    const items = [{ description: 'Test', quantity: -1, unitPrice: 100 }];
    const result = validateInvoiceItems(items);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Item 1: Quantity must be greater than 0');
  });

  it('should reject item with zero unit price', () => {
    const items = [{ description: 'Test', quantity: 1, unitPrice: 0 }];
    const result = validateInvoiceItems(items);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Item 1: Unit price must be greater than 0');
  });

  it('should reject item with negative unit price', () => {
    const items = [{ description: 'Test', quantity: 1, unitPrice: -50 }];
    const result = validateInvoiceItems(items);
    expect(result.valid).toBe(false);
  });

  it('should collect multiple errors for multiple invalid items', () => {
    const items = [
      { quantity: 0 },
      { description: 'Valid', quantity: 1, unitPrice: 100 },
      { description: '', quantity: -1, unitPrice: 0 },
    ];
    const result = validateInvoiceItems(items);
    expect(result.valid).toBe(false);
    // Item 1: missing description, zero quantity, missing unit price
    // Item 3: empty description, negative quantity, zero price
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('should report correct item numbers in error messages', () => {
    const items = [
      { description: 'OK', quantity: 1, unitPrice: 100 },
      { quantity: 1, unitPrice: 100 },
    ];
    const result = validateInvoiceItems(items);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Item 2: Description is required');
  });
});

// ============================================================================
// validateTimeRange
// ============================================================================
describe('validateTimeRange', () => {
  it('should accept end time after start time', () => {
    expect(validateTimeRange('09:00', '17:00')).toBe(true);
  });

  it('should accept overnight shifts (end before start)', () => {
    // The implementation allows overnight shifts by always returning true
    expect(validateTimeRange('22:00', '06:00')).toBe(true);
  });

  it('should accept same start and end time', () => {
    expect(validateTimeRange('12:00', '12:00')).toBe(true);
  });

  it('should reject invalid start time format', () => {
    expect(validateTimeRange('25:00', '17:00')).toBe(false);
  });

  it('should reject invalid end time format', () => {
    expect(validateTimeRange('09:00', '99:99')).toBe(false);
  });

  it('should reject non-time strings', () => {
    expect(validateTimeRange('abc', 'def')).toBe(false);
  });

  it('should reject empty strings', () => {
    expect(validateTimeRange('', '')).toBe(false);
  });
});
