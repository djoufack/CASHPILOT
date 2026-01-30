
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // This requires admin privileges to see auth.users or a public wrapper
      // Assuming we have a public 'profiles' table that syncs with users
      // or we use an Edge Function for admin listing.
      // For this demo, we'll fetch from the 'users' table we created in earlier steps
      // joining with 'user_roles'
      
      const { data, error } = await supabase
        .from('users') // public.users
        .select(`
          *,
          role:user_roles(role)
        `);

      if (error) throw error;
      setUsers(data.map(u => ({
        ...u,
        role: u.role?.[0]?.role || 'user'
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
