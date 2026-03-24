import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { readFunctionErrorData } from '@/utils/supabaseFunctionErrors';

/**
 * Hook that encapsulates all Peppol-related Supabase queries and mutations.
 * Replaces direct supabase.from() and supabase.functions.invoke() calls
 * previously embedded in PeppolPage.jsx.
 */
export function usePeppol() {
  const { user } = useAuth();
  const { company } = useCompany();
  const { applyCompanyScope } = useCompanyScope();

  // ─── Outbound invoices ───
  const {
    data: invoices,
    loading: loadingInvoices,
    refetch: fetchOutboundInvoices,
  } = useSupabaseQuery(
    async (_guard) => {
      if (!user) return [];
      let query = supabase
        .from('invoices')
        .select(
          `
          *,
          client:clients!fk_invoices_client_scope(id, company_name, contact_name, peppol_endpoint_id, peppol_scheme_id, electronic_invoicing_enabled)
        `
        )
        .eq('user_id', user.id)
        .eq('status', 'sent')
        .order('created_at', { ascending: false });
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user?.id, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // ─── Inbound logs ───
  const {
    data: inboundLogs,
    loading: loadingInbound,
    refetch: fetchInboundLogs,
  } = useSupabaseQuery(
    async (_guard) => {
      if (!user) return [];
      let query = supabase
        .from('peppol_transmission_log')
        .select(`*, invoice:invoices(id, invoice_number)`)
        .eq('user_id', user.id)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false });
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user?.id, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // ─── All transmission logs ───
  const {
    data: allLogs,
    loading: loadingLogs,
    refetch: fetchAllLogs,
  } = useSupabaseQuery(
    async (_guard) => {
      if (!user) return [];
      let query = supabase
        .from('peppol_transmission_log')
        .select(`*, invoice:invoices(id, invoice_number)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user?.id, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // ─── AP account info ───
  const [apInfo, setApInfo] = useState(null);
  const [loadingApInfo, setLoadingApInfo] = useState(false);

  const fetchApInfo = useCallback(async () => {
    if (!user) return;
    setLoadingApInfo(true);
    try {
      const { data, error } = await supabase.functions.invoke('peppol-account-info', {
        body: { company_id: company?.id || null },
      });
      if (error) throw error;
      setApInfo(data);
    } catch (err) {
      console.error('Error fetching AP info:', err);
      setApInfo(null);
    } finally {
      setLoadingApInfo(false);
    }
  }, [company?.id, user]);

  // ─── Fetch invoice items (for send dialog, view, UBL export) ───
  const fetchInvoiceItems = useCallback(async (invoiceId) => {
    const { data, error } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId);
    if (error) throw error;
    return data || [];
  }, []);

  // ─── Sync inbound (edge function) ───
  const [syncingInbound, setSyncingInbound] = useState(false);

  const syncInbound = useCallback(async () => {
    if (!user) return null;
    setSyncingInbound(true);
    try {
      const { data, error } = await supabase.functions.invoke('peppol-inbound', {
        body: { action: 'sync', company_id: company?.id || null },
      });
      if (error) throw error;
      return data;
    } catch (err) {
      const details = await readFunctionErrorData(err);
      throw details || err;
    } finally {
      setSyncingInbound(false);
    }
  }, [company?.id, user]);

  // ─── Refresh all data ───
  const refreshAll = useCallback(() => {
    fetchOutboundInvoices();
    fetchInboundLogs();
    fetchAllLogs();
  }, [fetchAllLogs, fetchInboundLogs, fetchOutboundInvoices]);

  return {
    // Outbound invoices
    invoices,
    loadingInvoices,
    fetchOutboundInvoices,

    // Inbound logs
    inboundLogs,
    loadingInbound,
    fetchInboundLogs,

    // All logs (journal)
    allLogs,
    loadingLogs,
    fetchAllLogs,

    // AP info
    apInfo,
    loadingApInfo,
    fetchApInfo,

    // Invoice items
    fetchInvoiceItems,

    // Sync inbound
    syncingInbound,
    syncInbound,

    // Convenience
    refreshAll,
  };
}
