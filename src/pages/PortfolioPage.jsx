import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  AlertTriangle,
  ArrowRight,
  BadgeEuro,
  Briefcase,
  Building2,
  FileSignature,
  FolderKanban,
  Layers3,
  Wallet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/utils/calculations';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';

const CLOSED_INVOICE_STATUSES = new Set(['paid', 'cancelled']);
const CLOSED_PAYMENT_STATUSES = new Set(['paid']);
const CLOSED_QUOTE_STATUSES = new Set(['accepted', 'signed', 'rejected', 'cancelled', 'expired']);
const INACTIVE_PROJECT_STATUSES = new Set(['completed', 'done', 'cancelled', 'archived']);

const toAmount = (value) => Number(value || 0);
const toDate = (value) => (value ? new Date(value) : null);

const buildEmptySummary = (company) => ({
  company,
  currency: resolveAccountingCurrency(company),
  bookedRevenue: 0,
  collectedCash: 0,
  outstandingReceivables: 0,
  overdueReceivables: 0,
  overdueInvoices: 0,
  activeProjects: 0,
  openQuotes: 0,
  quotePipeline: 0,
  lastActivityAt: null,
});

const updateLastActivity = (summary, value) => {
  if (!value) {
    return;
  }

  if (!summary.lastActivityAt || new Date(value) > new Date(summary.lastActivityAt)) {
    summary.lastActivityAt = value;
  }
};

const groupMoney = (rows, valueKey) => rows.reduce((accumulator, row) => {
  const amount = toAmount(row[valueKey]);
  if (amount === 0) {
    return accumulator;
  }

  const currency = row.currency || 'EUR';
  accumulator[currency] = (accumulator[currency] || 0) + amount;
  return accumulator;
}, {});

const formatMoneyGroups = (groups) => {
  const entries = Object.entries(groups);
  if (entries.length === 0) {
    return formatCurrency(0, 'EUR');
  }

  if (entries.length === 1) {
    const [currency, value] = entries[0];
    return formatCurrency(value, currency);
  }

  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, value]) => `${currency} ${formatCurrency(value, currency)}`)
    .join(' · ');
};

const getCompanyHealth = (summary) => {
  if (summary.overdueInvoices > 0 || summary.overdueReceivables > 0) {
    return {
      label: 'A surveiller',
      className: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    };
  }

  if (summary.activeProjects === 0 && summary.openQuotes === 0 && summary.bookedRevenue === 0) {
    return {
      label: 'Dormant',
      className: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
    };
  }

  return {
    label: 'Sous controle',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  };
};

const getDaysOverdue = (dueDate) => {
  if (!dueDate) {
    return 0;
  }

  const today = new Date();
  const due = new Date(dueDate);
  return Math.max(0, Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
};

const isInvoiceClosed = (invoice) => {
  const balanceDue = toAmount(invoice.balance_due);
  return CLOSED_INVOICE_STATUSES.has(invoice.status) || CLOSED_PAYMENT_STATUSES.has(invoice.payment_status) || balanceDue <= 0;
};

const PortfolioPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    companies,
    activeCompany,
    switchCompany,
    loading: companyLoading,
  } = useCompany();

  const [loading, setLoading] = useState(false);
  const [portfolio, setPortfolio] = useState([]);
  const [watchlist, setWatchlist] = useState([]);

  const loadPortfolio = useCallback(async () => {
    if (!user || companyLoading) {
      return;
    }

    if (!companies.length) {
      setPortfolio([]);
      setWatchlist([]);
      return;
    }

    const companyIds = companies.map((company) => company.id);
    setLoading(true);

    try {
      const [
        invoicesResponse,
        paymentsResponse,
        projectsResponse,
        quotesResponse,
      ] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, company_id, invoice_number, total_ttc, balance_due, status, payment_status, due_date, created_at, client:clients(company_name, contact_name)')
          .in('company_id', companyIds),
        supabase
          .from('payments')
          .select('id, company_id, amount, payment_date')
          .in('company_id', companyIds),
        supabase
          .from('projects')
          .select('id, company_id, name, status, created_at')
          .in('company_id', companyIds),
        supabase
          .from('quotes')
          .select('id, company_id, quote_number, total_ttc, total, status, created_at, client:clients(company_name, contact_name)')
          .in('company_id', companyIds),
      ]);

      const responses = [invoicesResponse, paymentsResponse, projectsResponse, quotesResponse];
      const failed = responses.find((response) => response.error);
      if (failed?.error) {
        throw failed.error;
      }

      const summaries = new Map(companies.map((company) => [company.id, buildEmptySummary(company)]));
      const nextWatchlist = [];

      for (const invoice of invoicesResponse.data || []) {
        const summary = summaries.get(invoice.company_id);
        if (!summary) {
          continue;
        }

        const total = toAmount(invoice.total_ttc);
        const balanceDue = toAmount(invoice.balance_due || total);
        const overdue = !isInvoiceClosed(invoice) && toDate(invoice.due_date) && toDate(invoice.due_date) < new Date();

        if (invoice.status !== 'cancelled') {
          summary.bookedRevenue += total;
        }

        if (!isInvoiceClosed(invoice) && invoice.status !== 'cancelled') {
          summary.outstandingReceivables += balanceDue;
        }

        if (overdue) {
          summary.overdueReceivables += balanceDue;
          summary.overdueInvoices += 1;
          nextWatchlist.push({
            companyId: summary.company.id,
            companyName: summary.company.company_name || 'Societe',
            currency: summary.currency,
            invoiceNumber: invoice.invoice_number || 'Facture',
            clientName: invoice.client?.company_name || invoice.client?.contact_name || 'Client',
            amount: balanceDue,
            daysOverdue: getDaysOverdue(invoice.due_date),
          });
        }

        updateLastActivity(summary, invoice.created_at);
      }

      for (const payment of paymentsResponse.data || []) {
        const summary = summaries.get(payment.company_id);
        if (!summary) {
          continue;
        }

        summary.collectedCash += toAmount(payment.amount);
        updateLastActivity(summary, payment.payment_date);
      }

      for (const project of projectsResponse.data || []) {
        const summary = summaries.get(project.company_id);
        if (!summary) {
          continue;
        }

        if (!INACTIVE_PROJECT_STATUSES.has(project.status)) {
          summary.activeProjects += 1;
        }

        updateLastActivity(summary, project.created_at);
      }

      for (const quote of quotesResponse.data || []) {
        const summary = summaries.get(quote.company_id);
        if (!summary) {
          continue;
        }

        if (!CLOSED_QUOTE_STATUSES.has(quote.status)) {
          summary.openQuotes += 1;
          summary.quotePipeline += toAmount(quote.total_ttc || quote.total);
        }

        updateLastActivity(summary, quote.created_at);
      }

      setPortfolio(
        [...summaries.values()].sort((left, right) => {
          if (left.company.id === activeCompany?.id) {
            return -1;
          }
          if (right.company.id === activeCompany?.id) {
            return 1;
          }
          return right.bookedRevenue - left.bookedRevenue;
        }),
      );
      setWatchlist(nextWatchlist.sort((left, right) => right.daysOverdue - left.daysOverdue));
    } catch (error) {
      toast({
        title: 'Erreur portfolio',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, companies, companyLoading, toast, user]);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const portfolioTotals = useMemo(() => ({
    companies: portfolio.length,
    overdueCompanies: portfolio.filter((company) => company.overdueInvoices > 0).length,
    activeProjects: portfolio.reduce((sum, company) => sum + company.activeProjects, 0),
    openQuotes: portfolio.reduce((sum, company) => sum + company.openQuotes, 0),
    bookedRevenue: groupMoney(portfolio, 'bookedRevenue'),
    collectedCash: groupMoney(portfolio, 'collectedCash'),
    outstandingReceivables: groupMoney(portfolio, 'outstandingReceivables'),
    quotePipeline: groupMoney(portfolio, 'quotePipeline'),
  }), [portfolio]);

  const openCompanyWorkspace = async (companyId) => {
    await switchCompany(companyId);
    navigate('/app');
  };

  const headerCards = [
    {
      title: 'Societes suivies',
      value: String(portfolioTotals.companies),
      hint: `${portfolioTotals.overdueCompanies} avec retard client`,
      icon: Layers3,
    },
    {
      title: 'CA facture portefeuille',
      value: formatMoneyGroups(portfolioTotals.bookedRevenue),
      hint: `${portfolioTotals.activeProjects} projets actifs`,
      icon: BadgeEuro,
    },
    {
      title: 'Encaissements',
      value: formatMoneyGroups(portfolioTotals.collectedCash),
      hint: `${portfolioTotals.openQuotes} devis ouverts`,
      icon: Wallet,
    },
    {
      title: 'Encours client',
      value: formatMoneyGroups(portfolioTotals.outstandingReceivables),
      hint: `Pipeline ${formatMoneyGroups(portfolioTotals.quotePipeline)}`,
      icon: AlertTriangle,
    },
  ];

  const topRevenue = Math.max(...portfolio.map((company) => company.bookedRevenue), 0);

  return (
    <>
      <Helmet>
        <title>Portefeuille societes - CashPilot</title>
      </Helmet>

      <div className="container mx-auto p-4 md:p-8 min-h-screen text-white space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(17,24,39,0.94))] p-6 md:p-8">
          <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_center,_rgba(45,212,191,0.12),_transparent_60%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <Badge className="bg-white/10 text-orange-200 border-white/15">Workflow cabinet</Badge>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-orange-500/15 p-3 ring-1 ring-orange-400/20">
                  <Building2 className="h-7 w-7 text-orange-300" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Portefeuille societes</h1>
                  <p className="text-sm md:text-base text-slate-300">
                    Vue transverse des dossiers, encours clients, pipeline devis et activite projet sans changer de societe a l aveugle.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={loadPortfolio}
                disabled={loading || companyLoading}
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                Actualiser
              </Button>
              <Button
                onClick={() => navigate('/app/settings')}
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                Gerer les societes
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {headerCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="border-white/10 bg-slate-950/70 backdrop-blur">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-300">{card.title}</CardTitle>
                    <Icon className="h-5 w-5 text-orange-300" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold text-white">{card.value}</div>
                  <p className="mt-2 text-xs text-slate-400">{card.hint}</p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.6fr_0.95fr]">
          <Card className="border-white/10 bg-slate-950/70 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-white">Societes et priorites</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {portfolio.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
                  {companyLoading || loading ? 'Chargement du portefeuille...' : 'Aucune societe a consolider pour le moment.'}
                </div>
              ) : portfolio.map((companySummary) => {
                const health = getCompanyHealth(companySummary);
                const revenueShare = topRevenue > 0 ? (companySummary.bookedRevenue / topRevenue) * 100 : 0;

                return (
                  <div
                    key={companySummary.company.id}
                    className={`rounded-2xl border p-5 ${
                      companySummary.company.id === activeCompany?.id
                        ? 'border-orange-400/35 bg-orange-500/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-white">
                            {companySummary.company.company_name || 'Societe sans nom'}
                          </h2>
                          <Badge className={health.className}>{health.label}</Badge>
                          {companySummary.company.id === activeCompany?.id && (
                            <Badge className="bg-teal-500/15 text-teal-200 border-teal-400/30">Active</Badge>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">CA facture</p>
                            <p className="mt-1 text-base font-semibold text-white">{formatCurrency(companySummary.bookedRevenue, companySummary.currency)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Encaisse</p>
                            <p className="mt-1 text-base font-semibold text-emerald-300">{formatCurrency(companySummary.collectedCash, companySummary.currency)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Encours</p>
                            <p className="mt-1 text-base font-semibold text-amber-300">{formatCurrency(companySummary.outstandingReceivables, companySummary.currency)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Retards</p>
                            <p className="mt-1 text-base font-semibold text-rose-300">
                              {companySummary.overdueInvoices} facture(s) · {formatCurrency(companySummary.overdueReceivables, companySummary.currency)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Projets actifs</p>
                            <p className="mt-1 text-base font-semibold text-white">{companySummary.activeProjects}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pipeline devis</p>
                            <p className="mt-1 text-base font-semibold text-cyan-300">
                              {companySummary.openQuotes} ouvert(s) · {formatCurrency(companySummary.quotePipeline, companySummary.currency)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex min-w-[220px] flex-col gap-3">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-500">
                            <span>Poids CA</span>
                            <span>{Math.round(revenueShare)}%</span>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-white/10">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-teal-300"
                              style={{ width: `${Math.max(revenueShare, 6)}%` }}
                            />
                          </div>
                          <p className="mt-3 text-xs text-slate-400">
                            Derniere activite: {companySummary.lastActivityAt ? new Date(companySummary.lastActivityAt).toLocaleDateString('fr-FR') : 'Aucune'}
                          </p>
                        </div>
                        <Button
                          onClick={() => openCompanyWorkspace(companySummary.company.id)}
                          className="justify-between bg-white text-slate-950 hover:bg-slate-200"
                        >
                          Ouvrir cette societe
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-white/10 bg-slate-950/70 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-white">Watchlist retards clients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {watchlist.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/5 p-5 text-sm text-emerald-200">
                    Aucun retard client critique sur le portefeuille.
                  </div>
                ) : watchlist.slice(0, 8).map((item) => (
                  <div key={`${item.companyId}-${item.invoiceNumber}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-white">{item.invoiceNumber}</p>
                        <p className="text-sm text-slate-400">{item.companyName} · {item.clientName}</p>
                      </div>
                      <Badge className="bg-rose-500/15 text-rose-200 border-rose-400/30">{item.daysOverdue} j</Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-amber-300">{formatCurrency(item.amount, item.currency)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-950/70 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-white">Lecture rapide du portefeuille</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-300">
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <Briefcase className="mt-0.5 h-5 w-5 text-teal-300" />
                  <div>
                    <p className="font-medium text-white">Charge projet</p>
                    <p>{portfolioTotals.activeProjects} projets actifs repartis sur {portfolioTotals.companies} societe(s).</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <FileSignature className="mt-0.5 h-5 w-5 text-cyan-300" />
                  <div>
                    <p className="font-medium text-white">Pipeline devis</p>
                    <p>{portfolioTotals.openQuotes} devis ouverts pour {formatMoneyGroups(portfolioTotals.quotePipeline)}.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <FolderKanban className="mt-0.5 h-5 w-5 text-orange-300" />
                  <div>
                    <p className="font-medium text-white">Action recommandee</p>
                    <p>Traiter en priorite les societes avec retards clients avant de changer de contexte opérationnel.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
};

export default PortfolioPage;
