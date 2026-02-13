import { supabase } from '@/lib/supabase';

/**
 * Escape HTML special characters to prevent XSS in email templates.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Base function to call the send-email Edge Function.
 */
const callSendEmail = async (payload) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to send email' }));
    throw new Error(err.error || 'Failed to send email');
  }

  return response.json();
};

/**
 * Send an invoice by email.
 * @param {Object} params
 * @param {string} params.invoiceId - The invoice ID (for audit purposes)
 * @param {string} params.recipientEmail - Recipient email address
 * @param {string} [params.pdfBase64] - PDF invoice as base64 string (optional attachment)
 * @param {Object} params.invoice - The invoice object
 * @param {Object} params.client - The client object
 * @param {string} params.companyName - The sender company name
 */
export const sendInvoiceEmail = async ({ invoiceId, recipientEmail, pdfBase64, invoice, client, companyName }) => {
  const clientName = client?.company_name || client?.contact_name || client?.name || '';
  const invoiceNumber = invoice?.invoice_number || invoice?.invoiceNumber || '';
  const totalTTC = Number(invoice?.total_ttc || invoice?.total || 0);
  const currency = client?.preferred_currency || invoice?.currency || 'EUR';
  const dueDate = invoice?.due_date || invoice?.dueDate || 'N/A';

  const subject = `Facture ${escapeHtml(invoiceNumber)} de ${escapeHtml(companyName)}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; padding: 32px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #f59e0b; font-size: 24px; margin: 0;">${escapeHtml(companyName)}</h1>
      </div>
      <p>Bonjour ${escapeHtml(clientName)},</p>
      <p>Veuillez trouver ci-joint la facture <strong>${escapeHtml(invoiceNumber)}</strong>.</p>
      <div style="background: #16213e; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 4px 0;"><strong>Montant:</strong> ${totalTTC.toFixed(2)} ${escapeHtml(currency)}</p>
        <p style="margin: 4px 0;"><strong>&Eacute;ch&eacute;ance:</strong> ${escapeHtml(dueDate)}</p>
      </div>
      <p>Cordialement,<br/>${escapeHtml(companyName)}</p>
    </div>
  `;

  const text = `Bonjour ${escapeHtml(clientName)},\n\nFacture ${escapeHtml(invoiceNumber)} - Montant: ${totalTTC.toFixed(2)} ${escapeHtml(currency)} - Echeance: ${escapeHtml(dueDate)}\n\nCordialement,\n${escapeHtml(companyName)}`;

  const payload = {
    to: recipientEmail,
    subject,
    html,
    text,
  };

  // Add PDF attachment if provided
  if (pdfBase64) {
    payload.attachments = [
      {
        filename: `${invoiceNumber || 'facture'}.pdf`,
        content: pdfBase64,
      },
    ];
  }

  return callSendEmail(payload);
};

/**
 * Send a payment reminder email.
 * @param {Object} params
 * @param {string} params.invoiceId - The invoice ID
 * @param {string} params.recipientEmail - Recipient email address
 * @param {Object} params.invoice - The invoice object
 * @param {Object} params.client - The client object
 * @param {string} params.companyName - The sender company name
 */
export const sendPaymentReminder = async ({ invoiceId, recipientEmail, invoice, client, companyName }) => {
  const clientName = client?.company_name || client?.contact_name || client?.name || '';
  const invoiceNumber = invoice?.invoice_number || invoice?.invoiceNumber || '';
  const totalTTC = Number(invoice?.total_ttc || invoice?.total || 0);
  const currency = client?.preferred_currency || invoice?.currency || 'EUR';
  const dueDate = invoice?.due_date || invoice?.dueDate || 'N/A';

  // Calculate days overdue
  let daysOverdue = 0;
  if (dueDate && dueDate !== 'N/A') {
    const due = new Date(dueDate);
    const now = new Date();
    daysOverdue = Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
  }

  const urgency = daysOverdue > 30 ? 'URGENT' : daysOverdue > 14 ? 'Rappel' : 'Rappel amical';
  const subject = `${urgency}: Facture ${escapeHtml(invoiceNumber)} en attente de paiement`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; padding: 32px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #f59e0b; font-size: 24px; margin: 0;">${escapeHtml(companyName)}</h1>
      </div>
      <p>Bonjour ${escapeHtml(clientName)},</p>
      <p>Nous vous rappelons que la facture <strong>${escapeHtml(invoiceNumber)}</strong> est en attente de paiement${daysOverdue > 0 ? ` depuis ${daysOverdue} jours` : ''}.</p>
      <div style="background: #16213e; padding: 16px; border-radius: 8px; margin: 20px 0; ${daysOverdue > 30 ? 'border-left: 4px solid #ef4444;' : ''}">
        <p style="margin: 4px 0;"><strong>Montant d&ucirc;:</strong> ${totalTTC.toFixed(2)} ${escapeHtml(currency)}</p>
        <p style="margin: 4px 0;"><strong>&Eacute;ch&eacute;ance:</strong> ${escapeHtml(dueDate)}</p>
        ${daysOverdue > 0 ? `<p style="margin: 4px 0; color: #ef4444;"><strong>Retard:</strong> ${daysOverdue} jours</p>` : ''}
      </div>
      <p>Merci de proc&eacute;der au r&egrave;glement dans les meilleurs d&eacute;lais.</p>
      <p>Cordialement,<br/>${escapeHtml(companyName)}</p>
    </div>
  `;

  const text = `Bonjour ${escapeHtml(clientName)},\n\n${urgency}: Facture ${escapeHtml(invoiceNumber)} - ${totalTTC.toFixed(2)} ${escapeHtml(currency)} - Echeance: ${escapeHtml(dueDate)} - Retard: ${daysOverdue} jours\n\nCordialement,\n${escapeHtml(companyName)}`;

  return callSendEmail({
    to: recipientEmail,
    subject,
    html,
    text,
  });
};
