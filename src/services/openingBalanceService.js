/**
 * Opening Balance Service
 * Creates OD journal entries for balance sheet initialization
 */

import { supabase } from '@/lib/supabase';

/**
 * Account used as counterpart for opening balance entries
 * 890 - Bilan d'ouverture (standard PCG)
 */
const OPENING_BALANCE_ACCOUNT = '890';
const OPENING_BALANCE_JOURNAL = 'OD';

// ---------------------------------------------------------------------------
// Country-specific account code mapping
// ---------------------------------------------------------------------------

/**
 * Account code mapping per field name and country code.
 * Supports Belgium (PCMN), France (PCG), and OHADA (SYSCOHADA).
 */
const ACCOUNT_CODE_MAP = {
  bank_balance:   { BE: '550', FR: '512', OHADA: '521' },
  receivables:    { BE: '400', FR: '411', OHADA: '411' },
  payables:       { BE: '440', FR: '401', OHADA: '401' },
  equity_capital: { BE: '100', FR: '101', OHADA: '101' },
  loan_balance:   { BE: '174', FR: '164', OHADA: '162' },
  fixed_assets:   { BE: '215', FR: '218', OHADA: '241' },
};

/**
 * Account type (debit/credit nature) for each balance field.
 * asset  -> debit normal
 * liability / equity -> credit normal
 */
const FIELD_ACCOUNT_TYPES = {
  bank_balance:   { type: 'asset',     label: 'Banque' },
  receivables:    { type: 'asset',     label: 'Créances clients' },
  payables:       { type: 'liability', label: 'Dettes fournisseurs' },
  equity_capital: { type: 'equity',    label: 'Capital' },
  loan_balance:   { type: 'liability', label: 'Emprunts' },
  fixed_assets:   { type: 'asset',     label: 'Immobilisations' },
};

/**
 * Returns the account code for a given field name and country.
 *
 * @param {string} fieldName - One of: bank_balance, receivables, payables, equity_capital, loan_balance, fixed_assets
 * @param {string} countryCode - "BE" | "FR" | "OHADA"
 * @returns {string|null} The account code, or null if not found
 */
export const getAccountCodeForCountry = (fieldName, countryCode) => {
  const fieldMap = ACCOUNT_CODE_MAP[fieldName];
  if (!fieldMap) return null;
  return fieldMap[countryCode] || fieldMap['FR'] || null;
};

/**
 * Generate opening balance entries from simple balance fields.
 *
 * Takes the balances entered by the user during onboarding and generates
 * proper double-entry accounting entries.
 *
 * @param {Object} balances - { bank_balance, receivables, payables, equity_capital, loan_balance, fixed_assets }
 * @param {string} accountingPlanId - The accounting plan ID (unused in entries, kept for future reference)
 * @param {string} userId - The user ID
 * @param {string} [countryCode='FR'] - Country code for account mapping
 * @returns {Promise<Object>} Result with created entries count
 */
export const generateOpeningEntries = async (balances, accountingPlanId, userId, countryCode = 'FR') => {
  if (!userId) {
    throw new Error('userId is required');
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const year = new Date().getFullYear();
  const entryRef = `OUV-${year}`;
  const entries = [];

  for (const [fieldName, fieldInfo] of Object.entries(FIELD_ACCOUNT_TYPES)) {
    const amount = parseFloat(balances[fieldName]) || 0;
    if (amount <= 0) continue;

    const accountCode = getAccountCodeForCountry(fieldName, countryCode);
    if (!accountCode) continue;

    const isAsset = fieldInfo.type === 'asset';
    // Assets: debit the account, credit the opening balance counterpart
    // Liabilities/equity: credit the account, debit the opening balance counterpart

    // Main account entry
    entries.push({
      user_id: userId,
      transaction_date: dateStr,
      account_code: accountCode,
      debit: isAsset ? amount : 0,
      credit: isAsset ? 0 : amount,
      entry_ref: entryRef,
      journal: OPENING_BALANCE_JOURNAL,
      source_type: 'opening_balance',
      source_id: null,
      is_auto: false,
      description: `Solde d'ouverture - ${fieldInfo.label}`,
    });

    // Counterpart entry (890 - Bilan d'ouverture)
    entries.push({
      user_id: userId,
      transaction_date: dateStr,
      account_code: OPENING_BALANCE_ACCOUNT,
      debit: isAsset ? 0 : amount,
      credit: isAsset ? amount : 0,
      entry_ref: entryRef,
      journal: OPENING_BALANCE_JOURNAL,
      source_type: 'opening_balance',
      source_id: null,
      is_auto: false,
      description: `Solde d'ouverture - Contrepartie ${accountCode}`,
    });
  }

  if (entries.length === 0) {
    return { success: true, entriesCreated: 0, entryRef };
  }

  // Insert all entries
  const { data, error } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select();

  if (error) throw error;

  return {
    success: true,
    entriesCreated: data.length,
    entryRef,
  };
};

/**
 * Generate unique entry reference for opening balances
 */
const generateEntryRef = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `OUV-${year}${month}-${Date.now().toString(36).toUpperCase()}`;
};

/**
 * Delete existing opening balance entries for a user
 */
export const deleteOpeningBalanceEntries = async (userId) => {
  const { error } = await supabase
    .from('accounting_entries')
    .delete()
    .eq('user_id', userId)
    .eq('journal', OPENING_BALANCE_JOURNAL)
    .like('description', '%Solde d\'ouverture%');

  if (error) throw error;
  return { success: true };
};

/**
 * Create opening balance entries from account balances
 * @param {string} userId - User ID
 * @param {Date} openingDate - Opening balance date
 * @param {Array} balances - Array of { account_code, account_name, amount, type }
 * @returns {Object} Result with created entries count
 */
export const createOpeningBalanceEntries = async (userId, openingDate, balances) => {
  if (!userId || !openingDate || !balances?.length) {
    throw new Error('Missing required parameters');
  }

  const entryRef = generateEntryRef(openingDate);
  const dateStr = new Date(openingDate).toISOString().split('T')[0];

  // Filter out zero balances
  const nonZeroBalances = balances.filter(b => b.amount && b.amount !== 0);

  if (nonZeroBalances.length === 0) {
    return { success: true, entriesCreated: 0 };
  }

  // Create entries array
  const entries = [];

  for (const balance of nonZeroBalances) {
    const isDebit = ['asset', 'expense'].includes(balance.type) ? balance.amount > 0 : balance.amount < 0;
    const absAmount = Math.abs(balance.amount);

    // Main account entry
    entries.push({
      user_id: userId,
      transaction_date: dateStr,
      account_code: balance.account_code,
      debit: isDebit ? absAmount : 0,
      credit: isDebit ? 0 : absAmount,
      entry_ref: entryRef,
      journal: OPENING_BALANCE_JOURNAL,
      source_type: 'opening_balance',
      source_id: null,
      is_auto: false,
      description: `Solde d'ouverture - ${balance.account_name}`
    });

    // Counterpart entry (890 - Bilan d'ouverture)
    entries.push({
      user_id: userId,
      transaction_date: dateStr,
      account_code: OPENING_BALANCE_ACCOUNT,
      debit: isDebit ? 0 : absAmount,
      credit: isDebit ? absAmount : 0,
      entry_ref: entryRef,
      journal: OPENING_BALANCE_JOURNAL,
      source_type: 'opening_balance',
      source_id: null,
      is_auto: false,
      description: `Solde d'ouverture - Contrepartie ${balance.account_code}`
    });
  }

  // Insert all entries
  const { data, error } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select();

  if (error) throw error;

  return {
    success: true,
    entriesCreated: data.length,
    entryRef
  };
};

/**
 * Get existing opening balance entries for a user
 */
export const getOpeningBalanceEntries = async (userId) => {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('source_type', 'opening_balance')
    .order('account_code');

  if (error) throw error;
  return data || [];
};

/**
 * Reinitialize balance sheet with new opening balances
 * Deletes existing opening entries and creates new ones
 */
export const reinitializeOpeningBalances = async (userId, openingDate, balances) => {
  // Delete existing opening balance entries
  await deleteOpeningBalanceEntries(userId);

  // Create new opening balance entries
  return createOpeningBalanceEntries(userId, openingDate, balances);
};

/**
 * Validate that opening balances are balanced (Assets = Liabilities + Equity)
 */
export const validateOpeningBalances = (balances) => {
  let totalAssets = 0;
  let totalLiabilitiesEquity = 0;

  for (const balance of balances) {
    const amount = balance.amount || 0;
    if (balance.type === 'asset') {
      totalAssets += amount;
    } else if (['liability', 'equity'].includes(balance.type)) {
      totalLiabilitiesEquity += amount;
    }
  }

  const isBalanced = Math.abs(totalAssets - totalLiabilitiesEquity) < 0.01;

  return {
    isBalanced,
    totalAssets,
    totalLiabilitiesEquity,
    difference: totalAssets - totalLiabilitiesEquity
  };
};

export default {
  createOpeningBalanceEntries,
  deleteOpeningBalanceEntries,
  getOpeningBalanceEntries,
  reinitializeOpeningBalances,
  validateOpeningBalances,
  generateOpeningEntries,
  getAccountCodeForCountry,
  OPENING_BALANCE_ACCOUNT,
  OPENING_BALANCE_JOURNAL
};
