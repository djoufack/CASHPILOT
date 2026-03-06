
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { normalizeRole, permissionMatches } from '@/lib/roles';

export const useUserRole = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const role = normalizeRole(user?.role);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data: permData, error: permError } = await supabase
          .from('role_permissions')
          .select('permission')
          .eq('role', role);

        if (permError) {
          console.error('Error fetching permissions:', permError);
        }

        setPermissions(permData || []);
      } catch (err) {
        console.error('Error in useUserRole:', err);
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [role, user]);

  const isAdmin = role === 'admin';

  const hasPermission = (resource, action) => {
    if (!user) return false;
    if (isAdmin) return true;

    return permissions.some((entry) => permissionMatches(entry.permission, resource, action));
  };

  return { hasPermission, loading, permissions, role, isAdmin };
};
