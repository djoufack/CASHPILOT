/**
 * Financial Simulation Engine
 * Calculates financial projections based on scenarios and assumptions
 */

import { addMonths, format, isSameMonth as isSameMonthDateFns, parseISO } from 'date-fns';
import { sanitizeScenarioAssumptions } from './scenarioAssumptionRules.js';

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

    const { validAssumptions } = sanitizeScenarioAssumptions(assumptions);
    const results = [];
    const startDate = parseISO(scenario.base_date);
    const endDate = parseISO(scenario.end_date);

    // Initialize state with current values
    let state = this.initializeState(currentFinancialState);
    let currentDate = new Date(startDate);

    // Simulate month by month
    while (currentDate <= endDate) {
      // Apply structural assumptions before building the month view.
      state = this.applyAssumptions(state, validAssumptions, currentDate);
      const periodState = this.buildPeriodState(state, validAssumptions, currentDate);

      // Calculate all financial metrics
      const metrics = this.calculateMetrics(periodState, currentDate);

      results.push({
        date: format(currentDate, 'yyyy-MM-dd'),
        period_label: format(currentDate, 'MMM yyyy'),
        ...metrics
      });

      // Move to next month
      state = this.updateStateForNextMonth(state, metrics, periodState);
      currentDate = addMonths(currentDate, 1);
    }

    return results;
  }

  /**
   * Initialize simulation state from current financial data
   */
  initializeState(currentFinancialState) {
    const annualRevenue = this.toFiniteNumber(currentFinancialState.revenue);
    const annualExpenses = this.toFiniteNumber(currentFinancialState.expenses);
    const annualFixedExpenses = this.toFiniteNumber(
      currentFinancialState.fixedExpenses,
      annualExpenses * 0.6
    );
    const annualVariableExpenses = this.toFiniteNumber(
      currentFinancialState.variableExpenses,
      annualExpenses * 0.3
    );
    const annualSalaries = this.toFiniteNumber(
      currentFinancialState.salaries,
      annualExpenses * 0.1
    );
    const avgPrice = this.toFiniteNumber(currentFinancialState.avgPrice, 100) || 100;
    const annualVolume = this.toFiniteNumber(
      currentFinancialState.volume,
      avgPrice > 0 ? annualRevenue / avgPrice : 0
    );

    return {
      // Monthly operating run rate
      monthlyRevenue: annualRevenue / 12,
      revenueGrowthRate: 0,
      avgPrice,
      monthlyVolume: annualVolume / 12,

      // Monthly expense run rate
      monthlyFixedExpenses: annualFixedExpenses / 12,
      monthlyVariableExpensesBase: annualVariableExpenses / 12,
      variableExpenseRatio: annualRevenue > 0 ? annualVariableExpenses / annualRevenue : 0,
      monthlySalaries: annualSalaries / 12,

      // Balance sheet items
      cash: this.toFiniteNumber(currentFinancialState.cash),
      receivables: this.toFiniteNumber(currentFinancialState.receivables),
      payables: this.toFiniteNumber(currentFinancialState.payables),
      inventory: this.toFiniteNumber(currentFinancialState.inventory),
      fixedAssets: this.toFiniteNumber(currentFinancialState.fixedAssets),
      equity: this.toFiniteNumber(currentFinancialState.equity),
      debt: this.toFiniteNumber(currentFinancialState.debt),

      // Working capital
      bfr: this.toFiniteNumber(currentFinancialState.bfr),
      bfrPrevious: this.toFiniteNumber(currentFinancialState.bfr),
      bfrManualAdjustment: 0,
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

      const parameters = assumption.parameters || {};
      const rate = this.toFiniteNumber(parameters.rate);
      const amount = this.toFiniteNumber(parameters.amount);

      switch (assumption.assumption_type) {
        case 'growth_rate':
          this.applyRateToCategory(newState, assumption.category, rate);
          newState.revenueGrowthRate = rate;
          break;

        case 'percentage_change':
          this.applyRateToCategory(newState, assumption.category, rate);
          break;

        case 'one_time':
          if (this.isSameMonth(date, parameters.date || assumption.start_date)) {
            if (assumption.category === 'investment' || assumption.category === 'equipment') {
              newState.fixedAssets += amount;
              newState.cash -= amount;
            } else if (assumption.category === 'working_capital') {
              newState.inventory += amount;
              newState.cash -= amount;
            }
          }
          break;

        case 'payment_terms':
          newState.customerPaymentDays = parameters.customer_days || newState.customerPaymentDays;
          newState.supplierPaymentDays = parameters.supplier_days || newState.supplierPaymentDays;
          break;

        default:
          break;
      }
    });

    return newState;
  }

  buildPeriodState(state, assumptions, date) {
    const periodState = {
      ...state,
      cashAdjustment: 0,
      customerPaymentDays: state.customerPaymentDays,
      supplierPaymentDays: state.supplierPaymentDays,
      bfrManualAdjustment: state.bfrManualAdjustment || 0,
    };

    if (!assumptions || !Array.isArray(assumptions)) {
      return periodState;
    }

    assumptions.forEach((assumption) => {
      if (!this.isApplicable(assumption, date)) {
        return;
      }

      const parameters = assumption.parameters || {};
      const amount = this.toFiniteNumber(parameters.amount);

      switch (assumption.assumption_type) {
        case 'fixed_amount':
          this.applyAmountToCategory(periodState, assumption.category, amount, 'set');
          break;

        case 'recurring':
          this.applyAmountToCategory(periodState, assumption.category, amount, 'add');
          break;

        case 'one_time':
          if (this.isSameMonth(date, parameters.date || assumption.start_date)) {
            this.applyOneTimePeriodImpact(periodState, assumption.category, amount);
          }
          break;

        case 'payment_terms':
          periodState.customerPaymentDays = parameters.customer_days || periodState.customerPaymentDays;
          periodState.supplierPaymentDays = parameters.supplier_days || periodState.supplierPaymentDays;
          break;

        default:
          break;
      }
    });

    periodState.monthlyRevenue = Math.max(0, periodState.monthlyRevenue);
    periodState.monthlyFixedExpenses = Math.max(0, periodState.monthlyFixedExpenses);
    periodState.monthlySalaries = Math.max(0, periodState.monthlySalaries);
    periodState.avgPrice = Math.max(0, periodState.avgPrice);
    periodState.monthlyVolume = Math.max(0, periodState.monthlyVolume);

    return periodState;
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
    return isSameMonthDateFns(d1, d2);
  }

  /**
   * Calculate BFR based on payment terms
   */
  calculateBFRFromPaymentTerms(state) {
    // BFR = (Revenue / 12 * customerDays/30) + Inventory - (Expenses / 12 * supplierDays/30)
    const monthlyRevenue = state.monthlyRevenue || 0;
    const monthlyExpenses = this.calculateMonthlyExpenses(state);

    const receivables = (monthlyRevenue * state.customerPaymentDays) / 30;
    const payables = (monthlyExpenses * state.supplierPaymentDays) / 30;

    return receivables + state.inventory - payables + (state.bfrManualAdjustment || 0);
  }

  /**
   * Calculate all financial metrics for current state
   */
  calculateMetrics(state, currentDate) {
    const monthlyRevenue = state.monthlyRevenue || 0;
    const monthlyVariableExpenses = this.calculateMonthlyVariableExpenses(state);
    const monthlyExpenses =
      Math.max(0, state.monthlyFixedExpenses || 0) +
      Math.max(0, state.monthlySalaries || 0) +
      monthlyVariableExpenses;

    // P&L metrics
    const grossMargin = monthlyRevenue - monthlyVariableExpenses;
    const ebitda = monthlyRevenue - monthlyExpenses;
    const depreciation = (state.fixedAssets * state.depreciationRate) / 12;
    const operatingResult = ebitda - depreciation;
    const taxes = operatingResult > 0 ? operatingResult * state.taxRate : 0;
    const netIncome = operatingResult - taxes;

    // Cash flow
    const caf = netIncome + depreciation;
    const receivables = (monthlyRevenue * state.customerPaymentDays) / 30;
    const payables = (monthlyExpenses * state.supplierPaymentDays) / 30;
    const bfr = receivables + state.inventory - payables + (state.bfrManualAdjustment || 0);
    const bfrChange = bfr - (state.bfrPrevious ?? bfr);
    const operatingCashFlow = caf - bfrChange;

    // Update cash balance
    const cashBalance = state.cash + operatingCashFlow + (state.cashAdjustment || 0);

    // Balance sheet items
    const currentAssets = cashBalance + receivables + state.inventory;
    const currentLiabilities = payables;
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
      receivables,
      payables,
      currentAssets,
      fixedAssets: state.fixedAssets,
      totalAssets,
      currentLiabilities,
      debt: state.debt,
      totalLiabilities,
      equity,
      bfr,

      // Ratios
      currentRatio,
      quickRatio,
      cashRatio,
      debtToEquity,
      roe,
      roce: (equity + state.debt) > 0 ? (operatingResult * 12 / (equity + state.debt)) * 100 : 0,
      customerPaymentDays: state.customerPaymentDays,
      supplierPaymentDays: state.supplierPaymentDays,
    };
  }

  /**
   * Update state for next month based on current metrics
   */
  updateStateForNextMonth(state, metrics, periodState) {
    return {
      ...state,
      cash: metrics.cashBalance,
      receivables: metrics.receivables,
      payables: metrics.payables,
      fixedAssets: Math.max(0, state.fixedAssets - metrics.depreciation),
      equity: metrics.equity,
      bfr: metrics.bfr,
      bfrPrevious: metrics.bfr,
      customerPaymentDays: periodState.customerPaymentDays,
      supplierPaymentDays: periodState.supplierPaymentDays,
    };
  }

  toFiniteNumber(value, fallback = 0) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  }

  calculateMonthlyVariableExpenses(state) {
    if ((state.monthlyRevenue || 0) > 0) {
      return Math.max(0, state.monthlyRevenue * (state.variableExpenseRatio || 0));
    }

    return Math.max(0, state.monthlyVariableExpensesBase || 0);
  }

  calculateMonthlyExpenses(state) {
    return (
      Math.max(0, state.monthlyFixedExpenses || 0) +
      Math.max(0, state.monthlySalaries || 0) +
      this.calculateMonthlyVariableExpenses(state)
    );
  }

  syncRevenueFromDrivers(state) {
    if ((state.avgPrice || 0) > 0) {
      state.monthlyRevenue = Math.max(0, (state.avgPrice || 0) * (state.monthlyVolume || 0));
    }
  }

  syncVolumeFromRevenue(state) {
    if ((state.avgPrice || 0) > 0) {
      state.monthlyVolume = Math.max(0, (state.monthlyRevenue || 0) / state.avgPrice);
    }
  }

  applyRateToCategory(state, category, rate) {
    if (!rate) {
      return;
    }

    if (category === 'pricing') {
      state.avgPrice = Math.max(0, state.avgPrice * (1 + rate / 100));
      this.syncRevenueFromDrivers(state);
      return;
    }

    if (category === 'expense_reduction') {
      state.monthlyFixedExpenses = Math.max(0, state.monthlyFixedExpenses * (1 - rate / 100));
      return;
    }

    if (category === 'expense' || category === 'social_charges') {
      state.monthlyFixedExpenses = Math.max(0, state.monthlyFixedExpenses * (1 + rate / 100));
      return;
    }

    if (category === 'salaries') {
      state.monthlySalaries = Math.max(0, state.monthlySalaries * (1 + rate / 100));
      return;
    }

    if (category === 'working_capital') {
      state.bfrManualAdjustment += (state.bfr || 0) * (rate / 100);
      return;
    }

    state.monthlyRevenue = Math.max(0, state.monthlyRevenue * (1 + rate / 100));
    this.syncVolumeFromRevenue(state);
  }

  applyAmountToCategory(state, category, amount, mode) {
    if (!amount && amount !== 0) {
      return;
    }

    if (category === 'pricing') {
      if (mode === 'set') {
        state.avgPrice = Math.max(0, amount);
        this.syncRevenueFromDrivers(state);
      } else {
        state.monthlyRevenue = Math.max(0, state.monthlyRevenue + amount);
        this.syncVolumeFromRevenue(state);
      }
      return;
    }

    if (category === 'expense_reduction') {
      if (mode === 'set') {
        state.monthlyFixedExpenses = Math.max(0, state.monthlyFixedExpenses - amount);
      } else {
        state.monthlyFixedExpenses = Math.max(0, state.monthlyFixedExpenses - amount);
      }
      return;
    }

    if (category === 'expense' || category === 'social_charges') {
      state.monthlyFixedExpenses = mode === 'set'
        ? Math.max(0, amount)
        : Math.max(0, state.monthlyFixedExpenses + amount);
      return;
    }

    if (category === 'salaries') {
      state.monthlySalaries = mode === 'set'
        ? Math.max(0, amount)
        : Math.max(0, state.monthlySalaries + amount);
      return;
    }

    if (category === 'working_capital') {
      state.bfrManualAdjustment = mode === 'set'
        ? amount
        : (state.bfrManualAdjustment || 0) + amount;
      return;
    }

    state.monthlyRevenue = mode === 'set'
      ? Math.max(0, amount)
      : Math.max(0, state.monthlyRevenue + amount);
    this.syncVolumeFromRevenue(state);
  }

  applyOneTimePeriodImpact(state, category, amount) {
    if (category === 'investment' || category === 'equipment') {
      return;
    }

    if (category === 'working_capital') {
      state.bfrManualAdjustment += amount;
      state.cashAdjustment -= amount;
      return;
    }

    if (category === 'expense' || category === 'social_charges') {
      state.monthlyFixedExpenses += amount;
      state.cashAdjustment -= amount;
      return;
    }

    if (category === 'salaries') {
      state.monthlySalaries += amount;
      state.cashAdjustment -= amount;
      return;
    }

    state.monthlyRevenue += amount;
    state.cashAdjustment += amount;
    this.syncVolumeFromRevenue(state);
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
  async sensitivityAnalysis(scenario, assumptions, currentState, parameter, range) {
    const results = [];

    for (const value of range) {
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
      const outcome = await this.simulateScenario(scenario, modifiedAssumptions, currentState);

      results.push({
        parameterValue: value,
        outcome,
        finalCash: outcome[outcome.length - 1].cashBalance,
        finalRevenue: outcome[outcome.length - 1].revenue,
        avgMargin: this.calculateAverage(outcome, 'netMargin')
      });
    }

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
