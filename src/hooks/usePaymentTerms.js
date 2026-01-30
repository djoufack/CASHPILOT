
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const usePaymentTerms = () => {
  const { user } = useAuth();
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchPaymentTerms();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchPaymentTerms = async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payment_terms')
        .select('*')
        .eq('user_id', user.id)
        .order('days', { ascending: true });

      if (error) throw error;
      setPaymentTerms(data || []);
    } catch (err) {
      console.error('Error fetching payment terms:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createPaymentTerm = async (termData) => {
    if (!user || !supabase) return null;

    try {
      const { data, error } = await supabase
        .from('payment_terms')
        .insert([{ ...termData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setPaymentTerms(prev => [...prev, data].sort((a, b) => a.days - b.days));
      toast({
        title: "Succès",
        description: "Condition de paiement créée.",
        className: "bg-green-600 border-none text-white"
      });
      return data;
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      return null;
    }
  };

  const updatePaymentTerm = async (id, termData) => {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from('payment_terms')
        .update(termData)
        .eq('id', id);

      if (error) throw error;

      setPaymentTerms(prev => prev.map(t => t.id === id ? { ...t, ...termData } : t));
      toast({ title: "Succès", description: "Condition mise à jour." });
      return true;
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      return false;
    }
  };

  const deletePaymentTerm = async (id) => {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from('payment_terms')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPaymentTerms(prev => prev.filter(t => t.id !== id));
      toast({ title: "Supprimé", description: "Condition de paiement supprimée." });
      return true;
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      return false;
    }
  };

  return {
    paymentTerms,
    loading,
    error,
    fetchPaymentTerms,
    createPaymentTerm,
    updatePaymentTerm,
    deletePaymentTerm
  };
};
