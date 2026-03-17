import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { normalizeRole } from '@/lib/roles';

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const _results = await Promise.allSettled([
        supabase
          .from('profiles')
          .select('id, user_id, full_name, company_name, role, created_at')
          .order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      _results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`Users fetch ${i} failed:`, r.reason);
      });

      const profileRes = _results[0].status === 'fulfilled' ? _results[0].value : { data: null, error: null };
      const roleRes = _results[1].status === 'fulfilled' ? _results[1].value : { data: null, error: null };

      const { data, error } = profileRes;
      const { data: roleData, error: roleError } = roleRes;

      if (error) throw error;
      if (roleError) {
        console.warn('User roles fetch skipped:', roleError.message);
      }

      const elevatedRoles = new Map((roleData || []).map((entry) => [entry.user_id, normalizeRole(entry.role)]));
      setUsers(
        (data || []).map((profile) => ({
          id: profile.id || profile.user_id,
          user_id: profile.user_id,
          name: profile.full_name || profile.company_name || 'Unknown user',
          email: null,
          role: elevatedRoles.get(profile.user_id) || normalizeRole(profile.role),
          created_at: profile.created_at,
        }))
      );
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to fetch users', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { users, fetchUsers, loading };
};
