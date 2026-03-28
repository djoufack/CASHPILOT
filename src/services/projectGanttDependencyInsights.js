const DONE_STATUSES = new Set(['completed', 'done', 'closed']);

const normalizeDependencies = (task) => {
  if (Array.isArray(task?.depends_on)) return task.depends_on.filter(Boolean);
  if (Array.isArray(task?.dependency_ids)) return task.dependency_ids.filter(Boolean);
  return [];
};

const hasSchedule = (task) => {
  const start = task?.start_date || task?.started_at;
  const end = task?.end_date || task?.completed_at || task?.due_date;
  return Boolean(start && end);
};

const isTaskDone = (task) => {
  const status = String(task?.status || '').toLowerCase();
  return DONE_STATUSES.has(status);
};

export const buildProjectGanttDependencyInsights = (tasks = []) => {
  const normalizedTasks = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
  const taskById = new Map(normalizedTasks.map((task) => [task.id, task]));
  const inboundCount = new Map();
  const rows = [];

  for (const task of normalizedTasks) {
    const dependencies = normalizeDependencies(task);
    for (const dependencyId of dependencies) {
      inboundCount.set(dependencyId, (inboundCount.get(dependencyId) || 0) + 1);
    }

    const blockingDependencies = dependencies.filter((dependencyId) => {
      const dependencyTask = taskById.get(dependencyId);
      return dependencyTask ? !isTaskDone(dependencyTask) : true;
    });

    rows.push({
      taskId: task.id,
      title: task.title || task.name || task.id,
      status: task.status || 'unknown',
      dependencyCount: dependencies.length,
      blockingDependencyCount: blockingDependencies.length,
      dependencies,
      dependencyTitles: task.dependency_titles || [],
      isBlocked: blockingDependencies.length > 0 && !isTaskDone(task),
      hasSchedule: hasSchedule(task),
    });
  }

  rows.sort((left, right) => {
    if (left.isBlocked !== right.isBlocked) return left.isBlocked ? -1 : 1;
    if (right.dependencyCount !== left.dependencyCount) return right.dependencyCount - left.dependencyCount;
    return String(left.title).localeCompare(String(right.title), 'fr', { sensitivity: 'base' });
  });

  const summary = rows.reduce(
    (accumulator, row) => {
      accumulator.totalTasks += 1;
      accumulator.dependencyLinks += row.dependencyCount;
      if (row.hasSchedule) accumulator.tasksWithSchedule += 1;
      if (row.isBlocked) accumulator.blockedTasks += 1;
      return accumulator;
    },
    {
      totalTasks: 0,
      tasksWithSchedule: 0,
      dependencyLinks: 0,
      blockedTasks: 0,
      independentTasks: 0,
    }
  );

  summary.independentTasks = rows.filter(
    (row) => row.dependencyCount === 0 && (inboundCount.get(row.taskId) || 0) === 0
  ).length;

  return {
    summary,
    rows,
  };
};
