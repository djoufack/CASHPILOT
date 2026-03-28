import { useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useSupplierReports } from '@/hooks/useSupplierReports';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { exportSupplierReportPDF, exportSupplierReportHTML } from '@/services/exportReports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Loader2, DollarSign, Package, Truck, Download, FileText, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/calculations';

const COLORS = ['#facc15', '#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#ef4444'];
const STATUS_COLORS = {
  pending: '#facc15',
  confirmed: '#3b82f6',
  delivered: '#22c55e',
  received: '#16a34a',
  cancelled: '#ef4444',
  draft: '#94a3b8',
};
const DELIVERY_COLORS = {
  onTime: '#22c55e',
  early: '#3b82f6',
  late: '#f97316',
};
const SCORE_BAND_STYLES = {
  A: 'bg-emerald-950/50 text-emerald-300 border-emerald-700/40',
  B: 'bg-lime-950/50 text-lime-300 border-lime-700/40',
  C: 'bg-yellow-950/50 text-yellow-300 border-yellow-700/40',
  D: 'bg-orange-950/50 text-orange-300 border-orange-700/40',
  E: 'bg-red-950/50 text-red-300 border-red-700/40',
};

const toDateOnly = (value) => {
  if (!value) return null;

  const rawDate = value.includes('T') ? value.split('T')[0] : value;
  const parsed = new Date(`${rawDate}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const EmptyChartState = ({ message }) => (
  <div className="h-[300px] sm:h-[360px] flex items-center justify-center rounded-lg border border-dashed border-gray-800 text-sm text-gray-500">
    {message}
  </div>
);

const SupplierReports = () => {
  const { t, i18n } = useTranslation();
  const { reportData, loading, error, generateReports } = useSupplierReports();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();

  useEffect(() => {
    void generateReports();
  }, [generateReports]);

  const chartLocale = i18n.language?.startsWith('fr') ? 'fr-BE' : 'en-US';

  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(chartLocale, {
        month: 'short',
        year: '2-digit',
      }),
    [chartLocale]
  );
  const scoreDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(chartLocale, {
        dateStyle: 'medium',
      }),
    [chartLocale]
  );

  const supplierScoreSummary = useMemo(() => {
    const rows = reportData.supplierScores || [];
    const averageGlobal =
      rows.length > 0
        ? Math.round((rows.reduce((sum, row) => sum + Number(row.globalScore || 0), 0) / rows.length) * 10) / 10
        : 0;

    const chartData = rows.slice(0, 12).map((row) => ({
      supplierName: row.supplierName,
      globalScore: Number(row.globalScore || 0),
      qualityScore: Number(row.qualityScore || 0),
      deliveryScore: Number(row.deliveryScore || 0),
      costScore: Number(row.costScore || 0),
    }));

    return {
      rows,
      chartData,
      averageGlobal,
    };
  }, [reportData.supplierScores]);

  const orderVolumeData = useMemo(() => {
    const monthMap = new Map();

    reportData.orders.forEach((order) => {
      const orderDate = toDateOnly(order.order_date || order.created_at);

      if (!orderDate) {
        return;
      }

      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      const current = monthMap.get(monthKey) || { orders: 0, amount: 0, date: orderDate };

      current.orders += 1;
      current.amount += Number(order.total_amount || 0);
      monthMap.set(monthKey, current);
    });

    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, value]) => ({
        monthKey,
        label: monthFormatter.format(value.date),
        orders: value.orders,
        amount: value.amount,
      }));
  }, [monthFormatter, reportData.orders]);

  const orderStatusData = useMemo(() => {
    const statusMap = new Map();

    reportData.orders.forEach((order) => {
      const status = order.order_status || 'draft';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    return [...statusMap.entries()]
      .map(([status, value]) => ({
        status,
        value,
        label: t(`supplierReports.status.${status}`, { defaultValue: status }),
      }))
      .sort((a, b) => b.value - a.value);
  }, [reportData.orders, t]);

  const deliverySummary = useMemo(() => {
    const deliveryRows = (reportData.delivery || []).map((entry) => ({
      ...entry,
      varianceLabel:
        entry.varianceDays === 0
          ? t('supplierReports.onTimeLabel')
          : entry.varianceDays < 0
            ? `${t('supplierReports.earlyLabel')} ${t('supplierReports.varianceDays', { count: Math.abs(entry.varianceDays) })}`
            : `${t('supplierReports.lateLabel')} ${t('supplierReports.varianceDays', { count: entry.varianceDays })}`,
    }));

    const deliveredCount = deliveryRows.length;
    const onTimeCount = deliveryRows.filter((entry) => entry.timing === 'onTime').length;
    const earlyCount = deliveryRows.filter((entry) => entry.timing === 'early').length;
    const lateCount = deliveryRows.filter((entry) => entry.timing === 'late').length;

    return {
      deliveredCount,
      onTimeCount,
      earlyCount,
      lateCount,
      onTimeRate: deliveredCount > 0 ? Math.round((onTimeCount / deliveredCount) * 100) : reportData.onTimeRate || 0,
      breakdown: [
        { key: 'onTime', value: onTimeCount, label: t('supplierReports.onTimeLabel') },
        { key: 'early', value: earlyCount, label: t('supplierReports.earlyLabel') },
        { key: 'late', value: lateCount, label: t('supplierReports.lateLabel') },
      ].filter((entry) => entry.value > 0),
      variance: deliveryRows,
    };
  }, [reportData.delivery, reportData.onTimeRate, t]);

  const handleExportPDF = () => {
    guardedAction(CREDIT_COSTS.PDF_SUPPLIER_REPORT, t('supplierReports.title'), async () => {
      await exportSupplierReportPDF(
        {
          ...reportData,
          onTimeRate: deliverySummary.onTimeRate,
        },
        company
      );
    });
  };

  const handleExportHTML = () => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, t('supplierReports.title'), () => {
      exportSupplierReportHTML(
        {
          ...reportData,
          onTimeRate: deliverySummary.onTimeRate,
        },
        company
      );
    });
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t('pages.supplierReports', 'Supplier Reports')} | CashPilot</title>
      </Helmet>
      <CreditsGuardModal {...modalProps} />
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gradient">{t('supplierReports.title')}</h1>
            <p className="text-gray-400 mt-2 text-sm">{t('supplierReports.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-gray-700 text-gray-300" onClick={handleExportPDF}>
              <Download className="w-4 h-4 mr-2" /> {t('supplierReports.exportPdf', { credits: 3 })}
            </Button>
            <Button variant="outline" className="border-gray-700 text-gray-300" onClick={handleExportHTML}>
              <FileText className="w-4 h-4 mr-2" /> {t('supplierReports.exportHtml', { credits: 2 })}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">{t('supplierReports.totalSpent')}</CardTitle>
              <DollarSign className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gradient">{formatCurrency(reportData.totalSpent || 0)}</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">{t('supplierReports.totalOrders')}</CardTitle>
              <Package className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gradient">{reportData.ordersCount || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">{t('supplierReports.onTimeDelivery')}</CardTitle>
              <Truck className="w-4 h-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gradient">{deliverySummary.onTimeRate}%</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                {t('supplierReports.averageSupplierScore')}
              </CardTitle>
              <Award className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gradient">
                {supplierScoreSummary.averageGlobal}
                <span className="ml-1 text-base text-gray-400">/100</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <Card className="bg-red-950/30 border-red-900/50">
            <CardContent className="py-4 text-sm text-red-200">{error}</CardContent>
          </Card>
        )}

        <Tabs defaultValue="spending" className="w-full">
          <TabsList className="bg-gray-900 border-gray-800 w-full overflow-x-auto justify-start h-auto p-1">
            <TabsTrigger value="spending" className="flex-1 min-w-[100px]">
              {t('supplierReports.spending')}
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex-1 min-w-[100px]">
              {t('supplierReports.orders')}
            </TabsTrigger>
            <TabsTrigger value="delivery" className="flex-1 min-w-[100px]">
              {t('supplierReports.delivery')}
            </TabsTrigger>
            <TabsTrigger value="scores" className="flex-1 min-w-[100px]">
              {t('supplierReports.supplierScores')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="spending" className="mt-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>{t('supplierReports.monthlySpendingTrend')}</CardTitle>
              </CardHeader>
              <CardContent>
                {reportData.spending.length > 0 ? (
                  <div className="h-[300px] sm:h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={reportData.spending}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                        <Line type="monotone" dataKey="amount" stroke="#8884d8" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChartState message={t('supplierReports.noOrderData')} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle>{t('supplierReports.ordersByMonth')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {orderVolumeData.length > 0 ? (
                    <div className="h-[300px] sm:h-[360px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={orderVolumeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="label" stroke="#9CA3AF" />
                          <YAxis stroke="#9CA3AF" allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                            formatter={(value, name) => {
                              if (name === 'amount') {
                                return [formatCurrency(Number(value)), t('supplierReports.totalSpent')];
                              }

                              return [value, t('supplierReports.totalOrders')];
                            }}
                          />
                          <Bar dataKey="orders" radius={[6, 6, 0, 0]} fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyChartState message={t('supplierReports.noOrderData')} />
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle>{t('supplierReports.ordersByStatus')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {orderStatusData.length > 0 ? (
                    <div className="h-[300px] sm:h-[360px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={orderStatusData}
                            dataKey="value"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            outerRadius={110}
                            label={({ label, value }) => `${label}: ${value}`}
                          >
                            {orderStatusData.map((entry, index) => (
                              <Cell
                                key={entry.status}
                                fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                            formatter={(value, _name, context) => [value, context?.payload?.label || '']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyChartState message={t('supplierReports.noOrderData')} />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="delivery" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    {t('supplierReports.deliveredOrders')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gradient">{deliverySummary.deliveredCount}</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">{t('supplierReports.onTime')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">{deliverySummary.onTimeCount}</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">{t('supplierReports.early')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-400">{deliverySummary.earlyCount}</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">{t('supplierReports.late')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-400">{deliverySummary.lateCount}</div>
                </CardContent>
              </Card>
            </div>

            {deliverySummary.deliveredCount > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle>{t('supplierReports.deliveryPerformance')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] sm:h-[360px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={deliverySummary.breakdown}
                            dataKey="value"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            outerRadius={110}
                            label={({ label, value }) => `${label}: ${value}`}
                          >
                            {deliverySummary.breakdown.map((entry) => (
                              <Cell key={entry.key} fill={DELIVERY_COLORS[entry.key]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                            formatter={(value, _name, context) => [value, context?.payload?.label || '']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle>{t('supplierReports.deliveryVariance')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] sm:h-[360px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={deliverySummary.variance}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="order" stroke="#9CA3AF" />
                          <YAxis stroke="#9CA3AF" />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                            formatter={(value, _name, context) => [
                              context?.payload?.varianceLabel || value,
                              t('supplierReports.deliveryVariance'),
                            ]}
                          />
                          <Bar dataKey="varianceDays" radius={[6, 6, 0, 0]}>
                            {deliverySummary.variance.map((entry) => (
                              <Cell key={entry.order} fill={DELIVERY_COLORS[entry.timing]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <EmptyChartState message={t('supplierReports.noDeliveryData')} />
            )}
          </TabsContent>

          <TabsContent value="scores" className="mt-6 space-y-6">
            {supplierScoreSummary.rows.length > 0 ? (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader>
                      <CardTitle>{t('supplierReports.scoreBySupplier')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[320px] sm:h-[380px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={supplierScoreSummary.chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis
                              dataKey="supplierName"
                              stroke="#9CA3AF"
                              interval={0}
                              angle={-20}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis stroke="#9CA3AF" domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                              formatter={(value, name) => {
                                const safeValue = `${Math.round(Number(value || 0) * 10) / 10}/100`;

                                switch (name) {
                                  case 'globalScore':
                                    return [safeValue, t('supplierReports.globalScore')];
                                  case 'qualityScore':
                                    return [safeValue, t('supplierReports.qualityScore')];
                                  case 'deliveryScore':
                                    return [safeValue, t('supplierReports.deliveryScore')];
                                  case 'costScore':
                                    return [safeValue, t('supplierReports.costScore')];
                                  default:
                                    return [safeValue, name];
                                }
                              }}
                            />
                            <Bar dataKey="globalScore" radius={[6, 6, 0, 0]} fill="#22c55e" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader>
                      <CardTitle>{t('supplierReports.scoreOverview')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-3">
                          <p className="text-xs text-gray-500">{t('supplierReports.globalScore')}</p>
                          <p className="text-xl font-semibold text-emerald-300">
                            {supplierScoreSummary.averageGlobal}/100
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-3">
                          <p className="text-xs text-gray-500">{t('supplierReports.qualityScore')}</p>
                          <p className="text-xl font-semibold text-sky-300">
                            {Math.round(
                              (supplierScoreSummary.rows.reduce((sum, row) => sum + Number(row.qualityScore || 0), 0) /
                                supplierScoreSummary.rows.length) *
                                10
                            ) / 10}
                            /100
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-3">
                          <p className="text-xs text-gray-500">{t('supplierReports.deliveryScore')}</p>
                          <p className="text-xl font-semibold text-blue-300">
                            {Math.round(
                              (supplierScoreSummary.rows.reduce((sum, row) => sum + Number(row.deliveryScore || 0), 0) /
                                supplierScoreSummary.rows.length) *
                                10
                            ) / 10}
                            /100
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-3">
                          <p className="text-xs text-gray-500">{t('supplierReports.costScore')}</p>
                          <p className="text-xl font-semibold text-orange-300">
                            {Math.round(
                              (supplierScoreSummary.rows.reduce((sum, row) => sum + Number(row.costScore || 0), 0) /
                                supplierScoreSummary.rows.length) *
                                10
                            ) / 10}
                            /100
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">{t('supplierReports.scoreBandLegend')}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle>{t('supplierReports.scoreTable')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead>
                          <tr className="border-b border-gray-800 text-left text-gray-400">
                            <th className="py-2 pr-3 font-medium">{t('common.supplier', 'Supplier')}</th>
                            <th className="py-2 pr-3 font-medium">{t('supplierReports.globalScore')}</th>
                            <th className="py-2 pr-3 font-medium">{t('supplierReports.qualityScore')}</th>
                            <th className="py-2 pr-3 font-medium">{t('supplierReports.deliveryScore')}</th>
                            <th className="py-2 pr-3 font-medium">{t('supplierReports.costScore')}</th>
                            <th className="py-2 pr-3 font-medium">{t('supplierReports.scoreBand')}</th>
                            <th className="py-2 pr-3 font-medium">{t('supplierReports.lastEvaluation')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplierScoreSummary.rows.map((row) => {
                            const scoreBand = String(row.scoreBand || 'E').toUpperCase();
                            const parsedEvaluationDate = row.evaluatedAt ? new Date(row.evaluatedAt) : null;
                            const hasValidEvaluationDate =
                              parsedEvaluationDate && !Number.isNaN(parsedEvaluationDate.getTime());

                            return (
                              <tr key={row.supplierId} className="border-b border-gray-900/80 text-gray-200">
                                <td className="py-3 pr-3 font-medium text-white">{row.supplierName}</td>
                                <td className="py-3 pr-3">{Math.round(Number(row.globalScore || 0) * 10) / 10}/100</td>
                                <td className="py-3 pr-3">{Math.round(Number(row.qualityScore || 0) * 10) / 10}/100</td>
                                <td className="py-3 pr-3">
                                  {Math.round(Number(row.deliveryScore || 0) * 10) / 10}/100
                                </td>
                                <td className="py-3 pr-3">{Math.round(Number(row.costScore || 0) * 10) / 10}/100</td>
                                <td className="py-3 pr-3">
                                  <Badge
                                    variant="outline"
                                    className={SCORE_BAND_STYLES[scoreBand] || SCORE_BAND_STYLES.E}
                                  >
                                    {scoreBand}
                                  </Badge>
                                </td>
                                <td className="py-3 pr-3 text-gray-400">
                                  {hasValidEvaluationDate
                                    ? scoreDateFormatter.format(parsedEvaluationDate)
                                    : t('supplierReports.notEvaluated')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <EmptyChartState message={t('supplierReports.noSupplierScoreData')} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default SupplierReports;
