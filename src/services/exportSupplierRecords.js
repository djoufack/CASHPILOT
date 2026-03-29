import { getLocale } from '@/utils/dateLocale';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';
import { formatDateInput } from '@/utils/dateFormatting';
import { supabase } from '@/lib/supabase';
import {
  renderInvoiceTemplateContent,
  buildStandaloneTemplateHtml,
  resolveInvoiceExportSettings,
} from '@/services/invoiceTemplateExport';
import { getTheme } from '@/config/invoiceThemes';
import { escapeHTML as escapeHtml, setSafeHtml } from '@/utils/sanitize';

const formatMoney = (value, currency = 'EUR') => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
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

const exportSupplierRecordAsPdf = async ({ filename, content }) => {
  const tempDiv = document.createElement('div');
  setSafeHtml(tempDiv, content);
  document.body.appendChild(tempDiv);

  try {
    await saveElementAsPdf(tempDiv, {
      margin: 10,
      filename: `${filename}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
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

const exportSupplierRecordAsHtml = ({ title, filename, content }) => {
  const html = buildStandaloneTemplateHtml(title, content);
  downloadHtmlFile(html, filename);
};

const toDisplayDate = (value) => (value ? new Date(value).toLocaleDateString(getLocale()) : '-');

const normalizePricingType = (value) => {
  if (value === 'hourly') return 'Horaire';
  if (value === 'fixed') return 'Forfait';
  if (value === 'per_unit') return 'A l unite';
  return value || '-';
};

const getStockMeta = (stock, min) => {
  if (stock <= 0) {
    return {
      label: 'Rupture',
      textColor: '#991b1b',
      borderColor: '#fecaca',
      bgColor: '#fef2f2',
      reorderQty: Math.max(min, 1),
    };
  }
  if (stock <= min) {
    return {
      label: 'Stock bas',
      textColor: '#92400e',
      borderColor: '#fde68a',
      bgColor: '#fffbeb',
      reorderQty: Math.max(min - stock, 1),
    };
  }
  return {
    label: 'Stock OK',
    textColor: '#166534',
    borderColor: '#bbf7d0',
    bgColor: '#f0fdf4',
    reorderQty: 0,
  };
};

const resolveSupplierRecordTheme = async (settingsOverride = null) => {
  const settings = await resolveInvoiceExportSettings(null, settingsOverride);
  const theme = getTheme(settings.color_theme);
  return { settings, theme };
};

const serviceContent = (service, supplier, company, settings, theme) => {
  const currency = supplier?.currency || company?.accounting_currency || 'EUR';
  const priceValue =
    service?.pricing_type === 'fixed'
      ? formatMoney(service?.fixed_price, currency)
      : `${formatMoney(service?.hourly_rate, currency)} / h`;

  const companyName = escapeHtml(company?.company_name || company?.name || 'CashPilot');
  const supplierName = escapeHtml(supplier?.company_name || 'Fournisseur');
  const fontFamily = escapeHtml(settings?.font_family || 'Inter');

  return `
    <div style="font-family:${fontFamily};max-width:860px;margin:0 auto;padding:20px;background:#f4f6f8;color:${theme.text};">
      <section style="background:#ffffff;border:2px solid ${theme.accent};border-radius:8px;padding:16px 18px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
          <div>
            <h1 style="margin:0 0 8px 0;font-size:42px;line-height:1;font-weight:900;color:${theme.primary};">SERVICE FOURNISSEUR</h1>
            <p style="margin:0;font-size:14px;color:${theme.textLight};">${supplierName} • ${companyName}</p>
          </div>
          <div style="text-align:right;font-size:12px;color:${theme.textLight};">
            <p style="margin:0 0 4px 0;"><strong style="color:${theme.text};">Date export:</strong> ${toDisplayDate(new Date().toISOString())}</p>
          </div>
        </div>
      </section>
      <section style="background:#ffffff;border:1px solid ${theme.border};border-radius:8px;padding:16px 18px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Nom du service</p>
            <p style="margin:0 0 12px 0;font-size:34px;line-height:1.1;font-weight:800;color:${theme.primary};">${escapeHtml(service?.service_name || '-')}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Prix</p>
            <p style="margin:0;font-size:24px;font-weight:800;color:${theme.primary};">${escapeHtml(priceValue)}</p>
          </div>
          <div>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Tarification</p>
            <p style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:${theme.text};">${escapeHtml(normalizePricingType(service?.pricing_type))}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Unité</p>
            <p style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:${theme.text};">${escapeHtml(service?.unit || '-')}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Dernière mise à jour</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:${theme.text};">${toDisplayDate(service?.updated_at || service?.created_at)}</p>
          </div>
        </div>
      </section>
    </div>
  `;
};

const productContent = (product, supplier, company, settings, theme) => {
  const currency = supplier?.currency || company?.accounting_currency || 'EUR';
  const stock = Number(product?.stock_quantity || 0);
  const min = Number(product?.min_stock_level || 0);
  const stockMeta = getStockMeta(stock, min);
  const companyName = escapeHtml(company?.company_name || company?.name || 'CashPilot');
  const supplierName = escapeHtml(supplier?.company_name || 'Fournisseur');
  const fontFamily = escapeHtml(settings?.font_family || 'Inter');

  return `
    <div style="font-family:${fontFamily};max-width:860px;margin:0 auto;padding:20px;background:#f4f6f8;color:${theme.text};">
      <section style="background:#ffffff;border:2px solid ${theme.accent};border-radius:8px;padding:16px 18px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
          <div>
            <h1 style="margin:0 0 8px 0;font-size:42px;line-height:1;font-weight:900;color:${theme.primary};">PRODUIT FOURNISSEUR</h1>
            <p style="margin:0;font-size:14px;color:${theme.textLight};">${supplierName} • ${companyName}</p>
          </div>
          <div style="text-align:right;font-size:12px;color:${theme.textLight};">
            <p style="margin:0 0 4px 0;"><strong style="color:${theme.text};">Date export:</strong> ${toDisplayDate(new Date().toISOString())}</p>
          </div>
        </div>
      </section>
      <section style="background:#ffffff;border:1px solid ${theme.border};border-radius:8px;padding:16px 18px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Nom du produit</p>
            <p style="margin:0 0 12px 0;font-size:34px;line-height:1.1;font-weight:800;color:${theme.primary};">${escapeHtml(product?.product_name || '-')}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">SKU</p>
            <p style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:${theme.text};">${escapeHtml(product?.sku || '-')}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Prix d'achat</p>
            <p style="margin:0;font-size:24px;font-weight:800;color:${theme.primary};">${escapeHtml(formatMoney(product?.unit_price, currency))}</p>
          </div>
          <div>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Catégorie</p>
            <p style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:${theme.text};">${escapeHtml(product?.category?.name || '-')}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Stock actuel / Min</p>
            <p style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:${theme.text};">${escapeHtml(stock)} / ${escapeHtml(min)}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Situation stock</p>
            <p style="display:inline-block;margin:0 0 12px 0;padding:4px 10px;border-radius:999px;font-size:13px;font-weight:700;color:${stockMeta.textColor};border:1px solid ${stockMeta.borderColor};background:${stockMeta.bgColor};">
              ${stockMeta.label}
            </p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Réappro conseillé</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:${theme.text};">${escapeHtml(stockMeta.reorderQty > 0 ? `${stockMeta.reorderQty} unités` : 'Aucun')}</p>
          </div>
        </div>
      </section>
    </div>
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

export const exportSupplierServicePDF = async (service, supplier, company, invoiceSettings = null) => {
  const { settings, theme } = await resolveSupplierRecordTheme(invoiceSettings);
  const filename = `Supplier_Service_${service?.service_name || 'service'}_${formatDateInput()}`;
  await exportSupplierRecordAsPdf({
    filename,
    content: serviceContent(service, supplier, company, settings, theme),
  });
};

export const exportSupplierServiceHTML = async (service, supplier, company, invoiceSettings = null) => {
  const { settings, theme } = await resolveSupplierRecordTheme(invoiceSettings);
  const filename = `Supplier_Service_${service?.service_name || 'service'}_${formatDateInput()}`;
  exportSupplierRecordAsHtml({
    title: 'Service fournisseur',
    filename,
    content: serviceContent(service, supplier, company, settings, theme),
  });
};

export const exportSupplierProductPDF = async (product, supplier, company, invoiceSettings = null) => {
  const { settings, theme } = await resolveSupplierRecordTheme(invoiceSettings);
  const filename = `Supplier_Product_${product?.product_name || 'product'}_${formatDateInput()}`;
  await exportSupplierRecordAsPdf({
    filename,
    content: productContent(product, supplier, company, settings, theme),
  });
};

export const exportSupplierProductHTML = async (product, supplier, company, invoiceSettings = null) => {
  const { settings, theme } = await resolveSupplierRecordTheme(invoiceSettings);
  const filename = `Supplier_Product_${product?.product_name || 'product'}_${formatDateInput()}`;
  exportSupplierRecordAsHtml({
    title: 'Produit fournisseur',
    filename,
    content: productContent(product, supplier, company, settings, theme),
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
