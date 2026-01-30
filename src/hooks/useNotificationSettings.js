
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const DEFAULT_PREFERENCES = {
  email: {
    newTasks: true,
    overdueTasks: true,
    completedTasks: false,
    comments: true,
    projectUpdates: true,
    reminders: true
  },
  push: {
    enabled: true,
    newTasks: true,
    comments: true
  },
  frequency: 'immediate'
};

// Map between frontend nested structure and flat DB columns
const toDbFormat = (prefs) => ({
  email_new_tasks: prefs.email?.newTasks ?? true,
  email_overdue_tasks: prefs.email?.overdueTasks ?? true,
  email_completed_tasks: prefs.email?.completedTasks ?? false,
  email_comments: prefs.email?.comments ?? true,
  email_project_updates: prefs.email?.projectUpdates ?? true,
  email_reminders: prefs.email?.reminders ?? true,
  push_enabled: prefs.push?.enabled ?? true,
  push_new_tasks: prefs.push?.newTasks ?? true,
  push_comments: prefs.push?.comments ?? true,
  frequency: prefs.frequency || 'immediate'
});

const fromDbFormat = (row) => ({
  email: {
    newTasks: row.email_new_tasks,
    overdueTasks: row.email_overdue_tasks,
    completedTasks: row.email_completed_tasks,
    comments: row.email_comments,
    projectUpdates: row.email_project_updates,
    reminders: row.email_reminders
  },
  push: {
    enabled: row.push_enabled,
    newTasks: row.push_new_tasks,
    comments: row.push_comments
  },
  frequency: row.frequency
});

export const useNotificationSettings = () => {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(false);
  const [dbRecord, setDbRecord] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchPreferences();
  }, [user]);

  const fetchPreferences = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDbRecord(data);
        setPreferences(fromDbFormat(data));
      }
    } catch (err) {
      console.warn('Error fetching notification preferences:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (newPrefs) => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      const payload = { ...toDbFormat(newPrefs), user_id: user.id };

      if (dbRecord?.id) {
        const { data, error } = await supabase
          .from('notification_preferences')
          .update(payload)
          .eq('id', dbRecord.id)
          .select()
          .single();
        if (error) throw error;
        setDbRecord(data);
      } else {
        const { data, error } = await supabase
          .from('notification_preferences')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        setDbRecord(data);
      }

      setPreferences(newPrefs);
      toast({ title: "Préférences sauvegardées", description: "Vos paramètres de notification ont été mis à jour." });
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetToDefault = async () => {
    await updatePreferences(DEFAULT_PREFERENCES);
  };

  return {
    preferences,
    loading,
    updatePreferences,
    resetToDefault
  };
};
