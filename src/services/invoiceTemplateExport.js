import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { supabase } from '@/lib/supabase';
import { getTheme } from '@/config/invoiceThemes';
import { DEFAULT_INVOICE_TEMPLATE_ID } from '@/config/invoiceTemplates';
import ClassicTemplate from '@/components/invoice-templates/ClassicTemplate';
import ModernTemplate from '@/components/invoice-templates/ModernTemplate';
import MinimalTemplate from '@/components/invoice-templates/MinimalTemplate';
import BoldTemplate from '@/components/invoice-templates/BoldTemplate';
import ProfessionalTemplate from '@/components/invoice-templates/ProfessionalTemplate';
import DMGDefaultTemplate from '@/components/invoice-templates/DMGDefaultTemplate';

const templateComponents = {
  dmg_default: DMGDefaultTemplate,
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  bold: BoldTemplate,
  professional: ProfessionalTemplate,
};

const TEMPLATE_IDS = new Set(Object.keys(templateComponents));

const DEFAULT_EXPORT_SETTINGS = {
  template_id: DEFAULT_INVOICE_TEMPLATE_ID,
  color_theme: 'default',
  custom_labels: {},
  show_logo: true,
  show_bank_details: true,
  show_payment_terms: true,
  footer_text: '',
  font_family: 'Inter',
};

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeTemplateId = (templateId) => (
  templateId && TEMPLATE_IDS.has(templateId)
    ? templateId
    : DEFAULT_INVOICE_TEMPLATE_ID
);

const normalizeInvoiceSettings = (rawSettings = {}) => ({
  ...DEFAULT_EXPORT_SETTINGS,
  ...rawSettings,
  template_id: normalizeTemplateId(rawSettings.template_id),
  custom_labels: rawSettings.custom_labels || {},
  font_family: rawSettings.font_family || 'Inter',
});

const buildClientFromSupplier = (supplier = {}, invoice = {}) => {
  const companyName = supplier?.company_name || invoice?.supplier_name_extracted || 'Fournisseur';
  return {
    companyName,
    company_name: companyName,
    preferredCurrency: invoice?.currency || supplier?.currency || 'EUR',
    preferred_currency: invoice?.currency || supplier?.currency || 'EUR',
    address: supplier?.address || invoice?.supplier_address_extracted || '',
    city: supplier?.city || '',
    postal_code: supplier?.postal_code || '',
    country: supplier?.country || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
    vat_number: supplier?.tax_id || invoice?.supplier_vat_number || '',
  };
};

const normalizeTemplateItems = (invoice = {}, fallbackDescription = 'Prestation') => {
  const rawItems = Array.isArray(invoice?.items)
    ? invoice.items
    : (Array.isArray(invoice?.line_items) ? invoice.line_items : []);

  const normalizedItems = rawItems.map((item) => {
    const quantity = toFiniteNumber(item?.quantity ?? item?.qty ?? 1) || 1;
    const unitPrice = toFiniteNumber(item?.unit_price ?? item?.unitPrice ?? item?.rate ?? 0);
    const lineTotalRaw = item?.total ?? item?.line_total ?? item?.amount;
    const lineTotal = lineTotalRaw !== undefined && lineTotalRaw !== null && lineTotalRaw !== ''
      ? toFiniteNumber(lineTotalRaw)
      : quantity * unitPrice;

    return {
      ...item,
      description: item?.description || item?.name || fallbackDescription,
      quantity,
      unit_price: unitPrice,
      total: lineTotal,
    };
  });

  if (normalizedItems.length > 0) {
    return normalizedItems;
  }

  const fallbackAmount = toFiniteNumber(invoice?.total_ht ?? invoice?.total_ttc ?? invoice?.total_amount ?? invoice?.total ?? 0);
  if (fallbackAmount <= 0) {
    return [];
  }

  return [{
    description: fallbackDescription,
    quantity: 1,
    unit_price: fallbackAmount,
    total: fallbackAmount,
  }];
};

const normalizeInvoiceForTemplate = ({ invoice, supplier }) => {
  const normalized = { ...(invoice || {}) };

  normalized.invoice_number = normalized.invoice_number || normalized.invoiceNumber || normalized.reference || '-';
  normalized.date = normalized.date || normalized.issueDate || normalized.invoice_date || normalized.created_at || null;
  normalized.due_date = normalized.due_date || normalized.dueDate || normalized.payment_due_date || null;
  normalized.total_ht = toFiniteNumber(normalized.total_ht ?? normalized.subtotal ?? normalized.total_amount ?? 0);
  normalized.total_ttc = toFiniteNumber(normalized.total_ttc ?? normalized.total ?? normalized.total_amount ?? normalized.total_ht);
  normalized.total = normalized.total_ttc;
  normalized.tax_rate = toFiniteNumber(normalized.tax_rate ?? normalized.taxRate ?? normalized.vat_rate ?? 0);
  normalized.tax_amount = toFiniteNumber(normalized.tax_amount ?? normalized.vat_amount ?? Math.max(0, normalized.total_ttc - normalized.total_ht));
  normalized.payment_status = normalized.payment_status || 'pending';
  normalized.status = normalized.status || normalized.approval_status || normalized.payment_status || 'draft';
  normalized.items = normalizeTemplateItems(normalized, supplier ? 'Ligne fournisseur' : 'Ligne facture');

  if (!normalized.client && supplier) {
    normalized.client = buildClientFromSupplier(supplier, normalized);
  }

  return normalized;
};

const collectDocumentStyles = () => {
  if (typeof document === 'undefined' || !document.styleSheets) {
    return '';
  }

  const chunks = [];
  const sheets = Array.from(document.styleSheets);
  for (const sheet of sheets) {
    try {
      const rules = sheet.cssRules ? Array.from(sheet.cssRules) : [];
      if (rules.length > 0) {
        chunks.push(rules.map((rule) => rule.cssText).join('\n'));
      }
    } catch {
      // Ignore cross-origin stylesheets.
    }
  }

  return chunks.join('\n');
};

const sanitizeForHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const resolveInvoiceExportSettings = async (userId, settingsOverride = null) => {
  if (settingsOverride) {
    return normalizeInvoiceSettings(settingsOverride);
  }

  let effectiveUserId = userId || null;
  if (!effectiveUserId) {
    const { data } = await supabase.auth.getUser();
    effectiveUserId = data?.user?.id || null;
  }

  if (!effectiveUserId) {
    return normalizeInvoiceSettings();
  }

  const { data, error } = await supabase
    .from('invoice_settings')
    .select('*')
    .eq('user_id', effectiveUserId)
    .maybeSingle();

  if (error) {
    return normalizeInvoiceSettings();
  }

  return normalizeInvoiceSettings(data || {});
};

export const renderInvoiceTemplateContent = async ({
  invoice,
  company,
  supplier = null,
  settingsOverride = null,
}) => {
  const normalizedInvoice = normalizeInvoiceForTemplate({ invoice, supplier });
  const settings = await resolveInvoiceExportSettings(
    normalizedInvoice?.user_id || normalizedInvoice?.userId || null,
    settingsOverride,
  );
  const theme = getTheme(settings.color_theme);
  const TemplateComponent = templateComponents[settings.template_id] || templateComponents[DEFAULT_INVOICE_TEMPLATE_ID];
  const client = normalizedInvoice.client || {};
  const items = Array.isArray(normalizedInvoice.items) ? normalizedInvoice.items : [];

  const content = renderToStaticMarkup(
    React.createElement(TemplateComponent, {
      invoice: normalizedInvoice,
      client,
      items,
      company,
      theme,
      settings,
    }),
  );

  return {
    content,
    settings,
  };
};

export const buildStandaloneTemplateHtml = (title, content) => {
  const styles = collectDocumentStyles();
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${sanitizeForHtml(title)}</title>
  <style>
${styles}
  </style>
  <style>
    body { margin: 0; background: #ffffff; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
};

