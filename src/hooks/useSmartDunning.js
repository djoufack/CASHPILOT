import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { isMissingRelationError } from '@/lib/supabaseCompatibility';

const SMART_DUNNING_RULE_CATEGORY = 'smart_dunning';
const DEFAULT_SMART_DUNNING_RULES = [
  {
    dunning_step: 1,
    name: 'Relance J+5',
    days_after_due: 5,
    channel: 'email',
    tone: 'friendly',
    max_reminders: 1,
    is_active: true,
  },
  {
    dunning_step: 2,
    name: 'Relance J+15',
    days_after_due: 15,
    channel: 'sms',
    tone: 'professional',
    max_reminders: 1,
    is_active: true,
  },
  {
    dunning_step: 3,
    name: 'Relance J+30',
    days_after_due: 30,
    channel: 'whatsapp',
    tone: 'firm',
    max_reminders: 1,
    is_active: true,
  },
];

export const selectDunningRuleForDays = (rules = [], daysOverdue = 0) => {
  const safeDays = Number(daysOverdue) || 0;

  const eligibleRules = (Array.isArray(rules) ? rules : [])
    .filter(
      (rule) =>
        rule &&
        rule.rule_category === SMART_DUNNING_RULE_CATEGORY &&
        rule.is_active !== false &&
        Number.isFinite(Number(rule.days_after_due)) &&
        Number(rule.days_after_due) <= safeDays
    )
    .sort((a, b) => {
      const daysDiff = Number(b.days_after_due) - Number(a.days_after_due);
      if (daysDiff !== 0) return daysDiff;
      return Number(a.dunning_step || 999) - Number(b.dunning_step || 999);
    });

  return eligibleRules[0] || null;
};

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
  const [dunningRules, setDunningRules] = useState([]);
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

  const buildFallbackSuggestions = useCallback(async () => {
    if (!user || !activeCompanyId) {
      return { suggestions: [], totalOverdue: 0 };
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const { data: invoiceRows, error: invoicesError } = await supabase
      .from('invoices')
      .select(
        `
        id,
        invoice_number,
        total_ttc,
        balance_due,
        due_date,
        client_id,
        clients (
          id,
          company_name,
          email,
          phone
        )
      `
      )
      .eq('user_id', user.id)
      .eq('company_id', activeCompanyId)
      .in('payment_status', ['unpaid', 'partial'])
      .lt('due_date', todayIso)
      .in('status', ['sent', 'overdue', 'accepted'])
      .order('due_date', { ascending: true });

    if (invoicesError) throw invoicesError;

    const overdueInvoices = Array.isArray(invoiceRows) ? invoiceRows : [];
    const invoiceIds = overdueInvoices.map((invoice) => invoice.id);

    const executionHistoryByInvoice = new Map();
    if (invoiceIds.length > 0) {
      const { data: executionRows, error: executionsError } = await supabase
        .from('dunning_executions')
        .select('invoice_id, sent_at, status')
        .eq('user_id', user.id)
        .eq('company_id', activeCompanyId)
        .in('invoice_id', invoiceIds);

      if (executionsError) throw executionsError;

      for (const execution of executionRows || []) {
        if (execution.status === 'pending' || execution.status === 'failed') continue;
        const current = executionHistoryByInvoice.get(execution.invoice_id) || { count: 0, lastSent: null };
        current.count += 1;
        if (!current.lastSent || new Date(execution.sent_at) > new Date(current.lastSent)) {
          current.lastSent = execution.sent_at;
        }
        executionHistoryByInvoice.set(execution.invoice_id, current);
      }
    }

    const now = Date.now();
    let totalOverdue = 0;
    const suggestions = overdueInvoices.map((invoice) => {
      const balanceDue = Number(invoice.balance_due ?? invoice.total_ttc ?? 0);
      totalOverdue += balanceDue;

      const dueDateIso = invoice.due_date || todayIso;
      const daysOverdue = Math.max(0, Math.floor((now - new Date(`${dueDateIso}T00:00:00Z`).getTime()) / 86400000));
      const history = executionHistoryByInvoice.get(invoice.id) || { count: 0, lastSent: null };

      let recommendedChannel = 'email';
      let recommendedTone = 'friendly';
      let urgency = 'low';

      if (daysOverdue > 15) {
        recommendedTone = 'firm';
        urgency = 'high';
      }
      if (daysOverdue > 30) {
        recommendedTone = 'urgent';
        urgency = 'critical';
        recommendedChannel = invoice.clients?.phone ? 'whatsapp' : 'letter';
      }
      if (daysOverdue > 7 && daysOverdue <= 30 && invoice.clients?.phone) {
        recommendedChannel = 'sms';
      }

      return {
        client_id: invoice.client_id,
        client_name: invoice.clients?.company_name || 'Client inconnu',
        client_email: invoice.clients?.email || null,
        client_phone: invoice.clients?.phone || null,
        ai_score: Math.max(1, 90 - daysOverdue - history.count * 5),
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        total_ttc: Number(invoice.total_ttc || 0),
        balance_due: balanceDue,
        due_date: dueDateIso,
        days_overdue: daysOverdue,
        recommended_channel: recommendedChannel,
        recommended_tone: recommendedTone,
        urgency,
        payment_history: null,
        dunning_history: {
          count: history.count,
          last_sent: history.lastSent,
        },
        recommended_step: Math.min(history.count + 1, 5),
      };
    });

    return { suggestions, totalOverdue };
  }, [user, activeCompanyId]);

  // ------------------------------------------
  // Fetch AI client scores via RPC
  // ------------------------------------------
  const fetchClientScores = useCallback(async () => {
    if (!user || !activeCompanyId) return;

    try {
      const { data, error: rpcError } = await supabase.rpc('get_smart_dunning_suggestions', {
        p_company_id: activeCompanyId,
      });

      let suggestions = [];
      let rpcStats = {};

      if (rpcError) {
        if (isMissingRelationError(rpcError, 'public.dunning_history')) {
          const fallback = await buildFallbackSuggestions();
          suggestions = fallback.suggestions;
          rpcStats = { total_overdue_amount: fallback.totalOverdue };
          console.warn('Smart dunning fallback activated: dunning_history table missing.');
        } else {
          throw rpcError;
        }
      } else {
        const result = data || {};
        suggestions = result.suggestions || [];
        rpcStats = result.stats || {};
      }

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
        dunningHistory: s.dunning_history || s.dunningHistory,
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
  }, [user, activeCompanyId, buildFallbackSuggestions]);

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
            clients (id, company_name, email, phone)
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
  // Fetch Smart Dunning company rules (J+5/J+15/J+30)
  // ------------------------------------------
  const fetchDunningRules = useCallback(async () => {
    if (!user || !activeCompanyId) return [];

    try {
      let query = supabase
        .from('payment_reminder_rules')
        .select(
          'id, name, days_after_due, max_reminders, is_active, rule_category, dunning_step, channel, tone, updated_at'
        )
        .eq('user_id', user.id)
        .eq('rule_category', SMART_DUNNING_RULE_CATEGORY)
        .order('dunning_step', { ascending: true })
        .order('days_after_due', { ascending: true });

      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      let nextRules = Array.isArray(data) ? data : [];

      // Ensure default J+5/J+15/J+30 rules exist for each company.
      if (nextRules.length === 0) {
        const payloads = DEFAULT_SMART_DUNNING_RULES.map((rule) =>
          withCompanyScope({
            user_id: user.id,
            name: rule.name,
            days_before_due: 0,
            days_after_due: rule.days_after_due,
            max_reminders: rule.max_reminders,
            is_active: rule.is_active,
            rule_category: SMART_DUNNING_RULE_CATEGORY,
            dunning_step: rule.dunning_step,
            channel: rule.channel,
            tone: rule.tone,
            updated_at: new Date().toISOString(),
          })
        );

        const { error: upsertError } = await supabase.from('payment_reminder_rules').upsert(payloads, {
          onConflict: 'company_id,rule_category,dunning_step',
        });

        if (upsertError) throw upsertError;

        let retryQuery = supabase
          .from('payment_reminder_rules')
          .select(
            'id, name, days_after_due, max_reminders, is_active, rule_category, dunning_step, channel, tone, updated_at'
          )
          .eq('user_id', user.id)
          .eq('rule_category', SMART_DUNNING_RULE_CATEGORY)
          .order('dunning_step', { ascending: true })
          .order('days_after_due', { ascending: true });

        retryQuery = applyCompanyScope(retryQuery, { includeUnassigned: false });
        const { data: seededRules, error: retryError } = await retryQuery;
        if (retryError) throw retryError;
        nextRules = Array.isArray(seededRules) ? seededRules : [];
      }

      setDunningRules(nextRules);
      return nextRules;
    } catch (err) {
      console.error('useSmartDunning fetchDunningRules error:', err);
      setError(err.message || 'Failed to fetch dunning rules');
      return [];
    }
  }, [activeCompanyId, applyCompanyScope, user, withCompanyScope]);

  // ------------------------------------------
  // Update one Smart Dunning rule
  // ------------------------------------------
  const updateDunningRule = useCallback(
    async (ruleId, updates) => {
      if (!user || !activeCompanyId || !ruleId) return null;

      try {
        const normalizedUpdates = withCompanyScope({
          ...updates,
          updated_at: new Date().toISOString(),
        });

        const { data, error: updateError } = await supabase
          .from('payment_reminder_rules')
          .update(normalizedUpdates)
          .eq('id', ruleId)
          .eq('user_id', user.id)
          .eq('company_id', activeCompanyId)
          .eq('rule_category', SMART_DUNNING_RULE_CATEGORY)
          .select(
            'id, name, days_after_due, max_reminders, is_active, rule_category, dunning_step, channel, tone, updated_at'
          )
          .single();

        if (updateError) throw updateError;

        await fetchDunningRules();
        return data;
      } catch (err) {
        console.error('useSmartDunning updateDunningRule error:', err);
        setError(err.message || 'Failed to update dunning rule');
        return null;
      }
    },
    [activeCompanyId, fetchDunningRules, user, withCompanyScope]
  );

  const toggleDunningRule = useCallback(
    async (ruleId, isActive) => updateDunningRule(ruleId, { is_active: isActive }),
    [updateDunningRule]
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
          .eq('company_id', activeCompanyId)
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
        const { error: deleteError } = await supabase
          .from('dunning_campaigns')
          .delete()
          .eq('id', campaignId)
          .eq('company_id', activeCompanyId);

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
      Promise.allSettled([fetchCampaigns(), fetchExecutions(), fetchClientScores(), fetchDunningRules()])
        .then((results) => {
          results.forEach((r, i) => {
            if (r.status === 'rejected') console.error(`SmartDunning initial fetch ${i} failed:`, r.reason);
          });
        })
        .finally(() => setLoading(false));
    }
  }, [user, activeCompanyId, fetchCampaigns, fetchExecutions, fetchClientScores, fetchDunningRules]);

  // Recompute stats when data changes
  useEffect(() => {
    computeStats();
  }, [computeStats]);

  return {
    campaigns,
    executions,
    clientScores,
    dunningRules,
    stats,
    loading,
    error,
    fetchCampaigns,
    fetchExecutions,
    fetchClientScores,
    fetchDunningRules,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    launchDunning,
    toggleCampaign,
    updateDunningRule,
    toggleDunningRule,
  };
};
