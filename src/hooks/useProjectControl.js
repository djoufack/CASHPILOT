import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const toMonthKey = (value) => {
  const isoDate = toIsoDate(value);
  return isoDate ? isoDate.slice(0, 7) : null;
};

const sortMonthKeys = (monthKeys) => [...monthKeys].sort((a, b) => a.localeCompare(b));

const isMissingProjectIdOnInvoices = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return message.includes('invoices.project_id') || message.includes('column project_id') || details.includes('invoices.project_id');
};

export function useProjectControl(projectId) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [baselines, setBaselines] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [resources, setResources] = useState([]);
  const [compensations, setCompensations] = useState([]);
  const [financeEvents, setFinanceEvents] = useState({ invoices: [], timesheets: [] });

  const fetchProjectControlData = useCallback(async () => {
    if (!user || !projectId || !supabase) return;
    setLoading(true);
    setError(null);

    try {
      let baselinesQuery = supabase
        .from('project_baselines')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false });

      let milestonesQuery = supabase
        .from('project_milestones')
        .select(`
          *,
          linked_invoice:invoices(id, invoice_number, total_ttc, status, payment_status),
          linked_payment:payments(id, amount, payment_date, payment_method)
        `)
        .eq('project_id', projectId)
        .order('planned_date', { ascending: true, nullsFirst: false });

      let resourcesQuery = supabase
        .from('project_resource_allocations')
        .select(`
          *,
          team_member:team_members(id, name, email, role)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      let compensationsQuery = supabase
        .from('team_member_compensations')
        .select(`
          *,
          team_member:team_members!team_member_compensations_team_member_id_fkey(id, name, email, role)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      let timesheetsQuery = supabase
        .from('timesheets')
        .select('id, date, duration_minutes, hourly_rate, invoice_id')
        .eq('project_id', projectId)
        .order('date', { ascending: true });

      baselinesQuery = applyCompanyScope(baselinesQuery);
      milestonesQuery = applyCompanyScope(milestonesQuery);
      resourcesQuery = applyCompanyScope(resourcesQuery);
      compensationsQuery = applyCompanyScope(compensationsQuery);
      timesheetsQuery = applyCompanyScope(timesheetsQuery);

      const [
        baselinesResult,
        milestonesResult,
        resourcesResult,
        compensationsResult,
        timesheetsResult,
      ] = await Promise.all([
        baselinesQuery,
        milestonesQuery,
        resourcesQuery,
        compensationsQuery,
        timesheetsQuery,
      ]);

      const firstError = [
        baselinesResult.error,
        milestonesResult.error,
        resourcesResult.error,
        compensationsResult.error,
        timesheetsResult.error,
      ].find(Boolean);

      if (firstError) throw firstError;

      let invoicesResult = { data: [], error: null };
      let byProjectInvoicesQuery = supabase
        .from('invoices')
        .select('id, date, total_ttc, status, payment_status')
        .eq('project_id', projectId)
        .order('date', { ascending: true });
      byProjectInvoicesQuery = applyCompanyScope(byProjectInvoicesQuery);
      invoicesResult = await byProjectInvoicesQuery;

      if (invoicesResult.error && isMissingProjectIdOnInvoices(invoicesResult.error)) {
        const invoiceIdSet = new Set();
        for (const timesheet of timesheetsResult.data || []) {
          if (timesheet?.invoice_id) invoiceIdSet.add(timesheet.invoice_id);
        }
        for (const milestone of milestonesResult.data || []) {
          if (milestone?.linked_invoice_id) invoiceIdSet.add(milestone.linked_invoice_id);
          if (milestone?.linked_invoice?.id) invoiceIdSet.add(milestone.linked_invoice.id);
        }

        const invoiceIds = [...invoiceIdSet];
        if (invoiceIds.length > 0) {
          let fallbackInvoicesQuery = supabase
            .from('invoices')
            .select('id, date, total_ttc, status, payment_status')
            .in('id', invoiceIds)
            .order('date', { ascending: true });
          fallbackInvoicesQuery = applyCompanyScope(fallbackInvoicesQuery);
          invoicesResult = await fallbackInvoicesQuery;
        } else {
          invoicesResult = { data: [], error: null };
        }
      }

      if (invoicesResult.error) throw invoicesResult.error;

      setBaselines(baselinesResult.data || []);
      setMilestones(milestonesResult.data || []);
      setResources(resourcesResult.data || []);
      setCompensations(compensationsResult.data || []);
      setFinanceEvents({
        invoices: invoicesResult.data || [],
        timesheets: timesheetsResult.data || [],
      });
    } catch (err) {
      setError(err.message || 'Unable to load project control data');
      toast({
        title: 'Erreur de pilotage projet',
        description: err.message || 'Impossible de charger les données de pilotage.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, projectId, toast, user]);

  const createBaseline = useCallback(async (payload) => {
    if (!user || !projectId || !supabase || !isObject(payload)) return null;

    const maxVersion = baselines.reduce((max, baseline) => Math.max(max, Number(baseline.version) || 0), 0);
    const preparedPayload = withCompanyScope({
      user_id: user.id,
      project_id: projectId,
      version: maxVersion + 1,
      baseline_label: payload.baseline_label || `Baseline v${maxVersion + 1}`,
      planned_start_date: payload.planned_start_date || null,
      planned_end_date: payload.planned_end_date || null,
      planned_budget_hours: payload.planned_budget_hours ?? null,
      planned_budget_amount: payload.planned_budget_amount ?? null,
      planned_tasks_count: payload.planned_tasks_count ?? 0,
      notes: payload.notes || null,
      is_active: Boolean(payload.is_active),
    });

    const { data, error: insertError } = await supabase
      .from('project_baselines')
      .insert([preparedPayload])
      .select('*')
      .single();

    if (insertError) throw insertError;

    if (data?.is_active) {
      await supabase
        .from('project_baselines')
        .update({ is_active: false })
        .eq('project_id', projectId)
        .neq('id', data.id);
    }

    await fetchProjectControlData();
    return data;
  }, [baselines, fetchProjectControlData, projectId, supabase, user, withCompanyScope]);

  const setBaselineActive = useCallback(async (baselineId) => {
    if (!baselineId || !projectId || !supabase) return;
    await supabase
      .from('project_baselines')
      .update({ is_active: false })
      .eq('project_id', projectId);

    await supabase
      .from('project_baselines')
      .update({ is_active: true })
      .eq('id', baselineId);

    await fetchProjectControlData();
  }, [fetchProjectControlData, projectId, supabase]);

  const createMilestone = useCallback(async (payload) => {
    if (!user || !projectId || !supabase || !isObject(payload)) return null;

    const preparedPayload = withCompanyScope({
      user_id: user.id,
      project_id: projectId,
      title: payload.title,
      description: payload.description || null,
      status: payload.status || 'planned',
      planned_date: payload.planned_date || null,
      actual_date: payload.actual_date || null,
      planned_amount: payload.planned_amount ?? 0,
      bonus_rule_type: payload.bonus_rule_type || 'none',
      bonus_rule_value: payload.bonus_rule_value ?? 0,
      malus_rule_type: payload.malus_rule_type || 'none',
      malus_rule_value: payload.malus_rule_value ?? 0,
      settled_amount: payload.settled_amount ?? 0,
      notes: payload.notes || null,
    });

    const { data, error: insertError } = await supabase
      .from('project_milestones')
      .insert([preparedPayload])
      .select('*')
      .single();

    if (insertError) throw insertError;
    await fetchProjectControlData();
    return data;
  }, [fetchProjectControlData, projectId, supabase, user, withCompanyScope]);

  const updateMilestone = useCallback(async (milestoneId, payload) => {
    if (!milestoneId || !isObject(payload) || !supabase) return null;

    const { data, error: updateError } = await supabase
      .from('project_milestones')
      .update(withCompanyScope(payload))
      .eq('id', milestoneId)
      .select('*')
      .single();

    if (updateError) throw updateError;
    await fetchProjectControlData();
    return data;
  }, [fetchProjectControlData, supabase, withCompanyScope]);

  const deleteMilestone = useCallback(async (milestoneId) => {
    if (!milestoneId || !supabase) return;

    const { error: deleteError } = await supabase
      .from('project_milestones')
      .delete()
      .eq('id', milestoneId);

    if (deleteError) throw deleteError;
    await fetchProjectControlData();
  }, [fetchProjectControlData, supabase]);

  const createResource = useCallback(async (payload) => {
    if (!user || !projectId || !supabase || !isObject(payload)) return null;
    const preparedPayload = withCompanyScope({
      user_id: user.id,
      project_id: projectId,
      resource_type: payload.resource_type,
      team_member_id: payload.team_member_id || null,
      resource_name: payload.resource_name || null,
      unit: payload.unit || 'hour',
      planned_quantity: payload.planned_quantity ?? 0,
      actual_quantity: payload.actual_quantity ?? 0,
      planned_cost: payload.planned_cost ?? 0,
      actual_cost: payload.actual_cost ?? 0,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      status: payload.status || 'planned',
      notes: payload.notes || null,
    });

    const { data, error: insertError } = await supabase
      .from('project_resource_allocations')
      .insert([preparedPayload])
      .select('*')
      .single();

    if (insertError) throw insertError;
    await fetchProjectControlData();
    return data;
  }, [fetchProjectControlData, projectId, supabase, user, withCompanyScope]);

  const deleteResource = useCallback(async (resourceId) => {
    if (!resourceId || !supabase) return;
    const { error: deleteError } = await supabase
      .from('project_resource_allocations')
      .delete()
      .eq('id', resourceId);
    if (deleteError) throw deleteError;
    await fetchProjectControlData();
  }, [fetchProjectControlData, supabase]);

  const markCompensationPaid = useCallback(async (compensationId, paymentReference = null) => {
    if (!compensationId || !supabase) return;
    const { error: updateError } = await supabase
      .from('team_member_compensations')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        payment_reference: paymentReference || null,
      })
      .eq('id', compensationId);

    if (updateError) throw updateError;
    await fetchProjectControlData();
  }, [fetchProjectControlData, supabase]);

  useEffect(() => {
    fetchProjectControlData();
  }, [fetchProjectControlData]);

  const activeBaseline = useMemo(
    () => baselines.find((baseline) => baseline.is_active) || baselines[0] || null,
    [baselines],
  );

  const financialCurve = useMemo(() => {
    const invoiceRows = financeEvents.invoices || [];
    const timesheetRows = financeEvents.timesheets || [];
    const compensationRows = compensations || [];

    const monthKeys = new Set();

    const revenueByMonth = {};
    const costByMonth = {};

    for (const invoice of invoiceRows) {
      const monthKey = toMonthKey(invoice.date);
      if (!monthKey) continue;
      monthKeys.add(monthKey);
      revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + toNumber(invoice.total_ttc);
    }

    for (const timesheet of timesheetRows) {
      const monthKey = toMonthKey(timesheet.date);
      if (!monthKey) continue;
      monthKeys.add(monthKey);
      const hours = toNumber(timesheet.duration_minutes) / 60;
      costByMonth[monthKey] = (costByMonth[monthKey] || 0) + (hours * toNumber(timesheet.hourly_rate));
    }

    for (const compensation of compensationRows) {
      const monthKey = toMonthKey(compensation.paid_at || compensation.planned_payment_date);
      if (!monthKey) continue;
      monthKeys.add(monthKey);
      costByMonth[monthKey] = (costByMonth[monthKey] || 0) + toNumber(compensation.amount);
    }

    const sortedMonthKeys = sortMonthKeys(monthKeys);
    let cumulativeRevenue = 0;
    let cumulativeCost = 0;

    return sortedMonthKeys.map((monthKey) => {
      const monthRevenue = toNumber(revenueByMonth[monthKey]);
      const monthCost = toNumber(costByMonth[monthKey]);
      cumulativeRevenue += monthRevenue;
      cumulativeCost += monthCost;
      return {
        period: monthKey,
        monthRevenue: Number(monthRevenue.toFixed(2)),
        monthCost: Number(monthCost.toFixed(2)),
        monthMargin: Number((monthRevenue - monthCost).toFixed(2)),
        revenue: Number(cumulativeRevenue.toFixed(2)),
        cost: Number(cumulativeCost.toFixed(2)),
        margin: Number((cumulativeRevenue - cumulativeCost).toFixed(2)),
      };
    });
  }, [compensations, financeEvents.invoices, financeEvents.timesheets]);

  return {
    loading,
    error,
    baselines,
    activeBaseline,
    milestones,
    resources,
    compensations,
    financeEvents,
    financialCurve,
    fetchProjectControlData,
    createBaseline,
    setBaselineActive,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    createResource,
    deleteResource,
    markCompensationPaid,
  };
}
