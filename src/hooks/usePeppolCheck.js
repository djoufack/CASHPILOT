import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useCompany } from '@/hooks/useCompany';
import { resolvePeppolCheckPayload } from '@/utils/peppolCheckQuery';

export const usePeppolCheck = () => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { company } = useCompany();

  const checkRegistration = useCallback(
    async (searchInput) => {
      const payload = resolvePeppolCheckPayload(searchInput);
      if (!supabase || !payload) return null;

      setChecking(true);
      setResult(null);

      try {
        const { data, error } = await supabase.functions.invoke('peppol-check', {
          body: { ...payload, company_id: company?.id || null },
        });

        if (error) throw error;

        setResult(data);

        const resolvedDisplay =
          data?.peppolId ||
          data?.input ||
          payload?.peppol_id ||
          payload?.vat_number ||
          payload?.company_name ||
          payload?.query;

        if (data.registered) {
          toast({
            title: t('peppol.checkRegistered'),
            description: resolvedDisplay,
            className: 'bg-green-600 border-none text-white',
          });
        } else {
          toast({
            title: t('peppol.checkNotRegistered'),
            description: resolvedDisplay,
            variant: 'destructive',
          });
        }

        return data;
      } catch (err) {
        toast({
          title: t('peppol.checkError'),
          description: err.message,
          variant: 'destructive',
        });
        return null;
      } finally {
        setChecking(false);
      }
    },
    [company?.id, toast, t]
  );

  const reset = useCallback(() => {
    setResult(null);
  }, []);

  return { checkRegistration, checking, result, reset, canUsePeppol: true };
};
