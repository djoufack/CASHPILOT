const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function buildAccountantCollaborationTaskInsights(tasks = [], now = new Date()) {
  const rows = Array.isArray(tasks) ? tasks : [];
  const nowDate = toDate(now) || new Date();

  const totalCount = rows.length;
  const todoCount = rows.filter((task) => task?.status === 'todo').length;
  const inReviewCount = rows.filter((task) => task?.status === 'in_review').length;
  const blockedCount = rows.filter((task) => task?.status === 'blocked').length;
  const doneCount = rows.filter((task) => task?.status === 'done').length;

  const overdueCount = rows.filter((task) => {
    if (task?.status === 'done') return false;
    const dueDate = toDate(task?.due_date);
    return dueDate && dueDate < nowDate;
  }).length;

  let status = 'ready';
  if (blockedCount > 0) {
    status = 'critical';
  } else if (todoCount > 0 || inReviewCount > 0 || overdueCount > 0) {
    status = 'attention';
  }

  const recommendations = [];
  if (overdueCount > 0) {
    recommendations.push('Traiter les taches en retard avant la prochaine revue comptable.');
  }
  if (blockedCount > 0) {
    recommendations.push('Lever les blocages pour fluidifier la collaboration expert-comptable.');
  }

  return {
    totalCount,
    todoCount,
    inReviewCount,
    blockedCount,
    doneCount,
    overdueCount,
    status,
    recommendations,
  };
}

export default buildAccountantCollaborationTaskInsights;
