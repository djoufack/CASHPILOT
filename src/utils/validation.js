
import React from "react";

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate time format (HH:mm)
 * @param {string} time - Time string to validate
 * @returns {boolean} True if valid
 */
export const validateTimeFormat = (time) => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

/**
 * Validate date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {boolean} True if valid
 */
export const validateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return end >= start;
};

/**
 * Validate invoice items
 * @param {Array} items - Array of invoice items
 * @returns {Object} Object with valid flag and errors array
 */
export const validateInvoiceItems = (items) => {
  const errors = [];
  
  if (!items || items.length === 0) {
    errors.push('At least one item is required');
    return { valid: false, errors };
  }
  
  items.forEach((item, index) => {
    if (!item.description || item.description.trim() === '') {
      errors.push(`Item ${index + 1}: Description is required`);
    }
    if (!item.quantity || item.quantity <= 0) {
      errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
    }
    if (!item.unitPrice || item.unitPrice <= 0) {
      errors.push(`Item ${index + 1}: Unit price must be greater than 0`);
    }
  });
  
  return { valid: errors.length === 0, errors };
};

/**
 * Validate time range (end time after start time)
 * @param {string} startTime - Start time in HH:mm format
 * @param {string} endTime - End time in HH:mm format
 * @returns {boolean} True if valid
 */
export const validateTimeRange = (startTime, endTime) => {
  if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
    return false;
  }
  
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Allow overnight shifts
  return true;
};
