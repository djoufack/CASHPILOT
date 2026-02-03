/**
 * Financial Simulation Engine
 * Calculates financial projections based on scenarios and assumptions
 */

import { buildFinancialDiagnostic } from './financialAnalysisCalculations';
import { addMonths, format, isSameMonth, parseISO } from 'date-fns';

export class FinancialSimulationEngine {
  constructor() {
    this.currentState = null;
  }

  /**
   * Main simulation function
   * Projects financial state month by month from base_date to end_date
   */
  async simulateScenario(scenario, assumptions, currentFinancialState) {
    if (!scenario || !currentFinancialState) {
      throw new Error('Scenario and current financial state are required');
    }

    const results = [];
    const startDate = parseISO(scenario.base_date);
    const endDate = parseISO(scenario.end_date);

    // Initialize state with current values
    let state = this.initializeState(currentFinancialState);
    let currentDate = new Date(startDate);

    // Simulate month by month
    while (currentDate <= endDate) {
      // Apply all assumptions for this month
      state = this.applyAssumptions(state, assumptions, currentDate);

      // Calculate all financial metrics
      const metrics = this.calculateMetrics(state, currentDate);

      results.push({
        date: format(currentDate, 'yyyy-MM-dd'),
        period_label: format(currentDate, 'MMM yyyy'),
        ...metrics
      });

      // Move to next month
      state = this.updateStateForNextMonth(state, metrics);
      currentDate = addMonths(currentDate, 1);
    }

    return results;
  }

  /**
   * Initialize simulation state from current financial data
   */
  initializeState(currentFinancialState) {
    return {
      // Revenue components
      revenue: currentFinancialState.revenue || 0,
      revenueGrowthRate: 0,
      avgPrice: currentFinancialState.avgPrice || 100,
      volume: currentFinancialState.volume || 0,

      // Expense components
      expenses: currentFinancialState.expenses || 0,
      fixedExpenses: currentFinancialState.fixedExpenses || 0,
      variableExpenses: currentFinancialState.variableExpenses || 0,
      salaries: currentFinancialState.salaries || 0,

      // Balance sheet items
      cash: currentFinancialState.cash || 0,
      receivables: currentFinancialState.receivables || 0,
      payables: currentFinancialState.payables || 0,
      inventory: currentFinancialState.inventory || 0,
      fixedAssets: currentFinancialState.fixedAssets || 0,
      equity: currentFinancialState.equity || 0,
      debt: currentFinancialState.debt || 0,

      // Working capital
      bfr: currentFinancialState.bfr || 0,
      bfrDays: 30, // Default 30 days
      customerPaymentDays: 45,
      supplierPaymentDays: 30,

      // Operational metrics
      taxRate: 0.25,
      depreciationRate: 0.10,
    };
  }

  /**
   * Apply all assumptions for a given date
   */
  applyAssumptions(state, assumptions, date) {
    const newState = { ...state };

    if (!assumptions || !Array.isArray(assumptions)) {
      return newState;
    }

    assumptions.forEach(assumption => {
      if (!this.isApplicable(assumption, date)) {
        return;
      }

      switch (assumption.assumption_type) {
        case 'growth_rate':
          newState.revenue *= (1 + (assumption.parameters.rate || 0) / 100);
          newState.revenueGrowthRate = assumption.parameters.rate || 0;
          break;

        case 'recurring':
          if (assumption.category === 'salaries') {
            newState.salaries += assumption.parameters.amount || 0;
          } else if (assumption.category === 'social_charges') {
            newState.fixedExpenses += assumption.parameters.amount || 0;
          } else {
            newState.fixedExpenses += assumption.parameters.amount || 0;
          }
          newState.expenses = newState.fixedExpenses + newState.variableExpenses + newState.salaries;
          break;

        case 'one_time':
          if (this.isSameMonth(date, assumption.parameters.date)) {
            if (assumption.category === 'investment' || assumption.category === 'equipment') {
              newState.fixedAssets += assumption.parameters.amount || 0;
              newState.cash -= assumption.parameters.amount || 0;
            } else {
              newState.expenses += assumption.parameters.amount || 0;
              newState.cash -= assumption.parameters.amount || 0;
            }
          }
          break;

        case 'percentage_change':
          if (assumption.category === 'pricing') {
            newState.avgPrice *= (1 + (assumption.parameters.rate || 0) / 100);
            newState.revenue = newState.avgPrice * newState.volume;
          } else if (assumption.category === 'expense_reduction') {
            newState.fixedExpenses *= (1 - (assumption.parameters.rate || 0) / 100);
            newState.expenses = newState.fixedExpenses + newState.variableExpenses + newState.salaries;
          }
          break;

        case 'payment_terms':
          newState.customerPaymentDays = assumption.parameters.customer_days || newState.customerPaymentDays;
          newState.supplierPaymentDays = assumption.parameters.supplier_days || newState.supplierPaymentDays;
          // Recalculate BFR based on new payment terms
          newState.bfr = this.calculateBFRFromPaymentTerms(newState);
          break;

        default:
          console.warn(`Unknown assumption type: ${assumption.assumption_type}`);
      }
    });

    return newState;
  }

  /**
   * Check if an assumption applies to a given date
   */
  isApplicable(assumption, date) {
    if (!assumption) return false;

    const hasStartDate = assumption.start_date;
    const hasEndDate = assumption.end_date;

    if (!hasStartDate && !hasEndDate) {
      return true; // No date restrictions
    }

    const assumptionStart = hasStartDate ? parseISO(assumption.start_date) : null;
    const assumptionEnd = hasEndDate ? parseISO(assumption.end_date) : null;

    if (assumptionStart && date < assumptionStart) {
      return false;
    }

    if (assumptionEnd && date > assumptionEnd) {
      return false;
    }

    return true;
  }

  /**
   * Check if two dates are in the same month
   */
  isSameMonth(date1, date2) {
    if (!date1 || !date2) return false;
    const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
    const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
    return isSameMonth(d1, d2);
  }

  /**
   * Calculate BFR based on payment terms
   */
  calculateBFRFromPaymentTerms(state) {
    // BFR = (Revenue / 12 * customerDays/30) + Inventory - (Expenses / 12 * supplierDays/30)
    const monthlyRevenue = state.revenue / 12;
    const monthlyExpenses = state.expenses / 12;

    const receivables = (monthlyRevenue * state.customerPaymentDays) / 30;
    const payables = (monthlyExpenses * state.supplierPaymentDays) / 30;

    return receivables + state.inventory - payables;
  }

  /**
   * Calculate all financial metrics for current state
   */
  calculateMetrics(state, currentDate) {
    // Monthly breakdown
    const monthlyRevenue = state.revenue / 12;
    const monthlyExpenses = state.expenses / 12;

    // P&L metrics
    const grossMargin = monthlyRevenue * 0.65; // Simplified: 65% gross margin
    const ebitda = monthlyRevenue - monthlyExpenses;
    const depreciation = (state.fixedAssets * state.depreciationRate) / 12;
    const operatingResult = ebitda - depreciation;
    const netIncome = operatingResult * (1 - state.taxRate);

    // Cash flow
    const caf = netIncome + depreciation;
    const bfrChange = state.bfr - (state.bfrPrevious || state.bfr);
    const operatingCashFlow = caf - bfrChange;

    // Update cash balance
    const cashBalance = state.cash + operatingCashFlow;

    // Balance sheet items
    const currentAssets = cashBalance + state.receivables + state.inventory;
    const currentLiabilities = state.payables;
    const totalAssets = currentAssets + state.fixedAssets;
    const totalLiabilities = currentLiabilities + state.debt;
    const equity = totalAssets - totalLiabilities;

    // Ratios
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const quickRatio = currentLiabilities > 0 ? (currentAssets - state.inventory) / currentLiabilities : 0;
    const cashRatio = currentLiabilities > 0 ? cashBalance / currentLiabilities : 0;
    const debtToEquity = equity > 0 ? state.debt / equity : 0;
    const roe = equity > 0 ? (netIncome * 12 / equity) * 100 : 0;

    return {
      // Income Statement
      revenue: monthlyRevenue,
      expenses: monthlyExpenses,
      grossMargin,
      ebitda,
      ebitdaMargin: monthlyRevenue > 0 ? (ebitda / monthlyRevenue) * 100 : 0,
      depreciation,
      operatingResult,
      operatingMargin: monthlyRevenue > 0 ? (operatingResult / monthlyRevenue) * 100 : 0,
      netIncome,
      netMargin: monthlyRevenue > 0 ? (netIncome / monthlyRevenue) * 100 : 0,

      // Cash Flow
      caf,
      bfrChange,
      operatingCashFlow,
      cashBalance,

      // Balance Sheet
      currentAssets,
      fixedAssets: state.fixedAssets,
      totalAssets,
      currentLiabilities,
      debt: state.debt,
      totalLiabilities,
      equity,
      bfr: state.bfr,

      // Ratios
      currentRatio,
      quickRatio,
      cashRatio,
      debtToEquity,
      roe,
      roce: (equity + state.debt) > 0 ? (operatingResult * 12 / (equity + state.debt)) * 100 : 0,
    };
  }

  /**
   * Update state for next month based on current metrics
   */
  updateStateForNextMonth(state, metrics) {
    return {
      ...state,
      cash: metrics.cashBalance,
      receivables: (metrics.revenue * state.customerPaymentDays) / 30,
      payables: (metrics.expenses * state.supplierPaymentDays) / 30,
      fixedAssets: state.fixedAssets - metrics.depreciation,
      equity: metrics.equity,
      bfrPrevious: state.bfr,
      volume: state.volume || metrics.revenue / state.avgPrice, // Update volume
    };
  }

  /**
   * Compare two scenarios
   */
  compareScenarios(scenario1Results, scenario2Results) {
    if (!scenario1Results || !scenario2Results) {
      throw new Error('Both scenario results are required for comparison');
    }

    const comparison = {
      revenueDifference: [],
      cashFlowDifference: [],
      profitabilityDifference: [],
      summary: {}
    };

    // Compare month by month
    const minLength = Math.min(scenario1Results.length, scenario2Results.length);

    for (let i = 0; i < minLength; i++) {
      const r1 = scenario1Results[i];
      const r2 = scenario2Results[i];

      comparison.revenueDifference.push({
        date: r1.date,
        difference: r1.revenue - r2.revenue,
        percentDiff: r2.revenue > 0 ? ((r1.revenue - r2.revenue) / r2.revenue) * 100 : 0
      });

      comparison.cashFlowDifference.push({
        date: r1.date,
        difference: r1.cashBalance - r2.cashBalance,
        percentDiff: r2.cashBalance > 0 ? ((r1.cashBalance - r2.cashBalance) / r2.cashBalance) * 100 : 0
      });

      comparison.profitabilityDifference.push({
        date: r1.date,
        difference: r1.netIncome - r2.netIncome,
        percentDiff: r2.netIncome > 0 ? ((r1.netIncome - r2.netIncome) / r2.netIncome) * 100 : 0
      });
    }

    // Calculate summary statistics
    const finalR1 = scenario1Results[scenario1Results.length - 1];
    const finalR2 = scenario2Results[scenario2Results.length - 1];

    comparison.summary = {
      finalRevenueDiff: finalR1.revenue - finalR2.revenue,
      finalCashDiff: finalR1.cashBalance - finalR2.cashBalance,
      finalProfitDiff: finalR1.netIncome - finalR2.netIncome,
      avgRevenueGrowthDiff: this.calculateAverageGrowth(scenario1Results, 'revenue') -
                            this.calculateAverageGrowth(scenario2Results, 'revenue'),
      totalCashFlowDiff: this.sumMetric(scenario1Results, 'operatingCashFlow') -
                         this.sumMetric(scenario2Results, 'operatingCashFlow')
    };

    return comparison;
  }

  /**
   * Calculate average growth rate
   */
  calculateAverageGrowth(results, metric) {
    if (results.length < 2) return 0;

    let totalGrowth = 0;
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1][metric];
      const curr = results[i][metric];
      if (prev > 0) {
        totalGrowth += ((curr - prev) / prev) * 100;
      }
    }

    return totalGrowth / (results.length - 1);
  }

  /**
   * Sum a metric across all periods
   */
  sumMetric(results, metric) {
    return results.reduce((sum, r) => sum + (r[metric] || 0), 0);
  }

  /**
   * Sensitivity Analysis
   * Test the impact of varying a parameter
   */
  sensitivityAnalysis(scenario, assumptions, currentState, parameter, range) {
    const results = [];

    range.forEach(value => {
      // Modify the assumption with the new value
      const modifiedAssumptions = assumptions.map(a => {
        if (a.category === parameter.category && a.assumption_type === parameter.type) {
          return {
            ...a,
            parameters: {
              ...a.parameters,
              [parameter.field]: value
            }
          };
        }
        return a;
      });

      // Run simulation with modified assumptions
      const outcome = this.simulateScenario(scenario, modifiedAssumptions, currentState);

      results.push({
        parameterValue: value,
        outcome,
        finalCash: outcome[outcome.length - 1].cashBalance,
        finalRevenue: outcome[outcome.length - 1].revenue,
        avgMargin: this.calculateAverage(outcome, 'netMargin')
      });
    });

    return results;
  }

  /**
   * Calculate average of a metric
   */
  calculateAverage(results, metric) {
    if (!results || results.length === 0) return 0;
    return results.reduce((sum, r) => sum + (r[metric] || 0), 0) / results.length;
  }
}

export default FinancialSimulationEngine;
