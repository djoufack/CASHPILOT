import { describe, expect, it } from 'vitest';
import { buildApiKeySecurityInsights } from '@/services/apiKeySecurityInsights';

describe('buildApiKeySecurityInsights', () => {
  it('returns empty-safe defaults', () => {
    const result = buildApiKeySecurityInsights({
      apiKeys: [],
      usageLogs: [],
      policy: { rotation_days: 90, anomaly_hourly_call_threshold: 100, anomaly_error_rate_threshold: 20 },
    });

    expect(result.rotationDueCount).toBe(0);
    expect(result.anomalyCount).toBe(0);
    expect(result.status).toBe('ready');
  });

  it('flags rotation due and anomaly by hourly volume', () => {
    const now = Date.now();
    const oldDate = new Date(now - 120 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date(now - 10 * 60 * 1000).toISOString();

    const result = buildApiKeySecurityInsights({
      apiKeys: [
        { id: 'k1', name: 'Legacy', key_prefix: 'cpk_old', created_at: oldDate },
        { id: 'k2', name: 'Fresh', key_prefix: 'cpk_new', created_at: recentDate },
      ],
      usageLogs: Array.from({ length: 5 }).map((_, index) => ({
        api_key_id: 'k2',
        created_at: new Date(now - index * 5 * 60 * 1000).toISOString(),
        status_code: 200,
      })),
      policy: { rotation_days: 90, anomaly_hourly_call_threshold: 3, anomaly_error_rate_threshold: 20 },
      now: new Date(now),
    });

    expect(result.rotationDueCount).toBe(1);
    expect(result.anomalyCount).toBe(1);
    expect(result.status).toBe('critical');
  });

  it('flags high error-rate anomalies', () => {
    const now = Date.now();
    const result = buildApiKeySecurityInsights({
      apiKeys: [{ id: 'k1', name: 'Key 1', key_prefix: 'cpk_1', created_at: new Date(now).toISOString() }],
      usageLogs: [
        { api_key_id: 'k1', created_at: new Date(now - 1000).toISOString(), status_code: 500 },
        { api_key_id: 'k1', created_at: new Date(now - 2000).toISOString(), status_code: 500 },
        { api_key_id: 'k1', created_at: new Date(now - 3000).toISOString(), status_code: 200 },
      ],
      policy: { rotation_days: 90, anomaly_hourly_call_threshold: 20, anomaly_error_rate_threshold: 50 },
      now: new Date(now),
    });

    expect(result.anomalyCount).toBe(1);
    expect(result.anomalies[0].reason).toMatch(/Taux d erreur/);
    expect(result.status).toBe('attention');
  });
});
