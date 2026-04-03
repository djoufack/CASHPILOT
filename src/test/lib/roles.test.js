import { describe, it, expect } from 'vitest';
import { DEFAULT_ROLE, normalizeRole, sanitizeSelfSignupRole, permissionMatches } from '@/lib/roles';

describe('roles', () => {
  describe('DEFAULT_ROLE', () => {
    it('should be "user"', () => {
      expect(DEFAULT_ROLE).toBe('user');
    });
  });

  describe('normalizeRole', () => {
    it('returns the role when it is a known role', () => {
      expect(normalizeRole('admin')).toBe('admin');
      expect(normalizeRole('manager')).toBe('manager');
      expect(normalizeRole('accountant')).toBe('accountant');
      expect(normalizeRole('freelance')).toBe('freelance');
      expect(normalizeRole('client')).toBe('client');
      expect(normalizeRole('user')).toBe('user');
    });

    it('trims whitespace and lowercases', () => {
      expect(normalizeRole('  Admin  ')).toBe('admin');
      expect(normalizeRole('MANAGER')).toBe('manager');
      expect(normalizeRole(' Accountant ')).toBe('accountant');
    });

    it('returns DEFAULT_ROLE for unknown roles', () => {
      expect(normalizeRole('superadmin')).toBe('user');
      expect(normalizeRole('moderator')).toBe('user');
      expect(normalizeRole('unknown')).toBe('user');
    });

    it('returns DEFAULT_ROLE for non-string values', () => {
      expect(normalizeRole(null)).toBe('user');
      expect(normalizeRole(undefined)).toBe('user');
      expect(normalizeRole(42)).toBe('user');
      expect(normalizeRole({})).toBe('user');
      expect(normalizeRole([])).toBe('user');
      expect(normalizeRole(true)).toBe('user');
    });

    it('returns DEFAULT_ROLE for empty string', () => {
      expect(normalizeRole('')).toBe('user');
      expect(normalizeRole('   ')).toBe('user');
    });
  });

  describe('sanitizeSelfSignupRole', () => {
    it('allows "client" role for self-signup', () => {
      expect(sanitizeSelfSignupRole('client')).toBe('client');
      expect(sanitizeSelfSignupRole('CLIENT')).toBe('client');
      expect(sanitizeSelfSignupRole('  client  ')).toBe('client');
    });

    it('forces DEFAULT_ROLE for any non-client known role', () => {
      expect(sanitizeSelfSignupRole('admin')).toBe('user');
      expect(sanitizeSelfSignupRole('manager')).toBe('user');
      expect(sanitizeSelfSignupRole('accountant')).toBe('user');
      expect(sanitizeSelfSignupRole('freelance')).toBe('user');
    });

    it('returns DEFAULT_ROLE for unknown roles', () => {
      expect(sanitizeSelfSignupRole('superadmin')).toBe('user');
      expect(sanitizeSelfSignupRole(null)).toBe('user');
      expect(sanitizeSelfSignupRole(undefined)).toBe('user');
    });
  });

  describe('permissionMatches', () => {
    it('matches resource:action pattern', () => {
      expect(permissionMatches('invoices:read', 'invoices', 'read')).toBe(true);
      expect(permissionMatches('users:write', 'users', 'write')).toBe(true);
    });

    it('matches resource:manage pattern', () => {
      expect(permissionMatches('invoices:manage', 'invoices', 'read')).toBe(true);
      expect(permissionMatches('invoices:manage', 'invoices', 'write')).toBe(true);
    });

    it('matches action_resource pattern', () => {
      expect(permissionMatches('read_invoices', 'invoices', 'read')).toBe(true);
      expect(permissionMatches('write_users', 'users', 'write')).toBe(true);
    });

    it('matches all:manage wildcard', () => {
      expect(permissionMatches('all:manage', 'invoices', 'read')).toBe(true);
      expect(permissionMatches('all:manage', 'anything', 'any_action')).toBe(true);
    });

    it('matches manage_all wildcard', () => {
      expect(permissionMatches('manage_all', 'invoices', 'read')).toBe(true);
    });

    it('matches admin wildcard', () => {
      expect(permissionMatches('admin', 'invoices', 'read')).toBe(true);
    });

    it('does not match unrelated permission', () => {
      expect(permissionMatches('invoices:read', 'users', 'read')).toBe(false);
      expect(permissionMatches('invoices:read', 'invoices', 'write')).toBe(false);
    });

    it('returns false for non-string permission', () => {
      expect(permissionMatches(null, 'invoices', 'read')).toBe(false);
      expect(permissionMatches(undefined, 'invoices', 'read')).toBe(false);
      expect(permissionMatches(42, 'invoices', 'read')).toBe(false);
    });

    it('returns false for empty resource or action', () => {
      expect(permissionMatches('invoices:read', '', 'read')).toBe(false);
      expect(permissionMatches('invoices:read', 'invoices', '')).toBe(false);
      expect(permissionMatches('invoices:read', null, 'read')).toBe(false);
      expect(permissionMatches('invoices:read', 'invoices', null)).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(permissionMatches('INVOICES:READ', 'Invoices', 'Read')).toBe(true);
      expect(permissionMatches('ADMIN', 'invoices', 'read')).toBe(true);
    });

    it('trims whitespace', () => {
      expect(permissionMatches('  invoices:read  ', 'invoices', 'read')).toBe(true);
    });
  });
});
