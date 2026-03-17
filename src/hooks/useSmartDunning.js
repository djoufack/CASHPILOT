import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

/**
 * Hook for Smart Dunning IA.
 * Manages campaigns, executions, AI client scores/suggestions, and stats.
 *
 * @returns {{
 *   campaigns, executions, clientScores, stats,
 *   loading, error,
 *   fetchCampaigns, fetchExecutions, fetchClientScores,
 *   createCampaign, updateCampaign, deleteCampaign,
 *   launchDunning, toggleCampaign
 * }}
 */
export const useSmartDunning = () => {
  const { user } = useAuth();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [campaigns, setCampaigns] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [clientScores, setClientScores] = useState([]);
  const [stats, setStats] = useState({
    totalOverdue: 0,
    recoveredAmount: 0,
    recoveryRate: 0,
    activeCampaigns: 0,
    totalSent: 0,
    totalPaid: 0,
    channelBreakdown: {},
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ------------------------------------------
  // Fetch AI client scores via RPC
  // ------------------------------------------
  const fetchClientScores = useCallback(async () => {
    if (!user || !activeCompanyId) return;

    try {
      const { data, error: rpcError } = await supabase.rpc('get_smart_dunning_suggestions', {
        p_company_id: activeCompanyId,
      });

      if (rpcError) throw rpcError;

      const result = data || {};
      const suggestions = result.suggestions || [];
      const rpcStats = result.stats || {};

      // Map suggestions to client scores with normalized fields
      const scores = suggestions.map((s) => ({
        clientId: s.client_id,
        clientName: s.client_name || 'Client inconnu',
        clientEmail: s.client_email,
        clientPhone: s.client_phone,
        score: s.ai_score ?? 0,
        invoiceId: s.invoice_id,
        invoiceNumber: s.invoice_number,
        totalTtc: s.total_ttc ?? 0,
        balanceDue: s.balance_due ?? 0,
        dueDate: s.due_date,
        daysOverdue: s.days_overdue ?? 0,
        recommendedChannel: s.recommended_channel,
        recommendedTone: s.recommended_tone,
        urgency: s.urgency,
        paymentHistory: s.payment_history,
        dunningHistory: s.dunning_history,
        recommendedStep: s.recommended_step,
      }));

      setClientScores(scores);

      // Update total overdue from RPC stats
      setStats((prev) => ({
        ...prev,
        totalOverdue: rpcStats.total_overdue_amount ?? prev.totalOverdue,
      }));
    } catch (err) {
      console.error('useSmartDunning fetchClientScores error:', err);
      // Non-critical: don't overwrite main error
    }
  }, [user, activeCompanyId]);

  // ------------------------------------------
  // Fetch campaigns
  // ------------------------------------------
  const fetchCampaigns = useCallback(async () => {
    if (!user || !activeCompanyId) return;

    try {
      let query = supabase.from('dunning_campaigns').select('*').order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setCampaigns(data || []);
    } catch (err) {
      console.error('useSmartDunning fetchCampaigns error:', err);
      setError(err.message || 'Failed to fetch campaigns');
    }
  }, [user, activeCompanyId, applyCompanyScope]);

  // ------------------------------------------
  // Fetch executions with invoice & client joins
  // ------------------------------------------
  const fetchExecutions = useCallback(
    async (filters = {}) => {
      if (!user || !activeCompanyId) return;

      try {
        let query = supabase
          .from('dunning_executions')
          .select(
            `
            *,
            dunning_campaigns:campaign_id (name, strategy),
            invoices:invoice_id (id, invoice_number, total_ttc, balance_due, due_date),
            clients:client_id (id, company_name, email, phone)
          `
          )
          .order('created_at', { ascending: false });

        query = applyCompanyScope(query);

        if (filters.campaign_id) {
          query = query.eq('campaign_id', filters.campaign_id);
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.invoice_id) {
          query = query.eq('invoice_id', filters.invoice_id);
        }
        if (filters.client_id) {
          query = query.eq('client_id', filters.client_id);
        }

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        setExecutions(data || []);
      } catch (err) {
        console.error('useSmartDunning fetchExecutions error:', err);
        setError(err.message || 'Failed to fetch executions');
      }
    },
    [user, activeCompanyId, applyCompanyScope]
  );

  // ------------------------------------------
  // Create a campaign with optional templates
  // ------------------------------------------
  const createCampaign = useCallback(
    async (campaignData, templates = []) => {
      if (!user || !activeCompanyId) return null;
      setError(null);

      try {
        const payload = withCompanyScope({
          ...campaignData,
          user_id: user.id,
        });

        const { data: campaign, error: insertError } = await supabase
          .from('dunning_campaigns')
          .insert(payload)
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert templates if provided
        if (templates.length > 0) {
          const templatePayloads = templates.map((tpl) =>
            withCompanyScope({
              ...tpl,
              user_id: user.id,
              campaign_id: campaign.id,
            })
          );

          const { error: tplError } = await supabase.from('dunning_templates').insert(templatePayloads);

          if (tplError) {
            console.error('Template insert error:', tplError);
          }
        }

        await fetchCampaigns();
        return campaign;
      } catch (err) {
        console.error('useSmartDunning createCampaign error:', err);
        setError(err.message || 'Failed to create campaign');
        return null;
      }
    },
    [user, activeCompanyId, withCompanyScope, fetchCampaigns]
  );

  // ------------------------------------------
  // Update a campaign
  // ------------------------------------------
  const updateCampaign = useCallback(
    async (campaignId, updates) => {
      if (!user || !activeCompanyId) return null;
      setError(null);

      try {
        const { data, error: updateError } = await supabase
          .from('dunning_campaigns')
          .update(updates)
          .eq('id', campaignId)
          .select()
          .single();

        if (updateError) throw updateError;

        await fetchCampaigns();
        return data;
      } catch (err) {
        console.error('useSmartDunning updateCampaign error:', err);
        setError(err.message || 'Failed to update campaign');
        return null;
      }
    },
    [user, activeCompanyId, fetchCampaigns]
  );

  // ------------------------------------------
  // Toggle campaign active status
  // ------------------------------------------
  const toggleCampaign = useCallback(
    async (campaignId, isActive) => {
      return updateCampaign(campaignId, { is_active: isActive });
    },
    [updateCampaign]
  );

  // ------------------------------------------
  // Delete a campaign
  // ------------------------------------------
  const deleteCampaign = useCallback(
    async (campaignId) => {
      if (!user || !activeCompanyId) return false;
      setError(null);

      try {
        const { error: deleteError } = await supabase.from('dunning_campaigns').delete().eq('id', campaignId);

        if (deleteError) throw deleteError;

        await fetchCampaigns();
        return true;
      } catch (err) {
        console.error('useSmartDunning deleteCampaign error:', err);
        setError(err.message || 'Failed to delete campaign');
        return false;
      }
    },
    [user, activeCompanyId, fetchCampaigns]
  );

  // ------------------------------------------
  // Launch dunning via Edge Function
  // ------------------------------------------
  const launchDunning = useCallback(
    async (params) => {
      if (!user || !activeCompanyId) return null;
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Session expired');
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/dunning-execute`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_id: activeCompanyId,
            ...params,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMsg;
          try {
            const errorJson = JSON.parse(errorText);
            errorMsg = errorJson.error || `Server error (${response.status})`;
          } catch {
            errorMsg = `Server error (${response.status})`;
          }
          throw new Error(errorMsg);
        }

        const result = await response.json();

        // Refresh executions after launch
        await fetchExecutions();

        return result;
      } catch (err) {
        console.error('useSmartDunning launchDunning error:', err);
        setError(err.message || 'Failed to launch dunning');
        return null;
      }
    },
    [user, activeCompanyId, fetchExecutions]
  );

  // ------------------------------------------
  // Compute stats from executions + campaigns + client scores
  // ------------------------------------------
  const computeStats = useCallback(() => {
    const activeCampaigns = campaigns.filter((c) => c.is_active).length;

    // Total overdue from client scores
    const totalOverdue = clientScores.reduce((sum, s) => sum + (s.balanceDue || 0), 0);

    // Recovered amount = executions with status 'paid'
    const paidExecutions = executions.filter((e) => e.status === 'paid');
    const recoveredAmount = paidExecutions.reduce((sum, e) => {
      const amount = e.invoices?.balance_due ?? e.invoices?.total_ttc ?? 0;
      return sum + Number(amount);
    }, 0);

    // Recovery rate
    const totalSent = executions.filter((e) => e.status !== 'pending' && e.status !== 'failed').length;
    const recoveryRate = totalSent > 0 ? Math.round((paidExecutions.length / totalSent) * 100) : 0;

    // Channel breakdown
    const channelBreakdown = executions.reduce((acc, e) => {
      acc[e.channel] = (acc[e.channel] || 0) + 1;
      return acc;
    }, {});

    setStats((prev) => ({
      ...prev,
      totalOverdue: totalOverdue || prev.totalOverdue,
      recoveredAmount,
      recoveryRate,
      activeCampaigns,
      totalSent,
      totalPaid: paidExecutions.length,
      channelBreakdown,
    }));
  }, [campaigns, executions, clientScores]);

  // ------------------------------------------
  // Auto-fetch on mount
  // ------------------------------------------
  useEffect(() => {
    if (user && activeCompanyId) {
      setLoading(true);
      Promise.allSettled([fetchCampaigns(), fetchExecutions(), fetchClientScores()])
        .then((results) => {
          results.forEach((r, i) => {
            if (r.status === 'rejected') console.error(`SmartDunning initial fetch ${i} failed:`, r.reason);
          });
        })
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeCompanyId]);

  // Recompute stats when data changes
  useEffect(() => {
    computeStats();
  }, [computeStats]);

  return {
    campaigns,
    executions,
    clientScores,
    stats,
    loading,
    error,
    fetchCampaigns,
    fetchExecutions,
    fetchClientScores,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    launchDunning,
    toggleCampaign,
  };
};
