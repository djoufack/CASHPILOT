import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const DEFAULT_TICKET_STATUS = 'open';
const DEFAULT_TICKET_PRIORITY = 'medium';
const DEFAULT_SLA_LEVEL = 'standard';

export function useCrmSupport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId } = useCompanyScope();

  const [tickets, setTickets] = useState([]);
  const [slaPolicies, setSlaPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchCrmSupport = useCallback(async () => {
    if (!supabase || !user || !activeCompanyId) {
      setTickets([]);
      setSlaPolicies([]);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const _results = await Promise.allSettled([
        supabase
          .from('crm_support_tickets')
          .select(
            `
            id,
            ticket_number,
            title,
            description,
            priority,
            status,
            sla_level,
            due_at,
            first_response_at,
            resolved_at,
            closed_at,
            created_at,
            updated_at,
            client_id,
            project_id,
            client:clients!fk_crm_support_tickets_client_scope(company_name),
            project:projects!fk_crm_support_tickets_project_scope(name)
          `
          )
          .eq('company_id', activeCompanyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('crm_support_sla_policies')
          .select('*')
          .eq('company_id', activeCompanyId)
          .order('target_first_response_minutes', { ascending: true }),
      ]);

      _results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`CrmSupport fetch ${i} failed:`, r.reason);
      });

      const ticketsResult = _results[0].status === 'fulfilled' ? _results[0].value : { data: null, error: null };
      const policiesResult = _results[1].status === 'fulfilled' ? _results[1].value : { data: null, error: null };

      if (ticketsResult.error) console.error('CrmSupport tickets query error:', ticketsResult.error);
      if (policiesResult.error) console.error('CrmSupport policies query error:', policiesResult.error);

      setTickets(ticketsResult.data || []);
      setSlaPolicies(policiesResult.data || []);
    } catch (fetchError) {
      const message = fetchError?.message || 'Impossible de charger le support CRM.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, user]);

  useEffect(() => {
    fetchCrmSupport();
  }, [fetchCrmSupport]);

  const createTicket = useCallback(
    async (payload) => {
      if (!supabase || !user || !activeCompanyId) return null;

      const ticketPayload = {
        ...payload,
        user_id: user.id,
        company_id: activeCompanyId,
        status: payload.status || DEFAULT_TICKET_STATUS,
        priority: payload.priority || DEFAULT_TICKET_PRIORITY,
        sla_level: payload.sla_level || DEFAULT_SLA_LEVEL,
      };

      const { data, error: insertError } = await supabase
        .from('crm_support_tickets')
        .insert([ticketPayload])
        .select(
          `
        id,
        ticket_number,
        title,
        description,
        priority,
        status,
        sla_level,
        due_at,
        first_response_at,
        resolved_at,
        closed_at,
        created_at,
        updated_at,
        client_id,
        project_id,
        client:clients!fk_crm_support_tickets_client_scope(company_name),
        project:projects!fk_crm_support_tickets_project_scope(name)
      `
        )
        .single();

      if (insertError) {
        toast({
          title: 'Erreur',
          description: insertError.message,
          variant: 'destructive',
        });
        throw insertError;
      }

      setTickets((prev) => [data, ...prev]);
      toast({
        title: 'Ticket créé',
        description: `${data.ticket_number || 'Ticket'} créé avec succès.`,
      });
      return data;
    },
    [activeCompanyId, toast, user]
  );

  const updateTicket = useCallback(
    async (ticketId, payload) => {
      if (!supabase || !user || !activeCompanyId || !ticketId) return null;

      const { data, error: updateError } = await supabase
        .from('crm_support_tickets')
        .update(payload)
        .eq('id', ticketId)
        .eq('company_id', activeCompanyId)
        .select(
          `
        id,
        ticket_number,
        title,
        description,
        priority,
        status,
        sla_level,
        due_at,
        first_response_at,
        resolved_at,
        closed_at,
        created_at,
        updated_at,
        client_id,
        project_id,
        client:clients!fk_crm_support_tickets_client_scope(company_name),
        project:projects!fk_crm_support_tickets_project_scope(name)
      `
        )
        .single();

      if (updateError) {
        toast({
          title: 'Erreur',
          description: updateError.message,
          variant: 'destructive',
        });
        throw updateError;
      }

      setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? data : ticket)));
      return data;
    },
    [activeCompanyId, toast, user]
  );

  const deleteTicket = useCallback(
    async (ticketId) => {
      if (!supabase || !user || !activeCompanyId || !ticketId) return false;

      const { error: deleteError } = await supabase
        .from('crm_support_tickets')
        .delete()
        .eq('id', ticketId)
        .eq('company_id', activeCompanyId);

      if (deleteError) {
        toast({
          title: 'Erreur',
          description: deleteError.message,
          variant: 'destructive',
        });
        throw deleteError;
      }

      setTickets((prev) => prev.filter((ticket) => ticket.id !== ticketId));
      toast({
        title: 'Ticket supprimé',
        description: 'Le ticket a été supprimé.',
      });
      return true;
    },
    [activeCompanyId, toast, user]
  );

  const supportKpis = useMemo(() => {
    const now = Date.now();
    const openStatuses = new Set(['open', 'in_progress', 'waiting_customer']);

    const openTickets = tickets.filter((ticket) => openStatuses.has(String(ticket.status || '').toLowerCase()));
    const overdueTickets = openTickets.filter((ticket) => ticket.due_at && new Date(ticket.due_at).getTime() < now);
    const resolvedTickets = tickets.filter((ticket) => {
      const status = String(ticket.status || '').toLowerCase();
      return status === 'resolved' || status === 'closed';
    });

    return {
      total: tickets.length,
      open: openTickets.length,
      overdue: overdueTickets.length,
      resolved: resolvedTickets.length,
    };
  }, [tickets]);

  return {
    tickets,
    slaPolicies,
    supportKpis,
    loading,
    error,
    fetchCrmSupport,
    createTicket,
    updateTicket,
    deleteTicket,
  };
}
