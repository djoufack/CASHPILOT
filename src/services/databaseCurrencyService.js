import { supabase } from '@/lib/supabase';
import { resolveAccountingCurrency } from '@/utils/accountingCurrency';

export { resolveAccountingCurrency };

export async function getDatabaseExchangeRate({
  fromCurrency,
  toCurrency,
  effectiveOn,
  companyId = null,
}) {
  const { data, error } = await supabase.rpc('get_exchange_rate', {
    p_from_currency: fromCurrency,
    p_to_currency: toCurrency,
    p_effective_on: effectiveOn || new Date().toISOString().slice(0, 10),
    p_company_id: companyId,
  });

  if (error) {
    throw error;
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0];
}

export async function convertAmountWithDatabaseRate({
  amount,
  fromCurrency,
  toCurrency,
  effectiveOn,
  companyId = null,
  scale = 6,
}) {
  const { data, error } = await supabase.rpc('convert_currency_amount', {
    p_amount: amount,
    p_from_currency: fromCurrency,
    p_to_currency: toCurrency,
    p_effective_on: effectiveOn || new Date().toISOString().slice(0, 10),
    p_company_id: companyId,
    p_scale: scale,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function listAccessibleFxRates({ companyId = null } = {}) {
  let query = supabase
    .from('fx_rates')
    .select('*')
    .order('rate_date', { ascending: false })
    .order('base_currency', { ascending: true })
    .order('quote_currency', { ascending: true });

  if (companyId) {
    query = query.or(`company_id.is.null,company_id.eq.${companyId}`);
  } else {
    query = query.is('company_id', null);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}
