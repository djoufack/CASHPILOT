/**
 * Invoice template registry
 * Defines available invoice templates with metadata.
 */

const invoiceTemplates = [
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

export const getTemplate = (templateId) =>
  invoiceTemplates.find(t => t.id === templateId) || invoiceTemplates[0];

export default invoiceTemplates;
