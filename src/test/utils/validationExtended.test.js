import { describe, it, expect } from 'vitest';
import {
  validatePasswordStrength,
  PASSWORD_POLICY,
} from '@/utils/validation';

// ============================================================================
// PASSWORD_POLICY constant
// ============================================================================
describe('PASSWORD_POLICY', () => {
  it('requires minimum length of 12', () => {
    expect(PASSWORD_POLICY.minLength).toBe(12);
  });

  it('requires uppercase, digit, and special character', () => {
    expect(PASSWORD_POLICY.requireUppercase).toBe(true);
    expect(PASSWORD_POLICY.requireDigit).toBe(true);
    expect(PASSWORD_POLICY.requireSpecial).toBe(true);
  });

  it('is frozen and cannot be modified', () => {
    expect(Object.isFrozen(PASSWORD_POLICY)).toBe(true);
  });
});

// ============================================================================
// validatePasswordStrength
// ============================================================================
describe('validatePasswordStrength', () => {
  it('accepts a strong password meeting all requirements', () => {
    expect(validatePasswordStrength('MySecurePass1!')).toBe(true);
  });

  it('accepts password with exactly 12 characters', () => {
    expect(validatePasswordStrength('Abcdefghij1!')).toBe(true);
  });

  it('rejects password shorter than 12 characters', () => {
    expect(validatePasswordStrength('Short1!')).toBe(false);
  });

  it('rejects password without uppercase letter', () => {
    expect(validatePasswordStrength('nouppercase1!!')).toBe(false);
  });

  it('rejects password without digit', () => {
    expect(validatePasswordStrength('NoDigitsHere!!')).toBe(false);
  });

  it('rejects password without special character', () => {
    expect(validatePasswordStrength('NoSpecialChar1A')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validatePasswordStrength('')).toBe(false);
  });

  it('rejects null', () => {
    expect(validatePasswordStrength(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validatePasswordStrength(undefined)).toBe(false);
  });

  it('rejects a number', () => {
    expect(validatePasswordStrength(12345678901234)).toBe(false);
  });

  it('accepts password with unicode special characters', () => {
    expect(validatePasswordStrength('MyPassword1@')).toBe(true);
  });

  it('accepts long passwords', () => {
    expect(validatePasswordStrength('VeryLongSecurePassword123!!!')).toBe(true);
  });

  it('rejects all-lowercase with digit and special but short', () => {
    expect(validatePasswordStrength('short1!')).toBe(false);
  });
});
