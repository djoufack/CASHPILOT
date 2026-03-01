import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { normalizeRole } from '@/lib/roles';

export const ADMIN_ACCESS_ROLES = ['user', 'manager', 'accountant', 'admin'];

const normalizeAccessRole = (role) => {
  const normalized = normalizeRole(role);
  return ADMIN_ACCESS_ROLES.includes(normalized) ? normalized : 'user';
};

const buildAssignments = (profiles, roleRows, permissionsByRole) => {
  const elevatedRolesByUserId = new Map(
    (roleRows || []).map((entry) => [entry.user_id, entry])
  );

  const assignments = (profiles || []).map((profile) => {
    const elevatedRole = elevatedRolesByUserId.get(profile.user_id);
    const accessRole = normalizeAccessRole(elevatedRole?.role);

    return {
      id: profile.user_id || profile.id,
      user_id: profile.user_id,
      name: profile.full_name || profile.company_name || 'Unknown user',
      profile_role: normalizeRole(profile.role),
      access_role: accessRole,
      permissions: permissionsByRole[accessRole] || [],
      created_at: profile.created_at,
      updated_at: elevatedRole?.updated_at || elevatedRole?.created_at || profile.created_at,
    };
  });

  const knownUserIds = new Set(assignments.map((entry) => entry.user_id));

  for (const roleRow of roleRows || []) {
    if (knownUserIds.has(roleRow.user_id)) {
      continue;
    }

    const accessRole = normalizeAccessRole(roleRow.role);
    assignments.push({
      id: roleRow.user_id,
      user_id: roleRow.user_id,
      name: 'Unknown user',
      profile_role: 'user',
      access_role: accessRole,
      permissions: permissionsByRole[accessRole] || [],
      created_at: roleRow.created_at,
      updated_at: roleRow.updated_at || roleRow.created_at,
    });
  }

  return assignments.sort(
    (left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()
  );
};

export const useAdminRoles = () => {
  const [assignments, setAssignments] = useState([]);
  const [permissionsByRole, setPermissionsByRole] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState(null);
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  const fetchRoleData = useCallback(async () => {
    if (!supabase) return;

    setLoading(true);
    try {
      const [
        { data: profileData, error: profileError },
        { data: roleData, error: roleError },
        { data: permissionData, error: permissionError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, user_id, full_name, company_name, role, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('user_roles')
          .select('user_id, role, created_at, updated_at'),
        supabase
          .from('role_permissions')
          .select('role, permission, created_at')
          .order('role', { ascending: true })
          .order('permission', { ascending: true }),
      ]);

      if (profileError) throw profileError;
      if (roleError) throw roleError;
      if (permissionError) throw permissionError;

      const nextPermissionsByRole = (permissionData || []).reduce((accumulator, entry) => {
        const role = normalizeAccessRole(entry.role);
        accumulator[role] = accumulator[role] || [];
        accumulator[role].push(entry.permission);
        return accumulator;
      }, {});

      setPermissionsByRole(nextPermissionsByRole);
      setAssignments(buildAssignments(profileData, roleData, nextPermissionsByRole));
    } catch (err) {
      console.error('Failed to fetch admin roles:', err);
      toast({
        title: 'Error',
        description: 'Failed to load role assignments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateAccessRole = useCallback(async (assignment, nextRole) => {
    if (!supabase || !assignment?.user_id) return false;

    const normalizedNextRole = normalizeAccessRole(nextRole);
    const previousRole = assignment.access_role;

    if (normalizedNextRole === previousRole) {
      return true;
    }

    setSavingUserId(assignment.user_id);
    try {
      if (normalizedNextRole === 'user') {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', assignment.user_id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .upsert({
            user_id: assignment.user_id,
            role: normalizedNextRole,
          });

        if (error) throw error;
      }

      await logAction(
        'admin_access_role_updated',
        'user_roles',
        { target_user_id: assignment.user_id, role: previousRole },
        { target_user_id: assignment.user_id, role: normalizedNextRole }
      );

      toast({
        title: 'Success',
        description: `Access level updated to ${normalizedNextRole}`,
      });

      await fetchRoleData();
      return true;
    } catch (err) {
      console.error('Failed to update access role:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to update access level',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSavingUserId(null);
    }
  }, [fetchRoleData, logAction, toast]);

  return {
    assignments,
    permissionsByRole,
    loading,
    savingUserId,
    fetchRoleData,
    updateAccessRole,
  };
};
