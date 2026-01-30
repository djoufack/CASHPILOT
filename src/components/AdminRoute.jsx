
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

const AdminRoute = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, loading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check for admin capability via permission 'all' 'manage' or explicit role check
  if (!hasPermission('all', 'manage')) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;
