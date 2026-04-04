// NOTE: These sets are also defined in DB table `invoice_status_config`.
// They are kept here as JS fallbacks for offline/loading states.
// Once the frontend fetches from DB on init, these become default fallback values.
// Source of truth: DB `invoice_status_config` (is_billable, is_booked, is_collected columns)
const BILLABLE_INVOICE_STATUSES = new Set(['sent', 'paid']); // mirrors DB: is_billable = true
const NON_BOOKED_INVOICE_STATUSES = new Set(['draft', 'cancelled']); // mirrors DB: is_booked = false
const COLLECTED_PAYMENT_STATUSES = new Set(['paid', 'overpaid']); // mirrors DB: is_collected = true (payment-level)
const COLLECTED_INVOICE_STATUSES = new Set(['paid']); // mirrors DB: is_collected = true (invoice-level)

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const round = (value, decimals = 2) => Number(toNumber(value).toFixed(decimals));

const normalizeStatus = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

export const getCanonicalInvoiceAmount = (invoice = {}) => {
  const totalTtc = toNumber(invoice.total_ttc);
  if (totalTtc !== 0) return totalTtc;
  return toNumber(invoice.total);
};

const calculateTrend = (current, previous) => {
  const cur = toNumber(current);
  const prev = toNumber(previous);
  if (prev === 0 && cur === 0) return 0;
  if (prev === 0) return cur > 0 ? 100 : -100;
  return Number((((cur - prev) / Math.abs(prev)) * 100).toFixed(1));
};

const calculateProfitMargin = (revenue, expenses) => {
  const rev = toNumber(revenue);
  const exp = toNumber(expenses);
  if (rev <= 0) return 0;
  return Number((((rev - exp) / rev) * 100).toFixed(1));
};

const resolveInvoiceDate = (invoice = {}) => invoice.date || invoice.invoice_date || invoice.created_at || null;

const resolveExpenseDate = (expense = {}) => expense.expense_date || expense.created_at || null;

const resolveTimesheetDate = (timesheet = {}) => timesheet.date || timesheet.created_at || null;

const classifyItem = (item = {}) => {
  if (item.item_type === 'product' || item.product_id) return 'product';
  if (item.item_type === 'service' || item.item_type === 'timesheet' || item.service_id) return 'service';
  return 'other';
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const getMonthLabel = (date) => `${monthNames[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
const getStartOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const isCanonicalInvoiceBooked = (invoice = {}) =>
  !NON_BOOKED_INVOICE_STATUSES.has(normalizeStatus(invoice.status));

export const isCanonicalInvoiceCollected = (invoice = {}) =>
  COLLECTED_INVOICE_STATUSES.has(normalizeStatus(invoice.status)) ||
  COLLECTED_PAYMENT_STATUSES.has(normalizeStatus(invoice.payment_status));

export const getCanonicalInvoiceBalanceDue = (invoice = {}) => {
  const rawBalance = invoice.balance_due;
  if (rawBalance != null && rawBalance !== '') {
    return Math.max(0, toNumber(rawBalance));
  }

  if (isCanonicalInvoiceCollected(invoice)) {
    return 0;
  }

  return Math.max(0, getCanonicalInvoiceAmount(invoice));
};

export const isCanonicalInvoiceOverdue = (invoice = {}, referenceDate = new Date()) => {
  const dueDateValue = invoice.due_date || null;
  if (!dueDateValue) return false;

  const dueDate = new Date(dueDateValue);
  if (Number.isNaN(dueDate.getTime())) return false;

  const dueStart = getStartOfDay(dueDate);
  const referenceStart = getStartOfDay(referenceDate);

  return dueStart < referenceStart && getCanonicalInvoiceBalanceDue(invoice) > 0;
};

export const buildCanonicalRevenueCollectionSnapshot = ({
  invoices = [],
  expenses = [],
  payments = [],
  referenceDate = new Date(),
} = {}) => {
  const invoiceRows = Array.isArray(invoices) ? invoices : [];
  const expenseRows = Array.isArray(expenses) ? expenses : [];
  const paymentRows = Array.isArray(payments) ? payments : [];

  const bookedInvoices = invoiceRows.filter((invoice) => isCanonicalInvoiceBooked(invoice));
  const collectedInvoices = bookedInvoices.filter((invoice) => isCanonicalInvoiceCollected(invoice));
  const outstandingInvoices = bookedInvoices.filter((invoice) => getCanonicalInvoiceBalanceDue(invoice) > 0);
  const overdueInvoices = outstandingInvoices.filter((invoice) => isCanonicalInvoiceOverdue(invoice, referenceDate));

  const bookedRevenue = bookedInvoices.reduce((sum, invoice) => sum + getCanonicalInvoiceAmount(invoice), 0);
  const collectedRevenue = collectedInvoices.reduce((sum, invoice) => sum + getCanonicalInvoiceAmount(invoice), 0);
  const outstandingReceivables = outstandingInvoices.reduce(
    (sum, invoice) => sum + getCanonicalInvoiceBalanceDue(invoice),
    0
  );
  const overdueReceivables = overdueInvoices.reduce((sum, invoice) => sum + getCanonicalInvoiceBalanceDue(invoice), 0);
  const totalExpenses = expenseRows.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
  const paymentsRecorded = paymentRows.reduce((sum, payment) => sum + toNumber(payment.amount), 0);

  const grossMargin = collectedRevenue - totalExpenses;
  const grossMarginPct = collectedRevenue > 0 ? (grossMargin / collectedRevenue) * 100 : 0;
  const collectionRate = bookedRevenue > 0 ? (collectedRevenue / bookedRevenue) * 100 : 0;

  return {
    bookedRevenue: round(bookedRevenue),
    collectedRevenue: round(collectedRevenue),
    outstandingReceivables: round(outstandingReceivables),
    overdueReceivables: round(overdueReceivables),
    totalExpenses: round(totalExpenses),
    grossMargin: round(grossMargin),
    grossMarginPct: round(grossMarginPct, 1),
    collectionRate: round(collectionRate, 1),
    paymentsRecorded: round(paymentsRecorded),
    invoicesBookedCount: bookedInvoices.length,
    invoicesCollectedCount: collectedInvoices.length,
    invoicesOutstandingCount: outstandingInvoices.length,
    invoicesOverdueCount: overdueInvoices.length,
  };
};

export const buildCanonicalDashboardSnapshot = ({
  invoices = [],
  expenses = [],
  timesheets = [],
  projects = [],
} = {}) => {
  const billedInvoices = invoices.filter((inv) => BILLABLE_INVOICE_STATUSES.has(normalizeStatus(inv.status)));
  const totalRevenue = billedInvoices.reduce((sum, inv) => sum + getCanonicalInvoiceAmount(inv), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + toNumber(exp.amount), 0);
  const profitMargin = calculateProfitMargin(totalRevenue, totalExpenses);
  const netCashFlow = totalRevenue - totalExpenses;

  const totalDurationMinutes = timesheets.reduce((sum, ts) => sum + toNumber(ts.duration_minutes), 0);
  const totalBudgetMinutes = projects.reduce((sum, p) => sum + toNumber(p.budget_hours) * 60, 0);
  let occupancyRate = 0;
  if (totalBudgetMinutes > 0) {
    occupancyRate = (totalDurationMinutes / totalBudgetMinutes) * 100;
  } else if (totalDurationMinutes > 0) {
    occupancyRate = projects.length > 0 ? 100 : 0;
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const currentMonthRevenue = billedInvoices
    .filter((inv) => {
      const dateValue = resolveInvoiceDate(inv);
      if (!dateValue) return false;
      const d = new Date(dateValue);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, inv) => sum + getCanonicalInvoiceAmount(inv), 0);

  const prevMonthRevenue = billedInvoices
    .filter((inv) => {
      const dateValue = resolveInvoiceDate(inv);
      if (!dateValue) return false;
      const d = new Date(dateValue);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    })
    .reduce((sum, inv) => sum + getCanonicalInvoiceAmount(inv), 0);

  const revenueTrend = calculateTrend(currentMonthRevenue, prevMonthRevenue);

  const currentMonthExpenses = expenses
    .filter((exp) => {
      const dateValue = resolveExpenseDate(exp);
      if (!dateValue) return false;
      const d = new Date(dateValue);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, exp) => sum + toNumber(exp.amount), 0);

  const prevMonthExpenses = expenses
    .filter((exp) => {
      const dateValue = resolveExpenseDate(exp);
      if (!dateValue) return false;
      const d = new Date(dateValue);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    })
    .reduce((sum, exp) => sum + toNumber(exp.amount), 0);

  const marginTrend = calculateTrend(
    calculateProfitMargin(currentMonthRevenue, currentMonthExpenses),
    calculateProfitMargin(prevMonthRevenue, prevMonthExpenses)
  );

  const currentMonthDuration = timesheets
    .filter((ts) => {
      const dateValue = resolveTimesheetDate(ts);
      if (!dateValue) return false;
      const d = new Date(dateValue);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, ts) => sum + toNumber(ts.duration_minutes), 0);

  const prevMonthDuration = timesheets
    .filter((ts) => {
      const dateValue = resolveTimesheetDate(ts);
      if (!dateValue) return false;
      const d = new Date(dateValue);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    })
    .reduce((sum, ts) => sum + toNumber(ts.duration_minutes), 0);

  const occupancyTrend = calculateTrend(currentMonthDuration, prevMonthDuration);

  const revenueByMonth = {};
  billedInvoices.forEach((inv) => {
    const dateValue = resolveInvoiceDate(inv);
    if (!dateValue) return;
    const date = new Date(dateValue);
    const key = getMonthKey(date);
    if (!revenueByMonth[key]) revenueByMonth[key] = { name: getMonthLabel(date), sortKey: key, revenue: 0 };
    revenueByMonth[key].revenue += getCanonicalInvoiceAmount(inv);
  });

  const revenueData = Object.values(revenueByMonth).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const revenueByClient = {};
  billedInvoices.forEach((inv) => {
    const clientName = inv.client?.company_name || 'Other';
    revenueByClient[clientName] = (revenueByClient[clientName] || 0) + getCanonicalInvoiceAmount(inv);
  });

  const clientRevenueData = Object.entries(revenueByClient)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const revenueByType = { product: 0, service: 0, other: 0 };
  const revenueByMonthType = {};

  billedInvoices.forEach((inv) => {
    const dateValue = resolveInvoiceDate(inv);
    if (!dateValue) return;
    const date = new Date(dateValue);
    const key = getMonthKey(date);

    if (!revenueByMonthType[key]) {
      revenueByMonthType[key] = { name: getMonthLabel(date), sortKey: key, products: 0, services: 0, other: 0 };
    }

    const items = Array.isArray(inv.items) ? inv.items : [];
    if (items.length === 0) {
      const amount = getCanonicalInvoiceAmount(inv);
      revenueByType.other += amount;
      revenueByMonthType[key].other += amount;
      return;
    }

    items.forEach((item) => {
      const itemTotal = toNumber(item.total) || toNumber(item.quantity) * toNumber(item.unit_price);
      const category = classifyItem(item);
      revenueByType[category] += itemTotal;

      if (category === 'product') revenueByMonthType[key].products += itemTotal;
      else if (category === 'service') revenueByMonthType[key].services += itemTotal;
      else revenueByMonthType[key].other += itemTotal;
    });
  });

  const revenueBreakdownData = Object.values(revenueByMonthType).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return {
    metrics: {
      revenue: totalRevenue,
      profitMargin,
      occupancyRate,
      totalExpenses,
      netCashFlow,
      revenueTrend,
      marginTrend,
      occupancyTrend,
    },
    revenueData,
    clientRevenueData,
    revenueByType,
    revenueBreakdownData,
  };
};
