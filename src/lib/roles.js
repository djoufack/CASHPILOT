export const DEFAULT_ROLE = 'user';

const KNOWN_ROLES = new Set(['admin', 'manager', 'accountant', 'freelance', 'client', 'user']);

export function normalizeRole(role) {
  if (typeof role !== 'string') return DEFAULT_ROLE;

  const normalized = role.trim().toLowerCase();
  return KNOWN_ROLES.has(normalized) ? normalized : DEFAULT_ROLE;
}

export function sanitizeSelfSignupRole(requestedRole) {
  const normalized = normalizeRole(requestedRole);
  return normalized === 'client' ? 'client' : DEFAULT_ROLE;
}

export function permissionMatches(permission, resource, action) {
  if (typeof permission !== 'string') return false;

  const normalizedPermission = permission.trim().toLowerCase();
  const normalizedResource = String(resource || '').trim().toLowerCase();
  const normalizedAction = String(action || '').trim().toLowerCase();

  if (!normalizedPermission || !normalizedResource || !normalizedAction) {
    return false;
  }

  return [
    `${normalizedResource}:${normalizedAction}`,
    `${normalizedResource}:manage`,
    `${normalizedAction}_${normalizedResource}`,
    'all:manage',
    'manage_all',
    'admin',
  ].includes(normalizedPermission);
}
