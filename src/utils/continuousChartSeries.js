const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildMonotoneSlopes = (values = []) => {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  if (values.length === 1) {
    return [0];
  }

  const deltas = Array.from({ length: values.length - 1 }, (_, index) => values[index + 1] - values[index]);
  const slopes = Array(values.length).fill(0);

  slopes[0] = deltas[0];
  slopes[values.length - 1] = deltas[deltas.length - 1];

  for (let index = 1; index < values.length - 1; index += 1) {
    slopes[index] = (deltas[index - 1] + deltas[index]) / 2;
  }

  for (let index = 0; index < deltas.length; index += 1) {
    const delta = deltas[index];

    if (delta === 0) {
      slopes[index] = 0;
      slopes[index + 1] = 0;
      continue;
    }

    if (Math.sign(slopes[index]) !== Math.sign(delta)) {
      slopes[index] = 0;
    }

    if (Math.sign(slopes[index + 1]) !== Math.sign(delta)) {
      slopes[index + 1] = 0;
    }

    const a = slopes[index] / delta;
    const b = slopes[index + 1] / delta;
    const sum = a * a + b * b;

    if (sum > 9) {
      const scale = 3 / Math.sqrt(sum);
      slopes[index] = scale * a * delta;
      slopes[index + 1] = scale * b * delta;
    }
  }

  return slopes;
};

const interpolateMonotone = (values, slopes, segmentIndex, progress) => {
  const start = values[segmentIndex];
  const end = values[segmentIndex + 1];
  const startSlope = slopes[segmentIndex];
  const endSlope = slopes[segmentIndex + 1];
  const t2 = progress * progress;
  const t3 = t2 * progress;

  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + progress;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  return h00 * start + h10 * startSlope + h01 * end + h11 * endSlope;
};

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
  const seriesByKey = Object.fromEntries(
    numericKeys.map((key) => [key, points.map((point) => toNumber(point[key]))])
  );
  const slopesByKey = Object.fromEntries(
    numericKeys.map((key) => [key, buildMonotoneSlopes(seriesByKey[key])])
  );
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
        row[key] = interpolateMonotone(seriesByKey[key], slopesByKey[key], index, progress);
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
