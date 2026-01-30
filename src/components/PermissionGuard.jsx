
import React from 'react';
import { useUserRole } from '@/hooks/useUserRole';

const PermissionGuard = ({ resource, action, children, fallback = null }) => {
  const { hasPermission, loading } = useUserRole();

  if (loading) return null; // Or a skeleton

  if (hasPermission(resource, action)) {
    return <>{children}</>;
  }

  return fallback;
};

export default PermissionGuard;
