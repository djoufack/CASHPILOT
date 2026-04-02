import { describe, it, expect } from 'vitest';
import {
  buildContinuousSeries,
  buildContinuousAxisTicks,
  formatContinuousTooltipLabel,
} from '@/utils/continuousChartSeries';

// ============================================================================
// buildContinuousSeries
// ============================================================================
describe('buildContinuousSeries', () => {
  it('should return empty array for empty points', () => {
    expect(buildContinuousSeries([], ['value'])).toEqual([]);
  });

  it('should return empty array for non-array input', () => {
    expect(buildContinuousSeries(null, ['value'])).toEqual([]);
  });

  it('should handle single point', () => {
    const points = [{ name: 'Jan', value: 100 }];
    const result = buildContinuousSeries(points, ['value']);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(100);
    expect(result[0].x).toBe(0);
    expect(result[0].isInterpolated).toBe(false);
  });

  it('should interpolate between two points', () => {
    const points = [
      { name: 'Jan', value: 100 },
      { name: 'Feb', value: 200 },
    ];
    const result = buildContinuousSeries(points, ['value'], 4);
    // Should have 4 steps for the segment + 1 for the last point = 5
    expect(result).toHaveLength(5);

    // First point should be exact
    expect(result[0].value).toBe(100);
    expect(result[0].isInterpolated).toBe(false);

    // Last point should be exact
    expect(result[result.length - 1].value).toBe(200);
    expect(result[result.length - 1].isInterpolated).toBe(false);

    // Intermediate points should be interpolated
    expect(result[1].isInterpolated).toBe(true);
  });

  it('should include startName and endName on interpolated points', () => {
    const points = [
      { name: 'Q1', value: 50 },
      { name: 'Q2', value: 150 },
    ];
    const result = buildContinuousSeries(points, ['value'], 2);
    expect(result[1].startName).toBe('Q1');
    expect(result[1].endName).toBe('Q2');
  });

  it('should handle multiple numeric keys', () => {
    const points = [
      { name: 'A', revenue: 100, expenses: 80 },
      { name: 'B', revenue: 200, expenses: 120 },
    ];
    const result = buildContinuousSeries(points, ['revenue', 'expenses'], 2);
    expect(result[0].revenue).toBe(100);
    expect(result[0].expenses).toBe(80);
    expect(result[result.length - 1].revenue).toBe(200);
    expect(result[result.length - 1].expenses).toBe(120);
  });

  it('should convert non-numeric values to 0', () => {
    const points = [
      { name: 'A', value: 'abc' },
      { name: 'B', value: 100 },
    ];
    const result = buildContinuousSeries(points, ['value'], 2);
    expect(result[0].value).toBe(0);
  });

  it('should handle three points with multiple segments', () => {
    const points = [
      { name: 'Jan', value: 100 },
      { name: 'Feb', value: 200 },
      { name: 'Mar', value: 150 },
    ];
    const result = buildContinuousSeries(points, ['value'], 3);
    // 2 segments * 3 steps + 1 final = 7
    expect(result).toHaveLength(7);
    expect(result[0].value).toBe(100);
    expect(result[result.length - 1].value).toBe(150);
  });

  it('should enforce minimum 2 steps per segment', () => {
    const points = [
      { name: 'A', value: 10 },
      { name: 'B', value: 20 },
    ];
    const result = buildContinuousSeries(points, ['value'], 1);
    expect(result.length).toBeGreaterThanOrEqual(3); // At least 2 steps + final
  });
});

// ============================================================================
// buildContinuousAxisTicks
// ============================================================================
describe('buildContinuousAxisTicks', () => {
  it('should generate ticks for each point index', () => {
    const points = ['A', 'B', 'C', 'D'];
    expect(buildContinuousAxisTicks(points)).toEqual([0, 1, 2, 3]);
  });

  it('should return empty array for no points', () => {
    expect(buildContinuousAxisTicks([])).toEqual([]);
  });

  it('should return [0] for single point', () => {
    expect(buildContinuousAxisTicks(['A'])).toEqual([0]);
  });
});

// ============================================================================
// formatContinuousTooltipLabel
// ============================================================================
describe('formatContinuousTooltipLabel', () => {
  it('should return name for non-interpolated point', () => {
    expect(formatContinuousTooltipLabel({
      name: 'January',
      isInterpolated: false,
    })).toBe('January');
  });

  it('should return interpolation label for interpolated point', () => {
    expect(formatContinuousTooltipLabel({
      startName: 'Jan',
      endName: 'Feb',
      progress: 0.5,
      isInterpolated: true,
    })).toBe('Jan -> Feb (50%)');
  });

  it('should return empty string for null point', () => {
    expect(formatContinuousTooltipLabel(null)).toBe('');
  });

  it('should return empty string for undefined point', () => {
    expect(formatContinuousTooltipLabel(undefined)).toBe('');
  });

  it('should use startName as fallback for non-interpolated point without name', () => {
    expect(formatContinuousTooltipLabel({
      startName: 'Q1',
      isInterpolated: false,
    })).toBe('Q1');
  });

  it('should round progress percentage', () => {
    expect(formatContinuousTooltipLabel({
      startName: 'A',
      endName: 'B',
      progress: 0.333,
      isInterpolated: true,
    })).toBe('A -> B (33%)');
  });
});
