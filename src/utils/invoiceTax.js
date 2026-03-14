const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const resolveInvoiceTaxAmount = (invoice) => {
  const explicitTax = toFiniteNumber(invoice?.tax_amount ?? invoice?.total_tva ?? invoice?.vat_amount);

  if (Math.abs(explicitTax) > 0.000001) {
    return explicitTax;
  }

  const totalHt = toFiniteNumber(invoice?.total_ht ?? invoice?.subtotal);
  const totalTtc = toFiniteNumber(invoice?.total_ttc ?? invoice?.total);
  return Math.max(0, Number((totalTtc - totalHt).toFixed(2)));
};

export default resolveInvoiceTaxAmount;
