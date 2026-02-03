import html2pdf from 'html2pdf.js';

/**
 * Generate HTML content for Invoice document
 */
const generateInvoiceHTML = (invoice, companyInfo) => {
  const items = invoice.items || [];
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const totalTax = items.reduce((sum, item) => sum + (item.quantity * item.unit_price * item.tax_rate / 100), 0);
  const total = subtotal + totalTax;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">FACTURE</h1>
        <p style="margin: 0; font-size: 18px; opacity: 0.9;">${invoice.invoice_number || invoice.invoiceNumber || 'N/A'}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
        <div>
          <h3 style="color: #16a34a; margin-bottom: 10px;">Émetteur</h3>
          <p style="margin: 5px 0;"><strong>${companyInfo?.name || 'Votre Entreprise'}</strong></p>
          <p style="margin: 5px 0; color: #666;">${companyInfo?.address || ''}</p>
          <p style="margin: 5px 0; color: #666;">${companyInfo?.email || ''}</p>
          <p style="margin: 5px 0; color: #666;">${companyInfo?.phone || ''}</p>
        </div>
        <div>
          <h3 style="color: #16a34a; margin-bottom: 10px;">Client</h3>
          <p style="margin: 5px 0;"><strong>${invoice.client?.company_name || invoice.client?.companyName || 'Client'}</strong></p>
          <p style="margin: 5px 0; color: #666;">${invoice.client?.email || ''}</p>
          <p style="margin: 5px 0; color: #666;">${invoice.client?.phone || ''}</p>
          <p style="margin: 5px 0; color: #666;">${invoice.client?.address || ''}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f0fdf4; padding: 15px; border-radius: 8px;">
        <div>
          <p style="margin: 5px 0; color: #666;">Date d'émission: <strong>${invoice.date ? new Date(invoice.date).toLocaleDateString('fr-FR') : 'N/A'}</strong></p>
          <p style="margin: 5px 0; color: #666;">Date d'échéance: <strong>${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : 'N/A'}</strong></p>
        </div>
        <div>
          <p style="margin: 5px 0; color: #666;">Statut: <strong style="color: #16a34a;">${invoice.status || 'draft'}</strong></p>
          <p style="margin: 5px 0; color: #666;">Conditions de paiement: <strong>${invoice.payment_terms || 'N/A'}</strong></p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #f3f4f6; border-bottom: 2px solid #16a34a;">
            <th style="padding: 12px; text-align: left; font-weight: 600;">Description</th>
            <th style="padding: 12px; text-align: center; font-weight: 600;">Qté</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">P.U.</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">TVA</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px;">${item.description || ''}</td>
              <td style="padding: 12px; text-align: center;">${item.quantity || 0}</td>
              <td style="padding: 12px; text-align: right;">${(item.unit_price || 0).toFixed(2)} €</td>
              <td style="padding: 12px; text-align: right;">${item.tax_rate || 0}%</td>
              <td style="padding: 12px; text-align: right; font-weight: 600;">${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)} €</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-left: auto; width: 300px; background: #f0fdf4; padding: 20px; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: #666;">Sous-total HT:</span>
          <span style="font-weight: 600;">${subtotal.toFixed(2)} €</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: #666;">TVA:</span>
          <span style="font-weight: 600;">${totalTax.toFixed(2)} €</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid #16a34a;">
          <span style="font-size: 18px; font-weight: bold;">Total TTC:</span>
          <span style="font-size: 20px; font-weight: bold; color: #16a34a;">${total.toFixed(2)} €</span>
        </div>
        ${invoice.balance_due ? `
          <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #d1d5db;">
            <span style="color: #dc2626; font-weight: 600;">Solde dû:</span>
            <span style="color: #dc2626; font-weight: bold;">${Number(invoice.balance_due).toFixed(2)} €</span>
          </div>
        ` : ''}
      </div>

      ${invoice.notes ? `
        <div style="margin-top: 30px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
          <p style="margin: 0; color: #92400e;"><strong>Notes:</strong></p>
          <p style="margin: 5px 0 0 0; color: #78350f;">${invoice.notes}</p>
        </div>
      ` : ''}

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">Document généré par CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
      </div>
    </div>
  `;
};

/**
 * Generate HTML content for Quote document
 */
const generateQuoteHTML = (quote, companyInfo) => {
  const items = quote.items || [];
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const totalTax = items.reduce((sum, item) => sum + (item.quantity * item.unit_price * item.tax_rate / 100), 0);
  const total = subtotal + totalTax;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">DEVIS</h1>
        <p style="margin: 0; font-size: 18px; opacity: 0.9;">${quote.quote_number || 'N/A'}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
        <div>
          <h3 style="color: #f97316; margin-bottom: 10px;">Émetteur</h3>
          <p style="margin: 5px 0;"><strong>${companyInfo?.name || 'Votre Entreprise'}</strong></p>
          <p style="margin: 5px 0; color: #666;">${companyInfo?.address || ''}</p>
          <p style="margin: 5px 0; color: #666;">${companyInfo?.email || ''}</p>
          <p style="margin: 5px 0; color: #666;">${companyInfo?.phone || ''}</p>
        </div>
        <div>
          <h3 style="color: #f97316; margin-bottom: 10px;">Client</h3>
          <p style="margin: 5px 0;"><strong>${quote.client?.company_name || 'Client'}</strong></p>
          <p style="margin: 5px 0; color: #666;">${quote.client?.email || ''}</p>
          <p style="margin: 5px 0; color: #666;">${quote.client?.phone || ''}</p>
          <p style="margin: 5px 0; color: #666;">${quote.client?.address || ''}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f9fafb; padding: 15px; border-radius: 8px;">
        <div>
          <p style="margin: 5px 0; color: #666;">Date: <strong>${quote.date ? new Date(quote.date).toLocaleDateString('fr-FR') : 'N/A'}</strong></p>
        </div>
        <div>
          <p style="margin: 5px 0; color: #666;">Statut: <strong style="color: #f97316;">${quote.status || 'draft'}</strong></p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #f3f4f6; border-bottom: 2px solid #f97316;">
            <th style="padding: 12px; text-align: left; font-weight: 600;">Description</th>
            <th style="padding: 12px; text-align: center; font-weight: 600;">Qté</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">P.U.</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">TVA</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px;">${item.description || ''}</td>
              <td style="padding: 12px; text-align: center;">${item.quantity || 0}</td>
              <td style="padding: 12px; text-align: right;">${(item.unit_price || 0).toFixed(2)} €</td>
              <td style="padding: 12px; text-align: right;">${item.tax_rate || 0}%</td>
              <td style="padding: 12px; text-align: right; font-weight: 600;">${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)} €</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-left: auto; width: 300px; background: #f9fafb; padding: 20px; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: #666;">Sous-total HT:</span>
          <span style="font-weight: 600;">${subtotal.toFixed(2)} €</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: #666;">TVA:</span>
          <span style="font-weight: 600;">${totalTax.toFixed(2)} €</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid #f97316;">
          <span style="font-size: 18px; font-weight: bold;">Total TTC:</span>
          <span style="font-size: 20px; font-weight: bold; color: #f97316;">${total.toFixed(2)} €</span>
        </div>
      </div>

      ${quote.notes ? `
        <div style="margin-top: 30px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
          <p style="margin: 0; color: #92400e;"><strong>Notes:</strong></p>
          <p style="margin: 5px 0 0 0; color: #78350f;">${quote.notes}</p>
        </div>
      ` : ''}

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">Document généré par CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
      </div>
    </div>
  `;
};

/**
 * Generate HTML content for Delivery Note document
 */
const generateDeliveryNoteHTML = (deliveryNote, companyInfo) => {
  const items = deliveryNote.items || [];

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">BON DE LIVRAISON</h1>
        <p style="margin: 0; font-size: 18px; opacity: 0.9;">${deliveryNote.delivery_note_number || 'N/A'}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
        <div>
          <h3 style="color: #3b82f6; margin-bottom: 10px;">Expéditeur</h3>
          <p style="margin: 5px 0;"><strong>${companyInfo?.name || 'Votre Entreprise'}</strong></p>
          <p style="margin: 5px 0; color: #666;">${companyInfo?.address || ''}</p>
        </div>
        <div>
          <h3 style="color: #3b82f6; margin-bottom: 10px;">Destinataire</h3>
          <p style="margin: 5px 0;"><strong>${deliveryNote.client?.company_name || 'Client'}</strong></p>
          <p style="margin: 5px 0; color: #666;">${deliveryNote.delivery_address || deliveryNote.client?.address || ''}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f0f9ff; padding: 15px; border-radius: 8px;">
        <div>
          <p style="margin: 5px 0; color: #666;">Date de livraison: <strong>${deliveryNote.date ? new Date(deliveryNote.date).toLocaleDateString('fr-FR') : 'N/A'}</strong></p>
          <p style="margin: 5px 0; color: #666;">Transporteur: <strong>${deliveryNote.carrier || 'N/A'}</strong></p>
        </div>
        <div>
          <p style="margin: 5px 0; color: #666;">N° suivi: <strong>${deliveryNote.tracking_number || 'N/A'}</strong></p>
          <p style="margin: 5px 0; color: #666;">Statut: <strong style="color: #3b82f6;">${deliveryNote.status || 'pending'}</strong></p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #f3f4f6; border-bottom: 2px solid #3b82f6;">
            <th style="padding: 12px; text-align: left; font-weight: 600;">Description</th>
            <th style="padding: 12px; text-align: center; font-weight: 600;">Quantité</th>
            <th style="padding: 12px; text-align: center; font-weight: 600;">Unité</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px;">${item.description || ''}</td>
              <td style="padding: 12px; text-align: center; font-weight: 600;">${item.quantity || 0}</td>
              <td style="padding: 12px; text-align: center;">${item.unit || 'pcs'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${deliveryNote.notes ? `
        <div style="margin-top: 30px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
          <p style="margin: 0; color: #92400e;"><strong>Notes:</strong></p>
          <p style="margin: 5px 0 0 0; color: #78350f;">${deliveryNote.notes}</p>
        </div>
      ` : ''}

      <div style="margin-top: 40px; padding: 20px; background: #f9fafb; border-radius: 8px;">
        <p style="margin: 0 0 20px 0; font-weight: 600;">Signature du destinataire:</p>
        <div style="border-bottom: 1px solid #9ca3af; height: 60px;"></div>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">Date et signature</p>
      </div>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">Document généré par CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
      </div>
    </div>
  `;
};

/**
 * Generate HTML content for Credit Note document
 */
const generateCreditNoteHTML = (creditNote, companyInfo) => {
  const items = creditNote.items || [];
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const totalTax = items.reduce((sum, item) => sum + (item.quantity * item.unit_price * item.tax_rate / 100), 0);
  const total = subtotal + totalTax;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">AVOIR</h1>
        <p style="margin: 0; font-size: 18px; opacity: 0.9;">${creditNote.credit_note_number || 'N/A'}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
        <div>
          <h3 style="color: #dc2626; margin-bottom: 10px;">Émetteur</h3>
          <p style="margin: 5px 0;"><strong>${companyInfo?.name || 'Votre Entreprise'}</strong></p>
          <p style="margin: 5px 0; color: #666;">${companyInfo?.address || ''}</p>
          <p style="margin: 5px 0; color: #666;">${companyInfo?.email || ''}</p>
        </div>
        <div>
          <h3 style="color: #dc2626; margin-bottom: 10px;">Client</h3>
          <p style="margin: 5px 0;"><strong>${creditNote.client?.company_name || 'Client'}</strong></p>
          <p style="margin: 5px 0; color: #666;">${creditNote.client?.email || ''}</p>
          <p style="margin: 5px 0; color: #666;">${creditNote.client?.address || ''}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #fef2f2; padding: 15px; border-radius: 8px;">
        <div>
          <p style="margin: 5px 0; color: #666;">Date: <strong>${creditNote.date ? new Date(creditNote.date).toLocaleDateString('fr-FR') : 'N/A'}</strong></p>
          <p style="margin: 5px 0; color: #666;">Facture liée: <strong>${creditNote.related_invoice_number || 'N/A'}</strong></p>
        </div>
        <div>
          <p style="margin: 5px 0; color: #666;">Motif: <strong>${creditNote.reason || 'N/A'}</strong></p>
          <p style="margin: 5px 0; color: #666;">Statut: <strong style="color: #dc2626;">${creditNote.status || 'draft'}</strong></p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #f3f4f6; border-bottom: 2px solid #dc2626;">
            <th style="padding: 12px; text-align: left; font-weight: 600;">Description</th>
            <th style="padding: 12px; text-align: center; font-weight: 600;">Qté</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">P.U.</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">TVA</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px;">${item.description || ''}</td>
              <td style="padding: 12px; text-align: center;">${item.quantity || 0}</td>
              <td style="padding: 12px; text-align: right;">${(item.unit_price || 0).toFixed(2)} €</td>
              <td style="padding: 12px; text-align: right;">${item.tax_rate || 0}%</td>
              <td style="padding: 12px; text-align: right; font-weight: 600;">${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)} €</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-left: auto; width: 300px; background: #fef2f2; padding: 20px; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: #666;">Sous-total HT:</span>
          <span style="font-weight: 600;">${subtotal.toFixed(2)} €</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: #666;">TVA:</span>
          <span style="font-weight: 600;">${totalTax.toFixed(2)} €</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid #dc2626;">
          <span style="font-size: 18px; font-weight: bold;">Montant remboursé:</span>
          <span style="font-size: 20px; font-weight: bold; color: #dc2626;">${total.toFixed(2)} €</span>
        </div>
      </div>

      ${creditNote.notes ? `
        <div style="margin-top: 30px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
          <p style="margin: 0; color: #92400e;"><strong>Notes:</strong></p>
          <p style="margin: 5px 0 0 0; color: #78350f;">${creditNote.notes}</p>
        </div>
      ` : ''}

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">Document généré par CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
      </div>
    </div>
  `;
};

/**
 * Generate HTML content for Purchase Order document
 */
const generatePurchaseOrderHTML = (purchaseOrder, companyInfo) => {
  const items = purchaseOrder.items || [];
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const totalTax = items.reduce((sum, item) => sum + (item.quantity * item.unit_price * (item.tax_rate || 0) / 100), 0);
  const total = subtotal + totalTax;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">BON DE COMMANDE</h1>
        <p style="margin: 0; font-size: 18px; opacity: 0.9;">${purchaseOrder.order_number || 'N/A'}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
        <div>
          <h3 style="color: #8b5cf6; margin-bottom: 10px;">Acheteur</h3>
          <p style="margin: 5px 0;"><strong>${companyInfo?.name || 'Votre Entreprise'}</strong></p>
          <p style="margin: 5px 0; color: #666;">${companyInfo?.address || ''}</p>
          <p style="margin: 5px 0; color: #666;">${companyInfo?.email || ''}</p>
        </div>
        <div>
          <h3 style="color: #8b5cf6; margin-bottom: 10px;">Fournisseur</h3>
          <p style="margin: 5px 0;"><strong>${purchaseOrder.supplier?.company_name || 'Fournisseur'}</strong></p>
          <p style="margin: 5px 0; color: #666;">${purchaseOrder.supplier?.email || ''}</p>
          <p style="margin: 5px 0; color: #666;">${purchaseOrder.supplier?.address || ''}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #faf5ff; padding: 15px; border-radius: 8px;">
        <div>
          <p style="margin: 5px 0; color: #666;">Date de commande: <strong>${purchaseOrder.date ? new Date(purchaseOrder.date).toLocaleDateString('fr-FR') : 'N/A'}</strong></p>
          <p style="margin: 5px 0; color: #666;">Date de livraison: <strong>${purchaseOrder.delivery_date ? new Date(purchaseOrder.delivery_date).toLocaleDateString('fr-FR') : 'N/A'}</strong></p>
        </div>
        <div>
          <p style="margin: 5px 0; color: #666;">Statut: <strong style="color: #8b5cf6;">${purchaseOrder.status || 'pending'}</strong></p>
          <p style="margin: 5px 0; color: #666;">Conditions de paiement: <strong>${purchaseOrder.payment_terms || 'N/A'}</strong></p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #f3f4f6; border-bottom: 2px solid #8b5cf6;">
            <th style="padding: 12px; text-align: left; font-weight: 600;">Description</th>
            <th style="padding: 12px; text-align: center; font-weight: 600;">Qté</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">P.U.</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">TVA</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px;">${item.description || ''}</td>
              <td style="padding: 12px; text-align: center;">${item.quantity || 0}</td>
              <td style="padding: 12px; text-align: right;">${(item.unit_price || 0).toFixed(2)} €</td>
              <td style="padding: 12px; text-align: right;">${item.tax_rate || 0}%</td>
              <td style="padding: 12px; text-align: right; font-weight: 600;">${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)} €</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-left: auto; width: 300px; background: #faf5ff; padding: 20px; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: #666;">Sous-total HT:</span>
          <span style="font-weight: 600;">${subtotal.toFixed(2)} €</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: #666;">TVA:</span>
          <span style="font-weight: 600;">${totalTax.toFixed(2)} €</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid #8b5cf6;">
          <span style="font-size: 18px; font-weight: bold;">Total TTC:</span>
          <span style="font-size: 20px; font-weight: bold; color: #8b5cf6;">${total.toFixed(2)} €</span>
        </div>
      </div>

      ${purchaseOrder.notes ? `
        <div style="margin-top: 30px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
          <p style="margin: 0; color: #92400e;"><strong>Notes:</strong></p>
          <p style="margin: 5px 0 0 0; color: #78350f;">${purchaseOrder.notes}</p>
        </div>
      ` : ''}

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">Document généré par CashPilot - ${new Date().toLocaleString('fr-FR')}</p>
      </div>
    </div>
  `;
};

// ========== PDF EXPORT FUNCTIONS ==========

/**
 * Export Invoice to PDF
 */
export const exportInvoicePDF = async (invoice, companyInfo) => {
  const htmlContent = generateInvoiceHTML(invoice, companyInfo);
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `Facture_${invoice.invoice_number || invoice.invoiceNumber || 'draft'}_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(options).from(tempDiv).save();
    document.body.removeChild(tempDiv);
    return true;
  } catch (error) {
    document.body.removeChild(tempDiv);
    console.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
};

/**
 * Export Quote to PDF
 */
export const exportQuotePDF = async (quote, companyInfo) => {
  const htmlContent = generateQuoteHTML(quote, companyInfo);
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `Devis_${quote.quote_number || 'draft'}_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(options).from(tempDiv).save();
    document.body.removeChild(tempDiv);
    return true;
  } catch (error) {
    document.body.removeChild(tempDiv);
    console.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
};

/**
 * Export Delivery Note to PDF
 */
export const exportDeliveryNotePDF = async (deliveryNote, companyInfo) => {
  const htmlContent = generateDeliveryNoteHTML(deliveryNote, companyInfo);
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `BonLivraison_${deliveryNote.delivery_note_number || 'draft'}_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(options).from(tempDiv).save();
    document.body.removeChild(tempDiv);
    return true;
  } catch (error) {
    document.body.removeChild(tempDiv);
    console.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
};

/**
 * Export Credit Note to PDF
 */
export const exportCreditNotePDF = async (creditNote, companyInfo) => {
  const htmlContent = generateCreditNoteHTML(creditNote, companyInfo);
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `Avoir_${creditNote.credit_note_number || 'draft'}_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(options).from(tempDiv).save();
    document.body.removeChild(tempDiv);
    return true;
  } catch (error) {
    document.body.removeChild(tempDiv);
    console.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
};

/**
 * Export Purchase Order to PDF
 */
export const exportPurchaseOrderPDF = async (purchaseOrder, companyInfo) => {
  const htmlContent = generatePurchaseOrderHTML(purchaseOrder, companyInfo);
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `BonCommande_${purchaseOrder.order_number || 'draft'}_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(options).from(tempDiv).save();
    document.body.removeChild(tempDiv);
    return true;
  } catch (error) {
    document.body.removeChild(tempDiv);
    console.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
};

// ========== HTML EXPORT FUNCTIONS ==========

/**
 * Export Invoice to HTML
 */
export const exportInvoiceHTML = (invoice, companyInfo) => {
  const content = generateInvoiceHTML(invoice, companyInfo);
  const html = generateStandaloneHTML(`Facture ${invoice.invoice_number || invoice.invoiceNumber || 'draft'}`, content);
  downloadHTML(html, `Facture_${invoice.invoice_number || invoice.invoiceNumber || 'draft'}_${new Date().toISOString().split('T')[0]}`);
};

/**
 * Download HTML file
 */
const downloadHTML = (html, filename) => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Generate standalone HTML document
 */
const generateStandaloneHTML = (title, content) => {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #ffffff; }
    @media print {
      body { margin: 0; }
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
};

/**
 * Export Quote to HTML
 */
export const exportQuoteHTML = (quote, companyInfo) => {
  const content = generateQuoteHTML(quote, companyInfo);
  const html = generateStandaloneHTML(`Devis ${quote.quote_number || 'draft'}`, content);
  downloadHTML(html, `Devis_${quote.quote_number || 'draft'}_${new Date().toISOString().split('T')[0]}`);
};

/**
 * Export Delivery Note to HTML
 */
export const exportDeliveryNoteHTML = (deliveryNote, companyInfo) => {
  const content = generateDeliveryNoteHTML(deliveryNote, companyInfo);
  const html = generateStandaloneHTML(`Bon de Livraison ${deliveryNote.delivery_note_number || 'draft'}`, content);
  downloadHTML(html, `BonLivraison_${deliveryNote.delivery_note_number || 'draft'}_${new Date().toISOString().split('T')[0]}`);
};

/**
 * Export Credit Note to HTML
 */
export const exportCreditNoteHTML = (creditNote, companyInfo) => {
  const content = generateCreditNoteHTML(creditNote, companyInfo);
  const html = generateStandaloneHTML(`Avoir ${creditNote.credit_note_number || 'draft'}`, content);
  downloadHTML(html, `Avoir_${creditNote.credit_note_number || 'draft'}_${new Date().toISOString().split('T')[0]}`);
};

/**
 * Export Purchase Order to HTML
 */
export const exportPurchaseOrderHTML = (purchaseOrder, companyInfo) => {
  const content = generatePurchaseOrderHTML(purchaseOrder, companyInfo);
  const html = generateStandaloneHTML(`Bon de Commande ${purchaseOrder.order_number || 'draft'}`, content);
  downloadHTML(html, `BonCommande_${purchaseOrder.order_number || 'draft'}_${new Date().toISOString().split('T')[0]}`);
};
