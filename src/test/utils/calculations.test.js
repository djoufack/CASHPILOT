import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateDuration,
  durationToHours,
  calculateInvoiceTotal,
  formatCurrency,
  calculateItemDiscount,
  calculateInvoiceTotalWithDiscount,
  calculateBalanceDue,
  allocateLumpSumPayment,
  getPaymentStatus,
  generateInvoiceNumber,
} from '@/utils/calculations';

// ============================================================================
// calculateDuration
// ============================================================================
describe('calculateDuration', () => {
  it('should calculate duration between two times', () => {
    expect(calculateDuration('09:00', '17:00')).toBe('8:00');
  });

  it('should handle minutes correctly', () => {
    expect(calculateDuration('09:15', '17:45')).toBe('8:30');
  });

  it('should return 0:00 for same start and end', () => {
    expect(calculateDuration('12:00', '12:00')).toBe('0:00');
  });

  it('should handle overnight shifts', () => {
    expect(calculateDuration('22:00', '06:00')).toBe('8:00');
  });

  it('should return 0:00 when startTime is empty', () => {
    expect(calculateDuration('', '17:00')).toBe('0:00');
  });

  it('should return 0:00 when endTime is empty', () => {
    expect(calculateDuration('09:00', '')).toBe('0:00');
  });

  it('should return 0:00 when both are null', () => {
    expect(calculateDuration(null, null)).toBe('0:00');
  });

  it('should handle short durations', () => {
    expect(calculateDuration('14:00', '14:30')).toBe('0:30');
  });

  it('should handle full 24-hour duration (overnight wrapping to same time)', () => {
    // 23:00 to 23:00 overnight = 24:00 (but same time = 0:00)
    expect(calculateDuration('23:00', '23:00')).toBe('0:00');
  });
});

// ============================================================================
// durationToHours
// ============================================================================
describe('durationToHours', () => {
  it('should convert whole hours', () => {
    expect(durationToHours('8:00')).toBe(8);
  });

  it('should convert hours with minutes', () => {
    expect(durationToHours('8:30')).toBe(8.5);
  });

  it('should convert minutes only', () => {
    expect(durationToHours('0:45')).toBe(0.75);
  });

  it('should return 0 for empty input', () => {
    expect(durationToHours('')).toBe(0);
  });

  it('should return 0 for null input', () => {
    expect(durationToHours(null)).toBe(0);
  });

  it('should return 0 for undefined input', () => {
    expect(durationToHours(undefined)).toBe(0);
  });
});

// ============================================================================
// calculateInvoiceTotal
// ============================================================================
describe('calculateInvoiceTotal', () => {
  it('should calculate subtotal, tax and total', () => {
    const items = [
      { amount: 100 },
      { amount: 200 },
      { amount: 50 },
    ];
    const result = calculateInvoiceTotal(items, 0.20);
    expect(result.subtotal).toBe(350);
    expect(result.taxAmount).toBe(70);
    expect(result.total).toBe(420);
  });

  it('should handle zero tax rate', () => {
    const items = [{ amount: 100 }];
    const result = calculateInvoiceTotal(items, 0);
    expect(result.subtotal).toBe(100);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(100);
  });

  it('should handle empty items array', () => {
    const result = calculateInvoiceTotal([], 0.20);
    expect(result.subtotal).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should handle items with missing amount', () => {
    const items = [{ amount: 100 }, { description: 'no amount' }];
    const result = calculateInvoiceTotal(items, 0.20);
    expect(result.subtotal).toBe(100);
    expect(result.taxAmount).toBe(20);
    expect(result.total).toBe(120);
  });

  it('should round to 2 decimal places', () => {
    const items = [{ amount: 33.33 }, { amount: 33.33 }, { amount: 33.34 }];
    const result = calculateInvoiceTotal(items, 0.20);
    expect(result.subtotal).toBe(100);
    expect(result.taxAmount).toBe(20);
    expect(result.total).toBe(120);
  });

  it('should handle French TVA rate 5.5%', () => {
    const items = [{ amount: 200 }];
    const result = calculateInvoiceTotal(items, 0.055);
    expect(result.subtotal).toBe(200);
    expect(result.taxAmount).toBe(11);
    expect(result.total).toBe(211);
  });
});

// ============================================================================
// formatCurrency
// ============================================================================
describe('formatCurrency', () => {
  it('should format EUR correctly (amount followed by symbol)', () => {
    expect(formatCurrency(100, 'EUR')).toBe('100.00 €');
  });

  it('should format USD correctly (symbol before amount)', () => {
    expect(formatCurrency(100, 'USD')).toBe('$100.00');
  });

  it('should format GBP correctly', () => {
    expect(formatCurrency(100, 'GBP')).toBe('100.00 £');
  });

  it('should default to EUR', () => {
    expect(formatCurrency(100)).toBe('100.00 €');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0, 'EUR')).toBe('0.00 €');
  });

  it('should handle decimal amounts', () => {
    expect(formatCurrency(99.99, 'EUR')).toBe('99.99 €');
  });

  it('should handle unknown currency code', () => {
    expect(formatCurrency(100, 'CHF')).toBe('100.00 CHF');
  });

  it('should handle negative amounts', () => {
    expect(formatCurrency(-50, 'EUR')).toBe('-50.00 €');
  });
});

// ============================================================================
// calculateItemDiscount
// ============================================================================
describe('calculateItemDiscount', () => {
  it('should return 0 for no discount type', () => {
    const item = { quantity: 2, unitPrice: 100 };
    expect(calculateItemDiscount(item)).toBe(0);
  });

  it('should return 0 for discount type "none"', () => {
    const item = { quantity: 2, unitPrice: 100, discount_type: 'none', discount_value: 10 };
    expect(calculateItemDiscount(item)).toBe(0);
  });

  it('should return 0 when discount_value is 0', () => {
    const item = { quantity: 2, unitPrice: 100, discount_type: 'percentage', discount_value: 0 };
    expect(calculateItemDiscount(item)).toBe(0);
  });

  it('should calculate percentage discount', () => {
    const item = { quantity: 2, unitPrice: 100, discount_type: 'percentage', discount_value: 10 };
    // lineTotal = 200, 10% = 20
    expect(calculateItemDiscount(item)).toBe(20);
  });

  it('should calculate fixed discount', () => {
    const item = { quantity: 2, unitPrice: 100, discount_type: 'fixed', discount_value: 15 };
    expect(calculateItemDiscount(item)).toBe(15);
  });

  it('should handle unit_price field name', () => {
    const item = { quantity: 3, unit_price: 50, discount_type: 'percentage', discount_value: 20 };
    // lineTotal = 150, 20% = 30
    expect(calculateItemDiscount(item)).toBe(30);
  });
});

// ============================================================================
// calculateInvoiceTotalWithDiscount
// ============================================================================
describe('calculateInvoiceTotalWithDiscount', () => {
  it('should calculate totals without discounts', () => {
    const items = [
      { quantity: 2, unitPrice: 100 },
      { quantity: 1, unitPrice: 50 },
    ];
    const result = calculateInvoiceTotalWithDiscount(items, 0.20);
    expect(result.subtotal).toBe(250);
    expect(result.totalItemDiscounts).toBe(0);
    expect(result.subtotalAfterItemDiscounts).toBe(250);
    expect(result.globalDiscountAmount).toBe(0);
    expect(result.totalHT).toBe(250);
    expect(result.taxAmount).toBe(50);
    expect(result.totalTTC).toBe(300);
  });

  it('should apply item percentage discount', () => {
    const items = [
      { quantity: 2, unitPrice: 100, discount_type: 'percentage', discount_value: 10 },
    ];
    const result = calculateInvoiceTotalWithDiscount(items, 0.20);
    expect(result.subtotal).toBe(200);
    expect(result.totalItemDiscounts).toBe(20);
    expect(result.subtotalAfterItemDiscounts).toBe(180);
    expect(result.totalHT).toBe(180);
    expect(result.taxAmount).toBe(36);
    expect(result.totalTTC).toBe(216);
  });

  it('should apply global percentage discount', () => {
    const items = [
      { quantity: 1, unitPrice: 100 },
    ];
    const globalDiscount = { type: 'percentage', value: 10 };
    const result = calculateInvoiceTotalWithDiscount(items, 0.20, globalDiscount);
    expect(result.subtotal).toBe(100);
    expect(result.globalDiscountAmount).toBe(10);
    expect(result.totalHT).toBe(90);
    expect(result.taxAmount).toBe(18);
    expect(result.totalTTC).toBe(108);
  });

  it('should apply global fixed discount', () => {
    const items = [
      { quantity: 1, unitPrice: 200 },
    ];
    const globalDiscount = { type: 'fixed', value: 25 };
    const result = calculateInvoiceTotalWithDiscount(items, 0.20, globalDiscount);
    expect(result.globalDiscountAmount).toBe(25);
    expect(result.totalHT).toBe(175);
  });

  it('should combine item and global discounts', () => {
    const items = [
      { quantity: 2, unitPrice: 100, discount_type: 'fixed', discount_value: 10 },
    ];
    const globalDiscount = { type: 'percentage', value: 5 };
    const result = calculateInvoiceTotalWithDiscount(items, 0.20, globalDiscount);
    // subtotal = 200, itemDiscount = 10, afterItem = 190, globalDiscount = 190*5% = 9.5
    expect(result.subtotal).toBe(200);
    expect(result.totalItemDiscounts).toBe(10);
    expect(result.subtotalAfterItemDiscounts).toBe(190);
    expect(result.globalDiscountAmount).toBe(9.5);
    expect(result.totalHT).toBe(180.5);
  });

  it('should handle empty items', () => {
    const result = calculateInvoiceTotalWithDiscount([], 0.20);
    expect(result.subtotal).toBe(0);
    expect(result.totalTTC).toBe(0);
  });
});

// ============================================================================
// calculateBalanceDue
// ============================================================================
describe('calculateBalanceDue', () => {
  it('should calculate remaining balance', () => {
    expect(calculateBalanceDue(1000, 400)).toBe(600);
  });

  it('should return full amount when nothing paid', () => {
    expect(calculateBalanceDue(500, 0)).toBe(500);
  });

  it('should return 0 when fully paid', () => {
    expect(calculateBalanceDue(300, 300)).toBe(0);
  });

  it('should return negative when overpaid', () => {
    expect(calculateBalanceDue(100, 150)).toBe(-50);
  });

  it('should handle null amountPaid', () => {
    expect(calculateBalanceDue(200, null)).toBe(200);
  });

  it('should handle string inputs', () => {
    expect(calculateBalanceDue('500', '200')).toBe(300);
  });
});

// ============================================================================
// allocateLumpSumPayment
// ============================================================================
describe('allocateLumpSumPayment', () => {
  it('should allocate payment to oldest invoice first', () => {
    const invoices = [
      { id: 'inv-2', balance_due: 200, date: '2024-02-01' },
      { id: 'inv-1', balance_due: 100, date: '2024-01-01' },
    ];
    const result = allocateLumpSumPayment(250, invoices);
    // Sorted by date: inv-1 first, then inv-2
    expect(result).toEqual([
      { invoiceId: 'inv-1', allocatedAmount: 100 },
      { invoiceId: 'inv-2', allocatedAmount: 150 },
    ]);
  });

  it('should stop when payment is fully allocated', () => {
    const invoices = [
      { id: 'inv-1', balance_due: 100, date: '2024-01-01' },
      { id: 'inv-2', balance_due: 200, date: '2024-02-01' },
      { id: 'inv-3', balance_due: 300, date: '2024-03-01' },
    ];
    const result = allocateLumpSumPayment(150, invoices);
    expect(result).toEqual([
      { invoiceId: 'inv-1', allocatedAmount: 100 },
      { invoiceId: 'inv-2', allocatedAmount: 50 },
    ]);
  });

  it('should handle empty invoices', () => {
    expect(allocateLumpSumPayment(100, [])).toEqual([]);
  });

  it('should handle zero payment amount', () => {
    const invoices = [{ id: 'inv-1', balance_due: 100, date: '2024-01-01' }];
    expect(allocateLumpSumPayment(0, invoices)).toEqual([]);
  });

  it('should skip invoices with zero balance', () => {
    const invoices = [
      { id: 'inv-1', balance_due: 0, date: '2024-01-01' },
      { id: 'inv-2', balance_due: 100, date: '2024-02-01' },
    ];
    const result = allocateLumpSumPayment(100, invoices);
    expect(result).toEqual([
      { invoiceId: 'inv-2', allocatedAmount: 100 },
    ]);
  });

  it('should handle total_ttc as fallback', () => {
    const invoices = [
      { id: 'inv-1', total_ttc: 50, date: '2024-01-01' },
    ];
    const result = allocateLumpSumPayment(30, invoices);
    expect(result).toEqual([
      { invoiceId: 'inv-1', allocatedAmount: 30 },
    ]);
  });
});

// ============================================================================
// getPaymentStatus
// ============================================================================
describe('getPaymentStatus', () => {
  it('should return "unpaid" when nothing paid', () => {
    expect(getPaymentStatus(100, 0)).toBe('unpaid');
  });

  it('should return "partial" for partial payment', () => {
    expect(getPaymentStatus(100, 50)).toBe('partial');
  });

  it('should return "paid" when fully paid', () => {
    expect(getPaymentStatus(100, 100)).toBe('paid');
  });

  it('should return "overpaid" when paid more than total', () => {
    expect(getPaymentStatus(100, 150)).toBe('overpaid');
  });

  it('should return "unpaid" when amountPaid is null', () => {
    expect(getPaymentStatus(100, null)).toBe('unpaid');
  });

  it('should return "unpaid" when amountPaid is negative', () => {
    expect(getPaymentStatus(100, -10)).toBe('unpaid');
  });
});

// ============================================================================
// generateInvoiceNumber
// ============================================================================
describe('generateInvoiceNumber', () => {
  beforeEach(() => {
    // Mock localStorage
    const store = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      store[key] = value;
    });
  });

  it('should generate invoice number with correct format', () => {
    Storage.prototype.getItem.mockReturnValue('[]');
    const result = generateInvoiceNumber();
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    expect(result).toBe(`INV-${year}-${month}-001`);
  });

  it('should increment sequence when existing invoices exist', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    Storage.prototype.getItem.mockReturnValue(
      JSON.stringify([
        { invoiceNumber: `INV-${year}-${month}-001` },
        { invoiceNumber: `INV-${year}-${month}-002` },
      ])
    );
    const result = generateInvoiceNumber();
    expect(result).toBe(`INV-${year}-${month}-003`);
  });
});
