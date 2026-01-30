
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export const useUserRole = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user) {
        setPermissions([]);
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        // 1. Get role
        // Use maybeSingle() instead of single() to handle cases where no role is assigned yet (returns null instead of throwing error)
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roleError) {
          console.error('Error fetching user role:', roleError);
        }

        // Default to 'user' if no role is found in the database
        const userRole = roleData?.role || 'user';
        setRole(userRole);

        // 2. Get permissions for role
        const { data: permData, error: permError } = await supabase
          .from('role_permissions')
          .select('*')
          .eq('role', userRole);

        if (permError) {
          console.error('Error fetching permissions:', permError);
        }

        setPermissions(permData || []);
      } catch (err) {
        console.error('Error in useUserRole:', err);
        // Fallback defaults on critical error
        setRole('user');
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user]);

  const hasPermission = (resource, action) => {
    if (!user) return false;
    // Admins have implicit 'manage' 'all'
    if (permissions.some(p => p.role === 'admin' || (p.resource === 'all' && p.action === 'manage'))) return true;
    
    return permissions.some(p => 
      (p.resource === resource || p.resource === 'all') && 
      (p.action === action || p.action === 'manage')
    );
  };

  return { hasPermission, loading, permissions, role };
};
