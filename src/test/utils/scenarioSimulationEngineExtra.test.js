import { describe, it, expect, vi } from 'vitest';

// Mock the dependency
vi.mock('@/utils/scenarioAssumptionRules', () => ({
  sanitizeScenarioAssumptions: vi.fn((assumptions) => ({
    validAssumptions: assumptions || [],
    warnings: [],
  })),
}));

import { FinancialSimulationEngine } from '@/utils/scenarioSimulationEngine';

// ============================================================================
// FinancialSimulationEngine unit tests for pure methods
// ============================================================================
describe('FinancialSimulationEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new FinancialSimulationEngine();
  });

  // ---------- toFiniteNumber ----------
  describe('toFiniteNumber', () => {
    it('should return the number for valid numeric input', () => {
      expect(engine.toFiniteNumber(42)).toBe(42);
    });

    it('should return fallback for NaN', () => {
      expect(engine.toFiniteNumber(NaN, 10)).toBe(10);
    });

    it('should return fallback for Infinity', () => {
      expect(engine.toFiniteNumber(Infinity, 5)).toBe(5);
    });

    it('should return 0 as default fallback', () => {
      expect(engine.toFiniteNumber(undefined)).toBe(0);
    });

    it('should parse string numbers', () => {
      expect(engine.toFiniteNumber('123')).toBe(123);
    });

    it('should return fallback for non-numeric string', () => {
      expect(engine.toFiniteNumber('abc', 7)).toBe(7);
    });

    it('should handle null (Number(null) = 0, which is finite)', () => {
      // Number(null) === 0 which is finite, so it returns 0 not the fallback
      expect(engine.toFiniteNumber(null, 99)).toBe(0);
    });
  });

  // ---------- initializeState ----------
  describe('initializeState', () => {
    it('should initialize state from financial data', () => {
      const state = engine.initializeState({
        revenue: 120000,
        expenses: 96000,
        cash: 50000,
        receivables: 15000,
        payables: 10000,
      });

      expect(state.monthlyRevenue).toBe(10000); // 120000/12
      expect(state.cash).toBe(50000);
      expect(state.receivables).toBe(15000);
      expect(state.payables).toBe(10000);
      expect(state.taxRate).toBe(0.25);
      expect(state.depreciationRate).toBe(0.10);
    });

    it('should compute derived values when not provided', () => {
      const state = engine.initializeState({
        revenue: 120000,
        expenses: 60000,
      });

      // Fixed expenses default = 60% of expenses
      expect(state.monthlyFixedExpenses).toBeCloseTo(60000 * 0.6 / 12);
      // Variable expenses default = 30% of expenses
      expect(state.monthlyVariableExpensesBase).toBeCloseTo(60000 * 0.3 / 12);
      // Salaries default = 10% of expenses
      expect(state.monthlySalaries).toBeCloseTo(60000 * 0.1 / 12);
    });

    it('should handle zero revenue', () => {
      const state = engine.initializeState({ revenue: 0, expenses: 0 });
      expect(state.monthlyRevenue).toBe(0);
      expect(state.variableExpenseRatio).toBe(0);
    });

    it('should default avgPrice to 100 when 0', () => {
      const state = engine.initializeState({ revenue: 12000, avgPrice: 0 });
      expect(state.avgPrice).toBe(100);
    });
  });

  // ---------- isApplicable ----------
  describe('isApplicable', () => {
    it('should return true for assumption with no date restrictions', () => {
      expect(engine.isApplicable({ assumption_type: 'growth_rate' }, new Date('2026-06-01'))).toBe(true);
    });

    it('should return false when date is before start_date', () => {
      const assumption = { start_date: '2026-06-01', assumption_type: 'growth_rate' };
      expect(engine.isApplicable(assumption, new Date('2026-01-01'))).toBe(false);
    });

    it('should return false when date is after end_date', () => {
      const assumption = { end_date: '2026-06-01', assumption_type: 'growth_rate' };
      expect(engine.isApplicable(assumption, new Date('2026-12-01'))).toBe(false);
    });

    it('should return true when date is within range', () => {
      const assumption = { start_date: '2026-01-01', end_date: '2026-12-31' };
      expect(engine.isApplicable(assumption, new Date('2026-06-15'))).toBe(true);
    });

    it('should return false for null assumption', () => {
      expect(engine.isApplicable(null, new Date())).toBe(false);
    });
  });

  // ---------- calculateMetrics ----------
  describe('calculateMetrics', () => {
    it('should compute P&L and balance sheet metrics', () => {
      const state = {
        monthlyRevenue: 10000,
        monthlyFixedExpenses: 3000,
        monthlySalaries: 2000,
        variableExpenseRatio: 0.3,
        monthlyVariableExpensesBase: 0,
        fixedAssets: 50000,
        depreciationRate: 0.12,
        taxRate: 0.25,
        cash: 20000,
        inventory: 5000,
        debt: 10000,
        customerPaymentDays: 30,
        supplierPaymentDays: 30,
        bfrManualAdjustment: 0,
        bfrPrevious: 0,
        cashAdjustment: 0,
      };

      const metrics = engine.calculateMetrics(state, new Date('2026-01-15'));

      expect(metrics.revenue).toBe(10000);
      expect(metrics.expenses).toBeGreaterThan(0);
      expect(metrics.grossMargin).toBe(10000 - 3000); // revenue - variable expenses
      expect(metrics.ebitda).toBeGreaterThan(0);
      expect(typeof metrics.netIncome).toBe('number');
      expect(typeof metrics.cashBalance).toBe('number');
      expect(typeof metrics.currentRatio).toBe('number');
    });

    it('should not compute negative taxes', () => {
      const state = {
        monthlyRevenue: 0,
        monthlyFixedExpenses: 5000,
        monthlySalaries: 0,
        variableExpenseRatio: 0,
        monthlyVariableExpensesBase: 0,
        fixedAssets: 10000,
        depreciationRate: 0.12,
        taxRate: 0.25,
        cash: 10000,
        inventory: 0,
        debt: 0,
        customerPaymentDays: 30,
        supplierPaymentDays: 30,
        bfrManualAdjustment: 0,
        bfrPrevious: 0,
        cashAdjustment: 0,
      };

      const metrics = engine.calculateMetrics(state, new Date());
      // Taxes should be 0 when operating result is negative
      expect(metrics.netIncome).toBeLessThanOrEqual(metrics.operatingResult);
    });
  });

  // ---------- compareScenarios ----------
  describe('compareScenarios', () => {
    it('should compare two scenario results', () => {
      const s1 = [
        { date: '2026-01', revenue: 10000, cashBalance: 50000, netIncome: 3000, operatingCashFlow: 2500 },
        { date: '2026-02', revenue: 11000, cashBalance: 52000, netIncome: 3500, operatingCashFlow: 2800 },
      ];
      const s2 = [
        { date: '2026-01', revenue: 9000, cashBalance: 45000, netIncome: 2500, operatingCashFlow: 2000 },
        { date: '2026-02', revenue: 9500, cashBalance: 47000, netIncome: 2800, operatingCashFlow: 2200 },
      ];

      const comparison = engine.compareScenarios(s1, s2);
      expect(comparison.revenueDifference).toHaveLength(2);
      expect(comparison.revenueDifference[0].difference).toBe(1000);
      expect(comparison.summary.finalRevenueDiff).toBe(1500);
      expect(comparison.summary.finalCashDiff).toBe(5000);
    });

    it('should throw for missing inputs', () => {
      expect(() => engine.compareScenarios(null, [])).toThrow();
      expect(() => engine.compareScenarios([], null)).toThrow();
    });
  });

  // ---------- calculateAverageGrowth ----------
  describe('calculateAverageGrowth', () => {
    it('should compute average growth rate', () => {
      const results = [
        { revenue: 100 },
        { revenue: 110 },
        { revenue: 121 },
      ];
      const avg = engine.calculateAverageGrowth(results, 'revenue');
      expect(avg).toBeCloseTo(10, 0); // ~10% per period
    });

    it('should return 0 for single result', () => {
      expect(engine.calculateAverageGrowth([{ revenue: 100 }], 'revenue')).toBe(0);
    });

    it('should handle zero previous values', () => {
      const results = [
        { revenue: 0 },
        { revenue: 100 },
      ];
      const avg = engine.calculateAverageGrowth(results, 'revenue');
      expect(avg).toBe(0); // Can't compute growth from 0
    });
  });

  // ---------- sumMetric ----------
  describe('sumMetric', () => {
    it('should sum a metric across results', () => {
      const results = [
        { cashFlow: 100 },
        { cashFlow: 200 },
        { cashFlow: -50 },
      ];
      expect(engine.sumMetric(results, 'cashFlow')).toBe(250);
    });

    it('should handle missing metric values', () => {
      const results = [{ a: 10 }, {}, { a: 20 }];
      expect(engine.sumMetric(results, 'a')).toBe(30);
    });
  });

  // ---------- calculateAverage ----------
  describe('calculateAverage', () => {
    it('should compute average of a metric', () => {
      const results = [{ margin: 10 }, { margin: 20 }, { margin: 30 }];
      expect(engine.calculateAverage(results, 'margin')).toBe(20);
    });

    it('should return 0 for empty results', () => {
      expect(engine.calculateAverage([], 'margin')).toBe(0);
    });

    it('should return 0 for null results', () => {
      expect(engine.calculateAverage(null, 'margin')).toBe(0);
    });
  });

  // ---------- updateStateForNextMonth ----------
  describe('updateStateForNextMonth', () => {
    it('should update state with metrics from current month', () => {
      const state = {
        cash: 10000,
        fixedAssets: 100000,
        equity: 50000,
        bfr: 5000,
        customerPaymentDays: 45,
        supplierPaymentDays: 30,
      };
      const metrics = {
        cashBalance: 12000,
        receivables: 8000,
        payables: 6000,
        depreciation: 1000,
        equity: 55000,
        bfr: 6000,
      };
      const periodState = {
        customerPaymentDays: 45,
        supplierPaymentDays: 30,
      };

      const newState = engine.updateStateForNextMonth(state, metrics, periodState);
      expect(newState.cash).toBe(12000);
      expect(newState.fixedAssets).toBe(99000); // 100000 - 1000 depreciation
      expect(newState.bfr).toBe(6000);
      expect(newState.bfrPrevious).toBe(6000);
    });
  });
});
