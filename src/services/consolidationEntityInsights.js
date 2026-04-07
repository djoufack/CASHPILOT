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

function toNullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeConsolidationScopeEntry(entry = {}) {
  const method = String(entry.consolidation_method ?? entry.consolidationMethod ?? entry.method ?? '').trim();
  const companyName = normalizeCompanyName(entry.company_name || entry.companyName || entry.name, 0);
  const ownershipPct = toNullableNumber(entry.ownership_pct ?? entry.ownershipPct ?? entry.ownership);
  const controlPct = toNullableNumber(entry.control_pct ?? entry.controlPct ?? entry.control);
  const consolidationWeight = toNullableNumber(entry.consolidation_weight ?? entry.consolidationWeight ?? entry.weight);
  const isInScopeRaw = entry.is_in_scope ?? entry.isInScope;
  const isInScope = typeof isInScopeRaw === 'boolean' ? isInScopeRaw : method ? method !== 'exclude' : null;

  return {
    companyName,
    consolidationMethod: method || null,
    ownershipPct,
    controlPct,
    consolidationWeight,
    isInScope,
  };
}

function buildConsolidationScopeIndex(consolidationScope) {
  const index = new Map();

  const setScope = (companyId, entry) => {
    if (!companyId) return;
    index.set(String(companyId), normalizeConsolidationScopeEntry(entry));
  };

  if (Array.isArray(consolidationScope)) {
    consolidationScope.forEach((entry, fallbackIndex) => {
      const companyId = entry?.company_id || entry?.companyId || entry?.id || `scope-company-${fallbackIndex + 1}`;
      setScope(companyId, entry);
    });
    return index;
  }

  if (consolidationScope && typeof consolidationScope === 'object') {
    Object.entries(consolidationScope).forEach(([companyId, entry]) => {
      setScope(companyId, entry);
    });
  }

  return index;
}

function extractScopeMetadata(source = {}) {
  const hasScopeFields =
    source.consolidation_method != null ||
    source.consolidationMethod != null ||
    source.method != null ||
    source.ownership_pct != null ||
    source.ownershipPct != null ||
    source.ownership != null ||
    source.control_pct != null ||
    source.controlPct != null ||
    source.control != null ||
    source.consolidation_weight != null ||
    source.consolidationWeight != null ||
    source.weight != null ||
    source.is_in_scope != null ||
    source.isInScope != null;

  return hasScopeFields ? normalizeConsolidationScopeEntry(source) : null;
}

function applyScopeMetadata(bucket, scope) {
  if (!scope) return;
  if (scope.companyName) {
    bucket.companyName = bucket.companyName || scope.companyName;
  }
  bucket.consolidationMethod = scope.consolidationMethod;
  bucket.ownershipPct = scope.ownershipPct;
  bucket.controlPct = scope.controlPct;
  bucket.consolidationWeight = scope.consolidationWeight;
  bucket.isInScope = scope.isInScope;
}

export function buildConsolidatedEntityRows({
  pnlByCompany = [],
  balanceByCompany = [],
  cashByCompany = [],
  intercompanyTransactions = [],
  consolidationScope = [],
} = {}) {
  const buckets = new Map();
  const scopeIndex = buildConsolidationScopeIndex(consolidationScope);

  (pnlByCompany || []).forEach((snapshot, index) => {
    const { companyId, companyName } = resolveCompanyIdentity(snapshot, 'pnl-company', index);
    const bucket = ensureBucket(buckets, companyId, companyName);
    bucket.revenue = toNumber(snapshot.revenue);
    bucket.expenses = Math.abs(toNumber(snapshot.expenses));
    bucket.netIncome = toNumber(snapshot.net_income ?? snapshot.netIncome);
    applyScopeMetadata(bucket, extractScopeMetadata(snapshot));
  });

  (balanceByCompany || []).forEach((snapshot, index) => {
    const { companyId, companyName } = resolveCompanyIdentity(snapshot, 'balance-company', index);
    const bucket = ensureBucket(buckets, companyId, companyName);
    bucket.assets = toNumber(snapshot.assets);
    bucket.liabilities = toNumber(snapshot.liabilities);
    bucket.equity = toNumber(snapshot.equity);
    applyScopeMetadata(bucket, extractScopeMetadata(snapshot));
  });

  (cashByCompany || []).forEach((snapshot, index) => {
    const { companyId, companyName } = resolveCompanyIdentity(snapshot, 'cash-company', index);
    const bucket = ensureBucket(buckets, companyId, companyName);
    bucket.cashBalance = toNumber(snapshot.cash_balance ?? snapshot.cashBalance);
    applyScopeMetadata(bucket, extractScopeMetadata(snapshot));
  });

  scopeIndex.forEach((scope, companyId) => {
    const bucket = ensureBucket(buckets, companyId, scope.companyName);
    applyScopeMetadata(bucket, scope);
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
    const outOfScope = bucket.isInScope === false;
    const status = outOfScope ? 'inactive' : hasPending ? 'attention' : hasActivity ? 'active' : 'inactive';
    const consolidationWeight =
      bucket.consolidationWeight == null ? (bucket.isInScope === false ? 0 : 1) : bucket.consolidationWeight;

    return {
      ...bucket,
      pendingEliminationAmount: toNumber(bucket.pendingEliminationAmount),
      consolidationWeight,
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
