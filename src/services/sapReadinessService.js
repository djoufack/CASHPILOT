const MODULE_ORDER = ['fi', 'co', 'aa', 'consolidation', 'close'];

const clampScore = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const toCount = (value) => {
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
  if (value && typeof value === 'object') {
    if (typeof value.count === 'number') return value.count > 0 ? value.count : 0;
    if (Array.isArray(value.data)) return value.data.length;
    if (Array.isArray(value.rows)) return value.rows.length;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const scoreFromTarget = (count, target) => {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return clampScore((toCount(count) / target) * 100);
};

export function getModuleStatusFromScore(score) {
  const normalizedScore = clampScore(score);
  if (normalizedScore >= 100) return 'ready';
  if (normalizedScore > 0) return 'in_progress';
  return 'planned';
}

export function normalizeSapMetrics(raw = {}) {
  const accountingEntries = raw.accountingEntries || raw.entries || {};
  const accountingAnalyticalAxes = raw.accountingAnalyticalAxes || raw.analyticalAxes || {};
  const accountingFixedAssets = raw.accountingFixedAssets || raw.fixedAssets || {};
  const companyPortfolios = raw.companyPortfolios || raw.portfolios || {};
  const companyPortfolioMembers = raw.companyPortfolioMembers || raw.portfolioMembers || {};
  const accountingPeriodClosures = raw.accountingPeriodClosures || raw.periodClosures || {};

  return {
    fi: {
      entriesCount: toCount(
        accountingEntries.count ?? accountingEntries.data ?? accountingEntries.rows ?? accountingEntries
      ),
      scope: accountingEntries.scope === 'company' ? 'company' : 'user',
      latestEntryAt: normalizeDate(accountingEntries.latestEntryAt || accountingEntries.latest_entry_at || null),
    },
    co: {
      analyticalAxesCount: toCount(
        accountingAnalyticalAxes.count ??
          accountingAnalyticalAxes.data ??
          accountingAnalyticalAxes.rows ??
          accountingAnalyticalAxes
      ),
    },
    aa: {
      fixedAssetsCount: toCount(
        accountingFixedAssets.count ?? accountingFixedAssets.data ?? accountingFixedAssets.rows ?? accountingFixedAssets
      ),
    },
    consolidation: {
      portfolioCount: toCount(
        companyPortfolios.count ?? companyPortfolios.data ?? companyPortfolios.rows ?? companyPortfolios
      ),
      portfolioMemberCount: toCount(
        companyPortfolioMembers.count ??
          companyPortfolioMembers.data ??
          companyPortfolioMembers.rows ??
          companyPortfolioMembers
      ),
    },
    close: {
      closureCount: toCount(
        accountingPeriodClosures.count ??
          accountingPeriodClosures.data ??
          accountingPeriodClosures.rows ??
          accountingPeriodClosures
      ),
      latestClosedAt: normalizeDate(
        accountingPeriodClosures.latestClosedAt ||
          accountingPeriodClosures.latest_closed_at ||
          accountingPeriodClosures.latestClosedOn ||
          null
      ),
    },
  };
}

function scoreFi(metrics) {
  return scoreFromTarget(metrics.entriesCount, 25);
}

function scoreCo(metrics) {
  return scoreFromTarget(metrics.analyticalAxesCount, 4);
}

function scoreAa(metrics) {
  return scoreFromTarget(metrics.fixedAssetsCount, 10);
}

function scoreConsolidation(metrics) {
  const portfolioScore = scoreFromTarget(metrics.portfolioCount, 1) * 0.5;
  const memberScore = scoreFromTarget(metrics.portfolioMemberCount, 2) * 0.5;
  return clampScore(portfolioScore + memberScore);
}

function scoreClose(metrics) {
  return scoreFromTarget(metrics.closureCount, 3);
}

export function deriveSapModuleReadiness(metricsByModule = {}) {
  const normalized = normalizeSapMetrics(metricsByModule);

  const modules = {
    fi: {
      metrics: normalized.fi,
      score: scoreFi(normalized.fi),
    },
    co: {
      metrics: normalized.co,
      score: scoreCo(normalized.co),
    },
    aa: {
      metrics: normalized.aa,
      score: scoreAa(normalized.aa),
    },
    consolidation: {
      metrics: normalized.consolidation,
      score: scoreConsolidation(normalized.consolidation),
    },
    close: {
      metrics: normalized.close,
      score: scoreClose(normalized.close),
    },
  };

  for (const key of MODULE_ORDER) {
    modules[key].status = getModuleStatusFromScore(modules[key].score);
  }

  const globalScore = clampScore(MODULE_ORDER.reduce((sum, key) => sum + modules[key].score, 0) / MODULE_ORDER.length);

  return {
    modules,
    globalScore,
  };
}

export default deriveSapModuleReadiness;
