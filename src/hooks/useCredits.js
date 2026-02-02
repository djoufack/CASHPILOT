import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

export const useCredits = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [credits, setCredits] = useState({ free_credits: 0, paid_credits: 0, total_used: 0 });
  const [packages, setPackages] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const availableCredits = credits.free_credits + credits.paid_credits;

  const fetchCredits = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // No row yet, create one
        const { data: newData } = await supabase
          .from('user_credits')
          .insert([{ user_id: user.id, free_credits: 10, paid_credits: 0, total_used: 0 }])
          .select()
          .single();
        if (newData) setCredits(newData);
      } else if (data) {
        setCredits(data);
      }
    } catch (err) {
      console.error('Error fetching credits:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchPackages = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      setPackages(data || []);
    } catch (err) {
      console.error('Error fetching packages:', err);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchCredits();
    fetchPackages();
  }, [fetchCredits, fetchPackages]);

  /**
   * Consume credits for an action (export, visualization, etc.)
   * @param {number} amount - Credits to consume
   * @param {string} description - What the credits are used for
   * @returns {boolean} true if credits were consumed, false if insufficient
   */
  const consumeCredits = async (amount, description) => {
    if (!user || !supabase) return false;

    if (availableCredits < amount) {
      toast({
        title: t('credits.insufficient'),
        description: t('credits.purchaseMore'),
        variant: 'destructive'
      });
      return false;
    }

    try {
      // Deduct from free credits first, then paid
      let freeDeduction = Math.min(credits.free_credits, amount);
      let paidDeduction = amount - freeDeduction;

      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          free_credits: credits.free_credits - freeDeduction,
          paid_credits: credits.paid_credits - paidDeduction,
          total_used: credits.total_used + amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Log the transaction
      await supabase
        .from('credit_transactions')
        .insert([{
          user_id: user.id,
          type: 'usage',
          amount: -amount,
          description
        }]);

      // Refresh credits
      await fetchCredits();
      return true;
    } catch (err) {
      console.error('Error consuming credits:', err);
      toast({
        title: t('common.error'),
        description: err.message,
        variant: 'destructive'
      });
      return false;
    }
  };

  /**
   * Add credits after successful Stripe payment
   */
  const addCredits = async (amount, stripeSessionId, stripePi) => {
    if (!user || !supabase) return;
    try {
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          paid_credits: credits.paid_credits + amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      await supabase
        .from('credit_transactions')
        .insert([{
          user_id: user.id,
          type: 'purchase',
          amount: amount,
          description: `Purchased ${amount} credits`,
          stripe_session_id: stripeSessionId || null,
          stripe_payment_intent: stripePi || null
        }]);

      await fetchCredits();
      toast({
        title: t('common.success'),
        description: t('credits.purchased', { amount })
      });
    } catch (err) {
      console.error('Error adding credits:', err);
    }
  };

  return {
    credits,
    availableCredits,
    packages,
    transactions,
    loading,
    fetchCredits,
    fetchPackages,
    fetchTransactions,
    consumeCredits,
    addCredits
  };
};
