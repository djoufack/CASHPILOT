export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function invoiceSentTemplate(params: {
  clientName: string;
  invoiceNumber: string;
  totalTTC: number;
  currency: string;
  dueDate: string;
  companyName: string;
  viewUrl?: string;
}): EmailTemplate {
  const { clientName, invoiceNumber, totalTTC, currency, dueDate, companyName, viewUrl } = params;
  return {
    subject: `Facture ${invoiceNumber} de ${companyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; padding: 32px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #f59e0b; font-size: 24px; margin: 0;">${companyName}</h1>
        </div>
        <p>Bonjour ${clientName},</p>
        <p>Veuillez trouver ci-joint la facture <strong>${invoiceNumber}</strong>.</p>
        <div style="background: #16213e; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Montant:</strong> ${totalTTC.toFixed(2)} ${currency}</p>
          <p style="margin: 4px 0;"><strong>Échéance:</strong> ${dueDate}</p>
        </div>
        ${viewUrl ? `<p><a href="${viewUrl}" style="color: #f59e0b;">Voir la facture en ligne</a></p>` : ''}
        <p>Cordialement,<br/>${companyName}</p>
      </div>
    `,
    text: `Bonjour ${clientName},\n\nFacture ${invoiceNumber} - Montant: ${totalTTC.toFixed(2)} ${currency} - Échéance: ${dueDate}\n\nCordialement,\n${companyName}`,
  };
}

export function paymentReminderTemplate(params: {
  clientName: string;
  invoiceNumber: string;
  totalTTC: number;
  currency: string;
  dueDate: string;
  daysOverdue: number;
  companyName: string;
}): EmailTemplate {
  const { clientName, invoiceNumber, totalTTC, currency, dueDate, daysOverdue, companyName } = params;
  const urgency = daysOverdue > 30 ? 'URGENT' : daysOverdue > 14 ? 'Rappel' : 'Rappel amical';
  return {
    subject: `${urgency}: Facture ${invoiceNumber} en attente de paiement`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; padding: 32px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #f59e0b; font-size: 24px; margin: 0;">${companyName}</h1>
        </div>
        <p>Bonjour ${clientName},</p>
        <p>Nous vous rappelons que la facture <strong>${invoiceNumber}</strong> est en attente de paiement${daysOverdue > 0 ? ` depuis ${daysOverdue} jours` : ''}.</p>
        <div style="background: #16213e; padding: 16px; border-radius: 8px; margin: 20px 0; ${daysOverdue > 30 ? 'border-left: 4px solid #ef4444;' : ''}">
          <p style="margin: 4px 0;"><strong>Montant dû:</strong> ${totalTTC.toFixed(2)} ${currency}</p>
          <p style="margin: 4px 0;"><strong>Échéance:</strong> ${dueDate}</p>
          ${daysOverdue > 0 ? `<p style="margin: 4px 0; color: #ef4444;"><strong>Retard:</strong> ${daysOverdue} jours</p>` : ''}
        </div>
        <p>Merci de procéder au règlement dans les meilleurs délais.</p>
        <p>Cordialement,<br/>${companyName}</p>
      </div>
    `,
    text: `Bonjour ${clientName},\n\n${urgency}: Facture ${invoiceNumber} - ${totalTTC.toFixed(2)} ${currency} - Échéance: ${dueDate} - Retard: ${daysOverdue} jours\n\nCordialement,\n${companyName}`,
  };
}
