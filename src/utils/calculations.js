
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
 * Format currency amount
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (EUR, USD, GBP)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'EUR') => {
  const symbols = {
    EUR: '€',
    USD: '$',
    GBP: '£'
  };
  
  const formatted = amount.toFixed(2);
  const symbol = symbols[currency] || currency;
  
  if (currency === 'USD') {
    return `${symbol}${formatted}`;
  }
  return `${formatted} ${symbol}`;
};

/**
 * Generate invoice number
 * @returns {string} Invoice number in format INV-YYYY-MM-XXX
 */
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
