const OVERDUE_DAYS_THRESHOLD = 14;

function toDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function daysBetween(fromDate, toDateValue = new Date()) {
  const date = toDate(fromDate);
  if (!date) return 0;
  const diffMs = toDateValue.getTime() - date.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function employeeName(employee) {
  return employee?.full_name || employee?.id || '-';
}

function buildEmployeeLookup(employees) {
  return new Map((employees || []).map((employee) => [employee.id, employee]));
}

export function buildHrManagerWorkflowInsights({ reviews = [], employees = [] } = {}) {
  const now = new Date();
  const employeeById = buildEmployeeLookup(employees);
  const allReviews = reviews || [];

  const managerQueue = allReviews.filter((review) => review?.status === 'manager_review');
  const hrQueue = allReviews.filter((review) => review?.status === 'hr_review');
  const drafts = allReviews.filter((review) => review?.status === 'employee_draft');
  const completed = allReviews.filter((review) => review?.status === 'completed');

  const priorityReviews = allReviews
    .filter((review) => review?.status === 'manager_review' || review?.status === 'hr_review')
    .map((review) => {
      const startedAt = review.updated_at || review.created_at;
      const daysOpen = daysBetween(startedAt, now);
      const isOverdue = review.status === 'manager_review' && daysOpen > OVERDUE_DAYS_THRESHOLD;

      return {
        id: review.id,
        status: review.status,
        employeeName: employeeName(review.employee || employeeById.get(review.employee_id)),
        reviewerName: employeeName(review.reviewer || employeeById.get(review.reviewer_id)),
        periodYear: review.period_year || '-',
        reviewType: review.review_type || 'annual',
        daysOpen,
        isOverdue,
      };
    })
    .sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'manager_review') return -1;
        if (b.status === 'manager_review') return 1;
      }
      if (b.daysOpen !== a.daysOpen) return b.daysOpen - a.daysOpen;
      return a.employeeName.localeCompare(b.employeeName, 'fr', { sensitivity: 'base' });
    })
    .slice(0, 8);

  const reviewerBuckets = new Map();
  for (const review of managerQueue) {
    const reviewerId = review.reviewer_id || 'unassigned';
    const key = String(reviewerId);
    const bucket = reviewerBuckets.get(key) || {
      reviewerId,
      reviewerName:
        reviewerId === 'unassigned' ? 'Non assigne' : employeeName(review.reviewer || employeeById.get(reviewerId)),
      pendingCount: 0,
      overdueCount: 0,
    };

    const daysOpen = daysBetween(review.updated_at || review.created_at, now);
    const isOverdue = daysOpen > OVERDUE_DAYS_THRESHOLD;

    bucket.pendingCount += 1;
    if (isOverdue) bucket.overdueCount += 1;
    reviewerBuckets.set(key, bucket);
  }

  const reviewerLoad = Array.from(reviewerBuckets.values()).sort((a, b) => {
    if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
    if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
    return a.reviewerName.localeCompare(b.reviewerName, 'fr', { sensitivity: 'base' });
  });

  const overdueManagerCount = managerQueue.filter(
    (review) => daysBetween(review.updated_at || review.created_at, now) > OVERDUE_DAYS_THRESHOLD
  ).length;

  let workflowStatus = 'watch';
  if (allReviews.length === 0) {
    workflowStatus = 'no_data';
  } else if (overdueManagerCount === 0 && managerQueue.length <= 3) {
    workflowStatus = 'healthy';
  } else if (overdueManagerCount >= 3 || managerQueue.length > 10) {
    workflowStatus = 'critical';
  }

  const recommendations = [];
  if (managerQueue.length > 0) {
    recommendations.push('Traiter en priorite la file manager_review pour fluidifier la revue RH.');
  }
  if (overdueManagerCount > 0) {
    recommendations.push('Declencher des relances managers sur les entretiens en retard de validation.');
  }
  if (hrQueue.length > 0) {
    recommendations.push('Planifier une session RH de signature pour cloturer la file hr_review.');
  }
  if (recommendations.length === 0 && allReviews.length > 0) {
    recommendations.push('Workflow stable: conserver un suivi hebdomadaire des files managers et RH.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Creer une premiere campagne pour activer le workflow manager.');
  }

  return {
    totals: {
      allReviews: allReviews.length,
      draftCount: drafts.length,
      managerQueueCount: managerQueue.length,
      overdueManagerCount,
      hrQueueCount: hrQueue.length,
      completedCount: completed.length,
    },
    priorityReviews,
    reviewerLoad,
    workflowStatus,
    recommendations,
  };
}

export default buildHrManagerWorkflowInsights;
