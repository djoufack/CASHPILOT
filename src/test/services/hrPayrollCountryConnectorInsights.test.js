import { describe, expect, it } from 'vitest';
import { buildPayrollCountryConnectorInsights } from '@/services/hrPayrollCountryConnectorInsights';

describe('buildPayrollCountryConnectorInsights', () => {
  it('returns empty-safe defaults', () => {
    const result = buildPayrollCountryConnectorInsights([]);

    expect(result.totalCount).toBe(0);
    expect(result.connectedCount).toBe(0);
    expect(result.complianceOkCount).toBe(0);
    expect(result.coveragePct).toBe(0);
    expect(result.compliancePct).toBe(0);
    expect(result.status).toBe('critical');
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('calculates coverage and compliance with mixed connectors', () => {
    const result = buildPayrollCountryConnectorInsights([
      { provider_category: 'payroll', status: 'connected', compliance_status: 'compliant' },
      { provider_category: 'compliance', status: 'connected', compliance_status: 'warning' },
      { provider_category: 'compliance', status: 'attention', compliance_status: 'non_compliant' },
    ]);

    expect(result.totalCount).toBe(3);
    expect(result.connectedCount).toBe(2);
    expect(result.attentionCount).toBe(1);
    expect(result.complianceRiskCount).toBe(2);
    expect(result.coveragePct).toBeCloseTo(66.67, 1);
    expect(result.compliancePct).toBeCloseTo(33.33, 1);
    expect(result.status).toBe('critical');
  });

  it('marks status ready when all connectors are connected and compliant', () => {
    const result = buildPayrollCountryConnectorInsights([
      { provider_category: 'payroll', status: 'connected', compliance_status: 'compliant' },
      { provider_category: 'compliance', status: 'connected', compliance_status: 'compliant' },
    ]);

    expect(result.status).toBe('ready');
    expect(result.coveragePct).toBe(100);
    expect(result.compliancePct).toBe(100);
    expect(result.recommendations).toEqual([]);
  });
});
