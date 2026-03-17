import { describe, it, expect } from 'vitest';
import { PAYROLL_STATUSES, ABSENCE_STATUSES } from '@/config/statusMappings';

// ============================================================================
// Regression: Status hardcodes moved to centralized statusMappings.js
// Bug: Statuses were hardcoded inline in page components, leading to
//      inconsistencies and ENF-1 violations. Now all status definitions live
//      in src/config/statusMappings.js as the single source of truth.
// ============================================================================

const REQUIRED_PAYROLL_KEYS = ['label', 'bg', 'text', 'border', 'dot', 'chartFill'];
const REQUIRED_ABSENCE_KEYS = ['label', 'dot', 'text', 'bg'];

// ---------------------------------------------------------------------------
// PAYROLL_STATUSES
// ---------------------------------------------------------------------------
describe('PAYROLL_STATUSES (regression: centralized status config)', () => {
  it('should export a non-empty PAYROLL_STATUSES object', () => {
    expect(PAYROLL_STATUSES).toBeDefined();
    expect(typeof PAYROLL_STATUSES).toBe('object');
    expect(Object.keys(PAYROLL_STATUSES).length).toBeGreaterThan(0);
  });

  it('should contain the expected payroll status keys', () => {
    const expected = ['draft', 'calculated', 'validated', 'exported'];
    for (const key of expected) {
      expect(PAYROLL_STATUSES).toHaveProperty(key);
    }
  });

  it.each(Object.entries(PAYROLL_STATUSES))(
    'status "%s" should have all required visual keys',
    (_statusName, statusConfig) => {
      for (const key of REQUIRED_PAYROLL_KEYS) {
        expect(statusConfig).toHaveProperty(key);
        expect(typeof statusConfig[key]).toBe('string');
        expect(statusConfig[key].length).toBeGreaterThan(0);
      }
    }
  );

  it('should have non-empty label for every payroll status', () => {
    for (const [name, config] of Object.entries(PAYROLL_STATUSES)) {
      expect(config.label, `${name}.label should be a non-empty string`).toBeTruthy();
    }
  });

  it('should have valid Tailwind bg class patterns', () => {
    for (const [name, config] of Object.entries(PAYROLL_STATUSES)) {
      expect(config.bg, `${name}.bg should start with "bg-"`).toMatch(/^bg-/);
    }
  });

  it('should have valid Tailwind text class patterns', () => {
    for (const [name, config] of Object.entries(PAYROLL_STATUSES)) {
      expect(config.text, `${name}.text should start with "text-"`).toMatch(/^text-/);
    }
  });

  it('should have valid chartFill rgba values', () => {
    for (const [name, config] of Object.entries(PAYROLL_STATUSES)) {
      expect(config.chartFill, `${name}.chartFill should be an rgba() color`).toMatch(/^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
    }
  });
});

// ---------------------------------------------------------------------------
// ABSENCE_STATUSES
// ---------------------------------------------------------------------------
describe('ABSENCE_STATUSES (regression: centralized status config)', () => {
  it('should export a non-empty ABSENCE_STATUSES object', () => {
    expect(ABSENCE_STATUSES).toBeDefined();
    expect(typeof ABSENCE_STATUSES).toBe('object');
    expect(Object.keys(ABSENCE_STATUSES).length).toBeGreaterThan(0);
  });

  it('should contain the expected absence status keys', () => {
    const expected = ['pending', 'approved', 'rejected', 'cancelled'];
    for (const key of expected) {
      expect(ABSENCE_STATUSES).toHaveProperty(key);
    }
  });

  it.each(Object.entries(ABSENCE_STATUSES))(
    'status "%s" should have all required visual keys',
    (_statusName, statusConfig) => {
      for (const key of REQUIRED_ABSENCE_KEYS) {
        expect(statusConfig).toHaveProperty(key);
        expect(typeof statusConfig[key]).toBe('string');
        expect(statusConfig[key].length).toBeGreaterThan(0);
      }
    }
  );

  it('should have non-empty label for every absence status', () => {
    for (const [name, config] of Object.entries(ABSENCE_STATUSES)) {
      expect(config.label, `${name}.label should be a non-empty string`).toBeTruthy();
    }
  });

  it('should not have any undefined or null values in status configs', () => {
    for (const [name, config] of Object.entries(ABSENCE_STATUSES)) {
      for (const [key, value] of Object.entries(config)) {
        expect(value, `${name}.${key} must not be null/undefined`).not.toBeNull();
        expect(value, `${name}.${key} must not be null/undefined`).not.toBeUndefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: no accidental collisions
// ---------------------------------------------------------------------------
describe('Status mappings cross-cutting checks', () => {
  it('payroll and absence status keys should not overlap accidentally', () => {
    // They can share names (e.g. both could have "draft"), but we verify
    // each mapping is independently valid — no copy-paste confusion.
    const payrollLabels = Object.values(PAYROLL_STATUSES).map((c) => c.label);
    const absenceLabels = Object.values(ABSENCE_STATUSES).map((c) => c.label);
    // Labels should be unique within each mapping
    expect(new Set(payrollLabels).size).toBe(payrollLabels.length);
    expect(new Set(absenceLabels).size).toBe(absenceLabels.length);
  });
});
