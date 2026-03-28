const HIGH_PERFORMANCE_LABELS = new Set(['Superieur', 'Exceptionnel']);
const HIGH_POTENTIAL_LABEL = 'Eleve';

const READINESS_SCORES = {
  not_ready: 0,
  ready_1_2y: 0.65,
  ready_now: 1,
};

const RISK_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 3,
};

const CRITICALITY_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function toPercent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((Number(numerator) / Number(denominator)) * 1000) / 10;
}

function normalizeSuccessors(plan) {
  if (!Array.isArray(plan?.successors)) return [];
  return plan.successors.filter((entry) => entry && entry.employee_id);
}

function isCriticalPlan(plan) {
  return plan?.criticality === 'high' || plan?.criticality === 'critical';
}

function buildEmployeeLookup(employees) {
  return new Map((employees || []).map((employee) => [employee.id, employee]));
}

function employeeDisplay(employee) {
  if (!employee) {
    return { name: '-', jobTitle: '' };
  }

  return {
    name: employee.full_name || employee.id || '-',
    jobTitle: employee.job_title || '',
  };
}

export function buildTalentSuccessionCalibrationInsights({ reviews = [], successionPlans = [], employees = [] } = {}) {
  const employeeById = buildEmployeeLookup(employees);
  const highPotentialIds = new Set(
    (reviews || [])
      .filter(
        (review) =>
          review?.nine_box_potential === HIGH_POTENTIAL_LABEL &&
          HIGH_PERFORMANCE_LABELS.has(review?.performance_rating || '')
      )
      .map((review) => review.employee_id)
      .filter(Boolean)
  );

  const plans = successionPlans || [];
  const totalPlans = plans.length;
  const criticalPlans = plans.filter(isCriticalPlan);
  const criticalCount = criticalPlans.length;

  const successorAssignments = [];
  const criticalWithoutSuccessor = [];
  const criticalWithoutReadyNow = [];

  let exposureScoreRaw = 0;
  let readinessScoreTotal = 0;
  let readinessScoreDenominator = 0;

  for (const plan of plans) {
    const successors = normalizeSuccessors(plan);
    const readyNowCount = successors.filter((entry) => entry.readiness === 'ready_now').length;
    const readySoonCount = successors.filter((entry) => entry.readiness === 'ready_1_2y').length;

    for (const successor of successors) {
      const readiness = successor.readiness || 'not_ready';
      readinessScoreTotal += READINESS_SCORES[readiness] || 0;
      readinessScoreDenominator += 1;

      successorAssignments.push({
        employeeId: successor.employee_id,
        readiness,
        planId: plan.id,
        positionTitle: plan.position_title || '',
        criticality: plan.criticality || 'medium',
      });
    }

    if (isCriticalPlan(plan)) {
      if (successors.length === 0) {
        criticalWithoutSuccessor.push({
          planId: plan.id,
          positionTitle: plan.position_title || '-',
          criticality: plan.criticality || 'high',
          riskOfLoss: plan.risk_of_loss || 'low',
          successorCount: 0,
          readyNowCount: 0,
        });
      }

      if (readyNowCount === 0) {
        criticalWithoutReadyNow.push({
          planId: plan.id,
          positionTitle: plan.position_title || '-',
          criticality: plan.criticality || 'high',
          riskOfLoss: plan.risk_of_loss || 'low',
          successorCount: successors.length,
          readyNowCount,
          readySoonCount,
        });
      }
    }

    const criticalityWeight = CRITICALITY_WEIGHTS[plan.criticality] || CRITICALITY_WEIGHTS.medium;
    const riskWeight = RISK_WEIGHTS[plan.risk_of_loss] || RISK_WEIGHTS.low;
    const mitigationFactor = readyNowCount > 0 ? 0.25 : 1;
    exposureScoreRaw += criticalityWeight * riskWeight * mitigationFactor;
  }

  const assignedHighPotentialIds = new Set(
    successorAssignments
      .map((assignment) => assignment.employeeId)
      .filter((employeeId) => highPotentialIds.has(employeeId))
  );

  const unassignedHighPotential = Array.from(highPotentialIds)
    .filter((employeeId) => !assignedHighPotentialIds.has(employeeId))
    .map((employeeId) => {
      const employee = employeeById.get(employeeId);
      const display = employeeDisplay(employee);
      return {
        employeeId,
        name: display.name,
        jobTitle: display.jobTitle,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

  const benchByEmployee = new Map();
  for (const assignment of successorAssignments) {
    const current = benchByEmployee.get(assignment.employeeId) || {
      employeeId: assignment.employeeId,
      planCount: 0,
      readyNowCount: 0,
      readySoonCount: 0,
      criticalPlanCount: 0,
    };

    current.planCount += 1;
    if (assignment.readiness === 'ready_now') current.readyNowCount += 1;
    if (assignment.readiness === 'ready_1_2y') current.readySoonCount += 1;
    if (assignment.criticality === 'high' || assignment.criticality === 'critical') current.criticalPlanCount += 1;

    benchByEmployee.set(assignment.employeeId, current);
  }

  const topBenchCandidates = Array.from(benchByEmployee.values())
    .map((entry) => {
      const employee = employeeById.get(entry.employeeId);
      const display = employeeDisplay(employee);
      return {
        ...entry,
        name: display.name,
        jobTitle: display.jobTitle,
      };
    })
    .sort((a, b) => {
      if (b.readyNowCount !== a.readyNowCount) return b.readyNowCount - a.readyNowCount;
      if (b.criticalPlanCount !== a.criticalPlanCount) return b.criticalPlanCount - a.criticalPlanCount;
      if (b.planCount !== a.planCount) return b.planCount - a.planCount;
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    })
    .slice(0, 5);

  const criticalCoveredCount = criticalPlans.filter((plan) => normalizeSuccessors(plan).length > 0).length;
  const criticalReadyNowCount = criticalPlans.filter((plan) =>
    normalizeSuccessors(plan).some((entry) => entry.readiness === 'ready_now')
  ).length;

  const highPotentialCount = highPotentialIds.size;
  const highPotentialAssignedCount = assignedHighPotentialIds.size;

  const criticalCoveragePct = toPercent(criticalCoveredCount, criticalCount);
  const criticalReadyNowPct = toPercent(criticalReadyNowCount, criticalCount);
  const highPotentialUsagePct = toPercent(highPotentialAssignedCount, highPotentialCount);
  const readinessIndex = toPercent(readinessScoreTotal, readinessScoreDenominator);

  const plansAtRiskCount = criticalWithoutReadyNow.filter((plan) => plan.riskOfLoss === 'high').length;

  let calibrationStatus = 'watch';
  if (totalPlans === 0 || (criticalCount === 0 && highPotentialCount === 0)) {
    calibrationStatus = 'no_data';
  } else if (criticalReadyNowPct >= 70 && highPotentialUsagePct >= 50 && plansAtRiskCount === 0) {
    calibrationStatus = 'aligned';
  } else if (criticalReadyNowPct < 40 || plansAtRiskCount >= 2) {
    calibrationStatus = 'critical';
  }

  const recommendations = [];
  if (criticalWithoutReadyNow.length > 0) {
    recommendations.push('Prioriser un successeur pret pour chaque poste critique non couvert en ready-now.');
  }
  if (unassignedHighPotential.length > 0) {
    recommendations.push('Affecter les hauts potentiels non mobilises sur des plans de releve prioritaires.');
  }
  if (plansAtRiskCount > 0) {
    recommendations.push(
      'Lancer des plans de retention cibles pour les postes critiques avec risque de vacance eleve.'
    );
  }
  if (recommendations.length === 0 && totalPlans > 0) {
    recommendations.push('Maintenir la calibration trimestrielle pour conserver la couverture talent/succession.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Creer des plans de succession pour etablir une base de calibration exploitable.');
  }

  return {
    totals: {
      plans: totalPlans,
      criticalPlans: criticalCount,
      employees: (employees || []).length,
      highPotentials: highPotentialCount,
      successors: successorAssignments.length,
    },
    coverage: {
      criticalCoveredCount,
      criticalReadyNowCount,
      highPotentialAssignedCount,
      criticalCoveragePct,
      criticalReadyNowPct,
      highPotentialUsagePct,
    },
    scores: {
      readinessIndex,
      exposureScore: Math.round(exposureScoreRaw * 10) / 10,
    },
    gaps: {
      criticalWithoutSuccessor,
      criticalWithoutReadyNow,
      unassignedHighPotential,
    },
    topBenchCandidates,
    plansAtRiskCount,
    calibrationStatus,
    recommendations,
  };
}

export default buildTalentSuccessionCalibrationInsights;
