/**
 * Accounting Initialization Service
 *
 * Initializes the accounting module for a new user by:
 *  1. Checking if the user is already initialized
 *  2. Loading the appropriate chart of accounts (PCG belge or PCG français)
 *  3. Creating default accounting mappings
 *  4. Creating default tax rates
 *  5. Marking the user as initialized
 */

import { supabase } from '@/lib/supabase';
import pcgBelge from '@/data/pcg-belge.json';
import pcgFrance from '@/data/pcg-france.json';
import pcgOhada from '@/data/pcg-ohada.json';

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
 * @param {string} country – "BE" for Belgium, "FR" for France
 * @returns {Promise<{ success: boolean, accountsCount: number, mappingsCount: number, taxRatesCount: number, error?: string }>}
 */
export async function initializeAccounting(userId, country) {
  try {
    // 1. Upsert user_accounting_settings (mark as NOT initialized yet)
    const { error: settingsError } = await supabase
      .from('user_accounting_settings')
      .upsert(
        {
          user_id: userId,
          country,
          is_initialized: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (settingsError) {
      console.error('[AccountingInit] Error upserting settings:', settingsError.message);
      return { success: false, accountsCount: 0, mappingsCount: 0, taxRatesCount: 0, error: settingsError.message };
    }

    // 2. Load the appropriate chart of accounts
    const accounts = country === 'BE' ? pcgBelge : country === 'OHADA' ? pcgOhada : pcgFrance;

    // 3. Bulk-insert accounts
    const accountsCount = await bulkInsertAccounts(userId, accounts);

    // 4. Insert default mappings
    const mappingsCount = await insertDefaultMappings(userId, country);

    // 5. Insert default tax rates
    const taxRatesCount = await insertDefaultTaxRates(userId, country);

    // 6. Mark user as initialized
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

/**
 * Upserts all accounts from a PCG file into accounting_chart_of_accounts.
 * Processes in batches of 200 to stay within Supabase limits.
 *
 * @param {string} userId
 * @param {Array<object>} accounts
 * @returns {Promise<number>} Number of accounts inserted / updated
 */
async function bulkInsertAccounts(userId, accounts) {
  const BATCH_SIZE = 200;
  let totalInserted = 0;

  const rows = accounts.map((acc) => ({
    user_id: userId,
    account_code: acc.account_code,
    account_name: acc.account_name,
    account_type: acc.account_type,
    account_category: acc.account_category || null,
    parent_code: acc.parent_code || null,
  }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    try {
      const { data, error } = await supabase
        .from('accounting_chart_of_accounts')
        .upsert(batch, { onConflict: 'user_id,account_code' });

      if (error) {
        console.error(`[AccountingInit] Error inserting accounts batch ${i / BATCH_SIZE + 1}:`, error.message);
      } else {
        totalInserted += batch.length;
      }
    } catch (err) {
      console.error(`[AccountingInit] Unexpected error in account batch ${i / BATCH_SIZE + 1}:`, err);
    }
  }

  return totalInserted;
}

// ---------------------------------------------------------------------------
// Insert default mappings
// ---------------------------------------------------------------------------

/**
 * Upserts default accounting mappings for the given country.
 *
 * @param {string} userId
 * @param {string} country
 * @returns {Promise<number>} Number of mappings inserted / updated
 */
async function insertDefaultMappings(userId, country) {
  const mappings = getDefaultMappings(country);

  const rows = mappings.map((m) => ({
    user_id: userId,
    source_type: m.source_type,
    source_category: m.source_category,
    debit_account_code: m.debit_account_code,
    credit_account_code: m.credit_account_code,
    description: m.description,
  }));

  try {
    const { data, error } = await supabase
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

/**
 * Upserts default tax rates for the given country.
 *
 * @param {string} userId
 * @param {string} country
 * @returns {Promise<number>} Number of tax rates inserted / updated
 */
async function insertDefaultTaxRates(userId, country) {
  const taxRates = getDefaultTaxRates(country);

  const rows = taxRates.map((t) => ({
    user_id: userId,
    name: t.name,
    rate: t.rate,
    tax_type: t.tax_type,
    account_code: t.account_code,
    is_default: t.is_default,
  }));

  try {
    const { data, error } = await supabase
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
// Default mapping data
// ---------------------------------------------------------------------------

/**
 * Returns the default accounting mappings for the given country.
 *
 * @param {string} country – "BE" | "FR"
 * @returns {Array<object>}
 */
export function getDefaultMappings(country) {
  if (country === 'OHADA') {
    return [
      // ---- Factures clients (ventes) ----
      { source_type: 'invoice', source_category: 'revenue',  debit_account_code: '411',  credit_account_code: '701',  description: 'Ventes de marchandises' },
      { source_type: 'invoice', source_category: 'service',  debit_account_code: '411',  credit_account_code: '706',  description: 'Services vendus' },
      { source_type: 'invoice', source_category: 'product',  debit_account_code: '411',  credit_account_code: '702',  description: 'Ventes de produits finis' },

      // ---- Paiements ----
      { source_type: 'payment', source_category: 'cash',          debit_account_code: '571', credit_account_code: '411', description: 'Encaissement client - espèces' },
      { source_type: 'payment', source_category: 'bank_transfer', debit_account_code: '521', credit_account_code: '411', description: 'Encaissement client - virement' },
      { source_type: 'payment', source_category: 'card',          debit_account_code: '521', credit_account_code: '411', description: 'Encaissement client - carte' },
      { source_type: 'payment', source_category: 'check',         debit_account_code: '513', credit_account_code: '411', description: 'Encaissement client - chèque' },

      // ---- Avoirs ----
      { source_type: 'credit_note', source_category: 'general', debit_account_code: '701', credit_account_code: '411', description: 'Avoir client' },

      // ---- Dépenses ----
      { source_type: 'expense', source_category: 'general',    debit_account_code: '638',  credit_account_code: '521', description: 'Autres charges externes' },
      { source_type: 'expense', source_category: 'office',     debit_account_code: '6053', credit_account_code: '521', description: 'Fournitures de bureau' },
      { source_type: 'expense', source_category: 'travel',     debit_account_code: '6371', credit_account_code: '521', description: 'Voyages et déplacements' },
      { source_type: 'expense', source_category: 'meals',      debit_account_code: '636',  credit_account_code: '521', description: 'Frais de réceptions' },
      { source_type: 'expense', source_category: 'transport',  debit_account_code: '618',  credit_account_code: '521', description: 'Autres frais de transport' },
      { source_type: 'expense', source_category: 'software',   debit_account_code: '634',  credit_account_code: '521', description: 'Redevances pour logiciels' },
      { source_type: 'expense', source_category: 'hardware',   debit_account_code: '6054', credit_account_code: '521', description: 'Fournitures informatiques' },
      { source_type: 'expense', source_category: 'marketing',  debit_account_code: '627',  credit_account_code: '521', description: 'Publicité et relations publiques' },
      { source_type: 'expense', source_category: 'legal',      debit_account_code: '6324', credit_account_code: '521', description: 'Honoraires' },
      { source_type: 'expense', source_category: 'insurance',  debit_account_code: '625',  credit_account_code: '521', description: "Primes d'assurance" },
      { source_type: 'expense', source_category: 'rent',       debit_account_code: '6222', credit_account_code: '521', description: 'Locations de bâtiments' },
      { source_type: 'expense', source_category: 'utilities',  debit_account_code: '6051', credit_account_code: '521', description: 'Eau, énergie' },
      { source_type: 'expense', source_category: 'telecom',    debit_account_code: '628',  credit_account_code: '521', description: 'Frais de télécommunications' },
      { source_type: 'expense', source_category: 'training',   debit_account_code: '633',  credit_account_code: '521', description: 'Formation du personnel' },
      { source_type: 'expense', source_category: 'consulting', debit_account_code: '6324', credit_account_code: '521', description: 'Honoraires de conseil' },
      { source_type: 'expense', source_category: 'other',      debit_account_code: '658',  credit_account_code: '521', description: 'Charges diverses' },

      // ---- Factures fournisseurs ----
      { source_type: 'supplier_invoice', source_category: 'purchase', debit_account_code: '601',  credit_account_code: '401', description: 'Achats de marchandises' },
      { source_type: 'supplier_invoice', source_category: 'service',  debit_account_code: '604',  credit_account_code: '401', description: 'Achats de matières et fournitures' },
      { source_type: 'supplier_invoice', source_category: 'supply',   debit_account_code: '605',  credit_account_code: '401', description: 'Autres achats' },
    ];
  }

  if (country === 'FR') {
    return [
      // ---- Factures clients (ventes) ----
      { source_type: 'invoice', source_category: 'revenue',  debit_account_code: '411',  credit_account_code: '701',   description: 'Ventes de marchandises' },
      { source_type: 'invoice', source_category: 'service',  debit_account_code: '411',  credit_account_code: '706',   description: 'Prestations de services' },
      { source_type: 'invoice', source_category: 'product',  debit_account_code: '411',  credit_account_code: '701',   description: 'Ventes de produits finis' },

      // ---- Paiements ----
      { source_type: 'payment', source_category: 'cash',          debit_account_code: '512', credit_account_code: '411', description: 'Encaissement client - espèces' },
      { source_type: 'payment', source_category: 'bank_transfer', debit_account_code: '512', credit_account_code: '411', description: 'Encaissement client - virement' },
      { source_type: 'payment', source_category: 'card',          debit_account_code: '512', credit_account_code: '411', description: 'Encaissement client - carte' },
      { source_type: 'payment', source_category: 'check',         debit_account_code: '512', credit_account_code: '411', description: 'Encaissement client - chèque' },

      // ---- Avoirs ----
      { source_type: 'credit_note', source_category: 'general', debit_account_code: '701', credit_account_code: '411', description: 'Avoir client' },

      // ---- Dépenses ----
      { source_type: 'expense', source_category: 'general',    debit_account_code: '6180', credit_account_code: '512', description: 'Frais généraux divers' },
      { source_type: 'expense', source_category: 'office',     debit_account_code: '6064', credit_account_code: '512', description: 'Fournitures administratives' },
      { source_type: 'expense', source_category: 'travel',     debit_account_code: '6251', credit_account_code: '512', description: 'Voyages et déplacements' },
      { source_type: 'expense', source_category: 'meals',      debit_account_code: '6257', credit_account_code: '512', description: 'Réceptions et frais de repas' },
      { source_type: 'expense', source_category: 'transport',  debit_account_code: '6241', credit_account_code: '512', description: 'Transport de biens et matériel' },
      { source_type: 'expense', source_category: 'software',   debit_account_code: '6116', credit_account_code: '512', description: 'Logiciels et abonnements numériques' },
      { source_type: 'expense', source_category: 'hardware',   debit_account_code: '6063', credit_account_code: '512', description: 'Matériel informatique (petit équipement)' },
      { source_type: 'expense', source_category: 'marketing',  debit_account_code: '6231', credit_account_code: '512', description: 'Publicité et marketing' },
      { source_type: 'expense', source_category: 'legal',      debit_account_code: '6226', credit_account_code: '512', description: 'Honoraires juridiques et comptables' },
      { source_type: 'expense', source_category: 'insurance',  debit_account_code: '616',  credit_account_code: '512', description: "Primes d'assurance" },
      { source_type: 'expense', source_category: 'rent',       debit_account_code: '6132', credit_account_code: '512', description: 'Loyers immobiliers' },
      { source_type: 'expense', source_category: 'utilities',  debit_account_code: '6061', credit_account_code: '512', description: 'Énergie (eau, gaz, électricité)' },
      { source_type: 'expense', source_category: 'telecom',    debit_account_code: '626',  credit_account_code: '512', description: 'Téléphone et Internet' },
      { source_type: 'expense', source_category: 'training',   debit_account_code: '6333', credit_account_code: '512', description: 'Formation professionnelle' },
      { source_type: 'expense', source_category: 'consulting', debit_account_code: '6226', credit_account_code: '512', description: 'Honoraires de conseil' },
      { source_type: 'expense', source_category: 'other',      debit_account_code: '658',  credit_account_code: '512', description: 'Charges diverses de gestion' },

      // ---- Factures fournisseurs ----
      { source_type: 'supplier_invoice', source_category: 'purchase', debit_account_code: '601',  credit_account_code: '401', description: 'Achats marchandises' },
      { source_type: 'supplier_invoice', source_category: 'service',  debit_account_code: '604',  credit_account_code: '401', description: 'Achats prestations de services' },
      { source_type: 'supplier_invoice', source_category: 'supply',   debit_account_code: '6022', credit_account_code: '401', description: 'Achats fournitures consommables' },
    ];
  }

  // Default: Belgium (BE)
  return [
    // ---- Factures clients (ventes) ----
    { source_type: 'invoice', source_category: 'revenue',  debit_account_code: '400',  credit_account_code: '700',   description: 'Ventes de marchandises' },
    { source_type: 'invoice', source_category: 'service',  debit_account_code: '400',  credit_account_code: '7061',  description: 'Prestations de services' },
    { source_type: 'invoice', source_category: 'product',  debit_account_code: '400',  credit_account_code: '701',   description: 'Ventes de produits finis' },

    // ---- Paiements ----
    { source_type: 'payment', source_category: 'cash',          debit_account_code: '550', credit_account_code: '400', description: 'Encaissement client - espèces' },
    { source_type: 'payment', source_category: 'bank_transfer', debit_account_code: '550', credit_account_code: '400', description: 'Encaissement client - virement' },
    { source_type: 'payment', source_category: 'card',          debit_account_code: '550', credit_account_code: '400', description: 'Encaissement client - carte' },
    { source_type: 'payment', source_category: 'check',         debit_account_code: '550', credit_account_code: '400', description: 'Encaissement client - chèque' },

    // ---- Avoirs ----
    { source_type: 'credit_note', source_category: 'general', debit_account_code: '700', credit_account_code: '400', description: 'Avoir client' },

    // ---- Dépenses ----
    { source_type: 'expense', source_category: 'general',    debit_account_code: '6180', credit_account_code: '550', description: 'Frais généraux divers' },
    { source_type: 'expense', source_category: 'office',     debit_account_code: '6064', credit_account_code: '550', description: 'Fournitures administratives' },
    { source_type: 'expense', source_category: 'travel',     debit_account_code: '6251', credit_account_code: '550', description: 'Voyages et déplacements' },
    { source_type: 'expense', source_category: 'meals',      debit_account_code: '6257', credit_account_code: '550', description: 'Réceptions et frais de repas' },
    { source_type: 'expense', source_category: 'transport',  debit_account_code: '6241', credit_account_code: '550', description: 'Transport de biens et matériel' },
    { source_type: 'expense', source_category: 'software',   debit_account_code: '6116', credit_account_code: '550', description: 'Logiciels et abonnements numériques' },
    { source_type: 'expense', source_category: 'hardware',   debit_account_code: '6063', credit_account_code: '550', description: 'Matériel informatique (petit équipement)' },
    { source_type: 'expense', source_category: 'marketing',  debit_account_code: '6231', credit_account_code: '550', description: 'Publicité et marketing' },
    { source_type: 'expense', source_category: 'legal',      debit_account_code: '6226', credit_account_code: '550', description: 'Honoraires juridiques et comptables' },
    { source_type: 'expense', source_category: 'insurance',  debit_account_code: '616',  credit_account_code: '550', description: "Primes d'assurance" },
    { source_type: 'expense', source_category: 'rent',       debit_account_code: '6132', credit_account_code: '550', description: 'Loyers immobiliers' },
    { source_type: 'expense', source_category: 'utilities',  debit_account_code: '6061', credit_account_code: '550', description: 'Énergie (eau, gaz, électricité)' },
    { source_type: 'expense', source_category: 'telecom',    debit_account_code: '626',  credit_account_code: '550', description: 'Téléphone et Internet' },
    { source_type: 'expense', source_category: 'training',   debit_account_code: '6333', credit_account_code: '550', description: 'Formation professionnelle' },
    { source_type: 'expense', source_category: 'consulting', debit_account_code: '6226', credit_account_code: '550', description: 'Honoraires de conseil' },
    { source_type: 'expense', source_category: 'other',      debit_account_code: '658',  credit_account_code: '550', description: 'Charges diverses de gestion' },

    // ---- Factures fournisseurs ----
    { source_type: 'supplier_invoice', source_category: 'purchase', debit_account_code: '601',  credit_account_code: '440', description: 'Achats marchandises' },
    { source_type: 'supplier_invoice', source_category: 'service',  debit_account_code: '604',  credit_account_code: '440', description: 'Achats prestations de services' },
    { source_type: 'supplier_invoice', source_category: 'supply',   debit_account_code: '6022', credit_account_code: '440', description: 'Achats fournitures consommables' },
  ];
}

// ---------------------------------------------------------------------------
// Default tax rate data
// ---------------------------------------------------------------------------

/**
 * Returns the default tax rates for the given country.
 *
 * @param {string} country – "BE" | "FR"
 * @returns {Array<object>}
 */
export function getDefaultTaxRates(country) {
  if (country === 'OHADA') {
    return [
      // TVA collectée (output) — taux le plus courant zone OHADA : 18%
      { name: 'TVA 18%',   rate: 0.18,  tax_type: 'output', account_code: '4431', is_default: true },
      { name: 'TVA 19.25%', rate: 0.1925, tax_type: 'output', account_code: '4431', is_default: false },
      { name: 'TVA 0% (exonéré)', rate: 0, tax_type: 'output', account_code: '4431', is_default: false },
      // TVA déductible (input)
      { name: 'TVA récupérable 18%',    rate: 0.18,   tax_type: 'input', account_code: '4452', is_default: true },
      { name: 'TVA récupérable 19.25%', rate: 0.1925, tax_type: 'input', account_code: '4452', is_default: false },
    ];
  }

  if (country === 'FR') {
    return [
      // TVA collectée (output)
      { name: 'TVA 20%',   rate: 0.20,  tax_type: 'output', account_code: '44571', is_default: true },
      { name: 'TVA 10%',   rate: 0.10,  tax_type: 'output', account_code: '44571', is_default: false },
      { name: 'TVA 5.5%',  rate: 0.055, tax_type: 'output', account_code: '44571', is_default: false },
      { name: 'TVA 2.1%',  rate: 0.021, tax_type: 'output', account_code: '44571', is_default: false },
      // TVA déductible (input)
      { name: 'TVA déductible 20%',  rate: 0.20,  tax_type: 'input', account_code: '44566', is_default: true },
      { name: 'TVA déductible 10%',  rate: 0.10,  tax_type: 'input', account_code: '44566', is_default: false },
      { name: 'TVA déductible 5.5%', rate: 0.055, tax_type: 'input', account_code: '44566', is_default: false },
    ];
  }

  // Default: Belgium (BE)
  return [
    // TVA collectée (output)
    { name: 'TVA 21%', rate: 0.21, tax_type: 'output', account_code: '4510', is_default: true },
    { name: 'TVA 12%', rate: 0.12, tax_type: 'output', account_code: '4510', is_default: false },
    { name: 'TVA 6%',  rate: 0.06, tax_type: 'output', account_code: '4510', is_default: false },
    { name: 'TVA 0%',  rate: 0,    tax_type: 'output', account_code: '4510', is_default: false },
    // TVA déductible (input)
    { name: 'TVA déductible 21%', rate: 0.21, tax_type: 'input', account_code: '4110', is_default: true },
    { name: 'TVA déductible 12%', rate: 0.12, tax_type: 'input', account_code: '4110', is_default: false },
    { name: 'TVA déductible 6%',  rate: 0.06, tax_type: 'input', account_code: '4110', is_default: false },
  ];
}

// ---------------------------------------------------------------------------
// Copy plan accounts from a template plan to user's personal plan
// ---------------------------------------------------------------------------

/**
 * Copies accounts from a template accounting plan to a new personal plan for the user.
 *
 * @param {string} fromPlanId - The source template plan ID
 * @param {string} userId - The user ID
 * @returns {Promise<{ success: boolean, planId: string|null, accountsCopied: number, error?: string }>}
 */
export async function copyPlanAccounts(fromPlanId, userId) {
  try {
    // 1. Fetch the source plan metadata
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

    // 2. Fetch all accounts from the source plan
    const { data: sourceAccounts, error: accountsError } = await supabase
      .from('accounting_plan_accounts')
      .select('*')
      .eq('plan_id', fromPlanId)
      .order('account_code');

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

    // 3. Create a personal plan for the user
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

    // 4. Copy all accounts to the personal plan (in batches of 200)
    const BATCH_SIZE = 200;
    let totalCopied = 0;

    const rows = sourceAccounts.map((acc) => ({
      plan_id: newPlan.id,
      account_code: acc.account_code,
      account_name: acc.account_name,
      account_type: acc.account_type,
      account_category: acc.account_category || null,
      parent_code: acc.parent_code || null,
      is_active: acc.is_active !== false,
    }));

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('accounting_plan_accounts')
        .insert(batch);

      if (insertError) {
        console.error(`[AccountingInit] Error copying accounts batch ${Math.floor(i / BATCH_SIZE) + 1}:`, insertError.message);
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
 * This is an alternative entry point that copies accounts from a plan template
 * and then initializes mappings and tax rates.
 *
 * @param {string} userId
 * @param {string} planId - The accounting plan to copy from
 * @param {string} countryCode - "BE" | "FR" | "OHADA"
 * @returns {Promise<{ success: boolean, accountsCount: number, mappingsCount: number, taxRatesCount: number, error?: string }>}
 */
export async function initializeAccountingFromPlan(userId, planId, countryCode) {
  try {
    // Map country code to the format used by existing functions
    const country = countryCode || 'FR';

    // 1. Upsert user_accounting_settings
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

    // 2. Copy plan accounts to user's chart of accounts
    let accountsCount = 0;
    if (planId) {
      const { data: planAccounts, error: fetchErr } = await supabase
        .from('accounting_plan_accounts')
        .select('*')
        .eq('plan_id', planId);

      if (!fetchErr && planAccounts && planAccounts.length > 0) {
        accountsCount = await bulkInsertAccounts(userId, planAccounts);
      }
    }

    // If no accounts were copied from the plan, fall back to static data
    if (accountsCount === 0) {
      const accounts = country === 'BE' ? pcgBelge : country === 'OHADA' ? pcgOhada : pcgFrance;
      accountsCount = await bulkInsertAccounts(userId, accounts);
    }

    // 3. Insert default mappings
    const mappingsCount = await insertDefaultMappings(userId, country);

    // 4. Insert default tax rates
    const taxRatesCount = await insertDefaultTaxRates(userId, country);

    // 5. Mark user as initialized
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
