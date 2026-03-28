const EPSILON = 0.01;
const PENDING_STATUSES = new Set(['pending', 'matched', 'to_eliminate', 'open']);

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCompanyName(value, fallbackIndex) {
  const label = String(value || '').trim();
  if (label) return label;
  return `Company ${fallbackIndex + 1}`;
}

function resolveCompanyIdentity(snapshot = {}, fallbackPrefix, fallbackIndex) {
  const companyId =
    snapshot.company_id || snapshot.companyId || snapshot.id || `${fallbackPrefix}-${fallbackIndex + 1}`;

  const companyName = normalizeCompanyName(
    snapshot.company_name || snapshot.companyName || snapshot.name,
    fallbackIndex
  );

  return { companyId: String(companyId), companyName };
}

function ensureBucket(buckets, companyId, companyName) {
  if (!buckets.has(companyId)) {
    buckets.set(companyId, {
      companyId,
      companyName,
      revenue: 0,
      expenses: 0,
      netIncome: 0,
      assets: 0,
      liabilities: 0,
      equity: 0,
      cashBalance: 0,
      totalIntercompanyCount: 0,
      pendingEliminationCount: 0,
      pendingEliminationAmount: 0,
      status: 'inactive',
      activityScore: 0,
    });
  } else if (companyName && !buckets.get(companyId).companyName) {
    buckets.get(companyId).companyName = companyName;
  }

  return buckets.get(companyId);
}

function isPendingStatus(status) {
  return PENDING_STATUSES.has(String(status || '').toLowerCase());
}

export function buildConsolidatedEntityRows({
  pnlByCompany = [],
  balanceByCompany = [],
  cashByCompany = [],
  intercompanyTransactions = [],
} = {}) {
  const buckets = new Map();

  (pnlByCompany || []).forEach((snapshot, index) => {
    const { companyId, companyName } = resolveCompanyIdentity(snapshot, 'pnl-company', index);
    const bucket = ensureBucket(buckets, companyId, companyName);
    bucket.revenue = toNumber(snapshot.revenue);
    bucket.expenses = Math.abs(toNumber(snapshot.expenses));
    bucket.netIncome = toNumber(snapshot.net_income ?? snapshot.netIncome);
  });

  (balanceByCompany || []).forEach((snapshot, index) => {
    const { companyId, companyName } = resolveCompanyIdentity(snapshot, 'balance-company', index);
    const bucket = ensureBucket(buckets, companyId, companyName);
    bucket.assets = toNumber(snapshot.assets);
    bucket.liabilities = toNumber(snapshot.liabilities);
    bucket.equity = toNumber(snapshot.equity);
  });

  (cashByCompany || []).forEach((snapshot, index) => {
    const { companyId, companyName } = resolveCompanyIdentity(snapshot, 'cash-company', index);
    const bucket = ensureBucket(buckets, companyId, companyName);
    bucket.cashBalance = toNumber(snapshot.cash_balance ?? snapshot.cashBalance);
  });

  (intercompanyTransactions || []).forEach((transaction, index) => {
    const sourceId = String(
      transaction.company_id ||
        transaction.companyId ||
        transaction.source_company_id ||
        transaction.source_company?.id ||
        `source-company-${index + 1}`
    );
    const sourceName = normalizeCompanyName(
      transaction.source_company?.company_name || transaction.source_company?.name || transaction.source_company_name,
      index
    );
    const targetId = String(
      transaction.linked_company_id ||
        transaction.target_company_id ||
        transaction.targetCompanyId ||
        transaction.target_company?.id ||
        `target-company-${index + 1}`
    );
    const targetName = normalizeCompanyName(
      transaction.target_company?.company_name || transaction.target_company?.name || transaction.target_company_name,
      index
    );

    const source = ensureBucket(buckets, sourceId, sourceName);
    const target = ensureBucket(buckets, targetId, targetName);
    const amount = Math.abs(toNumber(transaction.amount));

    source.totalIntercompanyCount += 1;
    target.totalIntercompanyCount += 1;

    if (isPendingStatus(transaction.status)) {
      source.pendingEliminationCount += 1;
      source.pendingEliminationAmount += amount;
      target.pendingEliminationCount += 1;
      target.pendingEliminationAmount += amount;
    }
  });

  const rows = Array.from(buckets.values()).map((bucket) => {
    const metricActivity =
      Math.abs(bucket.revenue) +
      Math.abs(bucket.expenses) +
      Math.abs(bucket.netIncome) +
      Math.abs(bucket.assets) +
      Math.abs(bucket.liabilities) +
      Math.abs(bucket.cashBalance);

    const activityScore = metricActivity + Math.abs(bucket.pendingEliminationAmount);
    const hasPending = bucket.pendingEliminationCount > 0;
    const hasActivity = activityScore > EPSILON || bucket.totalIntercompanyCount > 0;
    const status = hasPending ? 'attention' : hasActivity ? 'active' : 'inactive';

    return {
      ...bucket,
      pendingEliminationAmount: toNumber(bucket.pendingEliminationAmount),
      activityScore,
      status,
    };
  });

  rows.sort((left, right) => {
    const rank = { attention: 0, active: 1, inactive: 2 };
    const rankDelta = (rank[left.status] ?? 99) - (rank[right.status] ?? 99);
    if (rankDelta !== 0) return rankDelta;

    const scoreDelta = right.activityScore - left.activityScore;
    if (Math.abs(scoreDelta) > EPSILON) return scoreDelta;

    return left.companyName.localeCompare(right.companyName);
  });

  return rows;
}

export function filterConsolidatedEntityRows(rows = [], scope = 'all') {
  if (scope === 'attention') {
    return (rows || []).filter((row) => row.status === 'attention');
  }

  if (scope === 'active') {
    return (rows || []).filter((row) => row.status !== 'inactive');
  }

  return rows || [];
}

export function summarizeConsolidatedEntities(rows = []) {
  const total = (rows || []).length;
  const attention = (rows || []).filter((row) => row.status === 'attention').length;
  const inactive = (rows || []).filter((row) => row.status === 'inactive').length;
  const active = total - inactive;

  return {
    total,
    active,
    attention,
    inactive,
  };
}
