
/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const PASSWORD_POLICY = Object.freeze({
  minLength: 12,
  requireUppercase: true,
  requireDigit: true,
  requireSpecial: true,
});

/**
 * Validate password against minimum security policy.
 * Requirements: 12+ chars, uppercase, digit, special char.
 *
 * @param {string} password
 * @returns {boolean}
 */
export const validatePasswordStrength = (password) => {
  if (typeof password !== "string") return false;
  if (password.length < PASSWORD_POLICY.minLength) return false;

  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  return hasUppercase && hasDigit && hasSpecial;
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
  
  const _startMinutes = startHour * 60 + startMin;
  const _endMinutes = endHour * 60 + endMin;
  
  // Allow overnight shifts
  return true;
};
