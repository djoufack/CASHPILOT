const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const lerp = (start, end, progress) => start + (end - start) * progress;

export const buildContinuousSeries = (points = [], numericKeys = [], stepsPerSegment = 24) => {
  if (!Array.isArray(points) || points.length === 0) {
    return [];
  }

  if (points.length === 1) {
    const onlyPoint = points[0];
    const row = {
      ...onlyPoint,
      x: 0,
      startName: onlyPoint.name,
      endName: onlyPoint.name,
      progress: 0,
      isInterpolated: false,
    };

    for (const key of numericKeys) {
      row[key] = toNumber(onlyPoint[key]);
    }

    return [row];
  }

  const safeSteps = Math.max(2, Math.floor(stepsPerSegment));
  const rows = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];

    for (let step = 0; step < safeSteps; step += 1) {
      const progress = step / safeSteps;
      const row = {
        ...start,
        x: index + progress,
        startName: start.name,
        endName: end.name,
        progress,
        isInterpolated: progress > 0 && progress < 1,
      };

      for (const key of numericKeys) {
        row[key] = lerp(toNumber(start[key]), toNumber(end[key]), progress);
      }

      rows.push(row);
    }
  }

  const lastPoint = points[points.length - 1];
  const lastRow = {
    ...lastPoint,
    x: points.length - 1,
    startName: lastPoint.name,
    endName: lastPoint.name,
    progress: 1,
    isInterpolated: false,
  };

  for (const key of numericKeys) {
    lastRow[key] = toNumber(lastPoint[key]);
  }

  rows.push(lastRow);
  return rows;
};

export const buildContinuousAxisTicks = (points = []) =>
  Array.from({ length: points.length }, (_, index) => index);

export const formatContinuousTooltipLabel = (point) => {
  if (!point) {
    return '';
  }

  if (!point.isInterpolated) {
    return point.name || point.startName || '';
  }

  const percentage = Math.round(toNumber(point.progress) * 100);
  return `${point.startName} -> ${point.endName} (${percentage}%)`;
};
