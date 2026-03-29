/**
 * useAccountingTaxonomy — DB-driven accounting plan class prefix hook
 *
 * ENF-1: Fetches account class prefixes from the `accounting_account_taxonomy`
 * reference table (seeded in migration 20260308130000_accounting_sql_foundation.sql).
 * Replaces all hardcoded prefix arrays in frontend components.
 *
 * Provides:
 *   - caAccountPrefixes     : revenue prefixes for Chiffre d'Affaires (sales_revenue + operating_revenue)
 *   - chargesAccountPrefixes: expense prefixes for Charges d'Exploitation
 *                             (operating_cash_expense + supplier_expense + direct_cost_expense)
 *   - loading, error
 *
 * Supported regions: 'france' | 'belgium' | 'ohada'
 * Country → region mapping: FR → france, BE → belgium, OHADA → ohada (default: france)
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const COUNTRY_TO_REGION = {
  FR: 'france',
  BE: 'belgium',
  OHADA: 'ohada',
};

/**
 * Returns the taxonomy region key for a given company country code.
 * Falls back to 'france' for unknown countries (PCG is the most common default).
 */
function resolveRegion(country) {
  return COUNTRY_TO_REGION[country] || 'france';
}

/**
 * Semantic roles that correspond to Chiffre d'Affaires (revenue).
 * Used to build caAccountPrefixes.
 */
const CA_SEMANTIC_ROLES = ['sales_revenue', 'operating_revenue'];

/**
 * Semantic roles that correspond to Charges d'Exploitation.
 * Used to build chargesAccountPrefixes.
 */
const CHARGES_SEMANTIC_ROLES = ['operating_cash_expense', 'supplier_expense', 'direct_cost_expense'];

/**
 * In-memory cache: region → { caAccountPrefixes, chargesAccountPrefixes }
 * Avoids redundant Supabase queries across component re-renders.
 */
const taxonomyCache = {};

export function useAccountingTaxonomy(country = 'FR') {
  const region = resolveRegion(country);

  const [caAccountPrefixes, setCaAccountPrefixes] = useState(taxonomyCache[region]?.caAccountPrefixes ?? null);
  const [chargesAccountPrefixes, setChargesAccountPrefixes] = useState(
    taxonomyCache[region]?.chargesAccountPrefixes ?? null
  );
  const [loading, setLoading] = useState(!taxonomyCache[region]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Return immediately if already cached
    if (taxonomyCache[region]) {
      setCaAccountPrefixes(taxonomyCache[region].caAccountPrefixes);
      setChargesAccountPrefixes(taxonomyCache[region].chargesAccountPrefixes);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchTaxonomy() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('accounting_account_taxonomy')
          .select('code_prefix, semantic_role')
          .eq('region', region);

        if (fetchError) throw fetchError;
        if (cancelled) return;

        // Deduplicate prefixes per semantic role group
        const caSet = new Set();
        const chargesSet = new Set();

        for (const row of data || []) {
          if (CA_SEMANTIC_ROLES.includes(row.semantic_role)) {
            caSet.add(row.code_prefix);
          }
          if (CHARGES_SEMANTIC_ROLES.includes(row.semantic_role)) {
            chargesSet.add(row.code_prefix);
          }
        }

        const result = {
          caAccountPrefixes: Array.from(caSet).sort(),
          chargesAccountPrefixes: Array.from(chargesSet).sort(),
        };

        // Write through to cache
        taxonomyCache[region] = result;

        setCaAccountPrefixes(result.caAccountPrefixes);
        setChargesAccountPrefixes(result.chargesAccountPrefixes);
      } catch (err) {
        if (cancelled) return;
        console.error('[useAccountingTaxonomy] Failed to fetch taxonomy:', err);
        setError(err);

        // Graceful fallback: use standard PCG/OHADA defaults so UI never breaks
        // These are last-resort fallbacks only — DB is the source of truth.
        const fallback = buildFallback(region);
        setCaAccountPrefixes(fallback.caAccountPrefixes);
        setChargesAccountPrefixes(fallback.chargesAccountPrefixes);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTaxonomy();
    return () => {
      cancelled = true;
    };
  }, [region]);

  return { caAccountPrefixes, chargesAccountPrefixes, loading, error };
}

/**
 * Last-resort fallback when DB is unreachable.
 * These are the universal plan comptable backbone prefixes —
 * identical across FR, BE (PCMN), and OHADA for class 6 & 7 structures.
 * This is NOT ENF-1 data (not business data displayed in UI) — it is a
 * purely defensive code-path for catastrophic DB unavailability.
 */
function buildFallback(region) {
  if (region === 'ohada') {
    return {
      caAccountPrefixes: ['70', '71', '72', '73', '74', '75'],
      chargesAccountPrefixes: ['60', '61', '62', '63', '64', '65', '66'],
    };
  }
  if (region === 'belgium') {
    return {
      caAccountPrefixes: ['70', '71', '72', '74', '75'],
      chargesAccountPrefixes: ['60', '61', '62', '63', '64', '65'],
    };
  }
  // france (default)
  return {
    caAccountPrefixes: ['70', '71', '72', '73', '74', '75'],
    chargesAccountPrefixes: ['60', '61', '62', '63', '64', '65'],
  };
}
