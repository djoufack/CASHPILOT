import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

/**
 * Hook for PDP / Certification Fiscale compliance management.
 * Fetches compliance status, audit trail, archive stats,
 * and provides actions (update status, submit to Chorus Pro, run audit).
 */
export function usePdpCompliance() {
  const { user } = useAuth();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [submitting, setSubmitting] = useState(false);
  const [auditing, setAuditing] = useState(false);

  // ─── Compliance status for all 4 certification types ───
  const {
    data: complianceStatus,
    loading: loadingStatus,
    refetch: refetchStatus,
  } = useSupabaseQuery(
    async () => {
      if (!user) return [];
      let query = supabase
        .from('pdp_compliance_status')
        .select('*')
        .eq('user_id', user.id)
        .order('certification_type', { ascending: true });
      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user?.id, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // ─── Recent audit trail entries (last 50) ───
  const {
    data: auditTrail,
    loading: loadingAudit,
    refetch: refetchAudit,
  } = useSupabaseQuery(
    async () => {
      if (!user) return [];
      let query = supabase
        .from('pdp_audit_trail')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(50);
      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user?.id, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // ─── Archive statistics ───
  const {
    data: archiveStats,
    loading: loadingArchive,
    refetch: refetchArchive,
  } = useSupabaseQuery(
    async () => {
      if (!user) return { total: 0, byFormat: {}, expiringSoon: 0 };
      let query = supabase.from('pdp_archive').select('id, format, retention_until').eq('user_id', user.id);
      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) throw error;

      const items = data || [];
      const byFormat = {};
      let expiringSoon = 0;
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      for (const item of items) {
        byFormat[item.format] = (byFormat[item.format] || 0) + 1;
        if (item.retention_until) {
          const retDate = new Date(item.retention_until);
          if (retDate <= thirtyDaysFromNow) {
            expiringSoon++;
          }
        }
      }

      return { total: items.length, byFormat, expiringSoon };
    },
    {
      deps: [user?.id, applyCompanyScope],
      defaultData: { total: 0, byFormat: {}, expiringSoon: 0 },
      enabled: !!user,
    }
  );

  // ─── Update compliance status ───
  const updateStatus = useCallback(
    async (certType, updates) => {
      if (!user || !activeCompanyId) return null;

      // Upsert: insert if not exists, update if exists
      const payload = withCompanyScope({
        user_id: user.id,
        certification_type: certType,
        ...updates,
      });

      const { data, error } = await supabase
        .from('pdp_compliance_status')
        .upsert(payload, { onConflict: 'company_id,certification_type' })
        .select()
        .single();

      if (error) throw error;
      await refetchStatus();
      return data;
    },
    [user, activeCompanyId, withCompanyScope, refetchStatus]
  );

  // ─── Submit invoice to Chorus Pro ───
  const submitToChorus = useCallback(
    async (invoiceId) => {
      if (!user || !activeCompanyId) return null;

      setSubmitting(true);
      try {
        const { data, error } = await supabase.functions.invoke('chorus-pro-submit', {
          body: { invoice_id: invoiceId, company_id: activeCompanyId },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        await refetchAudit();
        return data;
      } finally {
        setSubmitting(false);
      }
    },
    [user, activeCompanyId, refetchAudit]
  );

  // ─── Run audit: verify all invoices have audit trail entries ───
  const runAudit = useCallback(async () => {
    if (!user || !activeCompanyId) return null;

    setAuditing(true);
    try {
      // Fetch all invoices for the company
      let invQuery = supabase.from('invoices').select('id, invoice_number, status').eq('user_id', user.id);
      invQuery = applyCompanyScope(invQuery);
      const { data: invoices, error: invError } = await invQuery;
      if (invError) throw invError;

      // Fetch all audit trail entries for invoices
      let auditQuery = supabase
        .from('pdp_audit_trail')
        .select('entity_id')
        .eq('user_id', user.id)
        .eq('entity_type', 'invoice');
      auditQuery = applyCompanyScope(auditQuery);
      const { data: auditEntries, error: auditError } = await auditQuery;
      if (auditError) throw auditError;

      const auditedIds = new Set((auditEntries || []).map((e) => e.entity_id));
      const allInvoices = invoices || [];
      const missing = allInvoices.filter((inv) => !auditedIds.has(inv.id));
      const coverage =
        allInvoices.length > 0 ? Math.round(((allInvoices.length - missing.length) / allInvoices.length) * 100) : 100;

      // Update NF525 compliance progress based on audit coverage
      await updateStatus('nf525', {
        progress_percent: coverage,
        last_audit_date: new Date().toISOString().split('T')[0],
        status: coverage === 100 ? 'certified' : coverage > 0 ? 'in_progress' : 'not_started',
      });

      return {
        totalInvoices: allInvoices.length,
        audited: allInvoices.length - missing.length,
        missing: missing.length,
        coverage,
        missingInvoices: missing.slice(0, 10), // Return first 10 for display
      };
    } finally {
      setAuditing(false);
    }
  }, [user, activeCompanyId, applyCompanyScope, updateStatus]);

  const loading = loadingStatus || loadingAudit || loadingArchive;

  return {
    complianceStatus,
    auditTrail,
    archiveStats,
    loading,
    loadingStatus,
    loadingAudit,
    loadingArchive,
    submitting,
    auditing,
    updateStatus,
    submitToChorus,
    runAudit,
    refetchStatus,
    refetchAudit,
    refetchArchive,
  };
}
