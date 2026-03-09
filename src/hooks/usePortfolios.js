import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

export function usePortfolios() {
  const { user } = useAuth();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPortfolios = useCallback(async () => {
    if (!user) return [];
    setLoading(true);
    try {
      let query = supabase
        .from('company_portfolios')
        .select('*, company_portfolio_members(*, company_payment_instruments(id, label, instrument_type, currency, current_balance, status))')
        .eq('user_id', user.id)
        .order('label');
      query = applyCompanyScope(query, { includeUnassigned: false });
      const { data, error } = await query;
      if (error) throw error;
      setPortfolios(data || []);
      return data || [];
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, applyCompanyScope, toast, t]);

  const createPortfolio = useCallback(async (portfolioData) => {
    if (!user) return null;
    try {
      const { members, ...hubData } = portfolioData;
      const payload = withCompanyScope({
        ...hubData,
        user_id: user.id,
      });
      const { data: portfolio, error } = await supabase
        .from('company_portfolios')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      // Insert members if provided
      if (members && members.length > 0) {
        const memberRows = members.map((m) => ({
          portfolio_id: portfolio.id,
          instrument_id: m.instrument_id,
          weight: m.weight || null,
          sort_order: m.sort_order || 0,
        }));
        const { error: memberErr } = await supabase
          .from('company_portfolio_members')
          .insert(memberRows);
        if (memberErr) throw memberErr;
      }
      toast({ title: t('common.success'), description: t('financialInstruments.portfolioCreated') });
      await fetchPortfolios();
      return portfolio;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return null;
    }
  }, [user, withCompanyScope, fetchPortfolios, toast, t]);

  const updatePortfolio = useCallback(async (id, updates) => {
    if (!user) return null;
    try {
      const { members, ...hubUpdates } = updates;
      const { data, error } = await supabase
        .from('company_portfolios')
        .update(hubUpdates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      // Replace members if provided
      if (members !== undefined) {
        await supabase
          .from('company_portfolio_members')
          .delete()
          .eq('portfolio_id', id);
        if (members && members.length > 0) {
          const memberRows = members.map((m) => ({
            portfolio_id: id,
            instrument_id: m.instrument_id,
            weight: m.weight || null,
            sort_order: m.sort_order || 0,
          }));
          const { error: memberErr } = await supabase
            .from('company_portfolio_members')
            .insert(memberRows);
          if (memberErr) throw memberErr;
        }
      }
      toast({ title: t('common.success'), description: t('common.updated') });
      await fetchPortfolios();
      return data;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return null;
    }
  }, [user, fetchPortfolios, toast, t]);

  const deletePortfolio = useCallback(async (id) => {
    if (!user) return false;
    try {
      // Members are deleted via ON DELETE CASCADE
      const { error } = await supabase
        .from('company_portfolios')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast({ title: t('common.success'), description: t('common.deleted') });
      await fetchPortfolios();
      return true;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return false;
    }
  }, [user, fetchPortfolios, toast, t]);

  const addMember = useCallback(async (portfolioId, instrumentId, options = {}) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('company_portfolio_members')
        .insert([{
          portfolio_id: portfolioId,
          instrument_id: instrumentId,
          weight: options.weight || null,
          sort_order: options.sort_order || 0,
        }])
        .select()
        .single();
      if (error) throw error;
      await fetchPortfolios();
      return data;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return null;
    }
  }, [user, fetchPortfolios, toast, t]);

  const removeMember = useCallback(async (portfolioId, instrumentId) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('company_portfolio_members')
        .delete()
        .eq('portfolio_id', portfolioId)
        .eq('instrument_id', instrumentId);
      if (error) throw error;
      await fetchPortfolios();
      return true;
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return false;
    }
  }, [user, fetchPortfolios, toast, t]);

  return {
    portfolios,
    loading,
    fetchPortfolios,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    addMember,
    removeMember,
  };
}
