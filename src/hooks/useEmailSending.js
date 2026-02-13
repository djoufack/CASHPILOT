import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  sendInvoiceEmail as sendInvoiceEmailService,
  sendPaymentReminder as sendPaymentReminderService,
} from '@/services/emailService';

/**
 * Hook for sending emails with loading state, error tracking, and timestamp.
 *
 * Provides:
 *  - sendEmail(params) - generic email sending
 *  - sending - boolean loading state
 *  - sendError - last error (or null)
 *  - lastSentAt - timestamp of last successful send (or null)
 */
export const useEmailSending = () => {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [lastSentAt, setLastSentAt] = useState(null);

  /**
   * Generic email send function. Calls the send-email Edge Function directly.
   */
  const sendEmail = useCallback(async (params) => {
    if (!user) throw new Error('Not authenticated');
    setSending(true);
    setSendError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            ...params,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to send email' }));
        throw new Error(err.error || 'Failed to send email');
      }

      const result = await response.json();
      setLastSentAt(new Date().toISOString());
      return result;
    } catch (err) {
      setSendError(err.message || 'Failed to send email');
      throw err;
    } finally {
      setSending(false);
    }
  }, [user]);

  /**
   * Send an invoice email using the email service.
   */
  const sendInvoiceByEmail = useCallback(async ({ invoice, client, companyName, pdfBase64 }) => {
    if (!user) throw new Error('Not authenticated');
    if (!client?.email) throw new Error('Missing client email');
    setSending(true);
    setSendError(null);
    try {
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
      setSendError(err.message || 'Failed to send invoice email');
      throw err;
    } finally {
      setSending(false);
    }
  }, [user]);

  /**
   * Send a payment reminder email using the email service.
   */
  const sendPaymentReminderEmail = useCallback(async ({ invoice, client, companyName }) => {
    if (!user) throw new Error('Not authenticated');
    if (!client?.email) throw new Error('Missing client email');
    setSending(true);
    setSendError(null);
    try {
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

  return {
    sendEmail,
    sendInvoiceByEmail,
    sendPaymentReminderEmail,
    sending,
    sendError,
    lastSentAt,
  };
};
