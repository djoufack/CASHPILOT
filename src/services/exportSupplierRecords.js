import DOMPurify from 'dompurify';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';
import { formatDateInput } from '@/utils/dateFormatting';
import { supabase } from '@/lib/supabase';
import {
  renderInvoiceTemplateContent,
  buildStandaloneTemplateHtml,
} from '@/services/invoiceTemplateExport';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatMoney = (value, currency = 'EUR') => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
};

const setSafeHtml = (element, html) => {
  element.innerHTML = DOMPurify.sanitize(String(html || ''));
};

const downloadHtmlFile = (html, filename) => {
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

const wrapStandaloneHtml = (title, content) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #0b1220; color: #e5e7eb; }
    .container { max-width: 900px; margin: 0 auto; padding: 24px; }
    .card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .title { margin: 0; font-size: 28px; color: #f8fafc; }
    .muted { color: #94a3b8; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .label { font-size: 12px; text-transform: uppercase; color: #94a3b8; letter-spacing: .03em; margin-bottom: 4px; }
    .value { font-size: 16px; color: #f8fafc; font-weight: 600; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
    @media print { body { background: #fff; color: #111827; } .card { border-color: #e5e7eb; } }
  </style>
</head>
<body>
  <div class="container">${content}</div>
</body>
</html>`;

const exportAsPdf = async ({ title, filename, content }) => {
  const html = wrapStandaloneHtml(title, content);
  const tempDiv = document.createElement('div');
  setSafeHtml(tempDiv, html);
  document.body.appendChild(tempDiv);

  try {
    await saveElementAsPdf(tempDiv, {
      margin: 10,
      filename: `${filename}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    });
  } finally {
    document.body.removeChild(tempDiv);
  }
};

const exportTemplateInvoiceAsPdf = async ({ filename, content }) => {
  const tempDiv = document.createElement('div');
  setSafeHtml(tempDiv, content);
  document.body.appendChild(tempDiv);

  try {
    await saveElementAsPdf(tempDiv, {
      margin: 10,
      filename: `${filename}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    });
  } finally {
    document.body.removeChild(tempDiv);
  }
};

const exportAsHtml = ({ title, filename, content }) => {
  const html = wrapStandaloneHtml(title, content);
  downloadHtmlFile(html, filename);
};

const serviceContent = (service, supplier, company) => {
  const currency = supplier?.currency || company?.accounting_currency || 'EUR';
  const priceValue = service?.pricing_type === 'fixed'
    ? formatMoney(service?.fixed_price, currency)
    : `${formatMoney(service?.hourly_rate, currency)} / h`;

  return `
    <section class="card">
      <h1 class="title">Service fournisseur</h1>
      <p class="muted">${escapeHtml(supplier?.company_name || 'Fournisseur')} • ${escapeHtml(company?.company_name || company?.name || 'CashPilot')}</p>
    </section>
    <section class="card grid">
      <div><div class="label">Nom du service</div><div class="value">${escapeHtml(service?.service_name || '-')}</div></div>
      <div><div class="label">Tarification</div><div class="value">${escapeHtml(service?.pricing_type || '-')}</div></div>
      <div><div class="label">Prix</div><div class="value">${escapeHtml(priceValue)}</div></div>
      <div><div class="label">Unité</div><div class="value">${escapeHtml(service?.unit || '-')}</div></div>
      <div><div class="label">Créé le</div><div class="value">${escapeHtml(service?.created_at ? new Date(service.created_at).toLocaleDateString('fr-FR') : '-')}</div></div>
      <div><div class="label">Dernière mise à jour</div><div class="value">${escapeHtml(service?.updated_at ? new Date(service.updated_at).toLocaleDateString('fr-FR') : '-')}</div></div>
    </section>
  `;
};

const productContent = (product, supplier, company) => {
  const currency = supplier?.currency || company?.accounting_currency || 'EUR';
  const stock = Number(product?.stock_quantity || 0);
  const min = Number(product?.min_stock_level || 0);
  const stockStatus = stock <= 0 ? 'Rupture' : stock <= min ? 'Stock bas' : 'Stock OK';
  const toReorder = Math.max(min - stock, 0);

  return `
    <section class="card">
      <h1 class="title">Produit fournisseur</h1>
      <p class="muted">${escapeHtml(supplier?.company_name || 'Fournisseur')} • ${escapeHtml(company?.company_name || company?.name || 'CashPilot')}</p>
    </section>
    <section class="card grid">
      <div><div class="label">Nom du produit</div><div class="value">${escapeHtml(product?.product_name || '-')}</div></div>
      <div><div class="label">SKU</div><div class="value">${escapeHtml(product?.sku || '-')}</div></div>
      <div><div class="label">Catégorie</div><div class="value">${escapeHtml(product?.category?.name || '-')}</div></div>
      <div><div class="label">Prix d'achat</div><div class="value">${escapeHtml(formatMoney(product?.unit_price, currency))}</div></div>
      <div><div class="label">Stock</div><div class="value">${escapeHtml(stock)}</div></div>
      <div><div class="label">Stock minimum</div><div class="value">${escapeHtml(min)}</div></div>
      <div><div class="label">Situation stock</div><div class="value">${escapeHtml(stockStatus)}</div></div>
      <div><div class="label">Réappro conseillé</div><div class="value">${escapeHtml(toReorder > 0 ? `${toReorder} unités` : 'Aucun')}</div></div>
    </section>
  `;
};

const loadSupplierInvoiceLineItems = async (invoiceId) => {
  if (!invoiceId) return [];
  const { data, error } = await supabase
    .from('supplier_invoice_line_items')
    .select('description, quantity, unit_price, total, vat_rate')
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true });

  if (error) {
    return [];
  }
  return data || [];
};

const toTemplateSupplierInvoice = async (invoice, supplier) => {
  const lineItems = await loadSupplierInvoiceLineItems(invoice?.id);
  return {
    ...invoice,
    date: invoice?.date || invoice?.invoice_date || invoice?.created_at || null,
    due_date: invoice?.due_date || null,
    tax_rate: invoice?.tax_rate ?? invoice?.vat_rate ?? 0,
    tax_amount: invoice?.tax_amount ?? invoice?.vat_amount ?? null,
    total: invoice?.total_ttc ?? invoice?.total_amount ?? invoice?.total ?? 0,
    status: invoice?.status || invoice?.approval_status || invoice?.payment_status || 'pending',
    items: lineItems,
    client: {
      companyName: supplier?.company_name || invoice?.supplier_name_extracted || 'Fournisseur',
      company_name: supplier?.company_name || invoice?.supplier_name_extracted || 'Fournisseur',
      preferredCurrency: invoice?.currency || supplier?.currency || 'EUR',
      preferred_currency: invoice?.currency || supplier?.currency || 'EUR',
      address: supplier?.address || invoice?.supplier_address_extracted || '',
      city: supplier?.city || '',
      postal_code: supplier?.postal_code || '',
      country: supplier?.country || '',
      phone: supplier?.phone || '',
      email: supplier?.email || '',
      vat_number: supplier?.tax_id || invoice?.supplier_vat_number || '',
    },
  };
};

export const exportSupplierServicePDF = async (service, supplier, company) => {
  const filename = `Supplier_Service_${service?.service_name || 'service'}_${formatDateInput()}`;
  await exportAsPdf({
    title: 'Service fournisseur',
    filename,
    content: serviceContent(service, supplier, company),
  });
};

export const exportSupplierServiceHTML = (service, supplier, company) => {
  const filename = `Supplier_Service_${service?.service_name || 'service'}_${formatDateInput()}`;
  exportAsHtml({
    title: 'Service fournisseur',
    filename,
    content: serviceContent(service, supplier, company),
  });
};

export const exportSupplierProductPDF = async (product, supplier, company) => {
  const filename = `Supplier_Product_${product?.product_name || 'product'}_${formatDateInput()}`;
  await exportAsPdf({
    title: 'Produit fournisseur',
    filename,
    content: productContent(product, supplier, company),
  });
};

export const exportSupplierProductHTML = (product, supplier, company) => {
  const filename = `Supplier_Product_${product?.product_name || 'product'}_${formatDateInput()}`;
  exportAsHtml({
    title: 'Produit fournisseur',
    filename,
    content: productContent(product, supplier, company),
  });
};

export const exportSupplierInvoicePDF = async (invoice, supplier, company, invoiceSettings = null) => {
  const filename = `Supplier_Invoice_${invoice?.invoice_number || 'invoice'}_${formatDateInput()}`;
  const templateInvoice = await toTemplateSupplierInvoice(invoice, supplier);
  const { content } = await renderInvoiceTemplateContent({
    invoice: templateInvoice,
    company,
    supplier,
    settingsOverride: invoiceSettings,
  });
  await exportTemplateInvoiceAsPdf({
    filename,
    content,
  });
};

export const exportSupplierInvoiceHTML = async (invoice, supplier, company, invoiceSettings = null) => {
  const filename = `Supplier_Invoice_${invoice?.invoice_number || 'invoice'}_${formatDateInput()}`;
  const templateInvoice = await toTemplateSupplierInvoice(invoice, supplier);
  const { content } = await renderInvoiceTemplateContent({
    invoice: templateInvoice,
    company,
    supplier,
    settingsOverride: invoiceSettings,
  });
  const html = buildStandaloneTemplateHtml('Facture fournisseur', content);
  downloadHtmlFile(html, filename);
};
