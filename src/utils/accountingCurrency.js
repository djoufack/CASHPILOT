export const resolveAccountingCurrency = (company) => {
  const accountingCurrency =
    typeof company?.accounting_currency === 'string' ? company.accounting_currency.trim().toUpperCase() : null;

  return accountingCurrency || 'EUR';
};
