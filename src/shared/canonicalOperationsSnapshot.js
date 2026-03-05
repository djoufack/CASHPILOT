const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
const normalizeCurrency = (value) => String(value || 'EUR').trim().toUpperCase() || 'EUR';

const resolveSupplierInvoiceAmount = (invoice = {}) => {
  const candidates = [
    invoice.total_amount,
    invoice.total_ttc,
    invoice.total,
    invoice.amount,
  ];

  let firstFinite = null;
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed)) continue;
    if (firstFinite === null) firstFinite = parsed;
    if (parsed !== 0) return parsed;
  }

  return firstFinite ?? 0;
};

const resolveSupplierOrderAmount = (order = {}) => {
  const candidates = [
    order.total_amount,
    order.total_ttc,
    order.total,
    order.amount,
  ];

  let firstFinite = null;
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed)) continue;
    if (firstFinite === null) firstFinite = parsed;
    if (parsed !== 0) return parsed;
  }

  return firstFinite ?? 0;
};

const normalizeSupplierOrderStatus = (status) => {
  const normalized = normalizeStatus(status);
  if (!normalized) return 'unknown';
  if (normalized === 'received') return 'delivered';
  return normalized;
};

const buildStatusSummary = (rows = [], statusResolver, amountResolver = () => 0) => {
  const counts = {};
  const amounts = {};

  rows.forEach((row) => {
    const status = statusResolver(row);
    counts[status] = (counts[status] || 0) + 1;
    amounts[status] = (amounts[status] || 0) + amountResolver(row);
  });

  return { counts, amounts };
};

const sumByStatuses = (map, statuses = []) => statuses.reduce((sum, status) => sum + toNumber(map?.[status]), 0);

export const EMPTY_CANONICAL_OPERATIONS_SNAPSHOT = {
  suppliers: {
    totalSuppliers: 0,
    activeSuppliers: 0,
    inactiveSuppliers: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    pendingOrders: 0,
    inProgressOrders: 0,
    overdueInvoices: 0,
    overdueInvoicesAmount: 0,
    supplierInvoices: {
      totalCount: 0,
      totalAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
      overdueCount: 0,
      overdueAmount: 0,
      paidCount: 0,
      paidAmount: 0,
      statusCounts: {},
      statusAmounts: {},
    },
  },
  purchases: {
    totalOrders: 0,
    totalAmount: 0,
    openOrdersCount: 0,
    openOrdersAmount: 0,
    deliveredOrders: 0,
    deliveredAmount: 0,
    cancelledOrders: 0,
    cancelledAmount: 0,
    statusCounts: {},
    statusAmounts: {},
  },
  bank: {
    totalConnections: 0,
    activeConnections: 0,
    pendingConnections: 0,
    revokedConnections: 0,
    expiredConnections: 0,
    errorConnections: 0,
    syncableConnections: 0,
    totalBalance: 0,
    balanceByCurrency: {},
    balanceCurrencies: [],
    hasMixedCurrencies: false,
    syncableConnectionIds: [],
  },
};

export const buildCanonicalOperationsSnapshot = ({
  suppliers = [],
  products = [],
  supplierOrders = [],
  supplierInvoices = [],
  bankConnections = [],
} = {}) => {
  const supplierRows = Array.isArray(suppliers) ? suppliers : [];
  const productRows = Array.isArray(products) ? products : [];
  const supplierOrderRows = Array.isArray(supplierOrders) ? supplierOrders : [];
  const supplierInvoiceRows = Array.isArray(supplierInvoices) ? supplierInvoices : [];
  const bankConnectionRows = Array.isArray(bankConnections) ? bankConnections : [];

  const activeSuppliers = supplierRows.filter((supplier) => normalizeStatus(supplier.status) === 'active').length;
  const inactiveSuppliers = Math.max(0, supplierRows.length - activeSuppliers);
  const lowStockProducts = productRows.filter((product) => toNumber(product.stock_quantity) <= toNumber(product.min_stock_level)).length;
  const outOfStockProducts = productRows.filter((product) => toNumber(product.stock_quantity) <= 0).length;

  const orderStatusSummary = buildStatusSummary(
    supplierOrderRows,
    (order) => normalizeSupplierOrderStatus(order.order_status),
    (order) => resolveSupplierOrderAmount(order),
  );

  const invoiceStatusSummary = buildStatusSummary(
    supplierInvoiceRows,
    (invoice) => normalizeStatus(invoice.payment_status) || 'unknown',
    (invoice) => resolveSupplierInvoiceAmount(invoice),
  );

  const supplierInvoiceTotals = {
    totalCount: supplierInvoiceRows.length,
    totalAmount: supplierInvoiceRows.reduce((sum, invoice) => sum + resolveSupplierInvoiceAmount(invoice), 0),
    pendingCount: toNumber(invoiceStatusSummary.counts.pending),
    pendingAmount: toNumber(invoiceStatusSummary.amounts.pending),
    overdueCount: toNumber(invoiceStatusSummary.counts.overdue),
    overdueAmount: toNumber(invoiceStatusSummary.amounts.overdue),
    paidCount: toNumber(invoiceStatusSummary.counts.paid),
    paidAmount: toNumber(invoiceStatusSummary.amounts.paid),
    statusCounts: invoiceStatusSummary.counts,
    statusAmounts: invoiceStatusSummary.amounts,
  };

  const openStatuses = ['draft', 'pending', 'confirmed'];
  const deliveredStatuses = ['delivered'];
  const cancelledStatuses = ['cancelled'];

  const syncableConnections = bankConnectionRows.filter((connection) => (
    normalizeStatus(connection.status) === 'active' && Boolean(connection.account_id)
  ));

  const balanceByCurrency = {};
  let totalBalance = 0;

  syncableConnections.forEach((connection) => {
    if (connection.account_balance == null) return;
    const balance = toNumber(connection.account_balance);
    const currency = normalizeCurrency(connection.account_currency);
    totalBalance += balance;
    balanceByCurrency[currency] = (balanceByCurrency[currency] || 0) + balance;
  });

  const balanceCurrencies = Object.keys(balanceByCurrency).sort((a, b) => a.localeCompare(b));

  return {
    suppliers: {
      totalSuppliers: supplierRows.length,
      activeSuppliers,
      inactiveSuppliers,
      totalProducts: productRows.length,
      lowStockProducts,
      outOfStockProducts,
      pendingOrders: toNumber(orderStatusSummary.counts.pending),
      inProgressOrders: sumByStatuses(orderStatusSummary.counts, openStatuses),
      overdueInvoices: supplierInvoiceTotals.overdueCount,
      overdueInvoicesAmount: supplierInvoiceTotals.overdueAmount,
      supplierInvoices: supplierInvoiceTotals,
    },
    purchases: {
      totalOrders: supplierOrderRows.length,
      totalAmount: supplierOrderRows.reduce((sum, order) => sum + resolveSupplierOrderAmount(order), 0),
      openOrdersCount: sumByStatuses(orderStatusSummary.counts, openStatuses),
      openOrdersAmount: sumByStatuses(orderStatusSummary.amounts, openStatuses),
      deliveredOrders: sumByStatuses(orderStatusSummary.counts, deliveredStatuses),
      deliveredAmount: sumByStatuses(orderStatusSummary.amounts, deliveredStatuses),
      cancelledOrders: sumByStatuses(orderStatusSummary.counts, cancelledStatuses),
      cancelledAmount: sumByStatuses(orderStatusSummary.amounts, cancelledStatuses),
      statusCounts: orderStatusSummary.counts,
      statusAmounts: orderStatusSummary.amounts,
    },
    bank: {
      totalConnections: bankConnectionRows.length,
      activeConnections: bankConnectionRows.filter((connection) => normalizeStatus(connection.status) === 'active').length,
      pendingConnections: bankConnectionRows.filter((connection) => normalizeStatus(connection.status) === 'pending').length,
      revokedConnections: bankConnectionRows.filter((connection) => normalizeStatus(connection.status) === 'revoked').length,
      expiredConnections: bankConnectionRows.filter((connection) => normalizeStatus(connection.status) === 'expired').length,
      errorConnections: bankConnectionRows.filter((connection) => normalizeStatus(connection.status) === 'error').length,
      syncableConnections: syncableConnections.length,
      totalBalance,
      balanceByCurrency,
      balanceCurrencies,
      hasMixedCurrencies: balanceCurrencies.length > 1,
      syncableConnectionIds: syncableConnections.map((connection) => connection.id).filter(Boolean),
    },
  };
};
