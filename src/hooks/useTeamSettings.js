import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/use-toast';
import { formatDateInput } from '@/utils/dateFormatting';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const useTeamSettings = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const fetchMembers = useCallback(async () => {
    if (!supabase) return;
    if (!activeCompanyId) {
      setMembers([]);
      return;
    }
    setLoading(true);
    try {
      let query = supabase.from('team_members').select('*').order('created_at', { ascending: true });
      query = applyCompanyScope(query);
      const { data, error } = await query;

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.warn('Error fetching team members:', err.message);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, applyCompanyScope]);

  useEffect(() => {
    if (user) fetchMembers();
  }, [user, fetchMembers]);

  const addMember = async (email, role) => {
    if (!user || !supabase) return;
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const newMember = withCompanyScope({
        user_id: user.id,
        name: email.split('@')[0],
        email,
        role,
        joined_at: formatDateInput(),
      });

      const { data, error } = await supabase.from('team_members').insert([newMember]).select().single();

      if (error) throw error;

      setMembers([...members, data]);
      toast({
        title: t('hooks.teamSettings.inviteSent'),
        description: t('hooks.teamSettings.inviteSentDesc', { email }),
      });
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateMember = async (id, updates) => {
    if (!supabase) return;
    if (!activeCompanyId) return;
    try {
      let query = supabase.from('team_members').update(withCompanyScope(updates)).eq('id', id).select();
      query = applyCompanyScope(query);
      const { data, error } = await query.single();

      if (error) throw error;

      setMembers((prev) => prev.map((m) => (m.id === id ? data : m)));
      toast({ title: t('hooks.teamSettings.memberUpdated'), description: t('hooks.teamSettings.memberUpdatedDesc') });
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const deleteMember = async (id) => {
    if (!supabase) return;
    if (!activeCompanyId) return;
    try {
      let query = supabase.from('team_members').delete().eq('id', id);
      query = applyCompanyScope(query);
      const { error } = await query;

      if (error) throw error;

      setMembers((prev) => prev.filter((m) => m.id !== id));
      toast({ title: t('hooks.teamSettings.memberDeleted'), description: t('hooks.teamSettings.memberDeletedDesc') });
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  return {
    members,
    loading,
    addMember,
    updateMember,
    deleteMember,
  };
};
