import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useCompany } from '@/hooks/useCompany';
import { validateForPeppolBE } from '@/services/peppolValidation';
import { useCreditsGuard, CREDIT_COSTS, CREDIT_COST_LABELS } from '@/hooks/useCreditsGuard';
import { readFunctionErrorData } from '@/utils/supabaseFunctionErrors';

const POLL_INTERVAL_MS = 10_000;
const POLL_MAX_ATTEMPTS = 12; // 2 minutes total

export const usePeppolSend = () => {
  const [sending, setSending] = useState(false);
  const [polling, setPolling] = useState(false);
  const [peppolStatus, setPeppolStatus] = useState(null);
  const pollRef = useRef(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { company } = useCompany();
  const { ensureCredits, openCreditsModal, modalProps } = useCreditsGuard();

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  const pollStatus = useCallback((invoiceId, documentId) => {
    let attempts = 0;
    setPolling(true);
    setPeppolStatus('pending');

    pollRef.current = setInterval(async () => {
      attempts++;

      try {
        const { data, error } = await supabase.functions.invoke('peppol-poll-status', {
          body: { invoice_id: invoiceId, document_id: documentId },
        });

        if (error) throw error;

        setPeppolStatus(data.status);

        if (data.final) {
          stopPolling();
          if (data.status === 'delivered' || data.status === 'accepted') {
            toast({
              title: t('peppol.status.delivered'),
              description: `Document ${documentId}`,
              className: 'bg-green-600 border-none text-white',
            });
          } else if (data.status === 'error') {
            toast({
              title: t('peppol.status.error'),
              description: data.errorMessage || 'Scrada error',
              variant: 'destructive',
            });
          }
        }
      } catch {
        // Silent retry — polling is best-effort
      }

      if (attempts >= POLL_MAX_ATTEMPTS) {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, toast, t]);

  const sendViaPeppol = async (invoice, client, items) => {
    if (!supabase) throw new Error('Supabase not configured');

    // Pre-validate
    const validation = validateForPeppolBE(invoice, company, client, items);
    if (!validation.isValid) {
      const messages = validation.errors.map(e => `[${e.rule}] ${e.message}`).join('\n');
      toast({
        title: t('peppol.validationFailed'),
        description: messages,
        variant: 'destructive',
      });
      return { success: false, errors: validation.errors };
    }

    const hasCredits = await ensureCredits(
      CREDIT_COSTS.PEPPOL_SEND_INVOICE,
      t(CREDIT_COST_LABELS.PEPPOL_SEND_INVOICE),
    );
    if (!hasCredits) {
      return { success: false, error: 'insufficient_credits' };
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('peppol-send', {
        body: { invoice_id: invoice.id },
      });

      if (error) throw error;

      toast({
        title: t('peppol.sentSuccess'),
        description: `Document ID: ${data.documentId}`,
      });

      // Start polling for status updates
      if (data.documentId) {
        pollStatus(invoice.id, data.documentId);
      }

      return { success: true, documentId: data.documentId };
    } catch (err) {
      const details = await readFunctionErrorData(err);
      if (details?.error === 'insufficient_credits') {
        openCreditsModal(
          CREDIT_COSTS.PEPPOL_SEND_INVOICE,
          t(CREDIT_COST_LABELS.PEPPOL_SEND_INVOICE),
        );
        return { success: false, error: 'insufficient_credits' };
      }

      toast({
        title: t('peppol.sendError'),
        description: details?.error || err.message,
        variant: 'destructive',
      });
      return { success: false, error: details?.error || err.message };
    } finally {
      setSending(false);
    }
  };

  return {
    sendViaPeppol,
    sending,
    polling,
    peppolStatus,
    stopPolling,
    canUsePeppol: true,
    creditsModalProps: modalProps,
  };
};
