
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  sendInvoiceEmail as sendInvoiceEmailService,
  sendPaymentReminder as sendPaymentReminderService,
} from '@/services/emailService';

export const useEmailService = () => {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [lastSentAt, setLastSentAt] = useState(null);

  const sendInvoiceEmail = useCallback(async (invoice, client, { pdfBase64 } = {}) => {
    if (!user || !client?.email) throw new Error('Missing user or client email');
    setSending(true);
    setSendError(null);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, full_name')
        .eq('user_id', user.id)
        .single();

      const companyName = profile?.company_name || profile?.full_name || 'CashPilot';

      const result = await sendInvoiceEmailService({
        invoiceId: invoice.id,
        recipientEmail: client.email,
        pdfBase64,
        invoice,
        client,
        companyName,
      });

      setLastSentAt(new Date().toISOString());
      return result;
    } catch (err) {
      setSendError(err.message || 'Failed to send email');
      throw err;
    } finally {
      setSending(false);
    }
  }, [user]);

  const sendPaymentReminder = useCallback(async (invoice, client) => {
    if (!user || !client?.email) throw new Error('Missing user or client email');
    setSending(true);
    setSendError(null);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, full_name')
        .eq('user_id', user.id)
        .single();

      const companyName = profile?.company_name || profile?.full_name || 'CashPilot';

      const result = await sendPaymentReminderService({
        invoiceId: invoice.id,
        recipientEmail: client.email,
        invoice,
        client,
        companyName,
      });

      setLastSentAt(new Date().toISOString());
      return result;
    } catch (err) {
      setSendError(err.message || 'Failed to send payment reminder');
      throw err;
    } finally {
      setSending(false);
    }
  }, [user]);

  return { sendInvoiceEmail, sendPaymentReminder, sending, sendError, lastSentAt };
};
