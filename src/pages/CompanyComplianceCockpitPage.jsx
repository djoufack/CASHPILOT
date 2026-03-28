import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeftRight,
  Bell,
  Building2,
  FileCheck,
  Globe,
  Landmark,
  Layers3,
  ShieldCheck,
} from 'lucide-react';
import { useComplianceGroupCockpit } from '@/hooks/useComplianceGroupCockpit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const formatDateTime = (value, locale) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale || 'fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatAmount = (value, locale) =>
  new Intl.NumberFormat(locale || 'fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const kpiCardClassName = 'border-white/10 bg-slate-950/45 text-slate-100';

const CompanyComplianceCockpitPage = () => {
  const { t, i18n } = useTranslation();
  const { metrics, warnings, hasIssues, loading, refetch } = useComplianceGroupCockpit();
  const locale = i18n.resolvedLanguage || i18n.language || 'fr';

  const summaryCards = useMemo(
    () => [
      {
        id: 'companies',
        title: t('companyCockpit.summary.companies'),
        value: String(metrics.companyCount),
        hint: t('companyCockpit.summary.peppolReadyHint', {
          count: metrics.peppolConfiguredCount,
          total: metrics.companyCount,
        }),
      },
      {
        id: 'portfolios',
        title: t('companyCockpit.summary.portfolios'),
        value: String(metrics.portfolioCount),
        hint: t('companyCockpit.summary.portfolioCompaniesHint', {
          count: metrics.portfolioCompaniesCount,
        }),
      },
      {
        id: 'certifications',
        title: t('companyCockpit.summary.certifications'),
        value: `${metrics.certificationsCertified}/${metrics.certificationsTotal}`,
        hint: t('companyCockpit.summary.certificationsAtRiskHint', {
          count: metrics.certificationsExpired,
        }),
      },
      {
        id: 'intercompany',
        title: t('companyCockpit.summary.intercompany'),
        value: String(metrics.pendingEliminationsCount),
        hint: t('companyCockpit.summary.eliminationAmountHint', {
          amount: formatAmount(metrics.eliminatedAmount, locale),
        }),
      },
      {
        id: 'regulatory',
        title: t('companyCockpit.summary.regulatory'),
        value: String(metrics.criticalUpdatesCount),
        hint: t('companyCockpit.summary.upcomingUpdatesHint', {
          count: metrics.upcomingUpdatesCount,
        }),
      },
      {
        id: 'last-sync',
        title: t('companyCockpit.summary.lastSync'),
        value: formatDateTime(metrics.latestEliminationAt, locale),
        hint: t('companyCockpit.summary.lastSyncHint'),
      },
    ],
    [
      locale,
      metrics.certificationsCertified,
      metrics.certificationsExpired,
      metrics.certificationsTotal,
      metrics.companyCount,
      metrics.criticalUpdatesCount,
      metrics.eliminatedAmount,
      metrics.latestEliminationAt,
      metrics.pendingEliminationsCount,
      metrics.peppolConfiguredCount,
      metrics.portfolioCompaniesCount,
      metrics.portfolioCount,
      metrics.upcomingUpdatesCount,
      t,
    ]
  );

  const moduleCards = useMemo(
    () => [
      {
        id: 'portfolio',
        title: t('companyCockpit.modules.portfolio.title'),
        description: t('companyCockpit.modules.portfolio.description'),
        metric: t('companyCockpit.modules.portfolio.metric', {
          companies: metrics.companyCount,
          portfolios: metrics.portfolioCount,
        }),
        path: '/app/portfolio',
        icon: Building2,
      },
      {
        id: 'peppol',
        title: t('companyCockpit.modules.peppol.title'),
        description: t('companyCockpit.modules.peppol.description'),
        metric: t('companyCockpit.modules.peppol.metric', {
          ready: metrics.peppolConfiguredCount,
          total: metrics.companyCount,
        }),
        path: '/app/peppol',
        icon: Globe,
      },
      {
        id: 'pdp',
        title: t('companyCockpit.modules.pdp.title'),
        description: t('companyCockpit.modules.pdp.description'),
        metric: t('companyCockpit.modules.pdp.metric', {
          certified: metrics.certificationsCertified,
          total: metrics.certificationsTotal,
        }),
        path: '/app/pdp-compliance',
        icon: FileCheck,
      },
      {
        id: 'inter-company',
        title: t('companyCockpit.modules.interCompany.title'),
        description: t('companyCockpit.modules.interCompany.description'),
        metric: t('companyCockpit.modules.interCompany.metric', {
          count: metrics.pendingEliminationsCount,
        }),
        path: '/app/inter-company',
        icon: ArrowLeftRight,
      },
      {
        id: 'consolidation',
        title: t('companyCockpit.modules.consolidation.title'),
        description: t('companyCockpit.modules.consolidation.description'),
        metric: t('companyCockpit.modules.consolidation.metric', {
          count: metrics.portfolioCount,
        }),
        path: '/app/consolidation',
        icon: Landmark,
      },
      {
        id: 'regulatory-intel',
        title: t('companyCockpit.modules.regulatory.title'),
        description: t('companyCockpit.modules.regulatory.description'),
        metric: t('companyCockpit.modules.regulatory.metric', {
          count: metrics.criticalUpdatesCount,
        }),
        path: '/app/regulatory-intel',
        icon: Bell,
      },
    ],
    [
      metrics.certificationsCertified,
      metrics.certificationsTotal,
      metrics.companyCount,
      metrics.criticalUpdatesCount,
      metrics.pendingEliminationsCount,
      metrics.peppolConfiguredCount,
      metrics.portfolioCount,
      t,
    ]
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Helmet>
        <title>{`${t('companyCockpit.pageTitle')} - CashPilot`}</title>
      </Helmet>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge className="border-cyan-300/30 bg-cyan-500/10 text-cyan-200">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              {t('companyCockpit.badge')}
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{t('companyCockpit.title')}</h1>
            <p className="max-w-3xl text-sm text-slate-300">{t('companyCockpit.subtitle')}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={loading}
            className="border-white/20 text-slate-100"
          >
            {t('companyCockpit.refresh')}
          </Button>
        </div>

        {hasIssues ? (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('companyCockpit.riskBanner')}</span>
            </div>
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-xs text-slate-300">
            <p className="font-medium text-slate-100">{t('companyCockpit.dataWarningsTitle')}</p>
            <p className="mt-1">{warnings[0]}</p>
          </div>
        ) : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="co-cockpit-summary-grid">
        {summaryCards.map((card) => (
          <Card key={card.id} className={kpiCardClassName}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-semibold text-white" data-testid={`co-cockpit-kpi-${card.id}`}>
                {card.value}
              </p>
              <p className="mt-1 text-xs text-slate-400">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" data-testid="co-cockpit-module-grid">
        {moduleCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.id} className="border-white/10 bg-slate-950/45">
              <CardHeader className="pb-3">
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-cyan-200">
                  <Icon className="h-4 w-4" />
                </div>
                <CardTitle className="text-base text-white">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <p className="text-sm text-slate-300">{card.description}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-cyan-200">{card.metric}</p>
                <Button asChild variant="outline" className="w-full border-white/20 text-slate-100">
                  <Link to={card.path} data-testid={`co-cockpit-link-${card.id}`}>
                    {t('companyCockpit.openModule')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
          <Layers3 className="h-4 w-4 text-cyan-200" />
          {t('companyCockpit.orchestrationTitle')}
        </div>
        <p className="mt-2 text-sm text-slate-300">{t('companyCockpit.orchestrationDescription')}</p>
      </section>
    </div>
  );
};

export default CompanyComplianceCockpitPage;
