
import React, { useEffect, useMemo } from "react";
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useInvoices } from '@/hooks/useInvoices';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { formatCurrency } from '@/utils/calculations';
import { Users, Clock, FileText, TrendingUp, DollarSign, Activity, Loader2, ArrowUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { invoices, fetchInvoices, loading: invoicesLoading } = useInvoices();
  const { timesheets, fetchTimesheets, loading: timesheetsLoading } = useTimesheets();
  const { projects, fetchProjects, loading: projectsLoading } = useProjects();
  const { clients, fetchClients } = useClients();

  useEffect(() => {
    if (user) {
      fetchInvoices();
      fetchTimesheets();
      fetchProjects();
      fetchClients();
    }
  }, [user]);

  const { metrics, revenueData, clientRevenueData, recentInvoices, recentTimesheets } = useMemo(() => {
    if (!invoices || !timesheets || !projects) {
      return {
        metrics: { revenue: 0, profitMargin: 0, occupancyRate: 0 },
        revenueData: [],
        clientRevenueData: [],
        recentInvoices: [],
        recentTimesheets: []
      };
    }

    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const profitMargin = totalRevenue > 0 ? ((totalRevenue) / totalRevenue) * 100 : 0;

    const totalDurationMinutes = timesheets.reduce((sum, ts) => sum + (ts.duration_minutes || 0), 0);
    const totalBudgetMinutes = projects.reduce((sum, p) => sum + (p.budget_hours || 0), 0) * 60;
    let occupancyRate = 0;
    if (totalBudgetMinutes > 0) {
      occupancyRate = (totalDurationMinutes / totalBudgetMinutes) * 100;
    } else if (totalDurationMinutes > 0) {
      occupancyRate = projects.length > 0 ? 100 : 0;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const revenueByMonth = {};
    paidInvoices.forEach(inv => {
      const date = new Date(inv.date || inv.created_at);
      const monthName = months[date.getMonth()];
      revenueByMonth[monthName] = (revenueByMonth[monthName] || 0) + (inv.total || 0);
    });
    const chartRevenue = Object.entries(revenueByMonth)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => months.indexOf(a.name) - months.indexOf(b.name));

    const revenueByClient = {};
    paidInvoices.forEach(inv => {
      const clientName = inv.client?.company_name || 'Other';
      revenueByClient[clientName] = (revenueByClient[clientName] || 0) + (inv.total || 0);
    });
    const chartClient = Object.entries(revenueByClient)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => months.indexOf(a.name) - months.indexOf(b.name));

    return {
      metrics: { revenue: totalRevenue, profitMargin, occupancyRate },
      revenueData: chartRevenue,
      clientRevenueData: chartClient,
      recentInvoices: [...invoices].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
      recentTimesheets: [...timesheets].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
    };
  }, [invoices, timesheets, projects]);

  const isLoading = invoicesLoading || timesheetsLoading || projectsLoading;

  const stats = [
    { label: "Total Revenue", value: formatCurrency(metrics.revenue), icon: DollarSign, trend: "+12.5%" },
    { label: "Profit Margin", value: `${Math.round(metrics.profitMargin)}%`, icon: TrendingUp, trend: "+3.2%" },
    { label: "Occupancy Rate", value: `${Math.round(metrics.occupancyRate)}%`, icon: Activity, trend: "+5.1%" },
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
      <Helmet>
        <title>{t('dashboard.title')} - {t('app.name')}</title>
      </Helmet>

      <div className="container mx-auto p-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">
            {t('dashboard.title')}
          </h1>
          <p className="text-gray-500 text-sm">{t('app.tagline')}</p>
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
                  <p className="text-2xl md:text-3xl font-bold text-white">{stat.value}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <ArrowUp className="w-3 h-3 text-orange-400" />
                    <span className="text-xs text-orange-400 font-medium">{stat.trend}</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-orange-500/10">
                  <stat.icon className="w-6 h-6 text-orange-400" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <motion.div
            className="lg:col-span-2 bg-gray-900 rounded-xl p-5 border border-gray-800/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-lg font-semibold text-white mb-5">Revenue Overview</h2>
            <div className="h-[280px] w-full">
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
                    <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => [formatCurrency(value), 'Revenue']}
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
            <h2 className="text-lg font-semibold text-white mb-5">Revenue by Client</h2>
            <div className="h-[280px] w-full">
              {clientRevenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={clientRevenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="name" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => [formatCurrency(value), 'Revenue']}
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

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            {t('dashboard.quickActions')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action, index) => (
              <Link key={index} to={action.path}>
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <div className="p-4 rounded-xl border border-gray-800/50 bg-gray-900 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all cursor-pointer flex items-center justify-center gap-3">
                    <action.icon className="w-5 h-5 text-orange-400" />
                    <span className="text-white font-medium text-sm">{action.label}</span>
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
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-400" />
              Recent Invoices
            </h2>
            <div className="space-y-3">
              {recentInvoices.length > 0 ? (
                recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                    <div>
                      <p className="text-white font-medium text-sm">{inv.invoice_number}</p>
                      <p className="text-xs text-gray-500">{inv.client?.company_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold text-sm">{formatCurrency(inv.total)}</p>
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
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-400" />
              Recent Timesheets
            </h2>
            <div className="space-y-3">
              {recentTimesheets.length > 0 ? (
                recentTimesheets.map((ts) => (
                  <div key={ts.id} className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                    <div>
                      <p className="text-white font-medium text-sm">{ts.task?.name || 'Untitled Task'}</p>
                      <p className="text-xs text-gray-500">{ts.project?.name || 'No Project'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold text-sm">
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
