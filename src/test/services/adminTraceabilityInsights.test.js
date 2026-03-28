import { describe, expect, it } from 'vitest';
import { buildAdminTraceabilityInsights } from '@/services/adminTraceabilityInsights';

describe('buildAdminTraceabilityInsights', () => {
  it('returns empty-safe metrics', () => {
    const insights = buildAdminTraceabilityInsights([]);
    expect(insights.totalCount).toBe(0);
    expect(insights.criticalCount).toBe(0);
    expect(insights.status).toBe('attention');
  });

  it('computes severity/status aggregates and recommendations', () => {
    const insights = buildAdminTraceabilityInsights([
      { severity: 'info', operation_status: 'success' },
      { severity: 'warning', operation_status: 'success' },
      { severity: 'critical', operation_status: 'failure' },
    ]);

    expect(insights.totalCount).toBe(3);
    expect(insights.criticalCount).toBe(1);
    expect(insights.failureCount).toBe(1);
    expect(insights.successRatePct).toBeCloseTo(66.666, 2);
    expect(insights.status).toBe('critical');
    expect(insights.recommendations.length).toBeGreaterThan(0);
  });
});
