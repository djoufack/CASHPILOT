import { describe, it, expect } from 'vitest';
import {
  isMissingColumnError,
  isMissingRelationError,
  isFunctionNotFoundError,
  isPostgrestRelationAmbiguityError,
} from '@/lib/supabaseCompatibility';

describe('supabaseCompatibility helpers', () => {
  it('detects missing column errors (42703)', () => {
    const error = { code: '42703', message: 'column subtasks_1.due_date does not exist' };
    expect(isMissingColumnError(error, 'subtasks_1.due_date')).toBe(true);
  });

  it('detects missing relation errors (42P01)', () => {
    const error = { code: '42P01', message: 'relation "public.dunning_history" does not exist' };
    expect(isMissingRelationError(error, 'public.dunning_history')).toBe(true);
  });

  it('detects missing function errors (42883)', () => {
    const error = { code: '42883', message: 'function get_default_payment_days(uuid) does not exist' };
    expect(isFunctionNotFoundError(error)).toBe(true);
  });

  it('detects postgrest relation ambiguity errors (PGRST201)', () => {
    const error = { code: 'PGRST201', message: 'Could not embed because more than one relationship was found' };
    expect(isPostgrestRelationAmbiguityError(error)).toBe(true);
  });
});
