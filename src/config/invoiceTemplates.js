/**
 * Invoice template registry
 * Defines available invoice templates with metadata.
 */

const invoiceTemplates = [
  {
    id: 'dmg_default',
    name: 'Business Default',
    description: 'Structured card layout with detailed totals panel',
    preview: 'dmg_default',
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Clean, traditional layout with header and footer',
    preview: 'classic',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Sleek lines with accent sidebar',
    preview: 'modern',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Minimalist design with generous whitespace',
    preview: 'minimal',
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Color blocks and strong typography',
    preview: 'bold',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Formal two-column header layout',
    preview: 'professional',
  },
];

export const DEFAULT_INVOICE_TEMPLATE_ID = 'dmg_default';

export const getTemplate = (templateId) =>
  invoiceTemplates.find(t => t.id === templateId) ||
  invoiceTemplates.find((template) => template.id === DEFAULT_INVOICE_TEMPLATE_ID) ||
  invoiceTemplates[0];

export default invoiceTemplates;
