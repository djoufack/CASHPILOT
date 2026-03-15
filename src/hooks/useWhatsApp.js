import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const useWhatsApp = () => {
  const { user } = useAuth();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendInvoice = useCallback(
    async (invoiceId, phoneNumber, template = null) => {
      if (!user || !activeCompanyId) return null;
      setLoading(true);
      setError(null);

      try {
        const res = await supabase.functions.invoke('whatsapp-send-invoice', {
          body: {
            invoice_id: invoiceId,
            phone_number: phoneNumber,
            template,
            company_id: activeCompanyId,
            message_type: 'invoice',
          },
        });

        if (res.error) throw new Error(res.error.message || 'Failed to send invoice via WhatsApp');
        return res.data;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, activeCompanyId]
  );

  const sendReminder = useCallback(
    async (invoiceId, phoneNumber) => {
      if (!user || !activeCompanyId) return null;
      setLoading(true);
      setError(null);

      try {
        const res = await supabase.functions.invoke('whatsapp-send-invoice', {
          body: {
            invoice_id: invoiceId,
            phone_number: phoneNumber,
            company_id: activeCompanyId,
            message_type: 'reminder',
          },
        });

        if (res.error) throw new Error(res.error.message || 'Failed to send reminder via WhatsApp');
        return res.data;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, activeCompanyId]
  );

  const getMessageHistory = useCallback(
    async (clientId = null) => {
      if (!user) return [];
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('whatsapp_messages')
          .select('*, invoice:invoices(id, invoice_number, total_ttc), client:clients(id, company_name, contact_name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        query = applyCompanyScope(query);

        if (clientId) {
          query = query.eq('client_id', clientId);
        }

        const { data, error: queryErr } = await query;
        if (queryErr) throw queryErr;
        return data ?? [];
      } catch (err) {
        setError(err.message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [user, applyCompanyScope]
  );

  return {
    loading,
    error,
    sendInvoice,
    sendReminder,
    getMessageHistory,
  };
};
