import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Default payment methods (fallback if DB fetch fails)
 */
const DEFAULT_METHODS = [
  { code: 'bank_transfer', name: 'bank_transfer', icon: 'Landmark', sort_order: 1 },
  { code: 'cash', name: 'cash', icon: 'Banknote', sort_order: 2 },
  { code: 'card', name: 'card', icon: 'CreditCard', sort_order: 3 },
  { code: 'check', name: 'check', icon: 'DollarSign', sort_order: 4 },
  { code: 'paypal', name: 'paypal', icon: 'Globe', sort_order: 5 },
  { code: 'other', name: 'other', icon: 'MoreHorizontal', sort_order: 6 },
];

/**
 * Hook that fetches payment methods from the payment_methods DB table.
 * Falls back to DEFAULT_METHODS if the fetch fails or returns empty.
 */
export function usePaymentMethods() {
  const [methods, setMethods] = useState(DEFAULT_METHODS);

  useEffect(() => {
    supabase
      .from('payment_methods')
      .select('code, name, icon, sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) {
          console.warn('Failed to fetch payment methods from DB, using defaults:', error);
          return;
        }
        if (data && data.length > 0) {
          setMethods(data);
        }
      });
  }, []);

  return methods;
}

export default usePaymentMethods;
