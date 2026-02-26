
import React from "react";

/**
 * Calculate duration between start and end time
 * @param {string} startTime - Start time in HH:mm format
 * @param {string} endTime - End time in HH:mm format
 * @returns {string} Duration in H:mm format
 */
export const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return '0:00';
  
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  let diffMinutes = endMinutes - startMinutes;
  
  // Handle overnight shifts
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }
  
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * Convert duration string to decimal hours
 * @param {string} duration - Duration in H:mm format
 * @returns {number} Duration in decimal hours
 */
export const durationToHours = (duration) => {
  if (!duration) return 0;
  const [hours, minutes] = duration.split(':').map(Number);
  return hours + (minutes / 60);
};

/**
 * Format a number with thousand separators (fr-FR locale)
 * @param {number} amount - Number to format
 * @param {number} decimals - Decimal places (default 2)
 * @returns {string} Formatted number (e.g., "4 471 875,00")
 */
export const formatNumber = (amount, decimals = 2) => {
  return (Number(amount) || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Calculate invoice totals
 * @param {Array} items - Array of invoice items
 * @param {number} taxRate - Tax rate as decimal (e.g., 0.20)
 * @returns {Object} Object with subtotal, taxAmount, and total
 */
export const calculateInvoiceTotal = (items, taxRate) => {
  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;
  
  return {
    subtotal: Number(subtotal.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    total: Number(total.toFixed(2))
  };
};

/**
 * Format currency amount with thousand separators
 * @param {number} amount - Amount to format
 * @param {string} currency - ISO 4217 currency code (EUR, USD, XAF, etc.)
 * @returns {string} Formatted currency string (e.g., "4 471 875,00 XAF")
 */
export const formatCurrency = (amount, currency = 'EUR') => {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    // Fallback for unknown currencies
    const formatted = (Number(amount) || 0).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${formatted} ${currency}`;
  }
};

/**
 * Generate invoice number
 * @returns {string} Invoice number in format INV-YYYY-MM-XXX
 */
/**
 * Calculate discount amount for a single line item
 * @param {Object} item - Invoice item with discount_type, discount_value, quantity, unitPrice
 * @returns {number} Discount amount
 */
export const calculateItemDiscount = (item) => {
  if (!item.discount_type || item.discount_type === 'none' || !item.discount_value) return 0;
  const lineTotal = Number(item.quantity) * Number(item.unitPrice || item.unit_price);
  if (item.discount_type === 'percentage') {
    return Number((lineTotal * Number(item.discount_value) / 100).toFixed(2));
  }
  return Number(Number(item.discount_value).toFixed(2));
};

/**
 * Calculate invoice totals with discount support
 * @param {Array} items - Array of invoice items (may include discount fields)
 * @param {number} taxRate - Tax rate as decimal (e.g., 0.20)
 * @param {Object} globalDiscount - { type: 'none'|'percentage'|'fixed', value: number }
 * @returns {Object} Detailed totals
 */
export const calculateInvoiceTotalWithDiscount = (items, taxRate, globalDiscount = { type: 'none', value: 0 }) => {
  let subtotal = 0;
  let totalItemDiscounts = 0;

  items.forEach(item => {
    const lineTotal = Number(item.quantity) * Number(item.unitPrice || item.unit_price || 0);
    const itemDiscount = calculateItemDiscount(item);
    subtotal += lineTotal;
    totalItemDiscounts += itemDiscount;
  });

  const subtotalAfterItemDiscounts = subtotal - totalItemDiscounts;

  let globalDiscountAmount = 0;
  if (globalDiscount && globalDiscount.type !== 'none' && globalDiscount.value > 0) {
    if (globalDiscount.type === 'percentage') {
      globalDiscountAmount = subtotalAfterItemDiscounts * Number(globalDiscount.value) / 100;
    } else {
      globalDiscountAmount = Number(globalDiscount.value);
    }
  }

  const totalHT = subtotalAfterItemDiscounts - globalDiscountAmount;
  const taxAmount = totalHT * taxRate;
  const totalTTC = totalHT + taxAmount;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    totalItemDiscounts: Number(totalItemDiscounts.toFixed(2)),
    subtotalAfterItemDiscounts: Number(subtotalAfterItemDiscounts.toFixed(2)),
    globalDiscountAmount: Number(globalDiscountAmount.toFixed(2)),
    totalHT: Number(totalHT.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    totalTTC: Number(totalTTC.toFixed(2))
  };
};

/**
 * Calculate balance due on an invoice
 * @param {number} totalTTC - Total amount including tax
 * @param {number} amountPaid - Amount already paid
 * @returns {number} Remaining balance
 */
export const calculateBalanceDue = (totalTTC, amountPaid) => {
  return Number((Number(totalTTC) - Number(amountPaid || 0)).toFixed(2));
};

/**
 * Allocate a lump-sum payment across pending invoices (oldest first)
 * @param {number} amount - Total payment amount
 * @param {Array} pendingInvoices - Array of { id, balance_due, date } sorted by date ascending
 * @returns {Array} Array of { invoiceId, allocatedAmount }
 */
export const allocateLumpSumPayment = (amount, pendingInvoices) => {
  const sorted = [...pendingInvoices].sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at));
  const allocations = [];
  let remaining = Number(amount);

  for (const invoice of sorted) {
    if (remaining <= 0) break;
    const balance = Number(invoice.balance_due || invoice.total_ttc || 0);
    if (balance <= 0) continue;
    const allocated = Math.min(remaining, balance);
    allocations.push({
      invoiceId: invoice.id,
      allocatedAmount: Number(allocated.toFixed(2))
    });
    remaining -= allocated;
  }

  return allocations;
};

/**
 * Determine payment status based on amounts
 * @param {number} totalTTC - Invoice total
 * @param {number} amountPaid - Amount paid
 * @returns {string} Payment status
 */
export const getPaymentStatus = (totalTTC, amountPaid) => {
  const total = Number(totalTTC);
  const paid = Number(amountPaid || 0);
  if (paid <= 0) return 'unpaid';
  if (paid < total) return 'partial';
  if (paid === total) return 'paid';
  return 'overpaid';
};

export const generateInvoiceNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  
  // Get existing invoices to determine sequence number
  const invoices = JSON.parse(localStorage.getItem('invoices') || '[]');
  const currentMonthInvoices = invoices.filter(inv => 
    inv.invoiceNumber.startsWith(`INV-${year}-${month}`)
  );
  
  const sequence = (currentMonthInvoices.length + 1).toString().padStart(3, '0');
  
  return `INV-${year}-${month}-${sequence}`;
};

/**
 * Calculate percentage trend between two values
 * @param {number} current - Current period value
 * @param {number} previous - Previous period value
 * @returns {number} Percentage change (e.g., 12.5 or -3.2)
 */
export const calculateTrend = (current, previous) => {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev === 0 && cur === 0) return 0;
  if (prev === 0) return cur > 0 ? 100 : -100;
  return Number((((cur - prev) / Math.abs(prev)) * 100).toFixed(1));
};

/**
 * Format a trend value as a display string
 * @param {number} trend - Trend percentage
 * @returns {string} Formatted string like "+12.5%" or "-3.2%"
 */
export const formatTrendLabel = (trend) => {
  const t = Number(trend);
  if (!t || isNaN(t)) return '0%';
  return `${t > 0 ? '+' : ''}${t}%`;
};

/**
 * Calculate real profit margin from revenue and expenses
 * @param {number} revenue - Total revenue
 * @param {number} expenses - Total expenses
 * @returns {number} Profit margin percentage
 */
export const calculateProfitMargin = (revenue, expenses) => {
  const rev = Number(revenue) || 0;
  const exp = Number(expenses) || 0;
  if (rev <= 0) return 0;
  return Number((((rev - exp) / rev) * 100).toFixed(1));
};

/**
 * Get the best available total amount from an invoice
 * Falls back through total_ttc -> total -> 0
 * @param {Object} invoice - Invoice object
 * @returns {number} The invoice amount
 */
export const getInvoiceAmount = (invoice) => {
  return parseFloat(invoice?.total_ttc) || parseFloat(invoice?.total) || 0;
};

/**
 * Filter array items by a specific month and year
 * @param {Array} items - Array of objects with date fields
 * @param {number} month - Month (0-11)
 * @param {number} year - Full year
 * @param {string} dateField - Name of the date field to check
 * @returns {Array} Filtered items
 */
export const filterByMonth = (items, month, year, dateField = 'date') => {
  return items.filter(item => {
    const d = new Date(item[dateField] || item.created_at);
    return d.getMonth() === month && d.getFullYear() === year;
  });
};
