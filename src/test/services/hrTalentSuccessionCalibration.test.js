import { describe, expect, it } from 'vitest';
import { buildTalentSuccessionCalibrationInsights } from '@/services/hrTalentSuccessionCalibration';

describe('buildTalentSuccessionCalibrationInsights', () => {
  it('computes coverage and high-potential usage from succession plans', () => {
    const employees = [
      { id: 'emp-1', full_name: 'Alice Martin', job_title: 'Finance Manager' },
      { id: 'emp-2', full_name: 'Benoit Diallo', job_title: 'HRBP' },
      { id: 'emp-3', full_name: 'Carla N.', job_title: 'Controller' },
    ];

    const reviews = [
      {
        employee_id: 'emp-1',
        performance_rating: 'Exceptionnel',
        nine_box_potential: 'Eleve',
      },
      {
        employee_id: 'emp-2',
        performance_rating: 'Superieur',
        nine_box_potential: 'Eleve',
      },
    ];

    const successionPlans = [
      {
        id: 'plan-1',
        position_title: 'Directeur Financier',
        criticality: 'critical',
        risk_of_loss: 'high',
        successors: [
          { employee_id: 'emp-1', readiness: 'ready_now' },
          { employee_id: 'emp-3', readiness: 'ready_1_2y' },
        ],
      },
      {
        id: 'plan-2',
        position_title: 'DRH',
        criticality: 'high',
        risk_of_loss: 'medium',
        successors: [{ employee_id: 'emp-2', readiness: 'not_ready' }],
      },
    ];

    const insights = buildTalentSuccessionCalibrationInsights({
      employees,
      reviews,
      successionPlans,
    });

    expect(insights.coverage.criticalCoveragePct).toBe(100);
    expect(insights.coverage.criticalReadyNowPct).toBe(50);
    expect(insights.coverage.highPotentialUsagePct).toBe(100);
    expect(insights.gaps.criticalWithoutReadyNow).toHaveLength(1);
    expect(insights.gaps.unassignedHighPotential).toHaveLength(0);
    expect(insights.topBenchCandidates[0].employeeId).toBe('emp-1');
    expect(insights.calibrationStatus).toBe('watch');
  });

  it('flags unassigned high potentials and critical gaps', () => {
    const employees = [
      { id: 'emp-1', full_name: 'Alice Martin', job_title: 'Finance Manager' },
      { id: 'emp-2', full_name: 'Benoit Diallo', job_title: 'HRBP' },
    ];

    const reviews = [
      {
        employee_id: 'emp-1',
        performance_rating: 'Superieur',
        nine_box_potential: 'Eleve',
      },
      {
        employee_id: 'emp-2',
        performance_rating: 'Exceptionnel',
        nine_box_potential: 'Eleve',
      },
    ];

    const successionPlans = [
      {
        id: 'plan-1',
        position_title: 'Directeur Financier',
        criticality: 'critical',
        risk_of_loss: 'high',
        successors: [],
      },
    ];

    const insights = buildTalentSuccessionCalibrationInsights({
      employees,
      reviews,
      successionPlans,
    });

    expect(insights.coverage.criticalCoveragePct).toBe(0);
    expect(insights.coverage.criticalReadyNowPct).toBe(0);
    expect(insights.gaps.criticalWithoutSuccessor).toHaveLength(1);
    expect(insights.gaps.unassignedHighPotential).toHaveLength(2);
    expect(insights.calibrationStatus).toBe('critical');
    expect(insights.recommendations.length).toBeGreaterThanOrEqual(2);
  });

  it('returns no_data when there is no calibration perimeter yet', () => {
    const insights = buildTalentSuccessionCalibrationInsights({
      employees: [],
      reviews: [],
      successionPlans: [],
    });

    expect(insights.calibrationStatus).toBe('no_data');
    expect(insights.coverage.criticalCoveragePct).toBe(0);
    expect(insights.recommendations[0]).toMatch(/Creer des plans de succession/i);
  });
});
