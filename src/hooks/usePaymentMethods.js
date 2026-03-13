import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Hook that fetches payment methods from the payment_methods DB table.
 * DB is the source of truth: no hardcoded payment method fallback.
 */
export function usePaymentMethods() {
  const [methods, setMethods] = useState([]);

  useEffect(() => {
    supabase
      .from('payment_methods')
      .select('code, name, icon, sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) {
          console.warn('Failed to fetch payment methods from DB:', error);
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
