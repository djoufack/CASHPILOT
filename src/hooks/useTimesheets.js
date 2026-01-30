
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';

export const useTimesheets = () => {
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();

  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    return Math.max(0, end - start);
  };

  const fetchTimesheets = async (filters = {}) => {
    if (!user) return;
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('timesheets')
        .select(`
          *,
          client:clients(company_name),
          project:projects(name),
          task:tasks(name)
        `)
        .order('date', { ascending: false });

      if (filters.startDate) query = query.gte('date', filters.startDate);
      if (filters.endDate) query = query.lte('date', filters.endDate);
      if (filters.projectId) query = query.eq('project_id', filters.projectId);

      const { data, error } = await query;

      if (error) throw error;
      setTimesheets(data || []);
    } catch (err) {
      // Handle RLS recursion (42P17) or permission (42501) errors gracefully
      if (err.code === '42P17' || err.code === '42501') {
        console.warn('RLS policy error fetching timesheets:', err.message);
        setTimesheets([]);
        return;
      }

      setError(err.message);
      toast({
        title: "Error fetching timesheets",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createTimesheet = async (timesheetData) => {
    if (!user) return;
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const duration = calculateDuration(timesheetData.start_time, timesheetData.end_time);
      const payload = {
        ...timesheetData,
        user_id: user.id,
        duration_minutes: duration
      };

      const { data, error } = await supabase
        .from('timesheets')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      setTimesheets([data, ...timesheets]);
      toast({
        title: "Success",
        description: t('messages.success.timesheetAdded')
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error creating timesheet",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateTimesheet = async (id, timesheetData) => {
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      // Recalculate duration if time changes
      let updates = { ...timesheetData };
      if (timesheetData.start_time && timesheetData.end_time) {
        updates.duration_minutes = calculateDuration(timesheetData.start_time, timesheetData.end_time);
      }

      const { data, error } = await supabase
        .from('timesheets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTimesheets(timesheets.map(t => t.id === id ? data : t));
      toast({
        title: "Success",
        description: t('messages.success.timesheetUpdated')
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error updating timesheet",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteTimesheet = async (id) => {
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const { error } = await supabase
        .from('timesheets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTimesheets(timesheets.filter(t => t.id !== id));
      toast({
        title: "Success",
        description: t('messages.success.timesheetDeleted')
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error deleting timesheet",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimesheets();
  }, [user]);

  return {
    timesheets,
    loading,
    error,
    fetchTimesheets,
    createTimesheet,
    updateTimesheet,
    deleteTimesheet,
    calculateDuration
  };
};
