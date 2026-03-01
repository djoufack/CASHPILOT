/**
 * Accounting Initialization Service
 *
 * Initializes the accounting module for a new user by:
 *  1. Checking if the user is already initialized
 *  2. Loading the seeded reference chart of accounts from Supabase
 *  3. Creating default accounting mappings from Supabase templates
 *  4. Creating default tax rates from Supabase templates
 *  5. Marking the user as initialized
 */

import { supabase } from '@/lib/supabase';
import {
  getAccountingMappingTemplates,
  getAccountingTaxRateTemplates,
  getGlobalAccountingPlanAccounts,
} from '@/services/referenceDataService';
import { validateChartOfAccountsImport } from '@/utils/accountingQualityChecks';

const resolveRegionHint = (country) => {
  if (country === 'BE') return 'belgium';
  if (country === 'OHADA') return 'ohada';
  return 'france';
};

async function loadReferenceAccounts(country) {
  const accounts = await getGlobalAccountingPlanAccounts(country);
  return (accounts || []).map((account) => ({
    account_code: account.account_code,
    account_name: account.account_name,
    account_type: account.account_type,
    account_category: account.account_category || null,
    parent_code: account.parent_code || null,
    description: account.description || null,
    is_header: Boolean(account.is_header),
  }));
}

// ---------------------------------------------------------------------------
// Check initialization status
// ---------------------------------------------------------------------------

/**
 * Checks whether the accounting module has been initialized for a given user.
 *
 * @param {string} userId
 * @returns {Promise<{ isInitialized: boolean, country: string|null, settings: object|null }>}
 */
export async function checkAccountingInitialized(userId) {
  try {
    const { data, error } = await supabase
      .from('user_accounting_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[AccountingInit] Error checking initialization:', error.message);
      return { isInitialized: false, country: null, settings: null };
    }

    if (!data) {
      return { isInitialized: false, country: null, settings: null };
    }

    return {
      isInitialized: !!data.is_initialized,
      country: data.country || null,
      settings: data,
    };
  } catch (err) {
    console.error('[AccountingInit] Unexpected error in checkAccountingInitialized:', err);
    return { isInitialized: false, country: null, settings: null };
  }
}

// ---------------------------------------------------------------------------
// Main initialization flow
// ---------------------------------------------------------------------------

/**
 * Initializes the full accounting module for the given user and country.
 *
 * @param {string} userId
 * @param {string} country
 * @returns {Promise<{ success: boolean, accountsCount: number, mappingsCount: number, taxRatesCount: number, error?: string }>}
 */
export async function initializeAccounting(userId, country) {
  try {
    const { error: settingsError } = await supabase
      .from('user_accounting_settings')
      .upsert(
        {
          user_id: userId,
          country,
          is_initialized: false,
          auto_journal_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (settingsError) {
      console.error('[AccountingInit] Error upserting settings:', settingsError.message);
      return { success: false, accountsCount: 0, mappingsCount: 0, taxRatesCount: 0, error: settingsError.message };
    }

    const accounts = await loadReferenceAccounts(country);
    if (accounts.length === 0) {
      return {
        success: false,
        accountsCount: 0,
        mappingsCount: 0,
        taxRatesCount: 0,
        error: 'Aucun plan comptable de référence n’est disponible dans Supabase pour ce pays',
      };
    }

    const validation = validateChartOfAccountsImport(accounts, {
      regionHint: resolveRegionHint(country),
    });
    if (!validation.canImport) {
      return {
        success: false,
        accountsCount: 0,
        mappingsCount: 0,
        taxRatesCount: 0,
        error: validation.blockingIssues[0]?.message || 'Le plan comptable de référence est invalide pour le pilotage',
      };
    }

    const accountsCount = await bulkInsertAccounts(userId, accounts);
    const mappingsCount = await insertDefaultMappings(userId, country);
    const taxRatesCount = await insertDefaultTaxRates(userId, country);

    const { error: finalizeError } = await supabase
      .from('user_accounting_settings')
      .update({
        is_initialized: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (finalizeError) {
      console.error('[AccountingInit] Error finalizing initialization:', finalizeError.message);
      return {
        success: false,
        accountsCount,
        mappingsCount,
        taxRatesCount,
        error: `Accounts/mappings/taxes were inserted but failed to finalize: ${finalizeError.message}`,
      };
    }

    return { success: true, accountsCount, mappingsCount, taxRatesCount };
  } catch (err) {
    console.error('[AccountingInit] Unexpected error in initializeAccounting:', err);
    return { success: false, accountsCount: 0, mappingsCount: 0, taxRatesCount: 0, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Bulk insert accounts
// ---------------------------------------------------------------------------

async function bulkInsertAccounts(userId, accounts) {
  const BATCH_SIZE = 200;
  let totalInserted = 0;

  const rows = accounts.map((account) => ({
    user_id: userId,
    account_code: account.account_code,
    account_name: account.account_name,
    account_type: account.account_type,
    account_category: account.account_category || null,
    parent_code: account.parent_code || null,
  }));

  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);

    try {
      const { error } = await supabase
        .from('accounting_chart_of_accounts')
        .upsert(batch, { onConflict: 'user_id,account_code' });

      if (error) {
        console.error(`[AccountingInit] Error inserting accounts batch ${index / BATCH_SIZE + 1}:`, error.message);
      } else {
        totalInserted += batch.length;
      }
    } catch (err) {
      console.error(`[AccountingInit] Unexpected error in account batch ${index / BATCH_SIZE + 1}:`, err);
    }
  }

  return totalInserted;
}

// ---------------------------------------------------------------------------
// Insert default mappings
// ---------------------------------------------------------------------------

async function insertDefaultMappings(userId, country) {
  const mappings = await getDefaultMappings(country);

  if (mappings.length === 0) {
    return 0;
  }

  const rows = mappings.map((mapping) => ({
    user_id: userId,
    source_type: mapping.source_type,
    source_category: mapping.source_category,
    debit_account_code: mapping.debit_account_code,
    credit_account_code: mapping.credit_account_code,
    description: mapping.description,
  }));

  try {
    const { error } = await supabase
      .from('accounting_mappings')
      .upsert(rows, { onConflict: 'user_id,source_type,source_category' });

    if (error) {
      console.error('[AccountingInit] Error inserting mappings:', error.message);
      return 0;
    }

    return rows.length;
  } catch (err) {
    console.error('[AccountingInit] Unexpected error in insertDefaultMappings:', err);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Insert default tax rates
// ---------------------------------------------------------------------------

async function insertDefaultTaxRates(userId, country) {
  const taxRates = await getDefaultTaxRates(country);

  if (taxRates.length === 0) {
    return 0;
  }

  const rows = taxRates.map((taxRate) => ({
    user_id: userId,
    name: taxRate.name,
    rate: taxRate.rate,
    tax_type: taxRate.tax_type,
    account_code: taxRate.account_code,
    is_default: taxRate.is_default,
  }));

  try {
    const { error } = await supabase
      .from('accounting_tax_rates')
      .upsert(rows, { onConflict: 'user_id,name' });

    if (error) {
      console.error('[AccountingInit] Error inserting tax rates:', error.message);
      return 0;
    }

    return rows.length;
  } catch (err) {
    console.error('[AccountingInit] Unexpected error in insertDefaultTaxRates:', err);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Default template readers
// ---------------------------------------------------------------------------

/**
 * Returns the default accounting mappings for the given country.
 *
 * @param {string} country
 * @returns {Promise<Array<object>>}
 */
export async function getDefaultMappings(country) {
  return getAccountingMappingTemplates(country);
}

/**
 * Returns the default tax rates for the given country.
 *
 * @param {string} country
 * @returns {Promise<Array<object>>}
 */
export async function getDefaultTaxRates(country) {
  return getAccountingTaxRateTemplates(country);
}

// ---------------------------------------------------------------------------
// Copy plan accounts from a template plan to user's personal plan
// ---------------------------------------------------------------------------

/**
 * Copies accounts from a template accounting plan to a new personal plan for the user.
 *
 * @param {string} fromPlanId
 * @param {string} userId
 * @returns {Promise<{ success: boolean, planId: string|null, accountsCopied: number, error?: string }>}
 */
export async function copyPlanAccounts(fromPlanId, userId) {
  try {
    const { data: sourcePlan, error: planError } = await supabase
      .from('accounting_plans')
      .select('*')
      .eq('id', fromPlanId)
      .single();

    if (planError || !sourcePlan) {
      return {
        success: false,
        planId: null,
        accountsCopied: 0,
        error: planError?.message || 'Source plan not found',
      };
    }

    const { data: sourceAccounts, error: accountsError } = await supabase
      .from('accounting_plan_accounts')
      .select('*')
      .eq('plan_id', fromPlanId)
      .order('sort_order', { ascending: true })
      .order('account_code', { ascending: true });

    if (accountsError) {
      return {
        success: false,
        planId: null,
        accountsCopied: 0,
        error: accountsError.message,
      };
    }

    if (!sourceAccounts || sourceAccounts.length === 0) {
      return {
        success: false,
        planId: null,
        accountsCopied: 0,
        error: 'No accounts found in source plan',
      };
    }

    const { data: newPlan, error: newPlanError } = await supabase
      .from('accounting_plans')
      .insert({
        name: `${sourcePlan.name} (copie)`,
        source: 'copy',
        country_code: sourcePlan.country_code || null,
        uploaded_by: userId,
        is_global: false,
        accounts_count: sourceAccounts.length,
        description: `Copie du plan ${sourcePlan.name}`,
        status: 'active',
      })
      .select()
      .single();

    if (newPlanError || !newPlan) {
      return {
        success: false,
        planId: null,
        accountsCopied: 0,
        error: newPlanError?.message || 'Failed to create personal plan',
      };
    }

    const BATCH_SIZE = 200;
    let totalCopied = 0;

    const rows = sourceAccounts.map((account) => ({
      plan_id: newPlan.id,
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      account_category: account.account_category || null,
      parent_code: account.parent_code || null,
      is_active: account.is_active !== false,
    }));

    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      const batch = rows.slice(index, index + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('accounting_plan_accounts')
        .insert(batch);

      if (insertError) {
        console.error(`[AccountingInit] Error copying accounts batch ${Math.floor(index / BATCH_SIZE) + 1}:`, insertError.message);
      } else {
        totalCopied += batch.length;
      }
    }

    return {
      success: true,
      planId: newPlan.id,
      accountsCopied: totalCopied,
    };
  } catch (err) {
    console.error('[AccountingInit] Unexpected error in copyPlanAccounts:', err);
    return {
      success: false,
      planId: null,
      accountsCopied: 0,
      error: err.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Initialize accounting with planId + countryCode variant
// ---------------------------------------------------------------------------

/**
 * Initializes accounting from a specific plan ID and country code.
 *
 * @param {string} userId
 * @param {string} planId
 * @param {string} countryCode
 * @returns {Promise<{ success: boolean, accountsCount: number, mappingsCount: number, taxRatesCount: number, error?: string }>}
 */
export async function initializeAccountingFromPlan(userId, planId, countryCode) {
  try {
    const country = countryCode || 'FR';

    const { error: settingsError } = await supabase
      .from('user_accounting_settings')
      .upsert(
        {
          user_id: userId,
          country,
          plan_id: planId,
          is_initialized: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (settingsError) {
      console.error('[AccountingInit] Error upserting settings:', settingsError.message);
      return { success: false, accountsCount: 0, mappingsCount: 0, taxRatesCount: 0, error: settingsError.message };
    }

    let accountsCount = 0;
    if (planId) {
      const { data: planAccounts, error: fetchError } = await supabase
        .from('accounting_plan_accounts')
        .select('*')
        .eq('plan_id', planId)
        .order('sort_order', { ascending: true })
        .order('account_code', { ascending: true });

      if (!fetchError && planAccounts && planAccounts.length > 0) {
        accountsCount = await bulkInsertAccounts(userId, planAccounts);
      }
    }

    if (accountsCount === 0) {
      const referenceAccounts = await loadReferenceAccounts(country);
      if (referenceAccounts.length === 0) {
        return {
          success: false,
          accountsCount: 0,
          mappingsCount: 0,
          taxRatesCount: 0,
          error: 'Aucun plan comptable de référence n’est disponible dans Supabase pour ce pays',
        };
      }
      accountsCount = await bulkInsertAccounts(userId, referenceAccounts);
    }

    const mappingsCount = await insertDefaultMappings(userId, country);
    const taxRatesCount = await insertDefaultTaxRates(userId, country);

    const { error: finalizeError } = await supabase
      .from('user_accounting_settings')
      .update({
        is_initialized: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (finalizeError) {
      console.error('[AccountingInit] Error finalizing initialization:', finalizeError.message);
      return {
        success: false,
        accountsCount,
        mappingsCount,
        taxRatesCount,
        error: `Accounts/mappings/taxes were inserted but failed to finalize: ${finalizeError.message}`,
      };
    }

    return { success: true, accountsCount, mappingsCount, taxRatesCount };
  } catch (err) {
    console.error('[AccountingInit] Unexpected error in initializeAccountingFromPlan:', err);
    return { success: false, accountsCount: 0, mappingsCount: 0, taxRatesCount: 0, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Refresh mappings for existing users
// ---------------------------------------------------------------------------

/**
 * Refreshes default mappings for a single user.
 *
 * @param {string} userId
 * @returns {Promise<{ success: boolean, mappingsCount: number, country: string|null, error?: string }>}
 */
export async function refreshUserMappings(userId) {
  try {
    const { data, error } = await supabase
      .from('user_accounting_settings')
      .select('country')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return { success: false, mappingsCount: 0, country: null, error: error?.message || 'User settings not found' };
    }

    const country = data.country || 'FR';
    const mappingsCount = await insertDefaultMappings(userId, country);
    return { success: true, mappingsCount, country };
  } catch (err) {
    console.error('[AccountingInit] Error in refreshUserMappings:', err);
    return { success: false, mappingsCount: 0, country: null, error: err.message };
  }
}

/**
 * Refreshes default mappings for all initialized users.
 *
 * @returns {Promise<{ usersUpdated: number, totalMappings: number, errors: string[] }>}
 */
export async function refreshAllUsersMappings() {
  const errors = [];
  let usersUpdated = 0;
  let totalMappings = 0;

  try {
    const { data: users, error } = await supabase
      .from('user_accounting_settings')
      .select('user_id, country')
      .eq('is_initialized', true);

    if (error || !users) {
      return { usersUpdated: 0, totalMappings: 0, errors: [error?.message || 'Failed to fetch users'] };
    }

    for (const user of users) {
      const country = user.country || 'FR';
      try {
        const count = await insertDefaultMappings(user.user_id, country);
        totalMappings += count;
        usersUpdated += 1;
      } catch (err) {
        errors.push(`User ${user.user_id}: ${err.message}`);
      }
    }

    return { usersUpdated, totalMappings, errors };
  } catch (err) {
    console.error('[AccountingInit] Error in refreshAllUsersMappings:', err);
    return { usersUpdated, totalMappings, errors: [...errors, err.message] };
  }
}
