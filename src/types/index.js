

/**
 * JSDoc Type Definitions (serving as TypeScript Interfaces)
 * 
 * @typedef {Object} User
 * @property {string} id
 * @property {string} email
 * @property {'admin' | 'manager' | 'freelance' | 'client'} role
 * @property {string} name
 * @property {string} [avatar_url]
 * @property {number} [tjm]
 * @property {string} created_at
 * 
 * @typedef {Object} Client
 * @property {string} id
 * @property {string} user_id
 * @property {string} companyName
 * @property {string} contactName
 * @property {string} email
 * @property {string} [phone]
 * @property {string} address
 * @property {string} created_at
 * 
 * @typedef {Object} Project
 * @property {string} id
 * @property {string} client_id
 * @property {string} name
 * @property {number} budget_hours
 * @property {number} hourly_rate
 * @property {'active' | 'completed' | 'on_hold'} status
 * @property {string} created_at
 * 
 * @typedef {Object} Timesheet
 * @property {string} id
 * @property {string} user_id
 * @property {string} project_id
 * @property {string} date
 * @property {string} start_time
 * @property {string} end_time
 * @property {number} duration_hours
 * @property {'draft' | 'submitted' | 'approved' | 'rejected'} status
 * @property {string} notes
 * 
 * @typedef {Object} Invoice
 * @property {string} id
 * @property {string} client_id
 * @property {string} invoice_number
 * @property {number} amount
 * @property {number} tax_rate
 * @property {'draft' | 'sent' | 'paid' | 'reminded'} status
 * @property {string} due_date
 * @property {InvoiceItem[]} items
 * 
 * @typedef {Object} InvoiceItem
 * @property {string} id
 * @property {string} description
 * @property {number} quantity
 * @property {number} unit_price
 * 
 * @typedef {Object} Quote
 * @property {string} id
 * @property {string} client_id
 * @property {string} quote_number
 * @property {number} amount
 * @property {'draft' | 'sent' | 'accepted' | 'rejected' | 'invoiced'} status
 * @property {string} created_at
 */

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  FREELANCE: 'freelance',
  CLIENT: 'client'
};

export const STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// DEPRECATED: Use SUPPORTED_CURRENCIES from '@/utils/currencyService' instead
// Kept for backwards compatibility only
export const Currency = {
  EUR: 'EUR',
  USD: 'USD',
  GBP: 'GBP'
};

// For new code, import SUPPORTED_CURRENCIES from currencyService.js
// which supports 75+ global currencies
