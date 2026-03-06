import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
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
import { useAuth } from '@/contexts/AuthContext';
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

const getCompanyHealth = (summary, t) => {
  if (summary.overdueInvoices > 0 || summary.overdueReceivables > 0) {
    return {
      label: t('portfolio.health.watch'),
      className: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    };
  }

  if (summary.activeProjects === 0 && summary.openQuotes === 0 && summary.bookedRevenue === 0) {
    return {
      label: t('portfolio.health.dormant'),
      className: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
    };
  }

  return {
    label: t('portfolio.health.control'),
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
  const { t, i18n } = useTranslation();
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
  const locale = i18n.resolvedLanguage || i18n.language || 'en';

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
          .select('id, company_id, quote_number, total_ttc, status, created_at, client:clients(company_name, contact_name)')
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
            companyName: summary.company.company_name || t('portfolio.companyGeneric'),
            currency: summary.currency,
            invoiceNumber: invoice.invoice_number || t('portfolio.invoiceFallback'),
            clientName: invoice.client?.company_name || invoice.client?.contact_name || t('portfolio.clientFallback'),
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
          summary.quotePipeline += toAmount(quote.total_ttc);
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
        title: t('portfolio.toastErrorTitle'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, companies, companyLoading, t, toast, user]);

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
      title: t('portfolio.summary.companiesTracked'),
      value: String(portfolioTotals.companies),
      hint: t('portfolio.summary.withOverdue', { count: portfolioTotals.overdueCompanies }),
      icon: Layers3,
    },
    {
      title: t('portfolio.summary.bookedRevenue'),
      value: formatMoneyGroups(portfolioTotals.bookedRevenue),
      hint: t('portfolio.summary.activeProjects', { count: portfolioTotals.activeProjects }),
      icon: BadgeEuro,
    },
    {
      title: t('portfolio.summary.collectedCash'),
      value: formatMoneyGroups(portfolioTotals.collectedCash),
      hint: t('portfolio.summary.openQuotes', { count: portfolioTotals.openQuotes }),
      icon: Wallet,
    },
    {
      title: t('portfolio.summary.outstandingReceivables'),
      value: formatMoneyGroups(portfolioTotals.outstandingReceivables),
      hint: t('portfolio.summary.pipelineHint', { amount: formatMoneyGroups(portfolioTotals.quotePipeline) }),
      icon: AlertTriangle,
    },
  ];

  const topRevenue = Math.max(...portfolio.map((company) => company.bookedRevenue), 0);

  return (
    <>
      <Helmet>
        <title>{`${t('portfolio.pageTitle')} - CashPilot`}</title>
      </Helmet>

      <div className="container mx-auto p-4 md:p-8 min-h-screen text-white space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(17,24,39,0.94))] p-6 md:p-8">
          <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_center,_rgba(45,212,191,0.12),_transparent_60%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <Badge className="bg-white/10 text-orange-200 border-white/15">{t('portfolio.badge')}</Badge>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-orange-500/15 p-3 ring-1 ring-orange-400/20">
                  <Building2 className="h-7 w-7 text-orange-300" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{t('portfolio.title')}</h1>
                  <p className="text-sm md:text-base text-slate-300">
                    {t('portfolio.subtitle')}
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
                {t('portfolio.refresh')}
              </Button>
              <Button
                onClick={() => navigate('/app/settings')}
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                {t('portfolio.manageCompanies')}
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
              <CardTitle className="text-white">{t('portfolio.sections.companiesAndPriorities')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {portfolio.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
                  {companyLoading || loading ? t('portfolio.emptyLoading') : t('portfolio.emptyNone')}
                </div>
              ) : portfolio.map((companySummary) => {
                const health = getCompanyHealth(companySummary, t);
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
                            {companySummary.company.company_name || t('portfolio.companyFallback')}
                          </h2>
                          <Badge className={health.className}>{health.label}</Badge>
                          {companySummary.company.id === activeCompany?.id && (
                            <Badge className="bg-teal-500/15 text-teal-200 border-teal-400/30">{t('portfolio.activeBadge')}</Badge>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('portfolio.metrics.bookedRevenue')}</p>
                            <p className="mt-1 text-base font-semibold text-white">{formatCurrency(companySummary.bookedRevenue, companySummary.currency)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('portfolio.metrics.collectedCash')}</p>
                            <p className="mt-1 text-base font-semibold text-emerald-300">{formatCurrency(companySummary.collectedCash, companySummary.currency)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('portfolio.metrics.outstanding')}</p>
                            <p className="mt-1 text-base font-semibold text-amber-300">{formatCurrency(companySummary.outstandingReceivables, companySummary.currency)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('portfolio.metrics.overdue')}</p>
                            <p className="mt-1 text-base font-semibold text-rose-300">
                              {t('portfolio.metrics.overdueValue', {
                                count: companySummary.overdueInvoices,
                                amount: formatCurrency(companySummary.overdueReceivables, companySummary.currency),
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('portfolio.metrics.activeProjects')}</p>
                            <p className="mt-1 text-base font-semibold text-white">{companySummary.activeProjects}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('portfolio.metrics.quotePipeline')}</p>
                            <p className="mt-1 text-base font-semibold text-cyan-300">
                              {t('portfolio.metrics.quotePipelineValue', {
                                count: companySummary.openQuotes,
                                amount: formatCurrency(companySummary.quotePipeline, companySummary.currency),
                              })}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex min-w-[220px] flex-col gap-3">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-500">
                            <span>{t('portfolio.revenueWeight')}</span>
                            <span>{Math.round(revenueShare)}%</span>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-white/10">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-teal-300"
                              style={{ width: `${Math.max(revenueShare, 6)}%` }}
                            />
                          </div>
                          <p className="mt-3 text-xs text-slate-400">
                            {t('portfolio.lastActivity', {
                              date: companySummary.lastActivityAt
                                ? new Date(companySummary.lastActivityAt).toLocaleDateString(locale)
                                : t('portfolio.noActivity'),
                            })}
                          </p>
                        </div>
                        <Button
                          onClick={() => openCompanyWorkspace(companySummary.company.id)}
                          className="justify-between bg-white text-slate-950 hover:bg-slate-200"
                        >
                          {t('portfolio.openCompany')}
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
                <CardTitle className="text-white">{t('portfolio.sections.watchlist')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {watchlist.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/5 p-5 text-sm text-emerald-200">
                    {t('portfolio.watchlistNone')}
                  </div>
                ) : watchlist.slice(0, 8).map((item) => (
                  <div key={`${item.companyId}-${item.invoiceNumber}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-white">{item.invoiceNumber}</p>
                        <p className="text-sm text-slate-400">{item.companyName} · {item.clientName}</p>
                      </div>
                      <Badge className="bg-rose-500/15 text-rose-200 border-rose-400/30">{t('portfolio.daysOverdue', { count: item.daysOverdue })}</Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-amber-300">{formatCurrency(item.amount, item.currency)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-950/70 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-white">{t('portfolio.sections.quickRead')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-300">
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <Briefcase className="mt-0.5 h-5 w-5 text-teal-300" />
                  <div>
                    <p className="font-medium text-white">{t('portfolio.quickRead.projectLoadTitle')}</p>
                    <p>{t('portfolio.quickRead.projectLoadText', { projects: portfolioTotals.activeProjects, companies: portfolioTotals.companies })}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <FileSignature className="mt-0.5 h-5 w-5 text-cyan-300" />
                  <div>
                    <p className="font-medium text-white">{t('portfolio.quickRead.quotePipelineTitle')}</p>
                    <p>{t('portfolio.quickRead.quotePipelineText', { quotes: portfolioTotals.openQuotes, amount: formatMoneyGroups(portfolioTotals.quotePipeline) })}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <FolderKanban className="mt-0.5 h-5 w-5 text-orange-300" />
                  <div>
                    <p className="font-medium text-white">{t('portfolio.quickRead.recommendedActionTitle')}</p>
                    <p>{t('portfolio.quickRead.recommendedActionText')}</p>
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
