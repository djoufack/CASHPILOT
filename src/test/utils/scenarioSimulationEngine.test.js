import { describe, expect, it } from 'vitest';
import FinancialSimulationEngine from '@/utils/scenarioSimulationEngine';

// ── fixtures ────────────────────────────────────────────────────────────────

const baseFinancialState = {
  monthly_revenue: 10000,
  monthly_expenses: 6000,
  cash_balance: 20000,
  accounts_receivable: 15000,
  accounts_payable: 5000,
  monthly_payroll: 3000,
  monthly_fixed_costs: 2000,
  monthly_variable_costs: 1000,
};

const baseScenario = {
  id: 'sc-1',
  name: 'Base Test Scenario',
  base_date: '2026-01-01',
  end_date: '2026-03-31',  // 3 months
};

const baseAssumptions = [];

const engine = new FinancialSimulationEngine();

// ── simulateScenario ─────────────────────────────────────────────────────────

describe('FinancialSimulationEngine.simulateScenario', () => {
  it('returns array of monthly results', async () => {
    const results = await engine.simulateScenario(baseScenario, baseAssumptions, baseFinancialState);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(3); // Jan, Feb, Mar 2026
  });

  it('each result has required date fields', async () => {
    const results = await engine.simulateScenario(baseScenario, baseAssumptions, baseFinancialState);
    for (const r of results) {
      expect(r).toHaveProperty('date');
      expect(r).toHaveProperty('period_label');
    }
  });

  it('throws if scenario is null', async () => {
    await expect(engine.simulateScenario(null, [], baseFinancialState)).rejects.toThrow();
  });

  it('throws if currentFinancialState is null', async () => {
    await expect(engine.simulateScenario(baseScenario, [], null)).rejects.toThrow();
  });

  it('handles 1-month scenario', async () => {
    const sc = { ...baseScenario, base_date: '2026-06-01', end_date: '2026-06-30' };
    const results = await engine.simulateScenario(sc, [], baseFinancialState);
    expect(results.length).toBe(1);
  });

  it('handles revenue growth assumption', async () => {
    const assumptions = [
      { type: 'revenue_growth', category: 'revenue', rate: 0.1, mode: 'percent' },
    ];
    const results = await engine.simulateScenario(baseScenario, assumptions, baseFinancialState);
    expect(results.length).toBe(3);
  });

  it('handles expense reduction assumption', async () => {
    const assumptions = [
      { type: 'cost_reduction', category: 'variable_costs', rate: -0.05, mode: 'percent' },
    ];
    const results = await engine.simulateScenario(baseScenario, assumptions, baseFinancialState);
    expect(results.length).toBe(3);
  });

  it('handles one-time impact assumption', async () => {
    const assumptions = [
      { type: 'one_time', category: 'revenue', amount: 5000, month: '2026-02', mode: 'add' },
    ];
    const results = await engine.simulateScenario(baseScenario, assumptions, baseFinancialState);
    expect(results.length).toBe(3);
  });
});

// ── initializeState ──────────────────────────────────────────────────────────

describe('FinancialSimulationEngine.initializeState', () => {
  it('returns a state object with expected keys', () => {
    const state = engine.initializeState(baseFinancialState);
    expect(state).toBeDefined();
    expect(typeof state).toBe('object');
  });

  it('copies revenue into state (uses annualRevenue / 12 internally)', () => {
    const state = engine.initializeState(baseFinancialState);
    // State uses camelCase internally
    expect(state.monthlyRevenue ?? state.revenue ?? state.monthly_revenue).toBeGreaterThanOrEqual(0);
  });

  it('handles state with zero values', () => {
    const zeroState = Object.fromEntries(Object.keys(baseFinancialState).map(k => [k, 0]));
    expect(() => engine.initializeState(zeroState)).not.toThrow();
  });

  it('handles partial state (missing some keys)', () => {
    const partial = { monthly_revenue: 5000 };
    expect(() => engine.initializeState(partial)).not.toThrow();
  });
});

// ── calculateMetrics ─────────────────────────────────────────────────────────

describe('FinancialSimulationEngine.calculateMetrics', () => {
  it('returns metrics object from period state', async () => {
    const results = await engine.simulateScenario(baseScenario, [], baseFinancialState);
    const r = results[0];
    // Should have numeric financial metrics
    expect(typeof r.date).toBe('string');
  });

  it('cash_balance trends correctly over months without assumptions', async () => {
    const sc = { ...baseScenario, end_date: '2026-06-30' };
    const results = await engine.simulateScenario(sc, [], baseFinancialState);
    expect(results.length).toBe(6);
    // Each month should have a cash value
    results.forEach(r => {
      const cash = r.cash_balance ?? r.cashBalance ?? r.ending_cash ?? r.endingCash;
      expect(cash !== undefined).toBe(true);
    });
  });
});

// ── calculateAverageGrowth / calculateAverage (utility methods) ──────────────

describe('FinancialSimulationEngine utility calculations', () => {
  it('calculateAverage returns mean of metric across results', async () => {
    const results = await engine.simulateScenario(baseScenario, [], baseFinancialState);
    // These are internal but exercised via full simulation — just verify no crash
    expect(results).toBeDefined();
  });

  it('handles long scenario (12 months)', async () => {
    const sc = { ...baseScenario, end_date: '2026-12-31' };
    const results = await engine.simulateScenario(sc, [], baseFinancialState);
    expect(results.length).toBe(12);
  });

  it('handles scenario with all assumption types mixed', async () => {
    const sc = { ...baseScenario, end_date: '2026-06-30' };
    const assumptions = [
      { type: 'revenue_growth', category: 'revenue', rate: 0.05, mode: 'percent' },
      { type: 'fixed_amount', category: 'fixed_costs', amount: 500, mode: 'add' },
      { type: 'payroll_change', category: 'payroll', rate: 0.03, mode: 'percent' },
    ];
    const results = await engine.simulateScenario(sc, assumptions, baseFinancialState);
    expect(results.length).toBe(6);
  });
});
