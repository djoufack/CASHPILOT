const STEP_STATUS_PENDING = 'pending';
const STEP_STATUS_APPROVED = 'approved';
const STEP_STATUS_REJECTED = 'rejected';

const toInt = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const normalizeApprovalSteps = (steps = []) =>
  (Array.isArray(steps) ? steps : [])
    .filter((step) => step && toInt(step.level, 0) > 0)
    .map((step) => ({
      ...step,
      level: toInt(step.level, 1),
      status: step.status || STEP_STATUS_PENDING,
    }))
    .sort((left, right) => left.level - right.level);

export const getCurrentPendingApprovalStep = (steps = []) =>
  normalizeApprovalSteps(steps).find((step) => step.status === STEP_STATUS_PENDING) || null;

export const getApprovalWorkflowSummary = (steps = [], fallbackStage = 1) => {
  const normalizedSteps = normalizeApprovalSteps(steps);
  const requiredLevels = Math.max(normalizedSteps.length, 1);
  const rejectedStep = normalizedSteps.find((step) => step.status === STEP_STATUS_REJECTED) || null;
  const pendingStep = normalizedSteps.find((step) => step.status === STEP_STATUS_PENDING) || null;
  const approvedLevels = normalizedSteps.filter((step) => step.status === STEP_STATUS_APPROVED).length;
  const rejectedLevels = normalizedSteps.filter((step) => step.status === STEP_STATUS_REJECTED).length;

  if (rejectedStep) {
    return {
      status: STEP_STATUS_REJECTED,
      requiredLevels,
      currentLevel: rejectedStep.level,
      approvedLevels,
      rejectedLevels,
      pendingStep: null,
      steps: normalizedSteps,
    };
  }

  if (pendingStep) {
    return {
      status: STEP_STATUS_PENDING,
      requiredLevels,
      currentLevel: pendingStep.level,
      approvedLevels,
      rejectedLevels,
      pendingStep,
      steps: normalizedSteps,
    };
  }

  if (normalizedSteps.length > 0) {
    return {
      status: STEP_STATUS_APPROVED,
      requiredLevels,
      currentLevel: requiredLevels,
      approvedLevels,
      rejectedLevels,
      pendingStep: null,
      steps: normalizedSteps,
    };
  }

  return {
    status: STEP_STATUS_PENDING,
    requiredLevels,
    currentLevel: toInt(fallbackStage, 1),
    approvedLevels,
    rejectedLevels,
    pendingStep: null,
    steps: normalizedSteps,
  };
};
