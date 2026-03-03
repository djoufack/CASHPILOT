import React, { useCallback, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useInvoices } from '@/hooks/useInvoices';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useExpenses } from '@/hooks/useExpenses';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { exportAnalyticsPDF, exportAnalyticsHTML } from '@/services/exportReports';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import SnapshotShareDialog from '@/components/SnapshotShareDialog';
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  Download,
  FileText,
  Loader2,
  PieChart as PieChartIcon,
  RefreshCw,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  aggregateClientConcentration,
  aggregateExpensesByMonth,
  aggregateProjectPerformance,
  aggregateReceivablesAging,
  aggregateReceivablesWatchlist,
  aggregateRevenueByClient,
  aggregateRevenueByMonth,
  computeExecutiveMetrics,
  formatChartData,
} from '@/utils/analyticsCalculations';
import { formatCurrency } from '@/utils/calculations';

const AnalyticsPage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();
  const companyCurrency = resolveAccountingCurrency(company);
  const locale = i18n.resolvedLanguage || i18n.language || 'en';

  const {
    invoices,
    fetchInvoices,
    loading: loadingInvoices
  } = useInvoices();

  const {
    timesheets,
    fetchTimesheets,
    loading: loadingTimesheets
  } = useTimesheets();

  const {
    expenses,
    fetchExpenses,
    loading: loadingExpenses
  } = useExpenses();

  const handleRefresh = useCallback(async () => {
    try {
      await Promise.all([
        fetchInvoices(),
        fetchTimesheets(),
        fetchExpenses()
      ]);
      toast({
        title: t('common.success'),
        description: t('analyticsPage.toasts.refreshSuccess'),
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('analyticsPage.toasts.refreshError'),
        variant: 'destructive'
      });
    }
  }, [fetchExpenses, fetchInvoices, fetchTimesheets, t, toast]);

  useEffect(() => {
    if (user) {
      handleRefresh();
    }
  }, [handleRefresh, user]);

  const formatMonthKey = useCallback((monthKey) => {
    if (!monthKey) {
      return monthKey;
    }

    const [year, month] = String(monthKey).split('-');
    const parsed = new Date(Number(year), Number(month) - 1, 1);
    if (Number.isNaN(parsed.getTime())) {
      return monthKey;
    }

    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      year: 'numeric',
    }).format(parsed);
  }, [locale]);

  const localizeClientName = useCallback((name) => {
    if (['Unknown Client', 'Client inconnu'].includes(name)) {
      return t('analyticsPage.fallbacks.unknownClient');
    }

    return name;
  }, [t]);

  const localizeProjectName = useCallback((name) => {
    if (['Unassigned', 'Non assigné'].includes(name)) {
      return t('analyticsPage.fallbacks.unassignedProject');
    }

    return name;
  }, [t]);

  const chartData = useMemo(() => {
    const revenueByMonth = aggregateRevenueByMonth(invoices);
    const expensesByMonth = aggregateExpensesByMonth(expenses);
    return formatChartData(revenueByMonth, expensesByMonth).map((point) => ({
      ...point,
      name: formatMonthKey(point.key),
    }));
  }, [expenses, formatMonthKey, invoices]);

  const clientRevenueData = useMemo(
    () => aggregateRevenueByClient(invoices).map((item) => ({
      ...item,
      name: localizeClientName(item.name),
    })),
    [invoices, localizeClientName]
  );
  const projectPerformanceData = useMemo(
    () => aggregateProjectPerformance(timesheets, invoices).map((item) => ({
      ...item,
      name: localizeProjectName(item.name),
    })),
    [invoices, localizeProjectName, timesheets]
  );
  const executiveMetrics = useMemo(() => computeExecutiveMetrics(invoices, expenses, timesheets), [expenses, invoices, timesheets]);
  const receivablesAging = useMemo(
    () => aggregateReceivablesAging(invoices).map((bucket) => ({
      ...bucket,
      name: t(`analyticsPage.aging.buckets.${bucket.key}`),
    })),
    [invoices, t]
  );
  const receivablesWatchlist = useMemo(
    () => aggregateReceivablesWatchlist(invoices).map((item) => ({
      ...item,
      clientName: localizeClientName(item.clientName),
    })),
    [invoices, localizeClientName]
  );
  const clientConcentration = useMemo(
    () => aggregateClientConcentration(invoices).map((item) => ({
      ...item,
      name: localizeClientName(item.name),
    })),
    [invoices, localizeClientName]
  );

  const topProjects = useMemo(() => {
    return [...projectPerformanceData]
      .map(project => ({
        ...project,
        revenuePerHour: project.hours > 0 ? project.revenue / project.hours : 0,
      }))
      .sort((a, b) => {
        if (b.revenue !== a.revenue) return b.revenue - a.revenue;
        return b.hours - a.hours;
      })
      .slice(0, 5);
  }, [projectPerformanceData]);

  const isLoading = loadingInvoices || loadingTimesheets || loadingExpenses;
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const handleExportPDF = () => {
    guardedAction(CREDIT_COSTS.PDF_ANALYTICS, t('analyticsPage.creditLabels.pdf'), async () => {
      await exportAnalyticsPDF({
        totalRevenue: executiveMetrics.collectedRevenue,
        totalExpenses: executiveMetrics.totalExpenses,
        outstandingReceivables: executiveMetrics.outstandingReceivables,
      }, company);
    });
  };

  const handleExportHTML = () => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, t('analyticsPage.creditLabels.html'), () => {
      exportAnalyticsHTML({
        totalRevenue: executiveMetrics.collectedRevenue,
        totalExpenses: executiveMetrics.totalExpenses,
        outstandingReceivables: executiveMetrics.outstandingReceivables,
      }, company);
    });
  };

  const kpiCards = [
    {
      title: t('analyticsPage.kpis.collectedRevenue.title'),
      value: formatCurrency(executiveMetrics.collectedRevenue, companyCurrency),
      hint: t('analyticsPage.kpis.collectedRevenue.hint', { value: executiveMetrics.collectionRate }),
      icon: Wallet,
      tone: 'text-emerald-400',
    },
    {
      title: t('analyticsPage.kpis.bookedRevenue.title'),
      value: formatCurrency(executiveMetrics.bookedRevenue, companyCurrency),
      hint: t('analyticsPage.kpis.bookedRevenue.hint'),
      icon: TrendingUp,
      tone: 'text-blue-400',
    },
    {
      title: t('analyticsPage.kpis.outstandingReceivables.title'),
      value: formatCurrency(executiveMetrics.outstandingReceivables, companyCurrency),
      hint: t('analyticsPage.kpis.outstandingReceivables.hint', {
        value: formatCurrency(executiveMetrics.overdueReceivables, companyCurrency),
      }),
      icon: AlertTriangle,
      tone: 'text-orange-400',
    },
    {
      title: t('analyticsPage.kpis.expenses.title'),
      value: formatCurrency(executiveMetrics.totalExpenses, companyCurrency),
      hint: t('analyticsPage.kpis.expenses.hint', { value: executiveMetrics.grossMarginPct }),
      icon: BarChart3,
      tone: 'text-red-400',
    },
    {
      title: t('analyticsPage.kpis.billableHours.title'),
      value: `${executiveMetrics.billableHours} h`,
      hint: t('analyticsPage.kpis.billableHours.hint', { value: executiveMetrics.billableUtilization }),
      icon: Clock3,
      tone: 'text-violet-400',
    },
    {
      title: t('analyticsPage.kpis.invoicingCoverage.title'),
      value: `${executiveMetrics.invoicingCoverage}%`,
      hint: t('analyticsPage.kpis.invoicingCoverage.hint', {
        value: formatCurrency(executiveMetrics.averageBillableRate, companyCurrency),
      }),
      icon: Target,
      tone: 'text-cyan-400',
    },
  ];

  const analyticsSnapshotData = useMemo(() => ({
    companyName: company?.company_name || t('app.name'),
    currency: companyCurrency,
    generatedAt: new Date().toISOString(),
    summaryCards: kpiCards.map((card) => ({
      label: card.title,
      value: card.value,
      hint: card.hint,
      accentClass: card.tone,
    })),
    revenueExpensesData: chartData,
    receivablesAging,
    receivablesWatchlist,
    clientConcentration,
    topProjects,
  }), [
    chartData,
    clientConcentration,
    company?.company_name,
    companyCurrency,
    kpiCards,
    receivablesAging,
    receivablesWatchlist,
    t,
    topProjects,
  ]);

  return (
    <>
      <Helmet>
        <title>{t('analyticsPage.pageTitle')} - {t('app.name')}</title>
      </Helmet>
      <CreditsGuardModal {...modalProps} />

      <div className="container mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
              {t('analyticsPage.title')}
            </h1>
            <p className="text-gray-400 text-sm md:text-base">
              {t('analyticsPage.subtitle')}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              className="w-full md:w-auto bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {t('analyticsPage.actions.refresh')}
            </Button>
            <SnapshotShareDialog
              snapshotType="analytics"
              title={t('analyticsPage.shareTitle', {
                company: company?.company_name || t('app.name'),
              })}
              snapshotData={analyticsSnapshotData}
              triggerClassName="border-gray-700"
            />
            <Button onClick={handleExportPDF} variant="outline" className="border-gray-700">
              <Download className="w-4 h-4 mr-2" /> PDF (3)
            </Button>
            <Button onClick={handleExportHTML} variant="outline" className="border-gray-700">
              <FileText className="w-4 h-4 mr-2" /> HTML (2)
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {kpiCards.map(card => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${card.tone}`} />
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${card.tone}`}>{card.value}</div>
                  <p className="text-xs text-gray-500 mt-2">{card.hint}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 bg-gray-900 p-4 md:p-6 rounded-xl border border-gray-800 shadow-lg">
            <h3 className="text-lg md:text-xl font-bold text-gradient mb-6 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
              {t('analyticsPage.charts.revenueVsExpenses')}
            </h3>
            <div className="h-[300px] md:h-[400px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                      formatter={(value) => formatCurrency(value, companyCurrency)}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name={t('analyticsPage.series.revenue')} stroke="#10B981" strokeWidth={3} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="expenses" name={t('analyticsPage.series.expenses')} stroke="#EF4444" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  {t('analyticsPage.empty.noData')}
                </div>
              )}
            </div>
          </div>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                {t('analyticsPage.aging.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[240px]">
                {receivablesAging.some(bucket => bucket.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={receivablesAging}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                        formatter={(value) => formatCurrency(value, companyCurrency)}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {receivablesAging.map(bucket => (
                          <Cell key={bucket.name} fill={bucket.tone} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    {t('analyticsPage.aging.empty')}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {receivablesAging.map(bucket => (
                  <div key={bucket.name} className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">{bucket.name}</p>
                    <p className="text-sm font-semibold text-white mt-1">
                      {formatCurrency(bucket.value, companyCurrency)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-blue-400" />
                {t('analyticsPage.concentration.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clientConcentration.length === 0 ? (
                <p className="text-gray-500">{t('analyticsPage.concentration.empty')}</p>
              ) : clientConcentration.map(client => (
                <div key={client.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{client.name}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(client.value, companyCurrency)}</p>
                    </div>
                    <Badge variant="outline" className="border-gray-700 text-gray-300">
                      {client.share}%
                    </Badge>
                  </div>
                  <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400"
                      style={{ width: `${Math.min(100, client.share)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                {t('analyticsPage.watchlist.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {receivablesWatchlist.length === 0 ? (
                <p className="text-gray-500">{t('analyticsPage.watchlist.empty')}</p>
              ) : receivablesWatchlist.map(item => (
                <div key={item.id} className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{item.clientName}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {t('analyticsPage.watchlist.dueDate', {
                          invoiceNumber: item.invoiceNumber,
                          dueDate: item.dueDate,
                        })}
                      </p>
                    </div>
                    <Badge className="bg-red-500/10 text-red-300 border border-red-500/20">
                      {t('analyticsPage.watchlist.daysOverdue', { count: item.daysOverdue })}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-gray-400">{t('analyticsPage.watchlist.outstandingLabel')}</span>
                    <span className="font-semibold text-orange-400">{formatCurrency(item.amount, companyCurrency)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-gray-900 p-4 md:p-6 rounded-xl border border-gray-800 shadow-lg">
            <h3 className="text-lg md:text-xl font-bold text-gradient mb-6 flex items-center">
              <PieChartIcon className="w-5 h-5 mr-2 text-blue-500" />
              {t('analyticsPage.clientRevenue.title')}
            </h3>
            <div className="h-[300px] md:h-[350px]">
              {clientRevenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={clientRevenueData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {clientRevenueData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                      formatter={(value) => formatCurrency(value, companyCurrency)}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  {t('analyticsPage.empty.noData')}
                </div>
              )}
            </div>
          </div>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-violet-400" />
                {t('analyticsPage.efficiency.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{t('analyticsPage.efficiency.totalHours')}</p>
                  <p className="text-xl font-semibold text-white mt-1">{executiveMetrics.totalHours} h</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{t('analyticsPage.efficiency.billable')}</p>
                  <p className="text-xl font-semibold text-violet-400 mt-1">{executiveMetrics.billableUtilization}%</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{t('analyticsPage.efficiency.invoicedHours')}</p>
                  <p className="text-xl font-semibold text-cyan-400 mt-1">{executiveMetrics.invoicingCoverage}%</p>
                </div>
              </div>

              <div className="space-y-3">
                {topProjects.length === 0 ? (
                  <p className="text-gray-500">{t('analyticsPage.efficiency.empty')}</p>
                ) : topProjects.map(project => (
                  <div key={project.name} className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{project.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {t('analyticsPage.efficiency.hoursWorked', { value: project.hours.toFixed(1) })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-400">{formatCurrency(project.revenue, companyCurrency)}</p>
                        <p className="text-xs text-gray-500">
                          {project.revenuePerHour > 0
                            ? `${formatCurrency(project.revenuePerHour, companyCurrency)}/h`
                            : t('analyticsPage.efficiency.noRevenueLinked')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default AnalyticsPage;
