
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useTeamSettings = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchMembers();
  }, [user]);

  const fetchMembers = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.warn('Error fetching team members:', err.message);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const addMember = async (email, role) => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      const newMember = {
        user_id: user.id,
        name: email.split('@')[0],
        email,
        role,
        joined_at: new Date().toISOString().split('T')[0]
      };

      const { data, error } = await supabase
        .from('team_members')
        .insert([newMember])
        .select()
        .single();

      if (error) throw error;

      setMembers([...members, data]);
      toast({ title: "Invitation envoyée", description: `Invitation envoyée à ${email}` });
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateMember = async (id, updates) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('team_members')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setMembers(prev => prev.map(m => m.id === id ? data : m));
      toast({ title: "Membre mis à jour", description: "Le rôle du membre a été modifié." });
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const deleteMember = async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMembers(prev => prev.filter(m => m.id !== id));
      toast({ title: "Membre supprimé", description: "L'utilisateur a été retiré de l'équipe." });
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  return {
    members,
    loading,
    addMember,
    updateMember,
    deleteMember
  };
};
