import { describe, expect, it } from 'vitest';
import {
  buildContinuousAxisTicks,
  buildContinuousSeries,
  formatContinuousTooltipLabel,
} from '@/utils/continuousChartSeries';

describe('continuousChartSeries', () => {
  it('returns an empty series when points are invalid', () => {
    expect(buildContinuousSeries(null, ['value'])).toEqual([]);
    expect(buildContinuousSeries([], ['value'])).toEqual([]);
  });

  it('returns a normalized single-point series', () => {
    const [row] = buildContinuousSeries([{ name: 'Jan', value: '42' }], ['value']);

    expect(row).toMatchObject({
      name: 'Jan',
      x: 0,
      startName: 'Jan',
      endName: 'Jan',
      progress: 0,
      isInterpolated: false,
      value: 42,
    });
  });

  it('builds an interpolated multi-point series with safe step normalization', () => {
    const points = [
      { name: 'Jan', amount: 10, margin: 0.1 },
      { name: 'Feb', amount: 20, margin: 0.2 },
      { name: 'Mar', amount: 10, margin: 0.05 },
    ];

    const rows = buildContinuousSeries(points, ['amount', 'margin'], 1);

    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      name: 'Jan',
      startName: 'Jan',
      endName: 'Feb',
      progress: 0,
      isInterpolated: false,
    });
    expect(rows.at(-1)).toMatchObject({
      name: 'Mar',
      x: 2,
      startName: 'Mar',
      endName: 'Mar',
      progress: 1,
      isInterpolated: false,
      amount: 10,
      margin: 0.05,
    });

    const middle = rows.find((row) => row.progress > 0 && row.progress < 1);
    expect(middle.isInterpolated).toBe(true);
    expect(Number.isFinite(middle.amount)).toBe(true);
    expect(Number.isFinite(middle.margin)).toBe(true);
  });

  it('keeps flat segments stable and finite', () => {
    const points = [
      { name: 'Q1', metric: 100 },
      { name: 'Q2', metric: 100 },
      { name: 'Q3', metric: 100 },
    ];

    const rows = buildContinuousSeries(points, ['metric'], 4);
    expect(rows).toHaveLength(9);
    expect(rows.every((row) => Number.isFinite(row.metric))).toBe(true);
    expect(rows.every((row) => row.metric === 100)).toBe(true);
  });

  it('builds axis ticks and tooltip labels', () => {
    const ticks = buildContinuousAxisTicks([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    expect(ticks).toEqual([0, 1, 2]);

    expect(formatContinuousTooltipLabel(null)).toBe('');
    expect(formatContinuousTooltipLabel({ isInterpolated: false, name: 'Jan' })).toBe('Jan');
    expect(
      formatContinuousTooltipLabel({
        isInterpolated: true,
        startName: 'Jan',
        endName: 'Feb',
        progress: 0.25,
      })
    ).toBe('Jan -> Feb (25%)');
  });
});
