import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileSignature,
  FileText,
  Kanban,
  LayoutGrid,
  LifeBuoy,
  List,
  Pencil,
  Trash2,
  Users,
  Workflow,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useCompany } from '@/hooks/useCompany';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useClients } from '@/hooks/useClients';
import { useQuotes } from '@/hooks/useQuotes';
import { useInvoices } from '@/hooks/useInvoices';
import { useProjects } from '@/hooks/useProjects';
import { useCrmSupport } from '@/hooks/useCrmSupport';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import GenericKanbanView from '@/components/GenericKanbanView';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';
import { useToast } from '@/components/ui/use-toast';
import {
  exportCrmSupportTicketHTML,
  exportCrmSupportTicketPDF,
} from '@/services/exportCrmSupportRecords';

const sectionConfig = [
  { key: 'overview', label: 'Vue CRM', icon: BarChart3 },
  { key: 'accounts', label: 'Comptes & Contacts', icon: Users },
  { key: 'leads', label: 'Leads', icon: Users },
  { key: 'opportunities', label: 'Opportunités', icon: FileSignature },
  { key: 'activities', label: 'Activités', icon: Activity },
  { key: 'quotes-contracts', label: 'Devis & Contrats', icon: ClipboardList },
  { key: 'support', label: 'Tickets & SLA', icon: LifeBuoy },
  { key: 'automation', label: 'Automatisation', icon: Workflow },
  { key: 'reports', label: 'Rapports CRM', icon: BarChart3 },
];

const openOpportunityStatuses = new Set(['draft', 'sent', 'pending', 'open']);
const closedWonQuoteStatuses = new Set(['accepted', 'approved', 'signed']);

const formatMoney = (amount, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

const formatDate = (rawDate) => {
  if (!rawDate) return '-';
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('fr-FR');
};

const formatDateTime = (rawDate) => {
  if (!rawDate) return '-';
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('fr-FR');
};

const statusBadgeClass = (status = '') => {
  const normalized = String(status).toLowerCase();
  if (normalized === 'paid' || normalized === 'accepted' || normalized === 'approved' || normalized === 'signed') {
    return 'bg-green-500/20 text-green-400 border-green-700';
  }
  if (normalized === 'sent' || normalized === 'pending' || normalized === 'in_progress') {
    return 'bg-orange-500/20 text-orange-400 border-orange-700';
  }
  if (normalized === 'overdue' || normalized === 'rejected' || normalized === 'cancelled') {
    return 'bg-red-500/20 text-red-400 border-red-700';
  }
  return 'bg-slate-700/40 text-slate-300 border-slate-600';
};

const ticketPriorityClass = (priority = '') => {
  const normalized = String(priority).toLowerCase();
  if (normalized === 'critical') return 'bg-red-500/20 text-red-300 border-red-700';
  if (normalized === 'high') return 'bg-orange-500/20 text-orange-300 border-orange-700';
  if (normalized === 'medium') return 'bg-blue-500/20 text-blue-300 border-blue-700';
  return 'bg-slate-700/40 text-slate-300 border-slate-600';
};

const ticketStatusLabel = (status = '') => {
  const normalized = String(status).toLowerCase();
  if (normalized === 'in_progress') return 'En cours';
  if (normalized === 'waiting_customer') return 'Attente client';
  if (normalized === 'resolved') return 'Résolu';
  if (normalized === 'closed') return 'Clôturé';
  return 'Ouvert';
};

const supportStatusOptions = [
  { value: 'open', label: 'Ouvert' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'waiting_customer', label: 'Attente client' },
  { value: 'resolved', label: 'Résolu' },
  { value: 'closed', label: 'Clôturé' },
];

const supportPriorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const supportSlaOptions = [
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'critical', label: 'Critical' },
];

const supportViewModes = [
  { key: 'list', label: 'Liste', icon: List },
  { key: 'gallery', label: 'Galerie', icon: LayoutGrid },
  { key: 'calendar', label: 'Calendrier', icon: CalendarDays },
  { key: 'agenda', label: 'Agenda', icon: CalendarClock },
  { key: 'kanban', label: 'Kanban', icon: Kanban },
];

const CRMPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { section } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const normalizedSection = section || 'overview';
  const activeSection = sectionConfig.find((entry) => entry.key === normalizedSection) || sectionConfig[0];

  const { company, companies = [] } = useCompany();
  const { activeCompanyId } = useCompanyScope();
  const { clients, loading: clientsLoading } = useClients();
  const { quotes, loading: quotesLoading } = useQuotes();
  const { invoices, loading: invoicesLoading } = useInvoices();
  const { projects, loading: projectsLoading } = useProjects();
  const {
    tickets: supportTickets,
    slaPolicies,
    supportKpis,
    loading: supportLoading,
    error: supportError,
    createTicket,
    updateTicket,
    deleteTicket,
  } = useCrmSupport();

  const [taskActivities, setTaskActivities] = useState([]);
  const [timesheetActivities, setTimesheetActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSaving, setTicketSaving] = useState(false);
  const [supportViewMode, setSupportViewMode] = useState('list');
  const [viewingTicket, setViewingTicket] = useState(null);
  const [editingTicket, setEditingTicket] = useState(null);
  const [editTicketSaving, setEditTicketSaving] = useState(false);
  const [ticketDraft, setTicketDraft] = useState({
    title: '',
    description: '',
    client_id: '',
    project_id: '',
    priority: 'medium',
    sla_level: 'standard',
    due_at: '',
  });
  const [editTicketDraft, setEditTicketDraft] = useState({
    title: '',
    description: '',
    client_id: '',
    project_id: '',
    priority: 'medium',
    sla_level: 'standard',
    status: 'open',
    due_at: '',
  });

  const activeCompany = useMemo(() => {
    if (!activeCompanyId) return company || null;
    if (company?.id === activeCompanyId) return company;
    return companies.find((entry) => entry.id === activeCompanyId) || company || null;
  }, [activeCompanyId, companies, company]);

  const scopedClients = useMemo(
    () => (clients || []).filter((client) => client?.company_id === activeCompanyId),
    [activeCompanyId, clients],
  );
  const scopedQuotes = useMemo(
    () => (quotes || []).filter((quote) => quote?.company_id === activeCompanyId),
    [activeCompanyId, quotes],
  );
  const scopedInvoices = useMemo(
    () => (invoices || []).filter((invoice) => invoice?.company_id === activeCompanyId),
    [activeCompanyId, invoices],
  );
  const scopedProjects = useMemo(
    () => (projects || []).filter((project) => project?.company_id === activeCompanyId),
    [activeCompanyId, projects],
  );
  const scopedProjectIds = useMemo(
    () => scopedProjects.map((project) => project?.id).filter(Boolean),
    [scopedProjects],
  );

  useEffect(() => {
    if (section && !sectionConfig.some((entry) => entry.key === section)) {
      navigate('/app/crm', { replace: true });
    }
  }, [navigate, section]);

  useEffect(() => {
    let cancelled = false;

    const fetchActivities = async () => {
      if (!activeCompanyId) {
        if (!cancelled) {
          setTaskActivities([]);
          setTimesheetActivities([]);
          setActivityError('');
          setActivityLoading(false);
        }
        return;
      }
      if (!supabase || projectsLoading) return;
      setActivityLoading(true);
      setActivityError('');
      try {
        if (!scopedProjectIds.length) {
          if (!cancelled) {
            setTaskActivities([]);
            setTimesheetActivities([]);
            setActivityLoading(false);
          }
          return;
        }

        let taskQuery = supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, updated_at, project:projects!tasks_project_id_fkey(name)')
          .in('project_id', scopedProjectIds)
          .order('updated_at', { ascending: false })
          .limit(8);
        const { data: taskRows, error: taskError } = await taskQuery;
        if (taskError) throw taskError;

        let timesheetQuery = supabase
          .from('timesheets')
          .select('id, date, duration_minutes, status, created_at, project:projects!fk_timesheets_project_scope(name), client:clients!fk_timesheets_client_scope(company_name)')
          .in('project_id', scopedProjectIds)
          .order('date', { ascending: false })
          .limit(8);
        const { data: timesheetRows, error: timesheetError } = await timesheetQuery;
        if (timesheetError) throw timesheetError;

        if (!cancelled) {
          setTaskActivities(taskRows || []);
          setTimesheetActivities(timesheetRows || []);
        }
      } catch (error) {
        if (!cancelled) {
          setActivityError(error?.message || 'Impossible de charger les activités CRM.');
        }
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    };

    fetchActivities();
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, projectsLoading, scopedProjectIds]);

  const currency = (activeCompany?.accounting_currency || activeCompany?.currency || 'EUR').toUpperCase();
  const loading = clientsLoading || quotesLoading || invoicesLoading || projectsLoading || activityLoading;

  const quoteClientIds = useMemo(
    () => new Set((scopedQuotes || []).map((quote) => quote.client_id).filter(Boolean)),
    [scopedQuotes],
  );
  const invoicedClientIds = useMemo(
    () => new Set((scopedInvoices || []).map((invoice) => invoice.client_id).filter(Boolean)),
    [scopedInvoices],
  );

  const kpis = useMemo(() => {
    const openQuotes = (scopedQuotes || []).filter((quote) => openOpportunityStatuses.has(String(quote.status || '').toLowerCase()));
    const wonQuotes = (scopedQuotes || []).filter((quote) => closedWonQuoteStatuses.has(String(quote.status || '').toLowerCase()));
    const paidInvoices = (scopedInvoices || []).filter((invoice) => String(invoice.payment_status || '').toLowerCase() === 'paid');
    const activeProjects = (scopedProjects || []).filter((project) => {
      const status = String(project.status || '').toLowerCase();
      return status !== 'completed' && status !== 'cancelled';
    });
    const leads = (scopedClients || []).filter((client) => {
      const id = client.id;
      return id && !quoteClientIds.has(id) && !invoicedClientIds.has(id);
    });

    return {
      accounts: scopedClients?.length || 0,
      leads: leads.length,
      opportunities: openQuotes.length,
      pipelineAmount: openQuotes.reduce((sum, quote) => sum + Number(quote.total_ttc || quote.total_ht || 0), 0),
      wonDeals: wonQuotes.length,
      paidRevenue: paidInvoices.reduce((sum, invoice) => sum + Number(invoice.total_ttc || 0), 0),
      activeProjects: activeProjects.length,
    };
  }, [invoicedClientIds, quoteClientIds, scopedClients, scopedInvoices, scopedProjects, scopedQuotes]);

  const recentQuotes = useMemo(
    () => [...(scopedQuotes || [])].slice(0, 8),
    [scopedQuotes],
  );
  const recentInvoices = useMemo(
    () => [...(scopedInvoices || [])].slice(0, 8),
    [scopedInvoices],
  );

  const accountsRows = useMemo(() => {
    const quoteMap = new Map();
    (scopedQuotes || []).forEach((quote) => {
      if (!quote?.client_id) return;
      const previous = quoteMap.get(quote.client_id);
      if (!previous || new Date(quote.created_at) > new Date(previous.created_at)) {
        quoteMap.set(quote.client_id, quote);
      }
    });
    return (scopedClients || []).map((client) => ({
      ...client,
      latest_quote: quoteMap.get(client.id) || null,
      is_lead: !quoteClientIds.has(client.id) && !invoicedClientIds.has(client.id),
    }));
  }, [invoicedClientIds, quoteClientIds, scopedClients, scopedQuotes]);

  const opportunitiesRows = useMemo(
    () => (scopedQuotes || []).filter((quote) => openOpportunityStatuses.has(String(quote.status || '').toLowerCase())),
    [scopedQuotes],
  );

  const toDateTimeLocalValue = (rawValue) => {
    if (!rawValue) return '';
    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  useEffect(() => {
    setTicketDraft({
      title: '',
      description: '',
      client_id: scopedClients[0]?.id || '',
      project_id: '',
      priority: 'medium',
      sla_level: 'standard',
      due_at: '',
    });
    setShowTicketForm(false);
    setViewingTicket(null);
    setEditingTicket(null);
    setSupportViewMode('list');
  }, [activeCompanyId, scopedClients]);

  const ticketProjectOptions = useMemo(() => {
    if (!ticketDraft.client_id) return [];
    return scopedProjects.filter((project) => project.client_id === ticketDraft.client_id);
  }, [scopedProjects, ticketDraft.client_id]);

  const editTicketProjectOptions = useMemo(() => {
    if (!editTicketDraft.client_id) return [];
    return scopedProjects.filter((project) => project.client_id === editTicketDraft.client_id);
  }, [editTicketDraft.client_id, scopedProjects]);

  const supportCalendarStatusColors = useMemo(() => ({
    open: { bg: '#1d4ed8', border: '#1e40af', text: '#dbeafe' },
    in_progress: { bg: '#ea580c', border: '#c2410c', text: '#ffedd5' },
    waiting_customer: { bg: '#7c3aed', border: '#6d28d9', text: '#ede9fe' },
    resolved: { bg: '#059669', border: '#047857', text: '#d1fae5' },
    closed: { bg: '#475569', border: '#334155', text: '#e2e8f0' },
  }), []);

  const supportCalendarLegend = useMemo(() => ([
    { label: 'Ouvert', color: '#1d4ed8' },
    { label: 'En cours', color: '#ea580c' },
    { label: 'Attente client', color: '#7c3aed' },
    { label: 'Résolu', color: '#059669' },
    { label: 'Clôturé', color: '#475569' },
  ]), []);

  const supportKanbanColumns = useMemo(() => ([
    { id: 'open', title: 'Ouvert', color: 'text-blue-300 bg-blue-500/10' },
    { id: 'in_progress', title: 'En cours', color: 'text-orange-300 bg-orange-500/10' },
    { id: 'waiting_customer', title: 'Attente client', color: 'text-violet-300 bg-violet-500/10' },
    { id: 'resolved', title: 'Résolu', color: 'text-emerald-300 bg-emerald-500/10' },
    { id: 'closed', title: 'Clôturé', color: 'text-slate-300 bg-slate-500/10' },
  ]), []);

  const supportViewItems = useMemo(
    () => supportTickets.map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      subtitle: `${ticket.ticket_number || '-'} • ${ticket.client?.company_name || 'Client inconnu'}`,
      amount: `${ticket.priority || 'medium'} • SLA ${ticket.sla_level || 'standard'}`,
      date: ticket.due_at || ticket.created_at,
      status: ticket.status || 'open',
      statusLabel: ticketStatusLabel(ticket.status),
      statusColor: statusBadgeClass(ticket.status),
      raw: ticket,
    })),
    [supportTickets],
  );

  const handleCreateTicket = async (event) => {
    event.preventDefault();
    if (!user || !activeCompanyId || !ticketDraft.title || !ticketDraft.client_id) return;

    setTicketSaving(true);
    try {
      await createTicket({
        title: ticketDraft.title.trim(),
        description: ticketDraft.description?.trim() || null,
        client_id: ticketDraft.client_id,
        project_id: ticketDraft.project_id || null,
        priority: ticketDraft.priority,
        sla_level: ticketDraft.sla_level,
        status: 'open',
        due_at: ticketDraft.due_at ? new Date(ticketDraft.due_at).toISOString() : null,
      });
      setTicketDraft((prev) => ({
        ...prev,
        title: '',
        description: '',
        due_at: '',
      }));
      setShowTicketForm(false);
    } finally {
      setTicketSaving(false);
    }
  };

  const buildStatusPayload = (ticket, nextStatus) => {
    const payload = { status: nextStatus };
    const nowIso = new Date().toISOString();
    if (nextStatus === 'resolved') {
      payload.resolved_at = ticket?.resolved_at || nowIso;
      payload.closed_at = null;
      return payload;
    }
    if (nextStatus === 'closed') {
      payload.closed_at = nowIso;
      payload.resolved_at = ticket?.resolved_at || nowIso;
      return payload;
    }
    payload.closed_at = null;
    return payload;
  };

  const handleTicketStatusChange = async (ticket, nextStatus) => {
    if (!ticket?.id) return;
    const payload = buildStatusPayload(ticket, nextStatus);
    await updateTicket(ticket.id, payload);
  };

  const handleTicketStatusChangeById = async (ticketId, nextStatus) => {
    const ticket = supportTickets.find((entry) => entry.id === ticketId);
    if (!ticket) return;
    await handleTicketStatusChange(ticket, nextStatus);
  };

  const openEditTicketModal = (ticket) => {
    if (!ticket) return;
    setEditingTicket(ticket);
    setEditTicketDraft({
      title: ticket.title || '',
      description: ticket.description || '',
      client_id: ticket.client_id || '',
      project_id: ticket.project_id || '',
      priority: ticket.priority || 'medium',
      sla_level: ticket.sla_level || 'standard',
      status: ticket.status || 'open',
      due_at: toDateTimeLocalValue(ticket.due_at),
    });
  };

  const handleSaveTicketEdition = async (event) => {
    event.preventDefault();
    if (!editingTicket?.id || !editTicketDraft.title || !editTicketDraft.client_id) return;

    const nextStatus = editTicketDraft.status || 'open';
    const payload = {
      title: editTicketDraft.title.trim(),
      description: editTicketDraft.description?.trim() || null,
      client_id: editTicketDraft.client_id,
      project_id: editTicketDraft.project_id || null,
      priority: editTicketDraft.priority || 'medium',
      sla_level: editTicketDraft.sla_level || 'standard',
      due_at: editTicketDraft.due_at ? new Date(editTicketDraft.due_at).toISOString() : null,
      ...buildStatusPayload(editingTicket, nextStatus),
    };

    setEditTicketSaving(true);
    try {
      const updated = await updateTicket(editingTicket.id, payload);
      setEditingTicket(null);
      setViewingTicket((prev) => (prev?.id === updated?.id ? updated : prev));
    } finally {
      setEditTicketSaving(false);
    }
  };

  const handleDeleteSupportTicket = async (ticket) => {
    if (!ticket?.id) return;
    await deleteTicket(ticket.id);
    setViewingTicket((prev) => (prev?.id === ticket.id ? null : prev));
    setEditingTicket((prev) => (prev?.id === ticket.id ? null : prev));
  };

  const handleSupportExportPdf = async (ticket) => {
    if (!ticket) return;
    try {
      await exportCrmSupportTicketPDF(ticket, activeCompany);
      toast({
        title: 'Export PDF généré',
        description: `${ticket.ticket_number || ticket.title} exporté en PDF.`,
      });
    } catch (error) {
      toast({
        title: 'Erreur export PDF',
        description: error?.message || 'Impossible de générer le PDF du ticket.',
        variant: 'destructive',
      });
    }
  };

  const handleSupportExportHtml = async (ticket) => {
    if (!ticket) return;
    try {
      await exportCrmSupportTicketHTML(ticket, activeCompany);
      toast({
        title: 'Export HTML généré',
        description: `${ticket.ticket_number || ticket.title} exporté en HTML.`,
      });
    } catch (error) {
      toast({
        title: 'Erreur export HTML',
        description: error?.message || 'Impossible de générer le HTML du ticket.',
        variant: 'destructive',
      });
    }
  };

  const renderSupportInlineExports = (item) => {
    const ticket = supportTickets.find((entry) => entry.id === item.id);
    if (!ticket) return null;
    return (
      <>
        <Button
          size="sm"
          variant="ghost"
          className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-7 px-2 text-xs"
          onClick={(event) => {
            event.stopPropagation();
            handleSupportExportPdf(ticket);
          }}
          title="Export PDF"
        >
          <Download className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 h-7 px-2 text-xs"
          onClick={(event) => {
            event.stopPropagation();
            handleSupportExportHtml(ticket);
          }}
          title="Export HTML"
        >
          <FileText className="w-3 h-3" />
        </Button>
      </>
    );
  };

  const renderSupportActions = (ticket, compact = true) => {
    if (!ticket) return null;

    const buttonClass = compact ? 'h-7 w-7 p-0' : 'h-8';
    const containerClass = compact ? 'flex items-center justify-end gap-1' : 'flex items-center gap-2';

    return (
      <div className={containerClass}>
        <Button
          variant="ghost"
          size="sm"
          className={`text-blue-400 hover:text-blue-300 ${buttonClass}`}
          onClick={() => setViewingTicket(ticket)}
          title="Visualiser"
        >
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`text-orange-400 hover:text-orange-300 ${buttonClass}`}
          onClick={() => openEditTicketModal(ticket)}
          title="Éditer"
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`text-purple-400 hover:text-purple-300 ${buttonClass}`}
          onClick={() => handleSupportExportPdf(ticket)}
          title="Export PDF"
        >
          <Download className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`text-cyan-400 hover:text-cyan-300 ${buttonClass}`}
          onClick={() => handleSupportExportHtml(ticket)}
          title="Export HTML"
        >
          <FileText className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`text-red-400 hover:text-red-300 ${buttonClass}`}
          onClick={() => handleDeleteSupportTicket(ticket)}
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Comptes actifs</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{kpis.accounts}</p>
            <p className="text-xs text-gray-500 mt-1">Clients rattachés à la société active.</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Leads qualifiables</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{kpis.leads}</p>
            <p className="text-xs text-gray-500 mt-1">Comptes sans devis ni factures.</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Pipeline opportunités</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-400">{formatMoney(kpis.pipelineAmount, currency)}</p>
            <p className="text-xs text-gray-500 mt-1">{kpis.opportunities} opportunité(s) ouverte(s).</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">CA encaissé</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-400">{formatMoney(kpis.paidRevenue, currency)}</p>
            <p className="text-xs text-gray-500 mt-1">Factures marquées payées.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Modules CRM par société</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sectionConfig.filter((item) => item.key !== 'overview').map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={`/app/crm/${item.key}`}
                className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 hover:border-orange-500/40 hover:bg-gray-900/80 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-semibold text-white">{item.label}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-500" />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Scopé automatiquement sur la société active ({activeCompany?.company_name || 'Société non définie'}).
                </p>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );

  const renderAccounts = () => (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white">Comptes & Contacts</CardTitle>
        <Button asChild className="bg-orange-500 hover:bg-orange-600">
          <Link to="/app/clients">Ouvrir gestion clients</Link>
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-400">
              <th className="py-2">Compte</th>
              <th className="py-2">Contact</th>
              <th className="py-2">Email</th>
              <th className="py-2">Téléphone</th>
              <th className="py-2">Dernier devis</th>
              <th className="py-2 text-right">Statut</th>
            </tr>
          </thead>
          <tbody>
            {accountsRows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-gray-500">Aucun compte client pour la société active.</td>
              </tr>
            )}
            {accountsRows.slice(0, 20).map((row) => (
              <tr key={row.id} className="border-b border-gray-900/70">
                <td className="py-2 text-white">{row.company_name || '-'}</td>
                <td className="py-2 text-gray-300">{row.contact_name || '-'}</td>
                <td className="py-2 text-gray-300">{row.email || '-'}</td>
                <td className="py-2 text-gray-300">{row.phone || '-'}</td>
                <td className="py-2 text-gray-300">{row.latest_quote ? `${row.latest_quote.quote_number} (${formatDate(row.latest_quote.created_at)})` : '-'}</td>
                <td className="py-2 text-right">
                  <Badge variant="outline" className={row.is_lead ? 'bg-blue-500/20 text-blue-300 border-blue-700' : 'bg-emerald-500/20 text-emerald-300 border-emerald-700'}>
                    {row.is_lead ? 'Lead' : 'Compte actif'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );

  const renderLeads = () => {
    const leads = accountsRows.filter((row) => row.is_lead);
    return (
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">Leads (qualification commerciale)</CardTitle>
          <Button asChild variant="outline">
            <Link to="/app/clients">Qualifier dans Clients</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-blue-900/50 bg-blue-950/20 p-3 text-sm text-blue-200">
            Les leads sont détectés ici comme des comptes sans devis ni factures. Cela reste 100% scoppé par société.
          </div>
          {leads.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucun lead détecté pour la société active.</p>
          ) : (
            <div className="space-y-2">
              {leads.slice(0, 20).map((lead) => (
                <div key={lead.id} className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{lead.company_name}</p>
                    <p className="text-xs text-gray-500">{lead.contact_name || 'Contact à qualifier'} • {lead.email || 'email manquant'}</p>
                  </div>
                  <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-700">À qualifier</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderOpportunities = () => (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white">Opportunités (pipeline devis)</CardTitle>
        <Button asChild className="bg-orange-500 hover:bg-orange-600">
          <Link to="/app/quotes">Ouvrir devis</Link>
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-400">
              <th className="py-2">Opportunité</th>
              <th className="py-2">Client</th>
              <th className="py-2">Date</th>
              <th className="py-2">Montant</th>
              <th className="py-2 text-right">Statut</th>
            </tr>
          </thead>
          <tbody>
            {opportunitiesRows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-gray-500">Aucune opportunité ouverte pour la société active.</td>
              </tr>
            )}
            {opportunitiesRows.slice(0, 20).map((quote) => (
              <tr key={quote.id} className="border-b border-gray-900/70">
                <td className="py-2 text-white">{quote.quote_number || quote.id}</td>
                <td className="py-2 text-gray-300">{quote.client?.company_name || '-'}</td>
                <td className="py-2 text-gray-300">{formatDate(quote.date || quote.created_at)}</td>
                <td className="py-2 text-gray-300">{formatMoney(quote.total_ttc || quote.total_ht || 0, currency)}</td>
                <td className="py-2 text-right">
                  <Badge variant="outline" className={statusBadgeClass(quote.status)}>{quote.status || 'draft'}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );

  const renderActivities = () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">Activités projet (tâches)</CardTitle>
          <Button asChild variant="outline"><Link to="/app/projects">Ouvrir projets</Link></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {taskActivities.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune activité tâche détectée.</p>
          ) : (
            taskActivities.map((task) => (
              <div key={task.id} className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white text-sm font-medium">{task.title || 'Tâche sans titre'}</p>
                  <Badge variant="outline" className={statusBadgeClass(task.status)}>{task.status || 'pending'}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">{task.project?.name || 'Projet non lié'} • Échéance: {formatDate(task.due_date)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">Activités d'exécution (timesheets)</CardTitle>
          <Button asChild variant="outline"><Link to="/app/timesheets">Ouvrir timesheets</Link></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {timesheetActivities.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune timesheet détectée.</p>
          ) : (
            timesheetActivities.map((timesheet) => (
              <div key={timesheet.id} className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white text-sm font-medium">{timesheet.project?.name || 'Projet non lié'}</p>
                  <Badge variant="outline" className={statusBadgeClass(timesheet.status)}>{timesheet.status || 'draft'}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(timesheet.date)} • {Math.round(Number(timesheet.duration_minutes || 0) / 60 * 10) / 10}h • {timesheet.client?.company_name || 'Client N/A'}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderQuotesContracts = () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">Devis récents</CardTitle>
          <Button asChild variant="outline"><Link to="/app/quotes">Ouvrir devis</Link></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentQuotes.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun devis pour la société active.</p>
          ) : recentQuotes.map((quote) => (
            <div key={quote.id} className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-white text-sm font-medium">{quote.quote_number || quote.id}</p>
                <p className="text-xs text-gray-500">{quote.client?.company_name || '-'} • {formatDate(quote.date || quote.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white">{formatMoney(quote.total_ttc || quote.total_ht || 0, currency)}</p>
                <Badge variant="outline" className={statusBadgeClass(quote.status)}>{quote.status || 'draft'}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">Contrats / Revenus (factures)</CardTitle>
          <Button asChild variant="outline"><Link to="/app/invoices">Ouvrir factures</Link></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune facture pour la société active.</p>
          ) : recentInvoices.map((invoice) => (
            <div key={invoice.id} className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-white text-sm font-medium">{invoice.invoice_number || invoice.id}</p>
                <p className="text-xs text-gray-500">{invoice.client?.company_name || '-'} • {formatDate(invoice.date || invoice.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white">{formatMoney(invoice.total_ttc || 0, currency)}</p>
                <Badge variant="outline" className={statusBadgeClass(invoice.payment_status || invoice.status)}>
                  {invoice.payment_status || invoice.status || 'draft'}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const renderSupport = () => (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white">Tickets & SLA</CardTitle>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
            <Link to="/app/clients">Ouvrir clients</Link>
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => setShowTicketForm((value) => !value)}
            disabled={!activeCompanyId}
          >
            {showTicketForm ? 'Fermer' : 'Nouveau ticket'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showTicketForm && (
          <form onSubmit={handleCreateTicket} className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 space-y-3">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Titre du ticket *</p>
                <Input
                  value={ticketDraft.title}
                  onChange={(event) => setTicketDraft((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Ex: Incident intégration ERP"
                  required
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Client *</p>
                <select
                  value={ticketDraft.client_id}
                  onChange={(event) => {
                    const nextClientId = event.target.value;
                    setTicketDraft((prev) => ({ ...prev, client_id: nextClientId, project_id: '' }));
                  }}
                  className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                  required
                >
                  <option value="">Sélectionner un client</option>
                  {scopedClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name || client.contact_name || client.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Projet lié (optionnel)</p>
                <select
                  value={ticketDraft.project_id}
                  onChange={(event) => setTicketDraft((prev) => ({ ...prev, project_id: event.target.value }))}
                  className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                >
                  <option value="">Aucun projet</option>
                  {ticketProjectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name || project.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Échéance SLA (optionnel)</p>
                <Input
                  type="datetime-local"
                  value={ticketDraft.due_at}
                  onChange={(event) => setTicketDraft((prev) => ({ ...prev, due_at: event.target.value }))}
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Priorité</p>
                <select
                  value={ticketDraft.priority}
                  onChange={(event) => setTicketDraft((prev) => ({ ...prev, priority: event.target.value }))}
                  className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">SLA</p>
                <select
                  value={ticketDraft.sla_level}
                  onChange={(event) => setTicketDraft((prev) => ({ ...prev, sla_level: event.target.value }))}
                  className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-1">Description</p>
              <Textarea
                value={ticketDraft.description}
                onChange={(event) => setTicketDraft((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Contexte, impact, action attendue..."
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={ticketSaving || !ticketDraft.title || !ticketDraft.client_id}>
                {ticketSaving ? 'Création...' : 'Créer le ticket'}
              </Button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
            <p className="text-xs text-gray-400">Tickets ouverts</p>
            <p className="text-2xl font-bold text-white mt-1">{supportKpis.open}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
            <p className="text-xs text-gray-400">Tickets en retard (SLA)</p>
            <p className="text-2xl font-bold text-red-300 mt-1">{supportKpis.overdue}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
            <p className="text-xs text-gray-400">Tickets résolus/clôturés</p>
            <p className="text-2xl font-bold text-emerald-300 mt-1">{supportKpis.resolved}</p>
          </div>
        </div>

        {supportError && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
            {supportError}
          </div>
        )}

        <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
          <p className="text-xs text-gray-400 mb-2">Politiques SLA (société active)</p>
          {slaPolicies.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune politique SLA configurée.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slaPolicies.map((policy) => (
                <Badge key={policy.id} variant="outline" className="bg-blue-500/10 text-blue-300 border-blue-800">
                  {policy.policy_name}: {policy.target_first_response_minutes} min / {policy.target_resolution_minutes} min
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {supportViewModes.map((mode) => {
            const Icon = mode.icon;
            const isActiveMode = supportViewMode === mode.key;
            return (
              <Button
                key={mode.key}
                variant={isActiveMode ? 'default' : 'outline'}
                className={isActiveMode ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}
                onClick={() => setSupportViewMode(mode.key)}
              >
                <Icon className="w-4 h-4 mr-2" />
                {mode.label}
              </Button>
            );
          })}
        </div>

        {supportViewMode === 'list' && (
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="py-2 px-3">Ticket</th>
                  <th className="py-2 px-3">Client</th>
                  <th className="py-2 px-3">Projet</th>
                  <th className="py-2 px-3">Priorité</th>
                  <th className="py-2 px-3">SLA</th>
                  <th className="py-2 px-3">Échéance</th>
                  <th className="py-2 px-3">Statut</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {supportTickets.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-4 px-3 text-gray-500">
                      {supportLoading ? 'Chargement des tickets...' : 'Aucun ticket pour la société active.'}
                    </td>
                  </tr>
                )}
                {supportTickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-gray-900/70">
                    <td className="py-2 px-3">
                      <p className="text-white font-medium">{ticket.title}</p>
                      <p className="text-xs text-gray-500">{ticket.ticket_number} • {formatDateTime(ticket.created_at)}</p>
                    </td>
                    <td className="py-2 px-3 text-gray-300">{ticket.client?.company_name || '-'}</td>
                    <td className="py-2 px-3 text-gray-300">{ticket.project?.name || '-'}</td>
                    <td className="py-2 px-3">
                      <Badge variant="outline" className={ticketPriorityClass(ticket.priority)}>
                        {ticket.priority || 'medium'}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-gray-300">{ticket.sla_level || 'standard'}</td>
                    <td className="py-2 px-3 text-gray-300">{formatDateTime(ticket.due_at)}</td>
                    <td className="py-2 px-3">
                      <select
                        value={ticket.status || 'open'}
                        onChange={(event) => handleTicketStatusChange(ticket, event.target.value)}
                        className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white"
                      >
                        {supportStatusOptions.map((statusOption) => (
                          <option key={statusOption.value} value={statusOption.value}>
                            {statusOption.label}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1">
                        <Badge variant="outline" className={statusBadgeClass(ticket.status)}>
                          {ticketStatusLabel(ticket.status)}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">{renderSupportActions(ticket, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {supportViewMode === 'gallery' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {supportTickets.length === 0 ? (
              <div className="col-span-full rounded-lg border border-gray-800 bg-gray-900/40 p-4 text-sm text-gray-500">
                {supportLoading ? 'Chargement des tickets...' : 'Aucun ticket pour la société active.'}
              </div>
            ) : supportTickets.map((ticket) => (
              <div key={ticket.id} className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-white font-semibold">{ticket.title}</p>
                    <p className="text-xs text-gray-500">{ticket.ticket_number}</p>
                  </div>
                  <Badge variant="outline" className={statusBadgeClass(ticket.status)}>
                    {ticketStatusLabel(ticket.status)}
                  </Badge>
                </div>
                <div className="text-sm text-gray-300 space-y-1">
                  <p><span className="text-gray-500">Client:</span> {ticket.client?.company_name || '-'}</p>
                  <p><span className="text-gray-500">Projet:</span> {ticket.project?.name || '-'}</p>
                  <p><span className="text-gray-500">Priorité:</span> {ticket.priority || 'medium'}</p>
                  <p><span className="text-gray-500">SLA:</span> {ticket.sla_level || 'standard'}</p>
                  <p><span className="text-gray-500">Échéance:</span> {formatDateTime(ticket.due_at)}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <select
                    value={ticket.status || 'open'}
                    onChange={(event) => handleTicketStatusChange(ticket, event.target.value)}
                    className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white"
                  >
                    {supportStatusOptions.map((statusOption) => (
                      <option key={statusOption.value} value={statusOption.value}>
                        {statusOption.label}
                      </option>
                    ))}
                  </select>
                  {renderSupportActions(ticket, false)}
                </div>
              </div>
            ))}
          </div>
        )}

        {supportViewMode === 'calendar' && (
          <GenericCalendarView
            events={supportViewItems.filter((item) => Boolean(item.date))}
            statusColors={supportCalendarStatusColors}
            legend={supportCalendarLegend}
            onSelectEvent={(item) => {
              const ticket = supportTickets.find((entry) => entry.id === item.id);
              if (ticket) setViewingTicket(ticket);
            }}
          />
        )}

        {supportViewMode === 'agenda' && (
          <GenericAgendaView
            items={supportViewItems}
            dateField="date"
            onView={(item) => {
              const ticket = supportTickets.find((entry) => entry.id === item.id);
              if (ticket) setViewingTicket(ticket);
            }}
            onEdit={(item) => {
              const ticket = supportTickets.find((entry) => entry.id === item.id);
              if (ticket) openEditTicketModal(ticket);
            }}
            onDelete={(item) => {
              const ticket = supportTickets.find((entry) => entry.id === item.id);
              if (ticket) handleDeleteSupportTicket(ticket);
            }}
            renderActions={renderSupportInlineExports}
            paidStatuses={['resolved', 'closed']}
          />
        )}

        {supportViewMode === 'kanban' && (
          <GenericKanbanView
            columns={supportKanbanColumns}
            items={supportViewItems}
            onStatusChange={handleTicketStatusChangeById}
            onView={(item) => {
              const ticket = supportTickets.find((entry) => entry.id === item.id);
              if (ticket) setViewingTicket(ticket);
            }}
            onEdit={(item) => {
              const ticket = supportTickets.find((entry) => entry.id === item.id);
              if (ticket) openEditTicketModal(ticket);
            }}
            onDelete={(item) => {
              const ticket = supportTickets.find((entry) => entry.id === item.id);
              if (ticket) handleDeleteSupportTicket(ticket);
            }}
            renderActions={renderSupportInlineExports}
          />
        )}

        <Dialog open={Boolean(viewingTicket)} onOpenChange={(open) => !open && setViewingTicket(null)}>
          <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>Visualiser - {viewingTicket?.title}</DialogTitle>
            </DialogHeader>
            {viewingTicket && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                    <p className="text-gray-400">Ticket</p>
                    <p className="text-white font-semibold">{viewingTicket.ticket_number || '-'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                    <p className="text-gray-400">Statut</p>
                    <Badge variant="outline" className={statusBadgeClass(viewingTicket.status)}>
                      {ticketStatusLabel(viewingTicket.status)}
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                    <p className="text-gray-400">Client</p>
                    <p className="text-white font-semibold">{viewingTicket.client?.company_name || '-'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                    <p className="text-gray-400">Projet</p>
                    <p className="text-white font-semibold">{viewingTicket.project?.name || '-'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                    <p className="text-gray-400">Priorité / SLA</p>
                    <p className="text-white font-semibold">{viewingTicket.priority || 'medium'} / {viewingTicket.sla_level || 'standard'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                    <p className="text-gray-400">Échéance SLA</p>
                    <p className="text-white font-semibold">{formatDateTime(viewingTicket.due_at)}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-sm">
                  <p className="text-gray-400 mb-1">Description</p>
                  <p className="text-white whitespace-pre-wrap">{viewingTicket.description || 'Aucune description'}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="border-gray-700" onClick={() => handleSupportExportPdf(viewingTicket)}>
                    <Download className="w-4 h-4 mr-2" /> PDF
                  </Button>
                  <Button variant="outline" className="border-gray-700" onClick={() => handleSupportExportHtml(viewingTicket)}>
                    <FileText className="w-4 h-4 mr-2" /> HTML
                  </Button>
                  <Button variant="outline" className="border-gray-700 text-orange-300 hover:text-orange-200" onClick={() => openEditTicketModal(viewingTicket)}>
                    <Pencil className="w-4 h-4 mr-2" /> Éditer
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(editingTicket)} onOpenChange={(open) => !open && setEditingTicket(null)}>
          <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>Éditer ticket - {editingTicket?.ticket_number || editingTicket?.title}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveTicketEdition} className="space-y-3">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Titre du ticket *</p>
                  <Input
                    value={editTicketDraft.title}
                    onChange={(event) => setEditTicketDraft((prev) => ({ ...prev, title: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Client *</p>
                  <select
                    value={editTicketDraft.client_id}
                    onChange={(event) => {
                      const nextClientId = event.target.value;
                      setEditTicketDraft((prev) => ({ ...prev, client_id: nextClientId, project_id: '' }));
                    }}
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                    required
                  >
                    <option value="">Sélectionner un client</option>
                    {scopedClients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.company_name || client.contact_name || client.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Projet lié (optionnel)</p>
                  <select
                    value={editTicketDraft.project_id}
                    onChange={(event) => setEditTicketDraft((prev) => ({ ...prev, project_id: event.target.value }))}
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Aucun projet</option>
                    {editTicketProjectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name || project.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Échéance SLA</p>
                  <Input
                    type="datetime-local"
                    value={editTicketDraft.due_at}
                    onChange={(event) => setEditTicketDraft((prev) => ({ ...prev, due_at: event.target.value }))}
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Priorité</p>
                  <select
                    value={editTicketDraft.priority}
                    onChange={(event) => setEditTicketDraft((prev) => ({ ...prev, priority: event.target.value }))}
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                  >
                    {supportPriorityOptions.map((priorityOption) => (
                      <option key={priorityOption.value} value={priorityOption.value}>
                        {priorityOption.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">SLA</p>
                  <select
                    value={editTicketDraft.sla_level}
                    onChange={(event) => setEditTicketDraft((prev) => ({ ...prev, sla_level: event.target.value }))}
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                  >
                    {supportSlaOptions.map((slaOption) => (
                      <option key={slaOption.value} value={slaOption.value}>
                        {slaOption.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Statut</p>
                  <select
                    value={editTicketDraft.status}
                    onChange={(event) => setEditTicketDraft((prev) => ({ ...prev, status: event.target.value }))}
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                  >
                    {supportStatusOptions.map((statusOption) => (
                      <option key={statusOption.value} value={statusOption.value}>
                        {statusOption.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Description</p>
                <Textarea
                  value={editTicketDraft.description}
                  onChange={(event) => setEditTicketDraft((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Contexte, impact, action attendue..."
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="border-gray-700" onClick={() => setEditingTicket(null)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={editTicketSaving || !editTicketDraft.title || !editTicketDraft.client_id}>
                  {editTicketSaving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );

  const renderAutomation = () => {
    const automationModules = [
      {
        key: 'webhooks',
        title: 'Webhooks',
        description: 'Déclencheurs CRM par évènement (création lead, update ticket, etc.).',
        to: '/app/webhooks',
        cta: 'Ouvrir Webhooks',
      },
      {
        key: 'api-mcp',
        title: 'API / MCP',
        description: 'Interop workflows, agents et apps externes.',
        to: '/app/api-mcp',
        cta: 'Ouvrir API/MCP',
      },
      {
        key: 'notifications',
        title: 'Notifications',
        description: 'Relances commerciales et alertes équipe.',
        to: '/app/notifications',
        cta: 'Ouvrir Notifications',
      },
      {
        key: 'scenarios',
        title: 'Scénarios',
        description: 'Simulation business et trajectoires pipeline.',
        to: '/app/scenarios',
        cta: 'Ouvrir Scénarios',
      },
    ];

    return (
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Automatisation CRM</CardTitle>
          <p className="text-sm text-gray-400">
            Cette section sert de centre de pilotage pour brancher et exécuter les automatisations CRM de la société active.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {automationModules.map((module) => (
            <div key={module.key} className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 flex flex-col gap-3">
              <div>
                <p className="text-white text-sm font-medium">{module.title}</p>
                <p className="text-xs text-gray-500 mt-1">{module.description}</p>
              </div>
              <Button asChild variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 mt-auto">
                <Link to={module.to}>{module.cta}</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  const renderReports = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="bg-white/5 border-white/10">
        <CardHeader><CardTitle className="text-white">KPI CRM</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between"><span className="text-gray-400">Pipeline ouvert</span><span className="text-white">{formatMoney(kpis.pipelineAmount, currency)}</span></div>
          <div className="flex items-center justify-between"><span className="text-gray-400">Opportunités ouvertes</span><span className="text-white">{kpis.opportunities}</span></div>
          <div className="flex items-center justify-between"><span className="text-gray-400">Deals gagnés</span><span className="text-white">{kpis.wonDeals}</span></div>
          <div className="flex items-center justify-between"><span className="text-gray-400">Projets actifs</span><span className="text-white">{kpis.activeProjects}</span></div>
        </CardContent>
      </Card>
      <Card className="bg-white/5 border-white/10">
        <CardHeader><CardTitle className="text-white">Exports et pilotage</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-2">
          <Button asChild variant="outline"><Link to="/app/quotes">Pipeline devis</Link></Button>
          <Button asChild variant="outline"><Link to="/app/invoices">Suivi facturation</Link></Button>
          <Button asChild variant="outline"><Link to="/app/projects">Pilotage projets</Link></Button>
          <Button asChild variant="outline"><Link to="/app/timesheets">Activités & charge</Link></Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderActiveSection = () => {
    if (!activeCompanyId) {
      return (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Sélection de société requise</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-yellow-900/60 bg-yellow-950/20 p-4 text-sm text-yellow-100">
              Le CRM est strictement isolé par société. Sélectionnez d'abord une société dans le sélecteur en haut de l'écran.
            </div>
          </CardContent>
        </Card>
      );
    }

    switch (activeSection.key) {
      case 'accounts':
        return renderAccounts();
      case 'leads':
        return renderLeads();
      case 'opportunities':
        return renderOpportunities();
      case 'activities':
        return renderActivities();
      case 'quotes-contracts':
        return renderQuotesContracts();
      case 'support':
        return renderSupport();
      case 'automation':
        return renderAutomation();
      case 'reports':
        return renderReports();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-gradient">CRM Pro</h1>
        <p className="text-gray-400 mt-2 text-sm">
          CRM scoppé par société active avec priorité à l'intégrité référentielle et à la journalisation comptable temps réel.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-orange-400" />
          <span className="text-sm text-gray-300">Société active</span>
          <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-700">
            {activeCompany?.company_name || 'Non définie'}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-700">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Scope company_id strict
          </Badge>
          <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-700">
            Audit & journalisation actifs
          </Badge>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {sectionConfig.map((entry) => {
          const isActive = entry.key === activeSection.key;
          const Icon = entry.icon;
          return (
            <Button
              key={entry.key}
              asChild
              variant={isActive ? 'default' : 'outline'}
              className={isActive ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}
            >
              <Link to={entry.key === 'overview' ? '/app/crm' : `/app/crm/${entry.key}`}>
                <Icon className="w-4 h-4 mr-2" />
                {entry.label}
              </Link>
            </Button>
          );
        })}
      </div>

      {loading && (
        <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900/40 p-3 text-sm text-gray-400">
          {t('common.loading', 'Chargement...')}
        </div>
      )}
      {activityError && (
        <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
          {activityError}
        </div>
      )}

      {renderActiveSection()}
    </div>
  );
};

export default CRMPage;
