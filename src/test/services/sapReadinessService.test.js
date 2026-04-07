import { describe, expect, it } from 'vitest';
import {
  deriveSapModuleReadiness,
  getModuleStatusFromScore,
  normalizeSapMetrics,
} from '@/services/sapReadinessService';

describe('sapReadinessService', () => {
  it('normalizes raw metrics into stable module counters', () => {
    const metrics = normalizeSapMetrics({
      accountingEntries: { count: '12', scope: 'company', latestEntryAt: '2026-03-31T00:00:00.000Z' },
      accountingAnalyticalAxes: [{ id: 1 }, { id: 2 }],
      accountingFixedAssets: { data: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      companyPortfolios: { rows: [{ id: 1 }] },
      companyPortfolioMembers: 4,
      accountingPeriodClosures: { count: '2', latestClosedAt: '2026-03-15T12:30:00.000Z' },
    });

    expect(metrics.fi.entriesCount).toBe(12);
    expect(metrics.fi.scope).toBe('company');
    expect(metrics.fi.latestEntryAt).toBe('2026-03-31T00:00:00.000Z');
    expect(metrics.co.analyticalAxesCount).toBe(2);
    expect(metrics.aa.fixedAssetsCount).toBe(3);
    expect(metrics.consolidation.portfolioCount).toBe(1);
    expect(metrics.consolidation.portfolioMemberCount).toBe(4);
    expect(metrics.close.closureCount).toBe(2);
    expect(metrics.close.latestClosedAt).toBe('2026-03-15T12:30:00.000Z');
  });

  it('maps score bands to SAP module statuses', () => {
    expect(getModuleStatusFromScore(0)).toBe('planned');
    expect(getModuleStatusFromScore(42)).toBe('in_progress');
    expect(getModuleStatusFromScore(100)).toBe('ready');
    expect(getModuleStatusFromScore(150)).toBe('ready');
  });

  it('derives module readiness and global score from normalized metrics', () => {
    const readiness = deriveSapModuleReadiness({
      accountingEntries: { count: 25, scope: 'company' },
      accountingAnalyticalAxes: { count: 2 },
      accountingFixedAssets: { count: 0 },
      companyPortfolios: { count: 1 },
      companyPortfolioMembers: { count: 1 },
      accountingPeriodClosures: { count: 3, latestClosedAt: '2026-03-31T00:00:00.000Z' },
    });

    expect(readiness.modules.fi.score).toBe(100);
    expect(readiness.modules.fi.status).toBe('ready');
    expect(readiness.modules.co.score).toBe(50);
    expect(readiness.modules.co.status).toBe('in_progress');
    expect(readiness.modules.aa.score).toBe(0);
    expect(readiness.modules.aa.status).toBe('planned');
    expect(readiness.modules.consolidation.score).toBe(75);
    expect(readiness.modules.consolidation.status).toBe('in_progress');
    expect(readiness.modules.close.score).toBe(100);
    expect(readiness.modules.close.status).toBe('ready');
    expect(readiness.globalScore).toBe(65);
  });
});
