import React from 'react';
import { formatCurrency } from '@/utils/calculations';

/**
 * Shared enhanced sections for all invoice templates.
 * Renders: reference, header_note, footer_note, terms_and_conditions,
 * custom_fields, shipping_fee, adjustment in totals, HSN code column.
 */

export const EnhancedReference = ({ invoice, label, style }) => {
  const ref = invoice.reference;
  if (!ref) return null;
  return (
    <div style={style}>
      <span>{label || 'Reference'}: </span>
      <span className="font-semibold">{ref}</span>
    </div>
  );
};

export const EnhancedHeaderNote = ({ invoice, style }) => {
  const note = invoice.header_note;
  if (!note) return null;
  return (
    <div className="whitespace-pre-line text-sm" style={style}>
      {note}
    </div>
  );
};

export const EnhancedFooterNote = ({ invoice, theme, className = '' }) => {
  const note = invoice.footer_note;
  if (!note) return null;
  return (
    <div className={`whitespace-pre-line text-sm ${className}`} style={{ color: theme?.textLight }}>
      {note}
    </div>
  );
};

export const EnhancedTerms = ({ invoice, theme, label, className = '' }) => {
  const terms = invoice.terms_and_conditions;
  if (!terms) return null;
  return (
    <div className={className}>
      <h3 className="font-semibold text-sm mb-1" style={{ color: theme?.textLight }}>{label || 'Terms & Conditions'}</h3>
      <p className="whitespace-pre-line text-xs" style={{ color: theme?.textLight }}>{terms}</p>
    </div>
  );
};

export const EnhancedCustomFields = ({ invoice, theme, className = '' }) => {
  const fields = invoice.custom_fields;
  if (!fields || !Array.isArray(fields) || fields.length === 0) return null;
  return (
    <div className={`text-sm ${className}`}>
      {fields.map((f, i) => (
        <div key={i} className="flex justify-between py-0.5">
          <span style={{ color: theme?.textLight }}>{f.label}:</span>
          <span className="font-medium">{f.value}</span>
        </div>
      ))}
    </div>
  );
};

export const EnhancedShippingTotalRow = ({ invoice, currency, theme, style }) => {
  const shipping = Number(invoice.shipping_fee || 0);
  if (shipping <= 0) return null;
  return (
    <div className="flex justify-between" style={style}>
      <span style={{ color: theme?.textLight || '#666' }}>Shipping:</span>
      <span>+{formatCurrency(shipping, currency)}</span>
    </div>
  );
};

export const EnhancedAdjustmentTotalRow = ({ invoice, currency, theme, style }) => {
  const adj = Number(invoice.adjustment || 0);
  if (adj === 0) return null;
  return (
    <div className="flex justify-between" style={style}>
      <span style={{ color: theme?.textLight || '#666' }}>{invoice.adjustment_label || 'Adjustment'}:</span>
      <span>{adj > 0 ? '+' : ''}{formatCurrency(adj, currency)}</span>
    </div>
  );
};

// Compute grand total (call in each template)
export const getGrandTotal = (invoice) => {
  const ttc = Number(invoice.total_ttc || invoice.total || 0);
  const shipping = Number(invoice.shipping_fee || 0);
  const adj = Number(invoice.adjustment || 0);
  // If the total_ttc already includes shipping/adjustment (set at creation), just use it
  // Otherwise if stored separately, add them
  return ttc;
};

export const hasHsnCodes = (items) => {
  return items?.some(item => item.hsn_code);
};
