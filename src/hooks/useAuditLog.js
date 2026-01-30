
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useAuditLog = () => {
  const { user } = useAuth();

  const logAction = async (action, resource, oldData, newData) => {
    if (!user) return;

    try {
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action,
        resource,
        old_data: oldData,
        new_data: newData
      });
    } catch (err) {
      console.error('Failed to create audit log:', err);
    }
  };

  return { logAction };
};
