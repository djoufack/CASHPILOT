import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

export function useConsolidation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [portfolios, setPortfolios] = useState([]);
  const [consolidatedPnl, setConsolidatedPnl] = useState(null);
  const [consolidatedBalance, setConsolidatedBalance] = useState(null);
  const [cashPosition, setCashPosition] = useState(null);
  const [intercompanyTransactions, setIntercompanyTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPortfolios = useCallback(async () => {
    if (!user) return [];
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('company_portfolios')
        .select('*, company_portfolio_members(id, company_id, company:company(id, company_name))')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('portfolio_name');

      if (fetchError) throw fetchError;
      setPortfolios(data || []);
      return data || [];
    } catch (err) {
      setError(err.message);
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, toast, t]);

  const fetchConsolidatedPnl = useCallback(
    async (portfolioId, startDate, endDate) => {
      if (!user || !portfolioId) return null;
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('get_consolidated_pnl', {
          p_portfolio_id: portfolioId,
          p_start_date: startDate,
          p_end_date: endDate,
        });

        if (rpcError) throw rpcError;
        if (data?.error) throw new Error(data.error);

        setConsolidatedPnl(data);
        return data;
      } catch (err) {
        setError(err.message);
        toast({ variant: 'destructive', title: t('common.error'), description: err.message });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, toast, t]
  );

  const fetchConsolidatedBalance = useCallback(
    async (portfolioId, date) => {
      if (!user || !portfolioId) return null;
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('get_consolidated_balance_sheet', {
          p_portfolio_id: portfolioId,
          p_date: date,
        });

        if (rpcError) throw rpcError;
        if (data?.error) throw new Error(data.error);

        setConsolidatedBalance(data);
        return data;
      } catch (err) {
        setError(err.message);
        toast({ variant: 'destructive', title: t('common.error'), description: err.message });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, toast, t]
  );

  const fetchCashPosition = useCallback(
    async (portfolioId) => {
      if (!user || !portfolioId) return null;
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('get_consolidated_cash_position', {
          p_portfolio_id: portfolioId,
        });

        if (rpcError) throw rpcError;
        if (data?.error) throw new Error(data.error);

        setCashPosition(data);
        return data;
      } catch (err) {
        setError(err.message);
        toast({ variant: 'destructive', title: t('common.error'), description: err.message });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, toast, t]
  );

  const fetchIntercompanyTransactions = useCallback(
    async (portfolioId) => {
      if (!user || !portfolioId) return [];
      setLoading(true);
      setError(null);
      try {
        // Get the company IDs in this portfolio
        const { data: members, error: membersError } = await supabase
          .from('company_portfolio_members')
          .select('company_id')
          .eq('portfolio_id', portfolioId)
          .eq('user_id', user.id);

        if (membersError) throw membersError;

        const companyIds = (members || []).map((m) => m.company_id);
        if (companyIds.length === 0) {
          setIntercompanyTransactions([]);
          return [];
        }

        const { data, error: txnError } = await supabase
          .from('intercompany_transactions')
          .select(
            `
          *,
          source_company:company!intercompany_transactions_company_id_fkey(id, company_name),
          target_company:company!intercompany_transactions_linked_company_id_fkey(id, company_name)
        `
          )
          .eq('user_id', user.id)
          .in('company_id', companyIds)
          .order('created_at', { ascending: false });

        if (txnError) throw txnError;

        setIntercompanyTransactions(data || []);
        return data || [];
      } catch (err) {
        setError(err.message);
        toast({ variant: 'destructive', title: t('common.error'), description: err.message });
        return [];
      } finally {
        setLoading(false);
      }
    },
    [user, toast, t]
  );

  return {
    portfolios,
    consolidatedPnl,
    consolidatedBalance,
    cashPosition,
    intercompanyTransactions,
    loading,
    error,
    fetchPortfolios,
    fetchConsolidatedPnl,
    fetchConsolidatedBalance,
    fetchCashPosition,
    fetchIntercompanyTransactions,
  };
}
