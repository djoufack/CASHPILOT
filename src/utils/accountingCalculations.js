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

// ============================================================================
// ENTRY-BASED CALCULATIONS (from real accounting_entries)
// ============================================================================

/**
 * Calculate revenue from accounting entries (Class 7 = Produits)
 * Revenue accounts have credit balances in OHADA
 */
export function calculateRevenueFromEntries(entries, accounts, startDate, endDate) {
  if (!entries || !accounts) return 0;
  const filtered = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const accountMap = {};
  accounts.forEach(a => { accountMap[a.account_code] = a; });

  let total = 0;
  filtered.forEach(e => {
    const acc = accountMap[e.account_code];
    if (!acc || !acc.account_code.startsWith('7')) return;
    total += (parseFloat(e.credit) || 0) - (parseFloat(e.debit) || 0);
  });
  return total;
}

/**
 * Calculate total expenses from accounting entries (Class 6 = Charges)
 * Expense accounts have debit balances in OHADA
 */
export function calculateExpensesFromEntries(entries, accounts, startDate, endDate) {
  if (!entries || !accounts) return 0;
  const filtered = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const accountMap = {};
  accounts.forEach(a => { accountMap[a.account_code] = a; });

  let total = 0;
  filtered.forEach(e => {
    const acc = accountMap[e.account_code];
    if (!acc || !acc.account_code.startsWith('6')) return;
    total += (parseFloat(e.debit) || 0) - (parseFloat(e.credit) || 0);
  });
  return total;
}

/**
 * Calculate net income from entries = Revenue - Expenses
 */
export function calculateNetIncomeFromEntries(entries, accounts, startDate, endDate) {
  const revenue = calculateRevenueFromEntries(entries, accounts, startDate, endDate);
  const expenses = calculateExpensesFromEntries(entries, accounts, startDate, endDate);
  return revenue - expenses;
}

/**
 * Calculate output VAT (TVA collectée) from entries
 * Account 4431 (TVA facturée sur ventes) - credit balance
 */
export function calculateOutputVATFromEntries(entries, accounts, startDate, endDate) {
  if (!entries) return 0;
  const filtered = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  let total = 0;
  filtered.forEach(e => {
    if (e.account_code && e.account_code.startsWith('4431')) {
      total += (parseFloat(e.credit) || 0) - (parseFloat(e.debit) || 0);
    }
  });
  return total;
}

/**
 * Calculate input VAT (TVA déductible) from entries
 * Account 445 (TVA récupérable) - debit balance
 */
export function calculateInputVATFromEntries(entries, accounts, startDate, endDate) {
  if (!entries) return 0;
  const filtered = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  let total = 0;
  filtered.forEach(e => {
    if (e.account_code && (e.account_code.startsWith('4452') || e.account_code.startsWith('4456'))) {
      total += (parseFloat(e.debit) || 0) - (parseFloat(e.credit) || 0);
    }
  });
  return total;
}

/**
 * Calculate VAT breakdown by rate from entries
 */
export function calculateVATBreakdownFromEntries(entries, accounts, startDate, endDate) {
  if (!entries) return { output: [], input: [] };
  const filtered = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const accountMap = {};
  (accounts || []).forEach(a => { accountMap[a.account_code] = a; });

  const outputByAccount = {};
  const inputByAccount = {};

  filtered.forEach(e => {
    if (!e.account_code) return;
    if (e.account_code.startsWith('4431')) {
      const key = e.account_code;
      if (!outputByAccount[key]) outputByAccount[key] = { account: key, name: accountMap[key]?.account_name || key, vat: 0, base: 0, rate: 0 };
      outputByAccount[key].vat += (parseFloat(e.credit) || 0) - (parseFloat(e.debit) || 0);
    }
    if (e.account_code.startsWith('4452') || e.account_code.startsWith('4456')) {
      const key = e.account_code;
      if (!inputByAccount[key]) inputByAccount[key] = { account: key, name: accountMap[key]?.account_name || key, vat: 0, base: 0, rate: 0 };
      inputByAccount[key].vat += (parseFloat(e.debit) || 0) - (parseFloat(e.credit) || 0);
    }
  });

  // Compute rate and base for VATDeclaration display compatibility
  const inferRate = (name) => {
    if (name && name.includes('18')) return 0.18;
    if (name && name.includes('5.5')) return 0.055;
    if (name && name.includes('10')) return 0.10;
    if (name && name.includes('20')) return 0.20;
    return 0.1925; // Default OHADA rate
  };
  Object.values(outputByAccount).forEach(v => {
    v.rate = inferRate(v.name);
    v.base = v.rate > 0 ? v.vat / v.rate : 0;
  });
  Object.values(inputByAccount).forEach(v => {
    v.rate = inferRate(v.name);
    v.base = v.rate > 0 ? v.vat / v.rate : 0;
  });

  return {
    output: Object.values(outputByAccount).filter(v => Math.abs(v.vat) > 0.001),
    input: Object.values(inputByAccount).filter(v => Math.abs(v.vat) > 0.001),
  };
}

/**
 * Build monthly chart data from accounting entries
 */
export function buildMonthlyChartDataFromEntries(entries, accounts, startDate, endDate) {
  if (!entries || !accounts) return [];
  const filtered = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const accountMap = {};
  accounts.forEach(a => { accountMap[a.account_code] = a; });

  const months = {};

  filtered.forEach(e => {
    const acc = accountMap[e.account_code];
    if (!acc) return;
    const d = new Date(e.transaction_date);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'short' });
    if (!months[key]) months[key] = { name: label, key, revenue: 0, expense: 0 };

    if (acc.account_code.startsWith('7')) {
      months[key].revenue += (parseFloat(e.credit) || 0) - (parseFloat(e.debit) || 0);
    } else if (acc.account_code.startsWith('6')) {
      months[key].expense += (parseFloat(e.debit) || 0) - (parseFloat(e.credit) || 0);
    }
  });

  return Object.values(months).sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Validate consistency between dashboard KPIs and income statement
 * Returns warnings array (empty = consistent)
 */
export function validateAccountingConsistency(dashboardKPIs, incomeStatement) {
  const warnings = [];
  if (!incomeStatement || !dashboardKPIs) return warnings;

  const threshold = 0.01;

  if (Math.abs((dashboardKPIs.revenue || 0) - (incomeStatement.totalRevenue || 0)) > threshold) {
    warnings.push({
      type: 'revenue_mismatch',
      message: `CA Dashboard (${dashboardKPIs.revenue?.toFixed(2)}) ≠ Compte de résultat (${incomeStatement.totalRevenue?.toFixed(2)})`,
      severity: 'error'
    });
  }

  if (Math.abs((dashboardKPIs.totalExpenses || 0) - (incomeStatement.totalExpenses || 0)) > threshold) {
    warnings.push({
      type: 'expenses_mismatch',
      message: `Charges Dashboard (${dashboardKPIs.totalExpenses?.toFixed(2)}) ≠ Compte de résultat (${incomeStatement.totalExpenses?.toFixed(2)})`,
      severity: 'error'
    });
  }

  if (Math.abs((dashboardKPIs.netIncome || 0) - (incomeStatement.netIncome || 0)) > threshold) {
    warnings.push({
      type: 'net_income_mismatch',
      message: `Résultat net Dashboard (${dashboardKPIs.netIncome?.toFixed(2)}) ≠ Compte de résultat (${incomeStatement.netIncome?.toFixed(2)})`,
      severity: 'error'
    });
  }

  return warnings;
}

/**
 * Build trial balance from real journal entries
 * Groups entries by account_code, sums debits and credits
 * @returns Array of { account_code, account_name, account_type, totalDebit, totalCredit, balance }
 */
export function buildTrialBalance(entries, accounts) {
  if (!entries || entries.length === 0) return [];

  const accountMap = {};
  (accounts || []).forEach(a => {
    accountMap[a.account_code] = a;
  });

  const balances = {};
  entries.forEach(e => {
    const code = e.account_code;
    if (!balances[code]) {
      const acc = accountMap[code] || {};
      balances[code] = {
        account_code: code,
        account_name: acc.account_name || code,
        account_type: acc.account_type || 'unknown',
        account_category: acc.account_category || '',
        totalDebit: 0,
        totalCredit: 0,
        balance: 0,
      };
    }
    balances[code].totalDebit += parseFloat(e.debit) || 0;
    balances[code].totalCredit += parseFloat(e.credit) || 0;
  });

  // Calculate balance: Debit - Credit for asset/expense, Credit - Debit for liability/equity/revenue
  Object.values(balances).forEach(b => {
    if (['asset', 'expense'].includes(b.account_type)) {
      b.balance = b.totalDebit - b.totalCredit;
    } else {
      b.balance = b.totalCredit - b.totalDebit;
    }
  });

  return Object.values(balances).sort((a, b) => a.account_code.localeCompare(b.account_code));
}

/**
 * SYSCOHADA Balance Sheet Sections
 * Maps 2-digit class codes to standard SYSCOHADA balance sheet sections
 */
const SYSCOHADA_ACTIF_SECTIONS = [
  { key: 'actifImmobilise', label: 'ACTIF IMMOBILISÉ', classRange: [20, 29] },
  { key: 'actifCirculant', label: 'ACTIF CIRCULANT', classRange: [30, 49] },
  { key: 'tresorerieActif', label: 'TRÉSORERIE-ACTIF', classRange: [50, 59] },
];
const SYSCOHADA_PASSIF_SECTIONS = [
  { key: 'capitauxPropres', label: 'CAPITAUX PROPRES ET RESSOURCES ASSIMILÉES', classRange: [10, 15] },
  { key: 'dettesFinancieres', label: 'DETTES FINANCIÈRES ET RESSOURCES ASSIMILÉES', classRange: [15, 19] },
  { key: 'passifCirculant', label: 'PASSIF CIRCULANT', classRange: [40, 49] },
  { key: 'tresoreriePassif', label: 'TRÉSORERIE-PASSIF', classRange: [50, 59] },
];

/**
 * Group accounts by their 2-digit class code for SYSCOHADA presentation
 */
function groupByClassCode(accountsList) {
  const groups = {};
  accountsList.forEach(a => {
    const classCode = a.account_code.substring(0, 2);
    if (!groups[classCode]) {
      groups[classCode] = { classCode, className: '', accounts: [] };
    }
    // Use the 2-digit account name as group name (if this IS the 2-digit account, use its name)
    if (a.account_code.length === 2 || a.account_code === classCode) {
      groups[classCode].className = a.account_name;
    }
    // Only add detailed accounts (3+ digits) as line items
    if (a.account_code.length >= 3) {
      groups[classCode].accounts.push(a);
    }
  });
  // If className not set (no 2-digit header found), use first account's category
  Object.values(groups).forEach(g => {
    if (!g.className && g.accounts.length > 0) {
      g.className = g.accounts[0].account_category || g.classCode;
    }
    g.subtotal = g.accounts.reduce((s, a) => s + (a.balance || 0), 0);
  });
  return Object.values(groups).sort((a, b) => a.classCode.localeCompare(b.classCode));
}

/**
 * Build SYSCOHADA section from grouped accounts
 */
function buildSyscohadaSection(allGroups, classRange, accountType) {
  const [min, max] = classRange;
  const filtered = allGroups.filter(g => {
    const code = parseInt(g.classCode, 10);
    if (code < min || code > max) return false;
    // For shared classes (40-49, 50-59), filter by account_type
    if (accountType && g.accounts.length > 0) {
      return g.accounts.some(a => a.account_type === accountType);
    }
    return true;
  });

  // For shared classes, filter individual accounts by type
  const result = filtered.map(g => {
    if (!accountType) return g;
    const accts = g.accounts.filter(a => a.account_type === accountType);
    return { ...g, accounts: accts, subtotal: accts.reduce((s, a) => s + (a.balance || 0), 0) };
  }).filter(g => g.accounts.length > 0 || g.className);

  const total = result.reduce((s, g) => s + g.subtotal, 0);
  return { groups: result, total };
}

/**
 * Build balance sheet from real journal entries — SYSCOHADA structure
 * Includes ALL accounts from the chart of accounts (even those with 0 balance)
 */
export function buildBalanceSheetFromEntries(accounts, entries, startDate, endDate) {
  const emptyResult = {
    assets: [], liabilities: [], equity: [],
    totalAssets: 0, totalLiabilities: 0, totalEquity: 0, totalPassif: 0, balanced: true,
    syscohada: null,
  };

  if (!accounts || accounts.length === 0) return emptyResult;

  // Build trial balance from ALL entries up to endDate (balance sheet is cumulative, not period-based)
  let filtered = [];
  if (entries && entries.length > 0 && endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filtered = entries.filter(e => new Date(e.transaction_date) <= end);
  }
  const trial = filtered.length > 0 ? buildTrialBalance(filtered, accounts) : [];

  // Create a map of trial balances by account_code
  const trialMap = {};
  trial.forEach(t => { trialMap[t.account_code] = t; });

  // Build complete account list: ALL balance sheet accounts (classes 1-5) with balances
  const balanceSheetTypes = ['asset', 'liability', 'equity'];
  const allBsAccounts = accounts
    .filter(a => balanceSheetTypes.includes(a.account_type))
    .map(a => {
      const t = trialMap[a.account_code];
      return {
        account_code: a.account_code,
        account_name: a.account_name,
        account_type: a.account_type,
        account_category: a.account_category || '',
        balance: t ? t.balance : 0,
      };
    });

  // Net income = cumulative (all revenue - all expenses up to endDate)
  // Without year-end closing entries, prior year results remain in classes 6-7.
  // The balance sheet must include ALL prior results to stay balanced:
  //   Actif = Passif + Capitaux Propres + Résultat Net (cumulatif)
  const revenueTotal = trial.filter(t => t.account_type === 'revenue').reduce((s, t) => s + t.balance, 0);
  const expenseTotal = trial.filter(t => t.account_type === 'expense').reduce((s, t) => s + t.balance, 0);
  const netIncome = revenueTotal - expenseTotal;

  // Group by 2-digit class code
  const allGroups = groupByClassCode(allBsAccounts);

  // Build SYSCOHADA sections
  const actifSections = SYSCOHADA_ACTIF_SECTIONS.map(s => ({
    ...s,
    ...buildSyscohadaSection(allGroups, s.classRange, 'asset'),
  }));
  const passifSections = SYSCOHADA_PASSIF_SECTIONS.map(s => ({
    ...s,
    ...buildSyscohadaSection(allGroups, s.classRange,
      s.key === 'capitauxPropres' ? 'equity' :
      s.key === 'dettesFinancieres' ? 'liability' : 'liability'),
  }));

  // Add net income as virtual equity entry in capitaux propres
  const cpSection = passifSections.find(s => s.key === 'capitauxPropres');
  if (cpSection && Math.abs(netIncome) > 0.001) {
    const resultGroup = {
      classCode: '13',
      className: 'RÉSULTAT NET DE L\'EXERCICE',
      accounts: [{
        account_code: '130',
        account_name: `Résultat net : ${netIncome >= 0 ? 'bénéfice' : 'perte'}`,
        account_type: 'equity',
        balance: netIncome,
      }],
      subtotal: netIncome,
    };
    // Replace or add the 13 group
    const idx = cpSection.groups.findIndex(g => g.classCode === '13');
    if (idx >= 0) cpSection.groups[idx] = resultGroup;
    else cpSection.groups.push(resultGroup);
    cpSection.groups.sort((a, b) => a.classCode.localeCompare(b.classCode));
    cpSection.total = cpSection.groups.reduce((s, g) => s + g.subtotal, 0);
  }

  const totalAssets = actifSections.reduce((s, sec) => s + sec.total, 0);
  const totalPassif = passifSections.reduce((s, sec) => s + sec.total, 0);

  // Legacy flat arrays for backward compatibility (used by financialAnalysisCalculations.js)
  const assets = allBsAccounts.filter(a => a.account_type === 'asset');
  const liabilities = allBsAccounts.filter(a => a.account_type === 'liability');
  const equity = [...allBsAccounts.filter(a => a.account_type === 'equity')];
  if (Math.abs(netIncome) > 0.001) {
    equity.push({ account_code: '130', account_name: 'Résultat net de l\'exercice', account_type: 'equity', balance: netIncome });
  }

  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
  const totalEquity = equity.reduce((s, a) => s + a.balance, 0);

  return {
    assets, liabilities, equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalPassif,
    balanced: Math.abs(totalAssets - totalPassif) < 0.01,
    syscohada: { actif: actifSections, passif: passifSections },
  };
}

/**
 * Build income statement from real journal entries
 */
export function buildIncomeStatementFromEntries(accounts, entries, startDate, endDate) {
  if (!entries || entries.length === 0 || !accounts || accounts.length === 0) {
    return { revenueItems: [], expenseItems: [], totalRevenue: 0, totalExpenses: 0, netIncome: 0 };
  }

  const filtered = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const trial = buildTrialBalance(filtered, accounts);

  const revenueAccounts = trial.filter(t => t.account_type === 'revenue' && Math.abs(t.balance) > 0.001);
  const expenseAccounts = trial.filter(t => t.account_type === 'expense' && Math.abs(t.balance) > 0.001);

  const revenueItems = groupTrialByCategory(revenueAccounts).map(g => ({
    ...g,
    accounts: g.accounts.map(a => ({ ...a, amount: a.balance })),
  }));

  const expenseItems = groupTrialByCategory(expenseAccounts).map(g => ({
    ...g,
    accounts: g.accounts.map(a => ({ ...a, amount: a.balance })),
  }));

  const totalRevenue = revenueAccounts.reduce((s, a) => s + a.balance, 0);
  const totalExpenses = expenseAccounts.reduce((s, a) => s + a.balance, 0);

  return {
    revenueItems,
    expenseItems,
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  };
}

/**
 * Build General Ledger: all entries grouped by account
 * @returns Array of { account_code, account_name, entries: [...], totalDebit, totalCredit, balance }
 */
export function buildGeneralLedger(entries, accounts, startDate, endDate) {
  if (!entries || entries.length === 0) return [];

  const filtered = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const accountMap = {};
  (accounts || []).forEach(a => { accountMap[a.account_code] = a; });

  const ledger = {};
  filtered.forEach(e => {
    const code = e.account_code;
    if (!ledger[code]) {
      const acc = accountMap[code] || {};
      ledger[code] = {
        account_code: code,
        account_name: acc.account_name || code,
        account_type: acc.account_type || 'unknown',
        entries: [],
        totalDebit: 0,
        totalCredit: 0,
        balance: 0,
      };
    }
    ledger[code].entries.push(e);
    ledger[code].totalDebit += parseFloat(e.debit) || 0;
    ledger[code].totalCredit += parseFloat(e.credit) || 0;
  });

  Object.values(ledger).forEach(l => {
    if (['asset', 'expense'].includes(l.account_type)) {
      l.balance = l.totalDebit - l.totalCredit;
    } else {
      l.balance = l.totalCredit - l.totalDebit;
    }
    l.entries.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
  });

  return Object.values(ledger).sort((a, b) => a.account_code.localeCompare(b.account_code));
}

/**
 * Build Journal Book: all entries sorted by date, grouped by entry_ref
 * @returns Array of { date, entry_ref, journal, description, lines: [...] }
 */
export function buildJournalBook(entries, startDate, endDate) {
  if (!entries || entries.length === 0) return [];

  const filtered = filterByPeriod(entries, startDate, endDate, 'transaction_date');
  const sorted = [...filtered].sort((a, b) => {
    const dateCompare = new Date(a.transaction_date) - new Date(b.transaction_date);
    if (dateCompare !== 0) return dateCompare;
    return (a.entry_ref || '').localeCompare(b.entry_ref || '');
  });

  const groups = {};
  sorted.forEach(e => {
    const key = e.entry_ref || e.id;
    if (!groups[key]) {
      groups[key] = {
        date: e.transaction_date,
        entry_ref: e.entry_ref || '-',
        journal: e.journal || 'OD',
        description: e.description || '',
        is_auto: e.is_auto || false,
        source_type: e.source_type || '',
        lines: [],
        totalDebit: 0,
        totalCredit: 0,
      };
    }
    groups[key].lines.push(e);
    groups[key].totalDebit += parseFloat(e.debit) || 0;
    groups[key].totalCredit += parseFloat(e.credit) || 0;
  });

  return Object.values(groups).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Helper: group trial balance items by category
function groupTrialByCategory(items) {
  const groups = {};
  items.forEach(a => {
    const cat = a.account_category || 'Autres';
    if (!groups[cat]) groups[cat] = { category: cat, accounts: [] };
    groups[cat].accounts.push(a);
  });
  return Object.values(groups).sort((a, b) => a.category.localeCompare(b.category));
}

// ============================================================================
// HELPER FUNCTIONS FOR FINANCIAL ANALYSIS
// ============================================================================

/**
 * Extraire les comptes d'un bilan par préfixe
 */
export function extractAccountsByPrefix(balanceSheet, prefix) {
  if (!balanceSheet) return [];

  const allAccounts = [
    ...(balanceSheet.assets || []),
    ...(balanceSheet.liabilities || []),
    ...(balanceSheet.equity || [])
  ];

  return allAccounts.filter(acc =>
    acc.account_code && acc.account_code.startsWith(prefix)
  );
}

/**
 * Obtenir le total des dettes
 * OHADA: Classe 16 (Emprunts) + Classe 17 (Dettes rattachées à des participations)
 */
export function getTotalDebt(balanceSheet) {
  if (!balanceSheet) return 0;

  const allAccounts = [
    ...(balanceSheet.liabilities || [])
  ];

  return allAccounts
    .filter(acc => acc.account_code &&
      (acc.account_code.startsWith('16') || acc.account_code.startsWith('17')))
    .reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
}

/**
 * Obtenir la trésorerie
 * OHADA: Classe 52 (Banques) + Classe 57 (Caisse)
 */
export function getCashAndEquivalents(balanceSheet) {
  if (!balanceSheet) return 0;

  const allAccounts = [
    ...(balanceSheet.assets || [])
  ];

  return allAccounts
    .filter(acc => acc.account_code &&
      (acc.account_code.startsWith('52') || acc.account_code.startsWith('57')))
    .reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
}

/**
 * Obtenir les actifs circulants
 * OHADA: Classe 3 (Stocks) + Classe 4 (Créances) + Classe 5 (Trésorerie)
 */
export function getCurrentAssets(balanceSheet) {
  if (!balanceSheet) return 0;

  const allAccounts = [
    ...(balanceSheet.assets || [])
  ];

  return allAccounts
    .filter(acc => acc.account_code &&
      (acc.account_code.startsWith('3') ||
       acc.account_code.startsWith('4') ||
       acc.account_code.startsWith('5')))
    .reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
}

/**
 * Obtenir les dettes à court terme
 * OHADA: Classe 40 (Fournisseurs) + Classe 44 (État et collectivités)
 */
export function getCurrentLiabilities(balanceSheet) {
  if (!balanceSheet) return 0;

  const allAccounts = [
    ...(balanceSheet.liabilities || [])
  ];

  return allAccounts
    .filter(acc => acc.account_code &&
      (acc.account_code.startsWith('40') || acc.account_code.startsWith('44')))
    .reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
}

/**
 * Obtenir les stocks
 * OHADA: Classe 3
 */
export function getInventory(balanceSheet) {
  if (!balanceSheet) return 0;

  const allAccounts = [
    ...(balanceSheet.assets || [])
  ];

  return allAccounts
    .filter(acc => acc.account_code && acc.account_code.startsWith('3'))
    .reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
}

/**
 * Obtenir les capitaux propres
 * OHADA: Classe 10
 */
export function getEquity(balanceSheet) {
  if (!balanceSheet) return 0;

  const allAccounts = [
    ...(balanceSheet.equity || [])
  ];

  return allAccounts
    .filter(acc => acc.account_code && acc.account_code.startsWith('10'))
    .reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
}

/**
 * Obtenir les dettes à long terme
 * OHADA: Classe 16 (Emprunts)
 */
export function getLongTermDebt(balanceSheet) {
  if (!balanceSheet) return 0;

  const allAccounts = [
    ...(balanceSheet.liabilities || [])
  ];

  return allAccounts
    .filter(acc => acc.account_code && acc.account_code.startsWith('16'))
    .reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
}
