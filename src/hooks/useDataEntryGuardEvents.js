import { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

const EVENT_NAME = 'cashpilot:data-entry-guard';

export const useDataEntryGuardEvents = () => {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onGuardEvent = (event) => {
      const detail = event?.detail;
      if (!detail || !detail.message) return;

      const isWarning = detail.level === 'warning';
      const isInfo = detail.level === 'info';
      if (!isWarning && !isInfo) return;

      toast({
        title: isWarning ? 'Attention a la saisie' : 'Auto-correction appliquee',
        description: detail.message,
        duration: isWarning ? 9000 : 5000,
      });
    };

    window.addEventListener(EVENT_NAME, onGuardEvent);
    return () => window.removeEventListener(EVENT_NAME, onGuardEvent);
  }, [toast]);
};
