import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  consumeCredits,
  createAuthClient,
  createServiceClient,
  HttpError,
  refundCredits,
  requireAuthenticatedUser,
  resolveCreditCost,
} from '../_shared/billing.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const ANALYTICS_RATE_LIMIT = { maxRequests: 30, windowMs: 15 * 60 * 1000, keyPrefix: 'ai-hr-analytics' };
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AnalyticsAction = 'turnover_risk' | 'absenteeism_forecast' | 'headcount_forecast' | 'salary_benchmark';

const resolveAnalyticsOperationCode = (action: AnalyticsAction): string => {
  switch (action) {
    case 'turnover_risk':
      return 'AI_ANOMALY_DETECT';
    case 'absenteeism_forecast':
    case 'headcount_forecast':
      return 'AI_FORECAST';
    case 'salary_benchmark':
      return 'AI_REPORT';
  }
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const resolveActiveCompanyId = async (
  supabase: ReturnType<typeof createAuthClient>,
  userId: string,
  requestedCompanyId: unknown
): Promise<string | null> => {
  if (typeof requestedCompanyId === 'string' && UUID_REGEX.test(requestedCompanyId)) {
    return requestedCompanyId;
  }
  const { data } = await supabase
    .from('user_company_preferences')
    .select('active_company_id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.active_company_id || null;
};

// ---- Percentile helper (linear interpolation) ----

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
};

// ---- Moving average helper ----

const movingAverage = (values: number[], window: number): number[] => {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
};

// ======================================================================
// ACTION 1: Turnover Risk
// Score 0-100 per active employee based on multiple risk factors
// ======================================================================

const handleTurnoverRisk = async (supabase: ReturnType<typeof createAuthClient>, companyId: string) => {
  // Fetch active employees with contracts, leaves, reviews, and training
  const { data: employees, error: empErr } = await supabase
    .from('hr_employees')
    .select('id, first_name, last_name, job_title, hire_date, department_id, hr_departments(name)')
    .eq('company_id', companyId)
    .eq('status', 'active');

  if (empErr) throw new HttpError(500, `Failed to fetch employees: ${empErr.message}`);
  if (!employees || employees.length === 0) {
    return {
      success: true,
      data: { employees: [], summary: { avg_risk: 0, high_risk_count: 0 } },
      message: 'Aucun employe actif.',
    };
  }

  const employeeIds = employees.map((e) => e.id);

  // Parallel fetch of all risk factor data
  const [contractsRes, leavesRes, reviewsRes, trainingRes] = await Promise.all([
    supabase
      .from('hr_employee_contracts')
      .select('employee_id, monthly_salary, hourly_rate, start_date, status')
      .eq('company_id', companyId)
      .in('employee_id', employeeIds)
      .eq('status', 'active'),
    supabase
      .from('hr_leave_requests')
      .select('employee_id, status, total_days, created_at')
      .eq('company_id', companyId)
      .in('employee_id', employeeIds),
    supabase
      .from('hr_performance_reviews')
      .select('employee_id, overall_manager_rating, performance_label, created_at')
      .eq('company_id', companyId)
      .in('employee_id', employeeIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('hr_training_enrollments')
      .select('employee_id, status, completed_at')
      .eq('company_id', companyId)
      .in('employee_id', employeeIds),
  ]);

  // Build lookup maps
  const contractsByEmployee = new Map<string, typeof contractsRes.data>();
  for (const c of contractsRes.data || []) {
    const list = contractsByEmployee.get(c.employee_id) || [];
    list.push(c);
    contractsByEmployee.set(c.employee_id, list);
  }

  const leavesByEmployee = new Map<string, typeof leavesRes.data>();
  for (const l of leavesRes.data || []) {
    const list = leavesByEmployee.get(l.employee_id) || [];
    list.push(l);
    leavesByEmployee.set(l.employee_id, list);
  }

  const reviewsByEmployee = new Map<string, typeof reviewsRes.data>();
  for (const r of reviewsRes.data || []) {
    const list = reviewsByEmployee.get(r.employee_id) || [];
    list.push(r);
    reviewsByEmployee.set(r.employee_id, list);
  }

  const trainingByEmployee = new Map<string, typeof trainingRes.data>();
  for (const t of trainingRes.data || []) {
    const list = trainingByEmployee.get(t.employee_id) || [];
    list.push(t);
    trainingByEmployee.set(t.employee_id, list);
  }

  const now = Date.now();
  const results = employees.map((emp) => {
    let riskScore = 50; // baseline
    const factors: string[] = [];

    // Factor 1: Tenure (< 1 year or > 5 years = higher risk)
    const hireDate = emp.hire_date ? new Date(emp.hire_date).getTime() : now;
    const tenureMonths = Math.max(0, (now - hireDate) / (1000 * 60 * 60 * 24 * 30.44));

    if (tenureMonths < 6) {
      riskScore += 15;
      factors.push('Anciennete < 6 mois (integration)');
    } else if (tenureMonths < 12) {
      riskScore += 8;
      factors.push('Anciennete < 1 an');
    } else if (tenureMonths > 60) {
      riskScore += 5;
      factors.push('Anciennete > 5 ans (risque stagnation)');
    } else {
      riskScore -= 10;
    }

    // Factor 2: Salary raises (no active contract or low salary)
    const contracts = contractsByEmployee.get(emp.id) || [];
    if (contracts.length === 0) {
      riskScore += 10;
      factors.push('Aucun contrat actif');
    } else {
      const salary = toNumber(contracts[0].monthly_salary);
      if (salary === 0 && toNumber(contracts[0].hourly_rate) === 0) {
        riskScore += 5;
        factors.push('Remuneration non renseignee');
      }
    }

    // Factor 3: Performance reviews
    const reviews = reviewsByEmployee.get(emp.id) || [];
    if (reviews.length === 0) {
      riskScore += 10;
      factors.push('Aucune evaluation de performance');
    } else {
      const latestReview = reviews[0];
      const rating = toNumber(latestReview.overall_manager_rating);
      if (rating > 0 && rating <= 2) {
        riskScore += 15;
        factors.push(`Evaluation faible (${rating}/5)`);
      } else if (rating >= 4) {
        // High performers also at risk of leaving for better opportunities
        riskScore += 5;
        factors.push(`Talent a risque (${rating}/5 - risque debauchage)`);
      } else if (rating > 0) {
        riskScore -= 5;
      }
      if (latestReview.performance_label === 'below') {
        riskScore += 10;
        factors.push('Label performance "below"');
      }
    }

    // Factor 4: Training engagement
    const trainings = trainingByEmployee.get(emp.id) || [];
    const completedTrainings = trainings.filter((t) => t.status === 'completed').length;
    if (trainings.length === 0) {
      riskScore += 8;
      factors.push('Aucune formation suivie');
    } else if (completedTrainings === 0) {
      riskScore += 5;
      factors.push('Formations inscrites mais non terminees');
    } else {
      riskScore -= 5;
    }

    // Factor 5: Rejected leaves (frustration signal)
    const leaves = leavesByEmployee.get(emp.id) || [];
    const rejectedLeaves = leaves.filter((l) => l.status === 'rejected').length;
    if (rejectedLeaves >= 3) {
      riskScore += 15;
      factors.push(`${rejectedLeaves} demandes de conges rejetees`);
    } else if (rejectedLeaves >= 1) {
      riskScore += 5;
      factors.push(`${rejectedLeaves} demande(s) de conge rejetee(s)`);
    }

    riskScore = clamp(Math.round(riskScore), 0, 100);
    const riskLevel = riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low';

    return {
      employee_id: emp.id,
      name: `${emp.first_name} ${emp.last_name}`,
      job_title: emp.job_title,
      department: (emp as any).hr_departments?.name || null,
      tenure_months: Math.round(tenureMonths),
      risk_score: riskScore,
      risk_level: riskLevel,
      risk_factors: factors,
    };
  });

  // Sort by risk score descending
  results.sort((a, b) => b.risk_score - a.risk_score);

  const avgRisk =
    results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.risk_score, 0) / results.length) : 0;
  const highRiskCount = results.filter((r) => r.risk_level === 'high').length;

  return {
    success: true,
    data: {
      employees: results,
      summary: {
        total_employees: results.length,
        avg_risk: avgRisk,
        high_risk_count: highRiskCount,
        medium_risk_count: results.filter((r) => r.risk_level === 'medium').length,
        low_risk_count: results.filter((r) => r.risk_level === 'low').length,
      },
    },
    message: `Analyse de risque de turnover pour ${results.length} employe(s). ${highRiskCount} a risque eleve.`,
  };
};

// ======================================================================
// ACTION 2: Absenteeism Forecast
// Moving average of last 12 months of leave data per department
// ======================================================================

const handleAbsenteeismForecast = async (supabase: ReturnType<typeof createAuthClient>, companyId: string) => {
  // Fetch all departments
  const { data: departments, error: deptErr } = await supabase
    .from('hr_departments')
    .select('id, name')
    .eq('company_id', companyId);

  if (deptErr) throw new HttpError(500, `Failed to fetch departments: ${deptErr.message}`);

  // Fetch approved/validated leave requests from the last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoffDate = twelveMonthsAgo.toISOString().split('T')[0];

  const { data: leaves, error: leaveErr } = await supabase
    .from('hr_leave_requests')
    .select('employee_id, total_days, start_date, hr_employees(department_id)')
    .eq('company_id', companyId)
    .in('status', ['approved', 'validated'])
    .gte('start_date', cutoffDate);

  if (leaveErr) throw new HttpError(500, `Failed to fetch leaves: ${leaveErr.message}`);

  // Fetch headcount per department
  const { data: empCounts } = await supabase
    .from('hr_employees')
    .select('id, department_id')
    .eq('company_id', companyId)
    .eq('status', 'active');

  const headcountByDept = new Map<string, number>();
  for (const emp of empCounts || []) {
    if (emp.department_id) {
      headcountByDept.set(emp.department_id, (headcountByDept.get(emp.department_id) || 0) + 1);
    }
  }

  // Build monthly absence days per department
  const deptMonthly = new Map<string, Map<string, number>>(); // dept_id -> month_key -> total_days

  for (const leave of leaves || []) {
    const deptId = (leave as any).hr_employees?.department_id;
    if (!deptId) continue;

    const monthKey = leave.start_date?.substring(0, 7) || 'unknown'; // YYYY-MM
    if (!deptMonthly.has(deptId)) deptMonthly.set(deptId, new Map());
    const monthly = deptMonthly.get(deptId)!;
    monthly.set(monthKey, (monthly.get(monthKey) || 0) + toNumber(leave.total_days));
  }

  // Generate last 12 month keys
  const monthKeys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    monthKeys.push(d.toISOString().substring(0, 7));
  }

  const departmentForecasts = (departments || []).map((dept) => {
    const monthly = deptMonthly.get(dept.id) || new Map();
    const headcount = headcountByDept.get(dept.id) || 1;

    // Build time series: absence days per month
    const rawValues = monthKeys.map((mk) => monthly.get(mk) || 0);

    // 3-month moving average
    const ma3 = movingAverage(rawValues, 3);
    // 6-month moving average
    const ma6 = movingAverage(rawValues, 6);

    // Forecast next 3 months using trend from MA3
    const lastMa3 = ma3[ma3.length - 1] || 0;
    const prevMa3 = ma3.length >= 2 ? ma3[ma3.length - 2] : lastMa3;
    const trend = lastMa3 - prevMa3;

    const forecast = [1, 2, 3].map((offset) => {
      const d = new Date();
      d.setMonth(d.getMonth() + offset);
      const forecastedDays = Math.max(0, lastMa3 + trend * offset);
      const workingDaysInMonth = 22;
      return {
        month: d.toISOString().substring(0, 7),
        forecasted_absence_days: Math.round(forecastedDays * 10) / 10,
        forecasted_rate_pct: Math.round((forecastedDays / (headcount * workingDaysInMonth)) * 100 * 10) / 10,
      };
    });

    // Monthly time series
    const timeSeries = monthKeys.map((mk, i) => ({
      month: mk,
      absence_days: rawValues[i],
      ma3: Math.round(ma3[i] * 10) / 10,
      ma6: Math.round(ma6[i] * 10) / 10,
      rate_pct: Math.round((rawValues[i] / (headcount * 22)) * 100 * 10) / 10,
    }));

    const totalAbsenceDays = rawValues.reduce((a, b) => a + b, 0);
    const avgMonthlyDays = totalAbsenceDays / 12;

    return {
      department_id: dept.id,
      department_name: dept.name,
      headcount,
      last_12m_total_days: Math.round(totalAbsenceDays * 10) / 10,
      avg_monthly_days: Math.round(avgMonthlyDays * 10) / 10,
      avg_rate_pct: Math.round((avgMonthlyDays / (headcount * 22)) * 100 * 10) / 10,
      trend_direction: trend > 0.5 ? 'increasing' : trend < -0.5 ? 'decreasing' : 'stable',
      time_series: timeSeries,
      forecast,
    };
  });

  // Sort by avg rate descending
  departmentForecasts.sort((a, b) => b.avg_rate_pct - a.avg_rate_pct);

  return {
    success: true,
    data: {
      departments: departmentForecasts,
      period: { from: monthKeys[0], to: monthKeys[monthKeys.length - 1] },
    },
    message: `Prevision d'absenteisme pour ${departmentForecasts.length} departement(s) sur 12 mois glissants.`,
  };
};

// ======================================================================
// ACTION 3: Headcount Forecast
// 3 scenarios (conservative, moderate, optimistic) using budgets + turnover
// ======================================================================

const handleHeadcountForecast = async (supabase: ReturnType<typeof createAuthClient>, companyId: string) => {
  const currentYear = new Date().getFullYear();

  // Fetch headcount budgets
  const { data: budgets, error: budgetErr } = await supabase
    .from('hr_headcount_budgets')
    .select(
      'fiscal_year, department_id, planned_headcount, actual_headcount, planned_payroll_cost, actual_payroll_cost, hr_departments(name)'
    )
    .eq('company_id', companyId)
    .order('fiscal_year', { ascending: false })
    .limit(50);

  if (budgetErr) throw new HttpError(500, `Failed to fetch budgets: ${budgetErr.message}`);

  // Fetch current active headcount
  const { count: currentHeadcount, error: hcErr } = await supabase
    .from('hr_employees')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'active');

  if (hcErr) throw new HttpError(500, `Failed to count employees: ${hcErr.message}`);

  // Fetch terminated in last 12 months for turnover rate
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoff = twelveMonthsAgo.toISOString().split('T')[0];

  const { count: terminatedCount } = await supabase
    .from('hr_employees')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'terminated')
    .gte('termination_date', cutoff);

  const hc = currentHeadcount || 1;
  const terminated = terminatedCount || 0;
  const turnoverRate = Math.round((terminated / hc) * 100 * 10) / 10;

  // Compute average salary from current budgets
  const currentBudgets = (budgets || []).filter((b) => b.fiscal_year === currentYear);
  const totalPlannedPayroll = currentBudgets.reduce((s, b) => s + toNumber(b.planned_payroll_cost), 0);
  const totalPlannedHC = currentBudgets.reduce((s, b) => s + toNumber(b.planned_headcount), 0);
  const avgCostPerHead = totalPlannedHC > 0 ? totalPlannedPayroll / totalPlannedHC : 45000; // fallback

  // Build 3 scenarios for next 3 years
  const scenarios = {
    conservative: {
      label: 'Conservateur',
      growth_rate: -0.02,
      turnover_adjustment: 1.15, // 15% higher turnover than current
      description: 'Gel des embauches, turnover accru, budget reduit.',
    },
    moderate: {
      label: 'Modere',
      growth_rate: 0.05,
      turnover_adjustment: 1.0,
      description: 'Croissance organique, turnover stable.',
    },
    optimistic: {
      label: 'Optimiste',
      growth_rate: 0.12,
      turnover_adjustment: 0.85,
      description: 'Forte croissance, meilleure retention.',
    },
  };

  const forecastYears = [currentYear + 1, currentYear + 2, currentYear + 3];
  const scenarioForecasts: Record<string, unknown[]> = {};

  for (const [key, scenario] of Object.entries(scenarios)) {
    let projectedHC = hc;
    const adjustedTurnover = (turnoverRate / 100) * scenario.turnover_adjustment;

    scenarioForecasts[key] = forecastYears.map((year) => {
      const departures = Math.round(projectedHC * adjustedTurnover);
      const growth = Math.round(projectedHC * scenario.growth_rate);
      const netChange = growth - departures;
      const replacementHires = departures;
      const growthHires = Math.max(0, growth);
      const totalHires = replacementHires + growthHires;

      projectedHC = Math.max(1, projectedHC + netChange + replacementHires);
      const projectedPayroll = Math.round(projectedHC * avgCostPerHead);

      return {
        year,
        projected_headcount: projectedHC,
        departures_estimated: departures,
        hires_needed: totalHires,
        replacement_hires: replacementHires,
        growth_hires: growthHires,
        projected_payroll_cost: projectedPayroll,
        net_change: netChange + replacementHires,
      };
    });
  }

  // Department breakdown from budgets
  const departmentBreakdown = currentBudgets.map((b) => ({
    department: (b as any).hr_departments?.name || 'Non attribue',
    planned_headcount: b.planned_headcount,
    actual_headcount: b.actual_headcount,
    variance: toNumber(b.actual_headcount) - toNumber(b.planned_headcount),
    fill_rate_pct:
      b.planned_headcount > 0 ? Math.round((toNumber(b.actual_headcount) / toNumber(b.planned_headcount)) * 100) : 0,
  }));

  return {
    success: true,
    data: {
      current_state: {
        headcount: hc,
        turnover_rate_pct: turnoverRate,
        terminated_12m: terminated,
        avg_cost_per_head: Math.round(avgCostPerHead),
      },
      scenarios: Object.entries(scenarios).reduce(
        (acc, [key, scenario]) => {
          acc[key] = {
            label: scenario.label,
            description: scenario.description,
            forecast: scenarioForecasts[key],
          };
          return acc;
        },
        {} as Record<string, unknown>
      ),
      department_breakdown: departmentBreakdown,
    },
    message: `Prevision d'effectifs sur 3 ans (3 scenarios). Effectif actuel: ${hc}, turnover: ${turnoverRate}%.`,
  };
};

// ======================================================================
// ACTION 4: Salary Benchmark
// Percentiles p25/p50/p75 per job_title from contract data
// ======================================================================

const handleSalaryBenchmark = async (supabase: ReturnType<typeof createAuthClient>, companyId: string) => {
  // Fetch active employees with active contracts
  const { data: employees, error: empErr } = await supabase
    .from('hr_employees')
    .select(
      'id, job_title, department_id, hire_date, hr_departments(name), hr_employee_contracts(monthly_salary, hourly_rate, pay_basis, status)'
    )
    .eq('company_id', companyId)
    .eq('status', 'active');

  if (empErr) throw new HttpError(500, `Failed to fetch employees: ${empErr.message}`);

  // Build salary data per job title
  const byJobTitle = new Map<
    string,
    {
      salaries: number[];
      department: string;
      tenures: number[];
    }
  >();

  const now = Date.now();

  for (const emp of employees || []) {
    const jobTitle = emp.job_title || 'Non defini';
    const contracts = (emp as any).hr_employee_contracts || [];
    const activeContract = contracts.find((c: any) => c.status === 'active');
    if (!activeContract) continue;

    // Normalize to monthly salary
    let monthlySalary = toNumber(activeContract.monthly_salary);
    if (monthlySalary === 0 && activeContract.pay_basis === 'hourly') {
      monthlySalary = toNumber(activeContract.hourly_rate) * 151.67; // French standard monthly hours
    }
    if (monthlySalary === 0) continue;

    if (!byJobTitle.has(jobTitle)) {
      byJobTitle.set(jobTitle, {
        salaries: [],
        department: (emp as any).hr_departments?.name || 'Non attribue',
        tenures: [],
      });
    }

    const entry = byJobTitle.get(jobTitle)!;
    entry.salaries.push(monthlySalary);

    const hireDate = emp.hire_date ? new Date(emp.hire_date).getTime() : now;
    entry.tenures.push(Math.max(0, (now - hireDate) / (1000 * 60 * 60 * 24 * 30.44)));
  }

  const benchmarks = Array.from(byJobTitle.entries()).map(([jobTitle, data]) => {
    const sorted = [...data.salaries].sort((a, b) => a - b);
    const p25 = percentile(sorted, 25);
    const p50 = percentile(sorted, 50);
    const p75 = percentile(sorted, 75);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    // Spread indicator (how dispersed are salaries)
    const spread = p75 - p25;
    const spreadPct = p50 > 0 ? Math.round((spread / p50) * 100) : 0;

    // Average tenure for context
    const avgTenure =
      data.tenures.length > 0 ? Math.round(data.tenures.reduce((a, b) => a + b, 0) / data.tenures.length) : 0;

    return {
      job_title: jobTitle,
      department: data.department,
      employee_count: sorted.length,
      monthly_salary: {
        p25: Math.round(p25),
        p50: Math.round(p50),
        p75: Math.round(p75),
        avg: Math.round(avg),
        min: Math.round(min),
        max: Math.round(max),
      },
      annual_salary: {
        p25: Math.round(p25 * 12),
        p50: Math.round(p50 * 12),
        p75: Math.round(p75 * 12),
        avg: Math.round(avg * 12),
      },
      spread_pct: spreadPct,
      avg_tenure_months: avgTenure,
      equity_flag: spreadPct > 40 ? 'high_dispersion' : spreadPct > 20 ? 'moderate_dispersion' : 'fair',
    };
  });

  // Sort by employee count descending
  benchmarks.sort((a, b) => b.employee_count - a.employee_count);

  // Company-wide aggregates
  const allSalaries = Array.from(byJobTitle.values())
    .flatMap((d) => d.salaries)
    .sort((a, b) => a - b);
  const companyWide =
    allSalaries.length > 0
      ? {
          total_employees_with_salary: allSalaries.length,
          monthly: {
            p25: Math.round(percentile(allSalaries, 25)),
            p50: Math.round(percentile(allSalaries, 50)),
            p75: Math.round(percentile(allSalaries, 75)),
            avg: Math.round(allSalaries.reduce((a, b) => a + b, 0) / allSalaries.length),
          },
          total_monthly_payroll: Math.round(allSalaries.reduce((a, b) => a + b, 0)),
          total_annual_payroll: Math.round(allSalaries.reduce((a, b) => a + b, 0) * 12),
        }
      : null;

  return {
    success: true,
    data: {
      by_job_title: benchmarks,
      company_wide: companyWide,
    },
    message: `Benchmark salarial pour ${benchmarks.length} poste(s) et ${allSalaries.length} employe(s).`,
  };
};

// ======================================================================
// Main handler
// ======================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const serviceClient = createServiceClient();
  let resolvedUserId = '';
  let creditConsumption = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, data: null, message: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scopedSupabase = createAuthClient(authHeader);
    const authUser = await requireAuthenticatedUser(req);
    resolvedUserId = authUser.id;

    const payload = await req.json();
    const action = (payload?.action || '') as string;

    const validActions: AnalyticsAction[] = [
      'turnover_risk',
      'absenteeism_forecast',
      'headcount_forecast',
      'salary_benchmark',
    ];
    if (!validActions.includes(action as AnalyticsAction)) {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          message: `Action invalide. Actions disponibles: ${validActions.join(', ')}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    const rateCheck = checkRateLimit(`${ANALYTICS_RATE_LIMIT.keyPrefix}:${resolvedUserId}`, ANALYTICS_RATE_LIMIT);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck, corsHeaders);

    const companyId = await resolveActiveCompanyId(scopedSupabase, resolvedUserId, payload?.activeCompanyId);
    if (!companyId) {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          message: 'Aucune entreprise active. Selectionnez une entreprise.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resolvedAction = action as AnalyticsAction;
    const creditCost = await resolveCreditCost(serviceClient as any, resolveAnalyticsOperationCode(resolvedAction));
    creditConsumption = await consumeCredits(serviceClient as any, resolvedUserId, creditCost, 'AI HR Analytics');

    let result: { success: boolean; data: unknown; message: string };

    switch (resolvedAction) {
      case 'turnover_risk':
        result = await handleTurnoverRisk(scopedSupabase, companyId);
        break;
      case 'absenteeism_forecast':
        result = await handleAbsenteeismForecast(scopedSupabase, companyId);
        break;
      case 'headcount_forecast':
        result = await handleHeadcountForecast(scopedSupabase, companyId);
        break;
      case 'salary_benchmark':
        result = await handleSalaryBenchmark(scopedSupabase, companyId);
        break;
      default:
        result = { success: false, data: null, message: 'Action non reconnue.' };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(serviceClient as any, resolvedUserId, creditConsumption, 'AI HR Analytics - error');
      } catch {
        /* ignore secondary failures */
      }
    }

    const status = error instanceof HttpError ? error.status : 500;
    console.error('[ai-hr-analytics] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        message: error instanceof HttpError ? error.message : 'Erreur interne du serveur.',
      }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
