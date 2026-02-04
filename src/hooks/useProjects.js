
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';

export const useProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchProjects = async (filters = {}) => {
    if (!user) return;
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('projects')
        .select('*, client:clients(id, company_name)')
        .order('created_at', { ascending: false });

      if (filters.clientId) query = query.eq('client_id', filters.clientId);

      const { data, error } = await query;
      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      if (err.code === '42P17' || err.code === '42501') {
        console.warn('RLS policy error fetching projects:', err.message);
        setProjects([]);
        toast({
          title: "Access restricted",
          description: "Some data may not be visible due to permission settings.",
        });
        return;
      }

      setError(err.message);
      toast({
        title: "Error fetching projects",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (projectData) => {
    if (!user) return;
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([{ ...projectData, user_id: user.id }])
        .select('*, client:clients(id, company_name)')
        .single();

      if (error) throw error;

      setProjects([data, ...projects]);
      toast({
        title: "Success",
        description: "Project created successfully"
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error creating project",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProject = async (id, projectData) => {
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', id)
        .select('*, client:clients(id, company_name)')
        .single();

      if (error) throw error;

      setProjects(projects.map(p => p.id === id ? data : p));
      toast({
        title: "Success",
        description: "Project updated successfully"
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error updating project",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (id) => {
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      // First check if there are linked timesheets
      const { count, error: countError } = await supabase
        .from('timesheets')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id);

      if (countError) throw countError;

      if (count > 0) {
        throw new Error(`Cannot delete project. It has ${count} linked timesheet entries.`);
      }

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProjects(projects.filter(p => p.id !== id));
      toast({
        title: "Success",
        description: "Project deleted successfully"
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error deleting project",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject
  };
};
