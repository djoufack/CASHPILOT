import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const toIsoDate = (value) => new Date(value).toISOString().split('T')[0];

const getMonthPeriodBounds = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

  return {
    key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
    periodStart: toIsoDate(start),
    periodEnd: toIsoDate(end),
  };
};

export const buildEliminationPeriods = (transactions = []) => {
  const buckets = new Map();

  for (const transaction of transactions) {
    if (String(transaction?.status || '').toLowerCase() !== 'synced') continue;
    if (!transaction?.created_at) continue;

    const period = getMonthPeriodBounds(transaction.created_at);
    if (!period) continue;
    buckets.set(period.key, period);
  }

  return [...buckets.values()].sort((left, right) => left.periodStart.localeCompare(right.periodStart));
};

export function useInterCompany() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [eliminations, setEliminations] = useState([]);

  // ─── Fetch all data ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;
    setLoading(true);

    try {
      let linksQuery = supabase
        .from('intercompany_links')
        .select('id, user_id, company_id, linked_company_id, link_type, is_active, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      let transactionsQuery = supabase
        .from('intercompany_transactions')
        .select(
          'id, user_id, company_id, linked_company_id, source_invoice_id, mirror_invoice_id, amount, currency, transaction_type, status, created_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      let rulesQuery = supabase
        .from('transfer_pricing_rules')
        .select(
          'id, user_id, company_id, service_type, pricing_method, margin_percent, min_amount, max_amount, is_active, created_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      let eliminationsQuery = supabase
        .from('intercompany_eliminations')
        .select(
          'id, user_id, company_id, portfolio_id, period_start, period_end, eliminated_amount, entries_count, status, created_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      linksQuery = applyCompanyScope(linksQuery);
      transactionsQuery = applyCompanyScope(transactionsQuery);
      rulesQuery = applyCompanyScope(rulesQuery);
      eliminationsQuery = applyCompanyScope(eliminationsQuery);

      const _results = await Promise.allSettled([linksQuery, transactionsQuery, rulesQuery, eliminationsQuery]);

      const _icLabels = ['links', 'transactions', 'rules', 'eliminations'];
      _results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`InterCompany fetch "${_icLabels[i]}" failed:`, r.reason);
      });

      const _v = (i) => (_results[i].status === 'fulfilled' ? _results[i].value : null) || { data: null, error: null };
      const linksRes = _v(0);
      const txRes = _v(1);
      const rulesRes = _v(2);
      const elimRes = _v(3);

      [linksRes, txRes, rulesRes, elimRes].forEach((res, i) => {
        if (res.error) console.error(`InterCompany query "${_icLabels[i]}" error:`, res.error);
      });

      // Enrich links with company names
      const companyIds = new Set();
      (linksRes.data || []).forEach((l) => {
        companyIds.add(l.company_id);
        companyIds.add(l.linked_company_id);
      });

      let companiesMap = {};
      if (companyIds.size > 0) {
        const { data: companies } = await supabase
          .from('company')
          .select('id, name')
          .in('id', [...companyIds]);
        if (companies) {
          companiesMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
        }
      }

      const enrichedLinks = (linksRes.data || []).map((l) => ({
        ...l,
        company_name: companiesMap[l.company_id] || l.company_id,
        linked_company_name: companiesMap[l.linked_company_id] || l.linked_company_id,
      }));

      setLinks(enrichedLinks);
      setTransactions(txRes.data || []);
      setPricingRules(rulesRes.data || []);
      setEliminations(elimRes.data || []);
    } catch (err) {
      toast({
        title: 'Erreur Inter-Societes',
        description: err.message || 'Impossible de charger les donnees inter-societes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, applyCompanyScope, toast, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Create link ────────────────────────────────────────────────
  const createLink = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const row = withCompanyScope({
        user_id: user.id,
        linked_company_id: payload.linked_company_id,
        link_type: payload.link_type || 'both',
        is_active: payload.is_active !== false,
      });

      const { data, error } = await supabase.from('intercompany_links').insert([row]).select('*').single();

      if (error) {
        toast({
          title: 'Erreur',
          description: error.message,
          variant: 'destructive',
        });
        throw error;
      }

      await fetchData();
      return data;
    },
    [fetchData, toast, user, withCompanyScope]
  );

  // ─── Toggle link active status ──────────────────────────────────
  const toggleLink = useCallback(
    async (linkId, isActive) => {
      if (!supabase) return null;

      const { data, error } = await supabase
        .from('intercompany_links')
        .update({ is_active: isActive })
        .eq('id', linkId)
        .select('*')
        .single();

      if (error) {
        toast({
          title: 'Erreur',
          description: error.message,
          variant: 'destructive',
        });
        throw error;
      }

      await fetchData();
      return data;
    },
    [fetchData, toast]
  );

  // ─── Delete link ────────────────────────────────────────────────
  const deleteLink = useCallback(
    async (linkId) => {
      if (!supabase) return;

      const { error } = await supabase.from('intercompany_links').delete().eq('id', linkId);

      if (error) {
        toast({
          title: 'Erreur',
          description: error.message,
          variant: 'destructive',
        });
        throw error;
      }

      await fetchData();
    },
    [fetchData, toast]
  );

  // ─── Sync invoice to mirror company via edge function ───────────
  const syncInvoice = useCallback(
    async (sourceCompanyId, targetCompanyId, invoiceId) => {
      if (!supabase) return null;

      const { data, error } = await supabase.functions.invoke('intercompany-sync', {
        body: {
          source_company_id: sourceCompanyId,
          target_company_id: targetCompanyId,
          invoice_id: invoiceId,
        },
      });

      if (error) {
        toast({
          title: 'Erreur synchronisation',
          description: error.message || 'Echec de la synchronisation inter-societes.',
          variant: 'destructive',
        });
        throw error;
      }

      if (data && !data.success) {
        toast({
          title: 'Erreur synchronisation',
          description: data.error || 'Echec de la synchronisation.',
          variant: 'destructive',
        });
        throw new Error(data.error || 'Sync failed');
      }

      toast({
        title: 'Synchronisation reussie',
        description: `Facture miroir ${data.mirror_invoice_number} creee.`,
      });

      await fetchData();
      return data;
    },
    [fetchData, toast]
  );

  // ─── Create / update transfer pricing rule ──────────────────────
  const updatePricingRule = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      if (payload.id) {
        const { data, error } = await supabase
          .from('transfer_pricing_rules')
          .update({
            service_type: payload.service_type,
            pricing_method: payload.pricing_method,
            margin_percent: Number(payload.margin_percent) || 0,
            min_amount: Number(payload.min_amount) || 0,
            max_amount: Number(payload.max_amount) || 0,
            is_active: payload.is_active !== false,
          })
          .eq('id', payload.id)
          .select('*')
          .single();

        if (error) {
          toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
          throw error;
        }
        await fetchData();
        return data;
      }

      const row = withCompanyScope({
        user_id: user.id,
        service_type: payload.service_type,
        pricing_method: payload.pricing_method || 'cost_plus',
        margin_percent: Number(payload.margin_percent) || 0,
        min_amount: Number(payload.min_amount) || 0,
        max_amount: Number(payload.max_amount) || 0,
        is_active: payload.is_active !== false,
      });

      const { data, error } = await supabase.from('transfer_pricing_rules').insert([row]).select('*').single();

      if (error) {
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
        throw error;
      }

      await fetchData();
      return data;
    },
    [fetchData, toast, user, withCompanyScope]
  );

  // ─── Delete pricing rule ────────────────────────────────────────
  const deletePricingRule = useCallback(
    async (ruleId) => {
      if (!supabase) return;

      const { error } = await supabase.from('transfer_pricing_rules').delete().eq('id', ruleId);

      if (error) {
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
        throw error;
      }

      await fetchData();
    },
    [fetchData, toast]
  );

  // ─── Compute eliminations for a period ──────────────────────────
  const computeEliminations = useCallback(
    async (periodStart, periodEnd, portfolioId, options = {}) => {
      if (!user || !supabase || !activeCompanyId) return null;
      const { status = 'applied', silent = false } = options;

      // Gather synced transactions in the period
      let txQuery = supabase
        .from('intercompany_transactions')
        .select('id, amount, currency')
        .eq('user_id', user.id)
        .eq('status', 'synced')
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd);

      txQuery = applyCompanyScope(txQuery);

      const { data: periodTx, error: txError } = await txQuery;
      if (txError) {
        toast({ title: 'Erreur', description: txError.message, variant: 'destructive' });
        throw txError;
      }

      const totalEliminated = (periodTx || []).reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      const entriesCount = (periodTx || []).length;

      // Upsert one elimination row per period to stay idempotent.
      let existingQuery = supabase
        .from('intercompany_eliminations')
        .select('id')
        .eq('user_id', user.id)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .maybeSingle();
      existingQuery = applyCompanyScope(existingQuery);

      const { data: existingElimination, error: existingError } = await existingQuery;
      if (existingError) {
        toast({ title: 'Erreur', description: existingError.message, variant: 'destructive' });
        throw existingError;
      }

      const payload = {
        eliminated_amount: totalEliminated,
        entries_count: entriesCount,
        status,
        portfolio_id: portfolioId || null,
      };

      let data;
      let error;
      if (existingElimination?.id) {
        ({ data, error } = await supabase
          .from('intercompany_eliminations')
          .update(payload)
          .eq('id', existingElimination.id)
          .select('*')
          .single());
      } else {
        const row = withCompanyScope({
          user_id: user.id,
          portfolio_id: portfolioId || null,
          period_start: periodStart,
          period_end: periodEnd,
          eliminated_amount: totalEliminated,
          entries_count: entriesCount,
          status,
        });
        ({ data, error } = await supabase.from('intercompany_eliminations').insert([row]).select('*').single());
      }

      if (error) {
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
        throw error;
      }

      // Mark those transactions as eliminated
      if (periodTx && periodTx.length > 0) {
        const txIds = periodTx.map((tx) => tx.id);
        await supabase.from('intercompany_transactions').update({ status: 'eliminated' }).in('id', txIds);
      }

      if (!silent) {
        toast({
          title: 'Eliminations appliquees',
          description: `${entriesCount} ecritures eliminees pour un total de ${totalEliminated.toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
          })} EUR.`,
        });
      }

      await fetchData();
      return {
        elimination: data,
        entriesCount,
        totalEliminated,
      };
    },
    [activeCompanyId, applyCompanyScope, fetchData, toast, user, withCompanyScope]
  );

  const autoComputeEliminations = useCallback(async () => {
    if (!user || !supabase || !activeCompanyId) return { processedPeriods: 0, entriesCount: 0, totalEliminated: 0 };

    let txQuery = supabase
      .from('intercompany_transactions')
      .select('id, status, created_at')
      .eq('user_id', user.id)
      .eq('status', 'synced');
    txQuery = applyCompanyScope(txQuery);

    const { data: syncedTransactions, error } = await txQuery;
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      throw error;
    }

    const periods = buildEliminationPeriods(syncedTransactions || []);
    if (periods.length === 0) {
      toast({
        title: 'Aucune elimination a automatiser',
        description: 'Aucune ecriture inter-societes synchronisee en attente.',
      });
      return { processedPeriods: 0, entriesCount: 0, totalEliminated: 0 };
    }

    let processedPeriods = 0;
    let entriesCount = 0;
    let totalEliminated = 0;

    for (const period of periods) {
      const result = await computeEliminations(period.periodStart, period.periodEnd, null, {
        status: 'applied',
        silent: true,
      });
      processedPeriods += 1;
      entriesCount += Number(result?.entriesCount || 0);
      totalEliminated += Number(result?.totalEliminated || 0);
    }

    toast({
      title: 'Automatisation interco terminee',
      description: `${processedPeriods} periode(s), ${entriesCount} ecriture(s), ${totalEliminated.toLocaleString(
        'fr-FR',
        {
          minimumFractionDigits: 2,
        }
      )} EUR elimines.`,
    });

    return { processedPeriods, entriesCount, totalEliminated };
  }, [activeCompanyId, applyCompanyScope, computeEliminations, toast, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    links,
    transactions,
    pricingRules,
    eliminations,
    loading,
    fetchData,
    createLink,
    toggleLink,
    deleteLink,
    syncInvoice,
    updatePricingRule,
    deletePricingRule,
    computeEliminations,
    autoComputeEliminations,
  };
}
