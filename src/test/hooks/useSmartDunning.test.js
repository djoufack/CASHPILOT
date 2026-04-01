import { describe, expect, it } from 'vitest';
import { selectDunningRuleForDays } from '@/hooks/useSmartDunning';

const buildRule = (overrides = {}) => ({
  id: 'rule-id',
  rule_category: 'smart_dunning',
  dunning_step: 1,
  days_after_due: 5,
  channel: 'email',
  tone: 'friendly',
  is_active: true,
  ...overrides,
});

describe('selectDunningRuleForDays', () => {
  const baseRules = [
    buildRule({ id: 'rule-j5', dunning_step: 1, days_after_due: 5, channel: 'email', tone: 'friendly' }),
    buildRule({ id: 'rule-j15', dunning_step: 2, days_after_due: 15, channel: 'sms', tone: 'professional' }),
    buildRule({ id: 'rule-j30', dunning_step: 3, days_after_due: 30, channel: 'whatsapp', tone: 'firm' }),
  ];

  it('returns null when no rules are provided', () => {
    expect(selectDunningRuleForDays([], 10)).toBeNull();
    expect(selectDunningRuleForDays(null, 10)).toBeNull();
  });

  it('returns null when overdue days are below first threshold', () => {
    expect(selectDunningRuleForDays(baseRules, 4)).toBeNull();
  });

  it('selects J+5 rule when overdue days match first threshold', () => {
    const selected = selectDunningRuleForDays(baseRules, 5);
    expect(selected?.id).toBe('rule-j5');
    expect(selected?.dunning_step).toBe(1);
  });

  it('selects J+15 rule when overdue days are between J+15 and J+30', () => {
    const selected = selectDunningRuleForDays(baseRules, 20);
    expect(selected?.id).toBe('rule-j15');
    expect(selected?.dunning_step).toBe(2);
  });

  it('selects J+30 rule when overdue days are above highest threshold', () => {
    const selected = selectDunningRuleForDays(baseRules, 45);
    expect(selected?.id).toBe('rule-j30');
    expect(selected?.dunning_step).toBe(3);
  });

  it('ignores inactive or non-smart-dunning rules', () => {
    const rules = [
      buildRule({ id: 'inactive-j30', dunning_step: 3, days_after_due: 30, is_active: false }),
      buildRule({ id: 'generic-j15', dunning_step: 2, days_after_due: 15, rule_category: 'generic' }),
      buildRule({ id: 'active-j5', dunning_step: 1, days_after_due: 5, is_active: true }),
    ];

    const selected = selectDunningRuleForDays(rules, 30);
    expect(selected?.id).toBe('active-j5');
  });
});
