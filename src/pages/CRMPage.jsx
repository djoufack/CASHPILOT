import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  LifeBuoy,
  Users,
  Workflow,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/hooks/useCompany';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useClients } from '@/hooks/useClients';
import { useQuotes } from '@/hooks/useQuotes';
import { useInvoices } from '@/hooks/useInvoices';
import { useProjects } from '@/hooks/useProjects';
import { supabase } from '@/lib/supabase';

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

const CRMPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { section } = useParams();
  const normalizedSection = section || 'overview';
  const activeSection = sectionConfig.find((entry) => entry.key === normalizedSection) || sectionConfig[0];

  const { company } = useCompany();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();
  const { clients, loading: clientsLoading } = useClients();
  const { quotes, loading: quotesLoading } = useQuotes();
  const { invoices, loading: invoicesLoading } = useInvoices();
  const { projects, loading: projectsLoading } = useProjects();

  const [taskActivities, setTaskActivities] = useState([]);
  const [timesheetActivities, setTimesheetActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  useEffect(() => {
    if (section && !sectionConfig.some((entry) => entry.key === section)) {
      navigate('/app/crm', { replace: true });
    }
  }, [navigate, section]);

  useEffect(() => {
    let cancelled = false;

    const fetchActivities = async () => {
      if (!supabase) return;
      setActivityLoading(true);
      setActivityError('');
      try {
        let taskQuery = supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, updated_at, project:projects(name)')
          .order('updated_at', { ascending: false })
          .limit(8);
        taskQuery = applyCompanyScope(taskQuery, { includeUnassigned: false });
        const { data: taskRows, error: taskError } = await taskQuery;
        if (taskError) throw taskError;

        let timesheetQuery = supabase
          .from('timesheets')
          .select('id, date, duration_minutes, status, created_at, project:projects(name), client:clients(company_name)')
          .order('date', { ascending: false })
          .limit(8);
        timesheetQuery = applyCompanyScope(timesheetQuery, { includeUnassigned: false });
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
  }, [activeCompanyId, applyCompanyScope]);

  const currency = (company?.accounting_currency || company?.currency || 'EUR').toUpperCase();
  const loading = clientsLoading || quotesLoading || invoicesLoading || projectsLoading || activityLoading;

  const quoteClientIds = useMemo(
    () => new Set((quotes || []).map((quote) => quote.client_id).filter(Boolean)),
    [quotes],
  );
  const invoicedClientIds = useMemo(
    () => new Set((invoices || []).map((invoice) => invoice.client_id).filter(Boolean)),
    [invoices],
  );

  const kpis = useMemo(() => {
    const openQuotes = (quotes || []).filter((quote) => openOpportunityStatuses.has(String(quote.status || '').toLowerCase()));
    const wonQuotes = (quotes || []).filter((quote) => closedWonQuoteStatuses.has(String(quote.status || '').toLowerCase()));
    const paidInvoices = (invoices || []).filter((invoice) => String(invoice.payment_status || '').toLowerCase() === 'paid');
    const activeProjects = (projects || []).filter((project) => {
      const status = String(project.status || '').toLowerCase();
      return status !== 'completed' && status !== 'cancelled';
    });
    const leads = (clients || []).filter((client) => {
      const id = client.id;
      return id && !quoteClientIds.has(id) && !invoicedClientIds.has(id);
    });

    return {
      accounts: clients?.length || 0,
      leads: leads.length,
      opportunities: openQuotes.length,
      pipelineAmount: openQuotes.reduce((sum, quote) => sum + Number(quote.total_ttc || quote.total_ht || 0), 0),
      wonDeals: wonQuotes.length,
      paidRevenue: paidInvoices.reduce((sum, invoice) => sum + Number(invoice.total_ttc || 0), 0),
      activeProjects: activeProjects.length,
    };
  }, [clients, invoicedClientIds, projects, quoteClientIds, quotes, invoices]);

  const recentQuotes = useMemo(
    () => [...(quotes || [])].slice(0, 8),
    [quotes],
  );
  const recentInvoices = useMemo(
    () => [...(invoices || [])].slice(0, 8),
    [invoices],
  );

  const accountsRows = useMemo(() => {
    const quoteMap = new Map();
    (quotes || []).forEach((quote) => {
      if (!quote?.client_id) return;
      const previous = quoteMap.get(quote.client_id);
      if (!previous || new Date(quote.created_at) > new Date(previous.created_at)) {
        quoteMap.set(quote.client_id, quote);
      }
    });
    return (clients || []).map((client) => ({
      ...client,
      latest_quote: quoteMap.get(client.id) || null,
      is_lead: !quoteClientIds.has(client.id) && !invoicedClientIds.has(client.id),
    }));
  }, [clients, invoices, quoteClientIds, invoicedClientIds, quotes]);

  const opportunitiesRows = useMemo(
    () => (quotes || []).filter((quote) => openOpportunityStatuses.has(String(quote.status || '').toLowerCase())),
    [quotes],
  );

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
                  Scopé automatiquement sur la société active ({company?.company_name || 'Société non définie'}).
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
      <CardHeader>
        <CardTitle className="text-white">Tickets & SLA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-yellow-900/60 bg-yellow-950/20 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-300 mt-0.5" />
            <div className="text-sm text-yellow-100">
              Le module ticketing est prêt côté navigation CRM et gouvernance par société. La table dédiée tickets/SLA est la prochaine étape d’implémentation fonctionnelle.
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
            <p className="text-xs text-gray-400">Société active</p>
            <p className="text-sm text-white mt-1">{company?.company_name || '-'}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
            <p className="text-xs text-gray-400">Audit CRUD</p>
            <p className="text-sm text-emerald-300 mt-1">Prévu: obligatoire</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
            <p className="text-xs text-gray-400">Journalisation comptable</p>
            <p className="text-sm text-emerald-300 mt-1">Prévu: temps réel</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderAutomation = () => (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white">Automatisation CRM</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Link to="/app/webhooks" className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 hover:border-orange-500/40">
          <p className="text-white text-sm font-medium">Webhooks</p>
          <p className="text-xs text-gray-500 mt-1">Déclencheurs CRM par évènement.</p>
        </Link>
        <Link to="/app/api-mcp" className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 hover:border-orange-500/40">
          <p className="text-white text-sm font-medium">API / MCP</p>
          <p className="text-xs text-gray-500 mt-1">Interop workflows, agents et apps externes.</p>
        </Link>
        <Link to="/app/notifications" className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 hover:border-orange-500/40">
          <p className="text-white text-sm font-medium">Notifications</p>
          <p className="text-xs text-gray-500 mt-1">Relances commerciales et alertes équipe.</p>
        </Link>
        <Link to="/app/scenarios" className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 hover:border-orange-500/40">
          <p className="text-white text-sm font-medium">Scénarios</p>
          <p className="text-xs text-gray-500 mt-1">Simulation business et trajectoires pipeline.</p>
        </Link>
      </CardContent>
    </Card>
  );

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
            {company?.company_name || 'Non définie'}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-700">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Scope company_id
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
