
import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useInvoices } from '@/hooks/useInvoices';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { useCompany } from '@/hooks/useCompany';
import { useExpenses } from '@/hooks/useExpenses';
import { useCashFlow } from '@/hooks/useCashFlow';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import OnboardingBanner from '@/components/onboarding/OnboardingBanner';
import { formatCurrency, formatCompactCurrency } from '@/utils/currencyService';
import { calculateTrend, formatTrendLabel, calculateProfitMargin, getInvoiceAmount } from '@/utils/calculations';
import { Users, Clock, FileText, TrendingUp, DollarSign, Activity, Loader2, ArrowUp, ArrowDown, Download, Package, Wrench, Wallet, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { exportDashboardPDF, exportDashboardHTML } from '@/services/exportReports';
import AccountingHealthWidget from '@/components/AccountingHealthWidget';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { invoices, fetchInvoices, loading: invoicesLoading } = useInvoices();
  const { timesheets, fetchTimesheets, loading: timesheetsLoading } = useTimesheets();
  const { projects, fetchProjects, loading: projectsLoading } = useProjects();
  const { clients, fetchClients } = useClients();
  const { company } = useCompany();
  const { expenses, fetchExpenses, loading: expensesLoading } = useExpenses();
  const [cfGranularity, setCfGranularity] = useState('month');
  const { cashFlowData, summary: cashFlowSummary, loading: cashFlowLoading } = useCashFlow(6, cfGranularity);
  const { guardedAction, modalProps } = useCreditsGuard();

  useEffect(() => {
    if (user) {
      fetchInvoices();
      fetchTimesheets();
      fetchProjects();
      fetchClients();
      fetchExpenses();
    }
  }, [user]);

  const { metrics, revenueData, clientRevenueData, revenueByType, revenueBreakdownData, recentInvoices, recentTimesheets } = useMemo(() => {
    if (!invoices || !timesheets || !projects || !expenses) {
      return {
        metrics: { revenue: 0, profitMargin: 0, occupancyRate: 0, totalExpenses: 0, netCashFlow: 0, revenueTrend: 0, marginTrend: 0, occupancyTrend: 0 },
        revenueData: [],
        clientRevenueData: [],
        revenueByType: { product: 0, service: 0, other: 0 },
        revenueBreakdownData: [],
        recentInvoices: [],
        recentTimesheets: []
      };
    }

    // --- Revenue: include both "sent" and "paid" invoices, use total_ttc preferably ---
    const billedInvoices = invoices.filter(inv => ['sent', 'paid'].includes(inv.status));
    const totalRevenue = billedInvoices.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);

    // --- Total Expenses ---
    const totalExpenses = (expenses || []).reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

    // --- Profit Margin (fixed formula) ---
    const profitMargin = calculateProfitMargin(totalRevenue, totalExpenses);

    // --- Net Cash Flow ---
    const netCashFlow = totalRevenue - totalExpenses;

    // --- Occupancy Rate ---
    const totalDurationMinutes = timesheets.reduce((sum, ts) => sum + (ts.duration_minutes || 0), 0);
    const totalBudgetMinutes = projects.reduce((sum, p) => sum + (p.budget_hours || 0), 0) * 60;
    let occupancyRate = 0;
    if (totalBudgetMinutes > 0) {
      occupancyRate = (totalDurationMinutes / totalBudgetMinutes) * 100;
    } else if (totalDurationMinutes > 0) {
      occupancyRate = projects.length > 0 ? 100 : 0;
    }

    // --- Real Trends (current month vs previous month) ---
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const getInvDate = (inv) => inv.date || inv.invoice_date || inv.created_at;

    const currentMonthRevenue = billedInvoices
      .filter(inv => { const d = new Date(getInvDate(inv)); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; })
      .reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);

    const prevMonthRevenue = billedInvoices
      .filter(inv => { const d = new Date(getInvDate(inv)); return d.getMonth() === prevMonth && d.getFullYear() === prevYear; })
      .reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);

    const revenueTrend = calculateTrend(currentMonthRevenue, prevMonthRevenue);

    // Expense trends
    const currentMonthExpenses = (expenses || [])
      .filter(exp => { const d = new Date(exp.expense_date || exp.created_at); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; })
      .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    const prevMonthExpenses = (expenses || [])
      .filter(exp => { const d = new Date(exp.expense_date || exp.created_at); return d.getMonth() === prevMonth && d.getFullYear() === prevYear; })
      .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

    const prevMonthMargin = calculateProfitMargin(prevMonthRevenue, prevMonthExpenses);
    const currentMonthMargin = calculateProfitMargin(currentMonthRevenue, currentMonthExpenses);
    const marginTrend = calculateTrend(currentMonthMargin, prevMonthMargin);

    // Occupancy trend
    const currentMonthDuration = timesheets
      .filter(ts => { const d = new Date(ts.date || ts.created_at); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; })
      .reduce((sum, ts) => sum + (ts.duration_minutes || 0), 0);
    const prevMonthDuration = timesheets
      .filter(ts => { const d = new Date(ts.date || ts.created_at); return d.getMonth() === prevMonth && d.getFullYear() === prevYear; })
      .reduce((sum, ts) => sum + (ts.duration_minutes || 0), 0);
    const occupancyTrend = calculateTrend(currentMonthDuration, prevMonthDuration);

    // --- Revenue chart by month (year-aware to avoid cross-year merging) ---
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const getMonthLabel = (date) => `${monthNames[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
    const revenueByMonth = {};
    billedInvoices.forEach(inv => {
      const date = new Date(getInvDate(inv));
      const key = getMonthKey(date);
      if (!revenueByMonth[key]) revenueByMonth[key] = { name: getMonthLabel(date), sortKey: key, revenue: 0 };
      revenueByMonth[key].revenue += getInvoiceAmount(inv);
    });
    const chartRevenue = Object.values(revenueByMonth)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // --- Revenue by client ---
    const revenueByClient = {};
    billedInvoices.forEach(inv => {
      const clientName = inv.client?.company_name || 'Other';
      revenueByClient[clientName] = (revenueByClient[clientName] || 0) + getInvoiceAmount(inv);
    });
    const chartClient = Object.entries(revenueByClient)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    // --- Revenue breakdown by type ---
    const revenueByType = { product: 0, service: 0, other: 0 };
    const classifyItem = (item) => {
      if (item.item_type === 'product' || item.product_id) return 'product';
      if (item.item_type === 'service' || item.item_type === 'timesheet' || item.service_id) return 'service';
      return 'other';
    };
    billedInvoices.forEach(inv => {
      const items = inv.items || [];
      if (items.length > 0) {
        items.forEach(item => {
          const itemTotal = item.total || (item.quantity * item.unit_price) || 0;
          revenueByType[classifyItem(item)] += itemTotal;
        });
      } else {
        revenueByType.other += getInvoiceAmount(inv);
      }
    });

    // --- Monthly breakdown by type for stacked chart (year-aware) ---
    const revenueByMonthType = {};
    billedInvoices.forEach(inv => {
      const date = new Date(getInvDate(inv));
      const key = getMonthKey(date);
      if (!revenueByMonthType[key]) {
        revenueByMonthType[key] = { name: getMonthLabel(date), sortKey: key, products: 0, services: 0, other: 0 };
      }
      const items = inv.items || [];
      if (items.length > 0) {
        items.forEach(item => {
          const itemTotal = item.total || (item.quantity * item.unit_price) || 0;
          const cat = classifyItem(item);
          if (cat === 'product') revenueByMonthType[key].products += itemTotal;
          else if (cat === 'service') revenueByMonthType[key].services += itemTotal;
          else revenueByMonthType[key].other += itemTotal;
        });
      } else {
        revenueByMonthType[key].other += getInvoiceAmount(inv);
      }
    });

    const revenueBreakdownData = Object.values(revenueByMonthType)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return {
      metrics: { revenue: totalRevenue, profitMargin, occupancyRate, totalExpenses, netCashFlow, revenueTrend, marginTrend, occupancyTrend },
      revenueData: chartRevenue,
      clientRevenueData: chartClient,
      revenueByType,
      revenueBreakdownData,
      recentInvoices: [...invoices].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
      recentTimesheets: [...timesheets].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
    };
  }, [invoices, timesheets, projects, expenses, cashFlowData]);

  const handleExportPDF = () => {
    guardedAction(
      CREDIT_COSTS.PDF_REPORT,
      'Dashboard Report PDF',
      async () => {
        await exportDashboardPDF({
          metrics,
          revenueData,
          clientRevenueData,
          recentInvoices,
          recentTimesheets
        }, company);
      }
    );
  };

  const handleExportHTML = () => {
    guardedAction(
      CREDIT_COSTS.EXPORT_HTML,
      'Dashboard Report HTML',
      () => {
        exportDashboardHTML({
          metrics,
          revenueData,
          clientRevenueData,
          recentInvoices,
          recentTimesheets
        }, company);
      }
    );
  };

  const isLoading = invoicesLoading || timesheetsLoading || projectsLoading || expensesLoading;

  const cc = company?.currency;
  const stats = [
    { label: "Total Revenue", value: formatCompactCurrency(metrics.revenue, cc), fullValue: formatCurrency(metrics.revenue, cc), icon: DollarSign, trend: formatTrendLabel(metrics.revenueTrend), trendUp: parseFloat(metrics.revenueTrend) >= 0 },
    { label: "Profit Margin", value: `${Math.round(metrics.profitMargin)}%`, icon: TrendingUp, trend: formatTrendLabel(metrics.marginTrend), trendUp: parseFloat(metrics.marginTrend) >= 0 },
    { label: "Occupancy Rate", value: `${Math.round(metrics.occupancyRate)}%`, icon: Activity, trend: formatTrendLabel(metrics.occupancyTrend), trendUp: parseFloat(metrics.occupancyTrend) >= 0 },
  ];

  const quickActions = [
    { label: t('dashboard.newTimesheet'), path: '/timesheets', icon: Clock },
    { label: t('dashboard.newInvoice'), path: '/invoices', icon: FileText },
    { label: t('dashboard.newClient'), path: '/clients', icon: Users },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <CreditsGuardModal {...modalProps} />
      <Helmet>
        <title>{t('dashboard.title')} - {t('app.name')}</title>
      </Helmet>

      {/* Onboarding Banner - shown when accounting setup is not complete */}
      <OnboardingBanner />

      <div className="container mx-auto p-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-1">
                {t('dashboard.title')}
              </h1>
              <p className="text-gray-500 text-sm">{t('app.tagline')}</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleExportPDF}
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF ({CREDIT_COSTS.PDF_REPORT})
              </Button>
              <Button
                onClick={handleExportHTML}
                size="sm"
                variant="outline"
                className="border-gray-600 hover:bg-gray-700"
              >
                <FileText className="w-4 h-4 mr-2" />
                HTML ({CREDIT_COSTS.EXPORT_HTML})
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{stat.label}</p>
                  <p className="text-2xl md:text-3xl font-bold text-gradient" title={stat.fullValue || stat.value}>{stat.value}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {stat.trendUp ? (
                      <ArrowUp className="w-3 h-3 text-green-400" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={`text-xs font-medium ${stat.trendUp ? 'text-green-400' : 'text-red-400'}`}>{stat.trend}</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-orange-500/10">
                  <stat.icon className="w-6 h-6 text-orange-400" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Revenue Breakdown Cards - show product/service split only when item data exists */}
        {(revenueByType.product > 0 || revenueByType.service > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{t('dashboard.productRevenue')}</p>
                  <p className="text-2xl md:text-3xl font-bold text-blue-400" title={formatCurrency(revenueByType.product, cc)}>{formatCompactCurrency(revenueByType.product, cc)}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Package className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{t('dashboard.serviceRevenue')}</p>
                  <p className="text-2xl md:text-3xl font-bold text-emerald-400" title={formatCurrency(revenueByType.service, cc)}>{formatCompactCurrency(revenueByType.service, cc)}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10">
                  <Wrench className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Expense & Cash Flow Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Total Expenses</p>
                <p className="text-2xl md:text-3xl font-bold text-red-400" title={formatCurrency(metrics.totalExpenses, cc)}>{formatCompactCurrency(metrics.totalExpenses, cc)}</p>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10">
                <Wallet className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Net Cash Flow</p>
                <p className={`text-2xl md:text-3xl font-bold ${metrics.netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`} title={formatCurrency(metrics.netCashFlow, cc)}>
                  {formatCompactCurrency(metrics.netCashFlow, cc)}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${metrics.netCashFlow >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                <DollarSign className={`w-6 h-6 ${metrics.netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`} />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Revenue Breakdown Chart */}
        {revenueBreakdownData.length > 0 && (
          <motion.div
            className="relative bg-gradient-to-br from-[#0c1222] via-[#111827] to-[#0c1222] rounded-2xl p-6 border border-gray-800/40 mb-8 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            {/* Subtle background glow */}
            <div className="absolute top-0 left-1/4 w-1/2 h-32 bg-gradient-to-b from-blue-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-6 relative z-10">
              <div>
                <h2 className="text-lg font-semibold text-white tracking-tight">{t('dashboard.revenueBreakdown')}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.revenueBreakdownSub', { defaultValue: 'Products vs Services by month' })}</p>
              </div>
              {/* Custom legend */}
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(180deg, #39ff14 0%, #20b20e 100%)', boxShadow: '0 0 8px #39ff1450' }} />
                  <span className="text-xs text-gray-400 font-medium">{t('dashboard.productRevenue')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(180deg, #ffd700 0%, #b8960c 100%)', boxShadow: '0 0 8px #ffd70050' }} />
                  <span className="text-xs text-gray-400 font-medium">{t('dashboard.serviceRevenue')}</span>
                </div>
              </div>
            </div>

            <div className="h-[320px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueBreakdownData} barCategoryGap="25%" barGap={4}>
                  <defs>
                    <linearGradient id="gradProducts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#39ff14" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#15803d" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="gradServices" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffd700" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#a16207" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="none" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#475569"
                    fontSize={11}
                    fontWeight={500}
                    tickLine={false}
                    axisLine={false}
                    dy={8}
                  />
                  <YAxis
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    dx={-4}
                    tickFormatter={(val) => {
                      const abs = Math.abs(val);
                      if (abs >= 1e9) return `${(val/1e9).toFixed(1)}Md`;
                      if (abs >= 1e6) return `${(val/1e6).toFixed(1)}M`;
                      if (abs >= 1e3) return `${(val/1e3).toFixed(0)}K`;
                      return val;
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const total = payload.reduce((s, p) => s + (p.value || 0), 0);
                      return (
                        <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-xl px-4 py-3 shadow-2xl shadow-black/40">
                          <p className="text-white font-semibold text-sm mb-2">{label}</p>
                          <div className="space-y-1.5">
                            {payload.filter(p => p.value > 0).map((p) => {
                              const nameMap = { products: t('dashboard.productRevenue'), services: t('dashboard.serviceRevenue') };
                              const colorMap = { products: '#39ff14', services: '#ffd700' };
                              const pct = total > 0 ? ((p.value / total) * 100).toFixed(0) : 0;
                              return (
                                <div key={p.dataKey} className="flex items-center justify-between gap-6">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorMap[p.dataKey] }} />
                                    <span className="text-gray-400 text-xs">{nameMap[p.dataKey]}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white text-xs font-semibold tabular-nums">{formatCurrency(p.value, company?.currency)}</span>
                                    <span className="text-gray-500 text-[10px] w-8 text-right">{pct}%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {payload.filter(p => p.value > 0).length > 1 && (
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50">
                              <span className="text-gray-500 text-xs">Total</span>
                              <span className="text-white text-xs font-bold tabular-nums">{formatCurrency(total, company?.currency)}</span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="products" fill="url(#gradProducts)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="services" fill="url(#gradServices)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <motion.div
            className="lg:col-span-2 bg-gray-900 rounded-xl p-5 border border-gray-800/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-lg font-semibold text-gradient mb-5">Revenue Overview</h2>
            <div id="dashboard-revenue-chart" className="h-[280px] w-full">
              {revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => { const abs = Math.abs(val); if (abs >= 1e9) return `${(val/1e9).toFixed(1)}Md`; if (abs >= 1e6) return `${(val/1e6).toFixed(1)}M`; if (abs >= 1e3) return `${(val/1e3).toFixed(0)}K`; return val; }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => [formatCurrency(value, company?.currency), 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#F59E0B" strokeWidth={2} fill="url(#revenueGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                  No revenue data available
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-lg font-semibold text-gradient mb-5">Revenue by Client</h2>
            <div id="dashboard-client-chart" className="h-[280px] w-full">
              {clientRevenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={clientRevenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="name" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => { const abs = Math.abs(val); if (abs >= 1e9) return `${(val/1e9).toFixed(1)}Md`; if (abs >= 1e6) return `${(val/1e6).toFixed(1)}M`; if (abs >= 1e3) return `${(val/1e3).toFixed(0)}K`; return val; }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => [formatCurrency(value, company?.currency), 'Revenue']}
                    />
                    <Line type="monotone" dataKey="amount" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', strokeWidth: 0, r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                  No data available
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Cash Flow Chart */}
        {cashFlowData.length > 0 && (
          <motion.div
            className="bg-gray-900 rounded-xl p-5 border border-gray-800/50 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gradient">Cash Flow</h2>
              <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-0.5">
                <Calendar className="w-3.5 h-3.5 text-gray-500 ml-2" />
                {[{ key: 'month', label: 'Mois' }, { key: 'week', label: 'Semaines' }].map(opt => (
                  <Button
                    key={opt.key}
                    variant="ghost"
                    size="sm"
                    className={`text-xs h-7 px-3 ${cfGranularity === opt.key ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setCfGranularity(opt.key)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="h-[280px] w-full relative">
              {cashFlowLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 z-10 rounded-lg">
                  <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis dataKey="label" stroke="#6B7280" fontSize={cfGranularity === 'week' ? 8 : 11} tickLine={false} axisLine={false} interval={0} angle={cfGranularity === 'week' ? -45 : 0} textAnchor={cfGranularity === 'week' ? 'end' : 'middle'} height={cfGranularity === 'week' ? 55 : 30} />
                  <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => { const abs = Math.abs(val); if (abs >= 1e9) return `${(val/1e9).toFixed(1)}Md`; if (abs >= 1e6) return `${(val/1e6).toFixed(1)}M`; if (abs >= 1e3) return `${(val/1e3).toFixed(0)}K`; return val; }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const income = payload.find(p => p.dataKey === 'income')?.value || 0;
                      const exp = payload.find(p => p.dataKey === 'expenses')?.value || 0;
                      const net = income - exp;
                      return (
                        <div style={{ backgroundColor: '#111827', border: '1px solid #1F2937', borderRadius: '8px', padding: '10px 14px' }}>
                          <p style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 6 }}>{label}</p>
                          <p style={{ color: '#10B981', fontSize: 13 }}>{formatCurrency(income, cc)}</p>
                          <p style={{ color: '#EF4444', fontSize: 13 }}>{formatCurrency(exp, cc)}</p>
                          <div style={{ borderTop: '1px solid #374151', marginTop: 6, paddingTop: 6 }}>
                            <p style={{ color: '#F59E0B', fontSize: 14, fontWeight: 700 }}>
                              {net >= 0 ? '+' : ''}{formatCompactCurrency(net, cc)}
                            </p>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="income" stroke="#10B981" fill="url(#incomeGradient)" name="Income" />
                  <Area type="monotone" dataKey="expenses" stroke="#EF4444" fill="url(#expenseGradient)" name="Expenses" />
                  <Area type="monotone" dataKey="net" stroke="#F59E0B" strokeWidth={2} strokeDasharray="6 3" fill="url(#netGradient)" name="Net" />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Accounting Health Widget */}
        <div className="mb-8">
          <AccountingHealthWidget />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gradient mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            {t('dashboard.quickActions')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action, index) => (
              <Link key={index} to={action.path}>
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <div className="p-4 rounded-xl border border-gray-800/50 bg-gray-900 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all cursor-pointer flex items-center justify-center gap-3">
                    <action.icon className="w-5 h-5 text-orange-400" />
                    <span className="text-gradient font-medium text-sm">{action.label}</span>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
          >
            <h2 className="text-lg font-semibold text-gradient mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-400" />
              Recent Invoices
            </h2>
            <div className="space-y-3">
              {recentInvoices.length > 0 ? (
                recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                    <div>
                      <p className="text-gradient font-medium text-sm">{inv.invoice_number}</p>
                      <p className="text-xs text-gray-500">{inv.client?.company_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gradient font-semibold text-sm" title={formatCurrency(getInvoiceAmount(inv), cc)}>{formatCompactCurrency(getInvoiceAmount(inv), cc)}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        inv.status === 'paid' ? 'bg-green-500/10 text-green-400' :
                        inv.status === 'sent' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-600 text-center py-6 text-sm">No recent invoices found</p>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-gray-900 rounded-xl p-5 border border-gray-800/50"
          >
            <h2 className="text-lg font-semibold text-gradient mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-400" />
              Recent Timesheets
            </h2>
            <div className="space-y-3">
              {recentTimesheets.length > 0 ? (
                recentTimesheets.map((ts) => (
                  <div key={ts.id} className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                    <div>
                      <p className="text-gradient font-medium text-sm">{ts.task?.name || 'Untitled Task'}</p>
                      <p className="text-xs text-gray-500">{ts.project?.name || 'No Project'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gradient font-semibold text-sm">
                        {Math.floor(ts.duration_minutes / 60)}h {ts.duration_minutes % 60}m
                      </p>
                      <p className="text-[10px] text-gray-500">{new Date(ts.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-600 text-center py-6 text-sm">No recent timesheets found</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
