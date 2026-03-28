import { describe, expect, it } from 'vitest';
import { buildCrmPipelineForecastInsights } from '@/services/crmPipelineForecastInsights';

describe('buildCrmPipelineForecastInsights', () => {
  it('computes weighted pipeline and scenario forecasts', () => {
    const quotes = [
      {
        id: 'q1',
        quote_number: 'DEV-001',
        status: 'sent',
        total_ttc: 10000,
        client_id: 'c1',
        created_at: '2026-03-01T10:00:00Z',
        valid_until: '2026-04-15',
      },
      {
        id: 'q2',
        quote_number: 'DEV-002',
        status: 'pending',
        total_ttc: 20000,
        client_id: 'c2',
        created_at: '2026-03-20T10:00:00Z',
        valid_until: '2026-04-10',
      },
    ];

    const result = buildCrmPipelineForecastInsights(quotes, { now: '2026-03-28T00:00:00Z' });

    expect(result.summary.opportunities).toBe(2);
    expect(result.summary.openPipeline).toBe(30000);
    expect(result.summary.weightedPipeline).toBeGreaterThan(0);
    expect(result.summary.conservativeForecast).toBeLessThan(result.summary.baseForecast);
    expect(result.summary.aggressiveForecast).toBeGreaterThanOrEqual(result.summary.baseForecast);
    expect(result.rows[0]).toHaveProperty('weightedProbability');
  });

  it('returns zeroed summary when no open opportunities', () => {
    const result = buildCrmPipelineForecastInsights([{ id: 'q-closed', status: 'rejected', total_ttc: 1200 }]);

    expect(result.summary.opportunities).toBe(0);
    expect(result.summary.openPipeline).toBe(0);
    expect(result.summary.baseForecast).toBe(0);
    expect(result.summary.confidence).toBe('low');
    expect(result.rows).toEqual([]);
  });
});
