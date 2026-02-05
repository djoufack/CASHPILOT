
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useEmailService = () => {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  const sendInvoiceEmail = async (invoice, client) => {
    if (!user || !client?.email) throw new Error('Missing user or client email');
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, full_name')
        .eq('user_id', user.id)
        .single();

      const companyName = profile?.company_name || profile?.full_name || 'CashPilot';

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
            to: client.email,
            subject: `Facture ${invoice.invoice_number} de ${companyName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; padding: 32px; border-radius: 12px;">
                <h1 style="color: #f59e0b; font-size: 24px;">${companyName}</h1>
                <p>Bonjour ${client.company_name || client.contact_name || client.name || ''},</p>
                <p>Veuillez trouver ci-joint la facture <strong>${invoice.invoice_number}</strong>.</p>
                <div style="background: #16213e; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Montant:</strong> ${(invoice.total_ttc || 0).toFixed(2)} ${invoice.currency || client.preferred_currency || 'EUR'}</p>
                  <p><strong>&Eacute;ch&eacute;ance:</strong> ${invoice.due_date || 'N/A'}</p>
                </div>
                <p>Cordialement,<br/>${companyName}</p>
              </div>
            `,
            text: `Facture ${invoice.invoice_number} - Montant: ${(invoice.total_ttc || 0).toFixed(2)} ${invoice.currency || client.preferred_currency || 'EUR'} - Echeance: ${invoice.due_date || 'N/A'}`,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to send email');
      }

      return await response.json();
    } finally {
      setSending(false);
    }
  };

  return { sendInvoiceEmail, sending };
};
