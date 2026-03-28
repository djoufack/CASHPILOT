import { describe, expect, it } from 'vitest';
import { buildAdminFeatureFlagInsights } from '@/services/adminFeatureFlagInsights';

describe('buildAdminFeatureFlagInsights', () => {
  it('returns critical status when no flags are configured', () => {
    const insights = buildAdminFeatureFlagInsights([]);

    expect(insights.totalCount).toBe(0);
    expect(insights.enabledCount).toBe(0);
    expect(insights.disabledCount).toBe(0);
    expect(insights.status).toBe('critical');
    expect(insights.recommendations.length).toBeGreaterThan(0);
  });

  it('computes counts, rollout average and recommendations for mixed portfolio', () => {
    const insights = buildAdminFeatureFlagInsights([
      {
        flag_key: 'admin.ops.health',
        is_enabled: true,
        rollout_percentage: 100,
        target_area: 'admin',
      },
      {
        flag_key: 'admin.traceability',
        is_enabled: false,
        rollout_percentage: 0,
        target_area: 'security',
      },
      {
        flag_key: 'integration.strict_scopes',
        is_enabled: true,
        rollout_percentage: 50,
        target_area: 'api',
      },
    ]);

    expect(insights.totalCount).toBe(3);
    expect(insights.enabledCount).toBe(2);
    expect(insights.disabledCount).toBe(1);
    expect(insights.rolloutAverage).toBeCloseTo(50, 5);
    expect(insights.byArea.security).toBe(1);
    expect(insights.criticalDisabledCount).toBe(1);
    expect(insights.status).toBe('attention');
    expect(insights.recommendations.some((entry) => /securit|security/i.test(entry))).toBe(true);
  });
});
