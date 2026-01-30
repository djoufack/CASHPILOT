
import { useState } from 'react';
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

export const useNotificationSettings = () => {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updatePreferences = async (newPrefs) => {
    setLoading(true);
    setTimeout(() => {
      setPreferences(newPrefs);
      setLoading(false);
      toast({ title: "Preferences Saved", description: "Notification settings updated." });
    }, 800);
  };

  const resetToDefault = async () => {
    setLoading(true);
    setTimeout(() => {
      setPreferences(DEFAULT_PREFERENCES);
      setLoading(false);
      toast({ title: "Reset Complete", description: "Settings restored to defaults." });
    }, 500);
  };

  return {
    preferences,
    loading,
    updatePreferences,
    resetToDefault
  };
};
