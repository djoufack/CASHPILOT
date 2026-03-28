import { describe, expect, it } from 'vitest';
import {
  getApprovalWorkflowSummary,
  getCurrentPendingApprovalStep,
  normalizeApprovalSteps,
} from '@/services/supplierApprovalWorkflow';

describe('supplierApprovalWorkflow', () => {
  it('normalizes and sorts steps by level', () => {
    const steps = normalizeApprovalSteps([
      { level: 3, status: 'pending' },
      { level: 1, status: 'approved' },
      { level: 2, status: 'approved' },
    ]);

    expect(steps.map((step) => step.level)).toEqual([1, 2, 3]);
    expect(steps[0].status).toBe('approved');
  });

  it('returns current pending step', () => {
    const pendingStep = getCurrentPendingApprovalStep([
      { level: 1, status: 'approved' },
      { level: 2, status: 'pending' },
      { level: 3, status: 'pending' },
    ]);

    expect(pendingStep?.level).toBe(2);
  });

  it('computes summary for pending multilevel workflow', () => {
    const summary = getApprovalWorkflowSummary([
      { level: 1, status: 'approved' },
      { level: 2, status: 'pending' },
    ]);

    expect(summary.status).toBe('pending');
    expect(summary.requiredLevels).toBe(2);
    expect(summary.currentLevel).toBe(2);
    expect(summary.approvedLevels).toBe(1);
  });

  it('computes summary for rejected workflow', () => {
    const summary = getApprovalWorkflowSummary([
      { level: 1, status: 'approved' },
      { level: 2, status: 'rejected' },
    ]);

    expect(summary.status).toBe('rejected');
    expect(summary.currentLevel).toBe(2);
    expect(summary.rejectedLevels).toBe(1);
  });

  it('computes summary for fully approved workflow', () => {
    const summary = getApprovalWorkflowSummary([
      { level: 1, status: 'approved' },
      { level: 2, status: 'approved' },
    ]);

    expect(summary.status).toBe('approved');
    expect(summary.requiredLevels).toBe(2);
    expect(summary.currentLevel).toBe(2);
    expect(summary.approvedLevels).toBe(2);
  });
});
