/**
 * Accounting Calculations Engine
 * Pure functions for computing financial reports from raw data
 */

// ============================================================================
// PERIOD FILTERING
// ============================================================================

export function filterByPeriod(items, startDate, endDate, dateField = 'date') {
  if (!items || !startDate || !endDate) return items || [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return items.filter(item => {
    const d = new Date(item[dateField]);
    return d >= start && d <= end;
  });
}

// ============================================================================
// REVENUE & EXPENSES
// ============================================================================

/**
 * Calculate total revenue HT from paid invoices
 */
export function calculateRevenue(invoices, startDate, endDate) {
  const filtered = filterByPeriod(invoices, startDate, endDate, 'date')
    .filter(inv => inv.status === 'paid');
  return filtered.reduce((sum, inv) => sum + (parseFloat(inv.total_ht) || 0), 0);
}

/**
 * Calculate total revenue TTC from paid invoices
 */
export function calculateRevenueTTC(invoices, startDate, endDate) {
  const filtered = filterByPeriod(invoices, startDate, endDate, 'date')
    .filter(inv => inv.status === 'paid');
  return filtered.reduce((sum, inv) => sum + (parseFloat(inv.total_ttc) || parseFloat(inv.total_ht) || 0), 0);
}

/**
 * Calculate total expenses from expenses + supplier invoices
 */
export function calculateExpenses(expenses, supplierInvoices, startDate, endDate) {
  const filteredExpenses = filterByPeriod(expenses, startDate, endDate, 'date');
  const filteredSupplier = filterByPeriod(supplierInvoices || [], startDate, endDate, 'created_at');

  const expTotal = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount_ht) || parseFloat(e.amount) || 0), 0);
  const supTotal = filteredSupplier.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

  return expTotal + supTotal;
}

/**
 * Calculate net income = Revenue HT - Total Expenses
 */
export function calculateNetIncome(invoices, expenses, supplierInvoices, startDate, endDate) {
  const revenue = calculateRevenue(invoices, startDate, endDate);
  const totalExpenses = calculateExpenses(expenses, supplierInvoices, startDate, endDate);
  return revenue - totalExpenses;
}

// ============================================================================
// VAT (TVA)
// ============================================================================

/**
 * Calculate output VAT (TVA collectée) from client invoices
 * = sum of (total_ttc - total_ht) for each paid invoice
 */
export function calculateOutputVAT(invoices, startDate, endDate) {
  const filtered = filterByPeriod(invoices, startDate, endDate, 'date')
    .filter(inv => inv.status === 'paid');

  return filtered.reduce((sum, inv) => {
    const ttc = parseFloat(inv.total_ttc) || 0;
    const ht = parseFloat(inv.total_ht) || 0;
    return sum + (ttc - ht);
  }, 0);
}

/**
 * Calculate input VAT (TVA déductible) from expenses and supplier invoices
 */
export function calculateInputVAT(expenses, supplierInvoices, startDate, endDate) {
  const filteredExpenses = filterByPeriod(expenses, startDate, endDate, 'date');
  const filteredSupplier = filterByPeriod(supplierInvoices || [], startDate, endDate, 'created_at');

  const expVAT = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.tax_amount) || 0), 0);
  const supVAT = filteredSupplier.reduce((sum, s) => sum + (parseFloat(s.tax_amount) || 0), 0);

  return expVAT + supVAT;
}

/**
 * Calculate VAT payable = Output VAT - Input VAT
 */
export function calculateVATPayable(outputVAT, inputVAT) {
  return outputVAT - inputVAT;
}

/**
 * Detailed VAT breakdown by tax rate
 */
export function calculateVATBreakdown(invoices, expenses, startDate, endDate) {
  const filteredInvoices = filterByPeriod(invoices, startDate, endDate, 'date')
    .filter(inv => inv.status === 'paid');
  const filteredExpenses = filterByPeriod(expenses, startDate, endDate, 'date');

  // Group output VAT by rate
  const outputByRate = {};
  filteredInvoices.forEach(inv => {
    const rate = parseFloat(inv.tax_rate) || 0;
    const vat = (parseFloat(inv.total_ttc) || 0) - (parseFloat(inv.total_ht) || 0);
    const key = rate.toFixed(2);
    if (!outputByRate[key]) outputByRate[key] = { rate, base: 0, vat: 0 };
    outputByRate[key].base += parseFloat(inv.total_ht) || 0;
    outputByRate[key].vat += vat;
  });

  // Group input VAT by rate
  const inputByRate = {};
  filteredExpenses.forEach(exp => {
    const rate = parseFloat(exp.tax_rate) || 0;
    if (rate === 0) return;
    const vat = parseFloat(exp.tax_amount) || 0;
    const key = rate.toFixed(2);
    if (!inputByRate[key]) inputByRate[key] = { rate, base: 0, vat: 0 };
    inputByRate[key].base += parseFloat(exp.amount_ht) || parseFloat(exp.amount) || 0;
    inputByRate[key].vat += vat;
  });

  return {
    output: Object.values(outputByRate).sort((a, b) => b.rate - a.rate),
    input: Object.values(inputByRate).sort((a, b) => b.rate - a.rate)
  };
}

// ============================================================================
// BALANCE SHEET (BILAN)
// ============================================================================

/**
 * Build balance sheet from accounts and transaction data
 * Uses mappings to determine which amounts go to which accounts
 */
export function buildBalanceSheet(accounts, invoices, expenses, supplierInvoices, mappings, startDate, endDate) {
  if (!accounts || accounts.length === 0) {
    return { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0, balanced: true };
  }

  const revenue = calculateRevenue(invoices, startDate, endDate);
  const totalExpenses = calculateExpenses(expenses, supplierInvoices, startDate, endDate);
  const netIncome = revenue - totalExpenses;
  const outputVAT = calculateOutputVAT(invoices, startDate, endDate);
  const inputVAT = calculateInputVAT(expenses, supplierInvoices, startDate, endDate);
  const receivables = calculateReceivables(invoices, startDate, endDate);
  const payables = calculatePayables(supplierInvoices, startDate, endDate);

  // Build account balances
  const assetAccounts = accounts.filter(a => a.account_type === 'asset');
  const liabilityAccounts = accounts.filter(a => a.account_type === 'liability');
  const equityAccounts = accounts.filter(a => a.account_type === 'equity');

  // Simple distribution: assign known balances to matching accounts
  const assets = groupByCategory(assetAccounts).map(group => ({
    ...group,
    accounts: group.accounts.map(a => ({
      ...a,
      balance: estimateAccountBalance(a, { revenue, totalExpenses, receivables, payables, netIncome, outputVAT, inputVAT })
    }))
  }));

  const liabilities = groupByCategory(liabilityAccounts).map(group => ({
    ...group,
    accounts: group.accounts.map(a => ({
      ...a,
      balance: estimateAccountBalance(a, { revenue, totalExpenses, receivables, payables, netIncome, outputVAT, inputVAT })
    }))
  }));

  const equity = groupByCategory(equityAccounts).map(group => ({
    ...group,
    accounts: group.accounts.map(a => ({
      ...a,
      balance: a.account_code.startsWith('12') ? netIncome : estimateAccountBalance(a, { revenue, totalExpenses, receivables, payables, netIncome, outputVAT, inputVAT })
    }))
  }));

  const totalAssets = assets.reduce((sum, g) => sum + g.accounts.reduce((s, a) => s + a.balance, 0), 0);
  const totalLiabilities = liabilities.reduce((sum, g) => sum + g.accounts.reduce((s, a) => s + a.balance, 0), 0);
  const totalEquity = equity.reduce((sum, g) => sum + g.accounts.reduce((s, a) => s + a.balance, 0), 0);

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalPassif: totalLiabilities + totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
  };
}

// ============================================================================
// INCOME STATEMENT (COMPTE DE RÉSULTAT)
// ============================================================================

export function buildIncomeStatement(accounts, invoices, expenses, supplierInvoices, mappings, startDate, endDate) {
  if (!accounts || accounts.length === 0) {
    return { revenueItems: [], expenseItems: [], totalRevenue: 0, totalExpenses: 0, netIncome: 0 };
  }

  const filteredInvoices = filterByPeriod(invoices, startDate, endDate, 'date').filter(inv => inv.status === 'paid');
  const filteredExpenses = filterByPeriod(expenses, startDate, endDate, 'date');
  const filteredSupplier = filterByPeriod(supplierInvoices || [], startDate, endDate, 'created_at');

  const revenueAccounts = accounts.filter(a => a.account_type === 'revenue');
  const expenseAccounts = accounts.filter(a => a.account_type === 'expense');

  // Distribute revenue across revenue accounts using mappings
  const totalRevHT = filteredInvoices.reduce((s, i) => s + (parseFloat(i.total_ht) || 0), 0);
  const revenueItems = groupByCategory(revenueAccounts).map(group => ({
    ...group,
    accounts: group.accounts.map(a => ({
      ...a,
      amount: distributeToAccount(a, mappings, 'invoice', totalRevHT, revenueAccounts.length)
    }))
  }));

  // Distribute expenses across expense accounts using mappings
  const expByCategory = {};
  filteredExpenses.forEach(e => {
    const cat = e.category || 'general';
    if (!expByCategory[cat]) expByCategory[cat] = 0;
    expByCategory[cat] += parseFloat(e.amount_ht) || parseFloat(e.amount) || 0;
  });

  const supTotal = filteredSupplier.reduce((s, si) => s + (parseFloat(si.amount) || 0), 0);

  const expenseItems = groupByCategory(expenseAccounts).map(group => ({
    ...group,
    accounts: group.accounts.map(a => {
      // Check if this account is mapped to a category
      const mapping = mappings?.find(m =>
        m.source_type === 'expense' && (m.debit_account_code === a.account_code || m.credit_account_code === a.account_code)
      );
      const catAmount = mapping ? (expByCategory[mapping.source_category] || 0) : 0;
      return { ...a, amount: catAmount };
    })
  }));

  const totalRevenue = revenueItems.reduce((s, g) => s + g.accounts.reduce((ss, a) => ss + a.amount, 0), 0);
  const totalExp = expenseItems.reduce((s, g) => s + g.accounts.reduce((ss, a) => ss + a.amount, 0), 0);
  // Add unmapped expenses
  const mappedExpTotal = Object.values(expByCategory).reduce((s, v) => s + v, 0);
  const unmappedExpenses = mappedExpTotal - totalExp + supTotal;

  return {
    revenueItems,
    expenseItems,
    totalRevenue: totalRevHT || totalRevenue,
    totalExpenses: mappedExpTotal + supTotal,
    netIncome: totalRevHT - (mappedExpTotal + supTotal),
    unmappedExpenses: unmappedExpenses > 0 ? unmappedExpenses : 0
  };
}

// ============================================================================
// TAX ESTIMATION
// ============================================================================

/**
 * Default French corporate tax brackets (IS)
 */
export const DEFAULT_TAX_BRACKETS = [
  { min: 0, max: 42500, rate: 0.15, label: 'Taux réduit PME (15%)' },
  { min: 42500, max: Infinity, rate: 0.25, label: 'Taux normal (25%)' }
];

export function estimateTax(netIncome, brackets = DEFAULT_TAX_BRACKETS) {
  if (netIncome <= 0) return { totalTax: 0, effectiveRate: 0, details: [], quarterlyPayment: 0 };

  let remaining = netIncome;
  let totalTax = 0;
  const details = [];

  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const taxableInBracket = Math.min(remaining, (bracket.max === Infinity ? remaining : bracket.max - bracket.min));
    const tax = taxableInBracket * bracket.rate;
    details.push({
      ...bracket,
      taxableAmount: taxableInBracket,
      tax
    });
    totalTax += tax;
    remaining -= taxableInBracket;
  }

  return {
    totalTax,
    effectiveRate: netIncome > 0 ? totalTax / netIncome : 0,
    details,
    quarterlyPayment: totalTax / 4
  };
}

// ============================================================================
// MONTHLY AGGREGATION (for charts)
// ============================================================================

export function aggregateByMonth(items, dateField = 'date', amountField = 'amount') {
  const months = {};

  (items || []).forEach(item => {
    const d = new Date(item[dateField]);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    if (!months[key]) months[key] = { key, label, total: 0 };
    months[key].total += parseFloat(item[amountField]) || 0;
  });

  return Object.values(months).sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Build monthly revenue vs expenses chart data
 */
export function buildMonthlyChartData(invoices, expenses, startDate, endDate) {
  const filteredInvoices = filterByPeriod(invoices, startDate, endDate, 'date')
    .filter(inv => inv.status === 'paid');
  const filteredExpenses = filterByPeriod(expenses, startDate, endDate, 'date');

  const months = {};

  filteredInvoices.forEach(inv => {
    const d = new Date(inv.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'short' });
    if (!months[key]) months[key] = { name: label, key, revenue: 0, expense: 0 };
    months[key].revenue += parseFloat(inv.total_ht) || 0;
  });

  filteredExpenses.forEach(exp => {
    const d = new Date(exp.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'short' });
    if (!months[key]) months[key] = { name: label, key, revenue: 0, expense: 0 };
    months[key].expense += parseFloat(exp.amount_ht) || parseFloat(exp.amount) || 0;
  });

  return Object.values(months).sort((a, b) => a.key.localeCompare(b.key));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateReceivables(invoices, startDate, endDate) {
  const filtered = filterByPeriod(invoices, startDate, endDate, 'date')
    .filter(inv => inv.status !== 'paid' && inv.status !== 'draft');
  return filtered.reduce((sum, inv) => sum + (parseFloat(inv.total_ttc) || 0), 0);
}

function calculatePayables(supplierInvoices, startDate, endDate) {
  const filtered = filterByPeriod(supplierInvoices || [], startDate, endDate, 'created_at')
    .filter(si => si.payment_status !== 'paid');
  return filtered.reduce((sum, si) => sum + (parseFloat(si.amount) || 0), 0);
}

function groupByCategory(accounts) {
  const groups = {};
  accounts.forEach(a => {
    const cat = a.account_category || 'Autres';
    if (!groups[cat]) groups[cat] = { category: cat, accounts: [] };
    groups[cat].accounts.push(a);
  });
  return Object.values(groups).sort((a, b) => a.category.localeCompare(b.category));
}

function estimateAccountBalance(account, data) {
  const code = account.account_code;
  // Rough mapping based on common account code patterns
  if (code.startsWith('41')) return data.receivables || 0; // Clients
  if (code.startsWith('40')) return data.payables || 0; // Fournisseurs
  if (code.startsWith('51') || code.startsWith('52')) return (data.revenue - data.totalExpenses) || 0; // Banque/Trésorerie
  if (code.startsWith('44') && code.includes('57')) return data.outputVAT || 0; // TVA collectée
  if (code.startsWith('44') && code.includes('56')) return data.inputVAT || 0; // TVA déductible
  return 0;
}

function distributeToAccount(account, mappings, sourceType, totalAmount, totalAccounts) {
  if (!mappings || mappings.length === 0) {
    // If no mappings, distribute evenly across accounts of this type
    return totalAccounts > 0 ? totalAmount / totalAccounts : 0;
  }

  const mapping = mappings.find(m =>
    m.source_type === sourceType && (m.credit_account_code === account.account_code || m.debit_account_code === account.account_code)
  );

  return mapping ? totalAmount : 0;
}
