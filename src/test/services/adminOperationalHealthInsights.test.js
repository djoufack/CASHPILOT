import { describe, expect, it } from 'vitest';
import { buildAdminOperationalHealthInsights } from '@/services/adminOperationalHealthInsights';

describe('buildAdminOperationalHealthInsights', () => {
  it('returns critical status when no edge function data is available', () => {
    const insights = buildAdminOperationalHealthInsights({
      edgeFunctions: [],
      webhookSummary: null,
    });

    expect(insights.totalFunctions).toBe(0);
    expect(insights.availabilityPct).toBe(0);
    expect(insights.status).toBe('critical');
    expect(insights.recommendations.length).toBeGreaterThan(0);
  });

  it('computes KPIs for mixed function and webhook health', () => {
    const insights = buildAdminOperationalHealthInsights({
      edgeFunctions: [{ status: 'healthy' }, { status: 'healthy' }, { status: 'degraded' }],
      webhookSummary: {
        deliveryTotal24h: 20,
        deliverySuccess24h: 17,
        deliveryFailure24h: 3,
      },
    });

    expect(insights.totalFunctions).toBe(3);
    expect(insights.healthyCount).toBe(2);
    expect(insights.degradedCount).toBe(1);
    expect(insights.availabilityPct).toBeCloseTo(66.666, 2);
    expect(insights.webhookSuccessRatePct).toBeCloseTo(85, 5);
    expect(insights.status).toBe('attention');
    expect(insights.recommendations.some((entry) => /webhook|degrad/i.test(entry))).toBe(true);
  });
});
