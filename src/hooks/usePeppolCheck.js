import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

export const usePeppolCheck = () => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const checkRegistration = useCallback(async (peppolId) => {
    if (!supabase || !peppolId) return null;

    setChecking(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('peppol-check', {
        body: { peppol_id: peppolId },
      });

      if (error) throw error;

      setResult(data);

      if (data.registered) {
        toast({
          title: t('peppol.checkRegistered'),
          description: peppolId,
          className: 'bg-green-600 border-none text-white',
        });
      } else {
        toast({
          title: t('peppol.checkNotRegistered'),
          description: peppolId,
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
  }, [toast, t]);

  const reset = useCallback(() => {
    setResult(null);
  }, []);

  return { checkRegistration, checking, result, reset, canUsePeppol: true };
};
