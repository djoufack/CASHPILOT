import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Hook that fetches payment methods from the payment_methods DB table.
 * DB is the source of truth:
 * - Primary source: company/user scoped `payment_methods`
 * - Fallback source: global `reference_debt_payment_methods` when primary is empty
 */
export function usePaymentMethods() {
  const [methods, setMethods] = useState([]);

  useEffect(() => {
    let mounted = true;

    const fetchMethods = async () => {
      const { data: scopedMethods, error: scopedError } = await supabase
        .from('payment_methods')
        .select('code, name, icon, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (scopedError) {
        console.warn('Failed to fetch scoped payment methods from DB:', scopedError);
      }

      if (mounted && Array.isArray(scopedMethods) && scopedMethods.length > 0) {
        setMethods(scopedMethods);
        return;
      }

      const { data: referenceMethods, error: referenceError } = await supabase
        .from('reference_debt_payment_methods')
        .select('code, label_key, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (referenceError) {
        console.warn('Failed to fetch reference payment methods from DB:', referenceError);
        return;
      }

      if (!mounted || !Array.isArray(referenceMethods) || referenceMethods.length === 0) return;

      setMethods(
        referenceMethods.map((method) => ({
          code: method.code,
          name: method.code,
          icon: null,
          sort_order: method.sort_order,
        }))
      );
    };

    fetchMethods();

    return () => {
      mounted = false;
    };
  }, []);

  return methods;
}

export default usePaymentMethods;
