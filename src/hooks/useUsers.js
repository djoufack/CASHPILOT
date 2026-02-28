
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { normalizeRole } from '@/lib/roles';

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [{ data, error }, { data: roleData, error: roleError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, user_id, full_name, company_name, role, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('user_roles')
          .select('user_id, role'),
      ]);

      if (error) throw error;
      if (roleError) {
        console.warn('User roles fetch skipped:', roleError.message);
      }

      const elevatedRoles = new Map((roleData || []).map((entry) => [entry.user_id, normalizeRole(entry.role)]));
      setUsers((data || []).map((profile) => ({
        id: profile.id || profile.user_id,
        user_id: profile.user_id,
        name: profile.full_name || profile.company_name || 'Unknown user',
        email: null,
        role: elevatedRoles.get(profile.user_id) || normalizeRole(profile.role),
        created_at: profile.created_at,
      })));
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to fetch users', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return { users, fetchUsers, loading };
};
