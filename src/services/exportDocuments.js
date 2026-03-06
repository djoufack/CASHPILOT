import { saveElementAsPdf } from '@/services/pdfExportRuntime';
import { formatDateInput } from '@/utils/dateFormatting';
import DOMPurify from 'dompurify';

const setSafeHtml = (element, html) => {
  element.innerHTML = DOMPurify.sanitize(String(html || ''));
};

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const computeInvoiceTotals = (invoice) => {
  const rawItems = Array.isArray(invoice?.items) ? invoice.items : [];
  const defaultTaxRate = toFiniteNumber(invoice?.tax_rate ?? invoice?.taxRate);

  const normalizedItems = rawItems.map((item) => {
    const quantity = toFiniteNumber(item?.quantity ?? item?.qty);
    const unitPrice = toFiniteNumber(item?.unit_price ?? item?.unitPrice);
    const rawLineTotal = item?.total ?? item?.line_total ?? item?.amount;
    const hasRawLineTotal = rawLineTotal !== null && rawLineTotal !== undefined && rawLineTotal !== '';
    const lineSubtotal = hasRawLineTotal ? toFiniteNumber(rawLineTotal) : quantity * unitPrice;
    const lineTaxRate = toFiniteNumber(item?.tax_rate ?? item?.taxRate ?? defaultTaxRate);

    return {
      ...item,
      quantity,
      unit_price: unitPrice,
      tax_rate: lineTaxRate,
      _lineSubtotal: lineSubtotal,
      _lineTaxAmount: lineSubtotal * (lineTaxRate / 100),
    };
  });

  const subtotalFromItems = normalizedItems.reduce((sum, item) => sum + item._lineSubtotal, 0);
  const taxFromItems = normalizedItems.reduce((sum, item) => sum + item._lineTaxAmount, 0);
  const totalFromItems = subtotalFromItems + taxFromItems;

  if (normalizedItems.some((item) => item._lineSubtotal > 0)) {
    return {
      items: normalizedItems,
      subtotal: subtotalFromItems,
      totalTax: taxFromItems,
      total: totalFromItems,
    };
  }

  const fallbackSubtotal = toFiniteNumber(invoice?.total_ht ?? invoice?.subtotal);
  const fallbackTotalCandidate = toFiniteNumber(invoice?.total_ttc ?? invoice?.total);
  const fallbackTaxCandidate = toFiniteNumber(invoice?.tax_amount);
  const fallbackTax = fallbackTaxCandidate > 0 ? fallbackTaxCandidate : Math.max(0, fallbackTotalCandidate - fallbackSubtotal);
  const fallbackTotal = fallbackTotalCandidate > 0 ? fallbackTotalCandidate : fallbackSubtotal + fallbackTax;

  return {
    items: normalizedItems,
    subtotal: fallbackSubtotal,
    totalTax: fallbackTax,
    total: fallbackTotal,
  };
};

/**
 * Generate HTML content for Invoice document
 */
const generateInvoiceHTML = (invoice, companyInfo) => {
  const { items, subtotal, totalTax, total } = computeInvoiceTotals(invoice);
  const companyName = companyInfo?.name || companyInfo?.company_name || 'Votre Entreprise';
  const companyLines = [
    companyInfo?.address,
    [companyInfo?.postal_code, companyInfo?.city, companyInfo?.country].filter(Boolean).join(' '),
    companyInfo?.tax_id,
    companyInfo?.phone ? `Tel: ${companyInfo.phone}` : '',
    companyInfo?.email,
    companyInfo?.website,
  ].filter(Boolean);

  const clientLines = [
    invoice.client?.company_name || invoice.client?.companyName || 'Client',
    invoice.client?.address,
    [invoice.client?.postal_code, invoice.client?.city, invoice.client?.country].filter(Boolean).join(' '),
    invoice.client?.phone ? `Tel: ${invoice.client.phone}` : '',
    invoice.client?.email,
  ].filter(Boolean);

  const issueDate = invoice.date || invoice.issueDate;
  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber || 'N/A';
  const taxRate = toFiniteNumber(invoice.tax_rate || invoice.taxRate);
  const noteText = invoice.notes || 'Tous nos produits et services sont garantis 12 mois, à compter de la date de réception du paiement de la facture.';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 860px; margin: 0 auto; padding: 20px; background:#f4f6f8; color:#1f2937;">
      <div style="display:flex; flex-direction:column; gap:14px;">
        <section style="background:#ffffff; border:2px solid #21d4c8; border-radius:8px; padding:16px 18px;">
          <div style="display:flex; justify-content:space-between; gap:16px; align-items:flex-start;">
            <div style="width:86px; height:86px; border-radius:8px; background:#e9f2ff; border:1px solid #d2e6ff; display:flex; align-items:center; justify-content:center; overflow:hidden;">
              ${companyInfo?.logo_url
                ? `<img src="${companyInfo.logo_url}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`
                : `<span style="font-size:28px; font-weight:800; color:#0f274f;">${String(companyName).slice(0, 3).toUpperCase()}</span>`}
            </div>
            <div style="font-size:13px; line-height:1.45; text-align:right;">
              <p style="margin:0; font-weight:800; text-transform:uppercase; color:#0f172a;">${companyName}</p>
              ${companyLines.map((line) => `<p style="margin:0;">${line}</p>`).join('')}
            </div>
          </div>
        </section>

        <section style="background:#ffffff; border:2px solid #21d4c8; border-radius:8px; padding:16px 18px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:22px;">
            <div>
              <h1 style="margin:0 0 12px 0; font-size:44px; line-height:1; font-weight:900; color:#0b1324;">FACTURE</h1>
              <p style="margin:0 0 6px 0; font-size:14px;"><strong>N° :</strong> ${invoiceNumber}</p>
              <p style="margin:0; font-size:14px;"><strong>Date :</strong> ${issueDate ? new Date(issueDate).toLocaleDateString('fr-FR') : 'N/A'}</p>
            </div>
            <div style="font-size:13px; line-height:1.45;">
              <p style="margin:0 0 8px 0; font-weight:700; text-transform:uppercase;">Facturé à</p>
              ${clientLines.map((line) => `<p style="margin:0;">${line}</p>`).join('')}
            </div>
          </div>
        </section>

        <section style="background:#ffffff; border:1px solid #d9e1ea; border-radius:8px; overflow:hidden;">
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="background:#2f4b88; color:#ffffff;">
                <th style="padding:10px 12px; text-align:left; font-weight:700;">Description</th>
                <th style="padding:10px 12px; text-align:right; font-weight:700;">Taux</th>
                <th style="padding:10px 12px; text-align:right; font-weight:700;">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${items.length === 0 ? `
                <tr style="border-top:1px solid #e5e7eb;">
                  <td style="padding:12px; color:#6b7280;" colspan="3">Aucune ligne détaillée disponible.</td>
                </tr>
              ` : items.map((item, index) => `
                <tr style="border-top:1px solid #e5e7eb; background:${index % 2 === 0 ? '#f8fafc' : '#ffffff'};">
                  <td style="padding:10px 12px;">${item.description || ''}</td>
                  <td style="padding:10px 12px; text-align:right; white-space:nowrap;">${item.unit_price.toFixed(2)} €</td>
                  <td style="padding:10px 12px; text-align:right; white-space:nowrap; font-weight:600;">${item._lineSubtotal.toFixed(2)} €</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>

        <section style="display:flex; justify-content:flex-end;">
          <div style="width:360px; border:1px solid #00132b; border-radius:8px; overflow:hidden;">
            <div style="background:#00132b; color:#e5ecf5;">
              <div style="display:flex; justify-content:space-between; gap:16px; align-items:center; padding:12px 14px; border-bottom:1px solid #0e2b4d;">
                <span style="font-weight:600;">Sous-total</span>
                <span style="font-weight:600;">${subtotal.toFixed(2)} € HT</span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:16px; align-items:center; padding:12px 14px; border-bottom:1px solid #0e2b4d;">
                <span style="font-weight:600;">TVA ${taxRate > 0 ? `${taxRate}%` : ''}</span>
                <span style="font-weight:600;">${totalTax.toFixed(2)} €</span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:16px; align-items:center; padding:15px 14px; color:#ffffff;">
                <span style="font-size:20px; font-weight:900;">TOTAL TTC</span>
                <span style="font-size:28px; font-weight:900;">${total.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </section>

        <section style="background:#ffffff; border:2px solid #21d4c8; border-radius:8px; padding:16px 18px;">
          <p style="margin:0 0 8px 0; font-weight:700;">Veuillez noter :</p>
          <p style="margin:0; line-height:1.6; font-size:13px; color:#374151;">${noteText}</p>

          <div style="margin-top:14px; font-size:13px; line-height:1.6;">
            <p style="margin:0; font-weight:700;">Informations Bancaires</p>
            ${companyInfo?.bank_name ? `<p style="margin:0;"><strong>Bénéficiaire :</strong> ${companyInfo.bank_name}</p>` : ''}
            ${companyInfo?.iban ? `<p style="margin:0;"><strong>IBAN :</strong> ${companyInfo.iban}</p>` : ''}
            <p style="margin:0;"><strong>Communication :</strong> ${invoiceNumber}</p>
            ${companyInfo?.swift ? `<p style="margin:0;"><strong>BIC/SWIFT :</strong> ${companyInfo.swift}</p>` : ''}
          </div>

          <div style="margin-top:18px; text-align:center; color:#6b7280; font-size:11px;">
            ${companyName}${companyInfo?.tax_id ? ` - TVA ${companyInfo.tax_id}` : ''}${companyInfo?.registration_number ? ` - ${companyInfo.registration_number}` : ''}
          </div>
        </section>
      </div>
    </div>
  `;
};

/**
 * Generate HTML content for Quote document
 */
export const generateQuoteHTML = (quote, companyInfo) => {
  const { items, subtotal, totalTax, total } = computeInvoiceTotals(quote);
  const companyName = companyInfo?.name || companyInfo?.company_name || 'Votre Entreprise';
  const companyLines = [
    companyInfo?.address,
    [companyInfo?.postal_code, companyInfo?.city, companyInfo?.country].filter(Boolean).join(' '),
    companyInfo?.tax_id,
    companyInfo?.phone ? `Tel: ${companyInfo.phone}` : '',
    companyInfo?.email,
    companyInfo?.website,
  ].filter(Boolean);

  const clientLines = [
    quote.client?.company_name || quote.client?.companyName || 'Client',
    quote.client?.address,
    [quote.client?.postal_code, quote.client?.city, quote.client?.country].filter(Boolean).join(' '),
    quote.client?.phone ? `Tel: ${quote.client.phone}` : '',
    quote.client?.email,
  ].filter(Boolean);

  const quoteNumber = quote.quote_number || 'N/A';
  const issueDate = quote.date ? new Date(quote.date).toLocaleDateString('fr-FR') : 'N/A';
  const validityDate = quote.due_date ? new Date(quote.due_date).toLocaleDateString('fr-FR') : 'N/A';
  const taxRate = toFiniteNumber(quote.tax_rate || quote.taxRate);
  const noteText = quote.notes || 'Ce devis est valable 30 jours. Toute commande implique l’acceptation des conditions générales de vente.';
  const statusLabels = {
    draft: 'Brouillon',
    sent: 'Envoyé',
    accepted: 'Accepté',
    rejected: 'Rejeté',
    expired: 'Expiré',
  };

  return `
    <div style="font-family: Arial, sans-serif; max-width: 860px; margin: 0 auto; padding: 20px; background:#f4f6f8; color:#1f2937;">
      <div style="display:flex; flex-direction:column; gap:14px;">
        <section style="background:#ffffff; border:2px solid #21d4c8; border-radius:8px; padding:16px 18px;">
          <div style="display:flex; justify-content:space-between; gap:16px; align-items:flex-start;">
            <div style="width:86px; height:86px; border-radius:8px; background:#e9f2ff; border:1px solid #d2e6ff; display:flex; align-items:center; justify-content:center; overflow:hidden;">
              ${companyInfo?.logo_url
                ? `<img src="${companyInfo.logo_url}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`
                : `<span style="font-size:28px; font-weight:800; color:#0f274f;">${String(companyName).slice(0, 3).toUpperCase()}</span>`}
            </div>
            <div style="font-size:13px; line-height:1.45; text-align:right;">
              <p style="margin:0; font-weight:800; text-transform:uppercase; color:#0f172a;">${companyName}</p>
              ${companyLines.map((line) => `<p style="margin:0;">${line}</p>`).join('')}
            </div>
          </div>
        </section>

        <section style="background:#ffffff; border:2px solid #21d4c8; border-radius:8px; padding:16px 18px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:22px;">
            <div>
              <h1 style="margin:0 0 12px 0; font-size:44px; line-height:1; font-weight:900; color:#0b1324;">DEVIS</h1>
              <p style="margin:0 0 6px 0; font-size:14px;"><strong>N° :</strong> ${quoteNumber}</p>
              <p style="margin:0 0 6px 0; font-size:14px;"><strong>Date :</strong> ${issueDate}</p>
              <p style="margin:0 0 6px 0; font-size:14px;"><strong>Validité :</strong> ${validityDate}</p>
              <p style="margin:0; font-size:14px;"><strong>Statut :</strong> ${statusLabels[quote.status] || quote.status || 'Brouillon'}</p>
            </div>
            <div style="font-size:13px; line-height:1.45;">
              <p style="margin:0 0 8px 0; font-weight:700; text-transform:uppercase;">Adressé à</p>
              ${clientLines.map((line) => `<p style="margin:0;">${line}</p>`).join('')}
            </div>
          </div>
        </section>

        <section style="background:#ffffff; border:1px solid #d9e1ea; border-radius:8px; overflow:hidden;">
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="background:#2f4b88; color:#ffffff;">
                <th style="padding:10px 12px; text-align:left; font-weight:700;">Description</th>
                <th style="padding:10px 12px; text-align:right; font-weight:700;">Taux</th>
                <th style="padding:10px 12px; text-align:right; font-weight:700;">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${items.length === 0 ? `
                <tr style="border-top:1px solid #e5e7eb;">
                  <td style="padding:12px; color:#6b7280;" colspan="3">Aucune ligne détaillée disponible.</td>
                </tr>
              ` : items.map((item, index) => `
                <tr style="border-top:1px solid #e5e7eb; background:${index % 2 === 0 ? '#f8fafc' : '#ffffff'};">
                  <td style="padding:10px 12px;">${item.description || ''}</td>
                  <td style="padding:10px 12px; text-align:right; white-space:nowrap;">${item.unit_price.toFixed(2)} €</td>
                  <td style="padding:10px 12px; text-align:right; white-space:nowrap; font-weight:600;">${item._lineSubtotal.toFixed(2)} €</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>

        <section style="display:flex; justify-content:flex-end;">
          <div style="width:360px; border:1px solid #00132b; border-radius:8px; overflow:hidden;">
            <div style="background:#00132b; color:#e5ecf5;">
              <div style="display:flex; justify-content:space-between; gap:16px; align-items:center; padding:12px 14px; border-bottom:1px solid #0e2b4d;">
                <span style="font-weight:600;">Sous-total</span>
                <span style="font-weight:600;">${subtotal.toFixed(2)} € HT</span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:16px; align-items:center; padding:12px 14px; border-bottom:1px solid #0e2b4d;">
                <span style="font-weight:600;">TVA ${taxRate > 0 ? `${taxRate}%` : ''}</span>
                <span style="font-weight:600;">${totalTax.toFixed(2)} €</span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:16px; align-items:center; padding:15px 14px; color:#ffffff;">
                <span style="font-size:20px; font-weight:900;">TOTAL TTC</span>
                <span style="font-size:28px; font-weight:900;">${total.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </section>

        <section style="background:#ffffff; border:2px solid #21d4c8; border-radius:8px; padding:16px 18px;">
          <p style="margin:0 0 8px 0; font-weight:700;">Veuillez noter :</p>
          <p style="margin:0; line-height:1.6; font-size:13px; color:#374151;">${noteText}</p>

          <div style="margin-top:14px; font-size:13px; line-height:1.6;">
            <p style="margin:0; font-weight:700;">Informations Bancaires</p>
            ${companyInfo?.bank_name ? `<p style="margin:0;"><strong>Bénéficiaire :</strong> ${companyInfo.bank_name}</p>` : ''}
            ${companyInfo?.iban ? `<p style="margin:0;"><strong>IBAN :</strong> ${companyInfo.iban}</p>` : ''}
            <p style="margin:0;"><strong>Communication :</strong> ${quoteNumber}</p>
            ${companyInfo?.swift ? `<p style="margin:0;"><strong>BIC/SWIFT :</strong> ${companyInfo.swift}</p>` : ''}
          </div>

          <div style="margin-top:18px; text-align:center; color:#6b7280; font-size:11px;">
            ${companyName}${companyInfo?.tax_id ? ` - TVA ${companyInfo.tax_id}` : ''}${companyInfo?.registration_number ? ` - ${companyInfo.registration_number}` : ''}
          </div>
        </section>
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
  setSafeHtml(tempDiv, htmlContent);
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `Facture_${invoice.invoice_number || invoice.invoiceNumber || 'draft'}_${formatDateInput()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await saveElementAsPdf(tempDiv, options);
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
  setSafeHtml(tempDiv, htmlContent);
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `Devis_${quote.quote_number || 'draft'}_${formatDateInput()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await saveElementAsPdf(tempDiv, options);
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
  setSafeHtml(tempDiv, htmlContent);
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `BonLivraison_${deliveryNote.delivery_note_number || 'draft'}_${formatDateInput()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await saveElementAsPdf(tempDiv, options);
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
  setSafeHtml(tempDiv, htmlContent);
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `Avoir_${creditNote.credit_note_number || 'draft'}_${formatDateInput()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await saveElementAsPdf(tempDiv, options);
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
  setSafeHtml(tempDiv, htmlContent);
  document.body.appendChild(tempDiv);

  const options = {
    margin: 10,
    filename: `BonCommande_${purchaseOrder.order_number || 'draft'}_${formatDateInput()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await saveElementAsPdf(tempDiv, options);
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
  downloadHTML(html, `Facture_${invoice.invoice_number || invoice.invoiceNumber || 'draft'}_${formatDateInput()}`);
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
  downloadHTML(html, `Devis_${quote.quote_number || 'draft'}_${formatDateInput()}`);
};

/**
 * Export Delivery Note to HTML
 */
export const exportDeliveryNoteHTML = (deliveryNote, companyInfo) => {
  const content = generateDeliveryNoteHTML(deliveryNote, companyInfo);
  const html = generateStandaloneHTML(`Bon de Livraison ${deliveryNote.delivery_note_number || 'draft'}`, content);
  downloadHTML(html, `BonLivraison_${deliveryNote.delivery_note_number || 'draft'}_${formatDateInput()}`);
};

/**
 * Export Credit Note to HTML
 */
export const exportCreditNoteHTML = (creditNote, companyInfo) => {
  const content = generateCreditNoteHTML(creditNote, companyInfo);
  const html = generateStandaloneHTML(`Avoir ${creditNote.credit_note_number || 'draft'}`, content);
  downloadHTML(html, `Avoir_${creditNote.credit_note_number || 'draft'}_${formatDateInput()}`);
};

/**
 * Export Purchase Order to HTML
 */
export const exportPurchaseOrderHTML = (purchaseOrder, companyInfo) => {
  const content = generatePurchaseOrderHTML(purchaseOrder, companyInfo);
  const html = generateStandaloneHTML(`Bon de Commande ${purchaseOrder.order_number || 'draft'}`, content);
  downloadHTML(html, `BonCommande_${purchaseOrder.order_number || 'draft'}_${formatDateInput()}`);
};
