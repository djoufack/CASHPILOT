
import React, { useEffect, useState, useMemo } from "react";
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useInvoices } from '@/hooks/useInvoices';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { formatCurrency } from '@/utils/calculations';
import { Users, Clock, FileText, Plus, TrendingUp, DollarSign, Activity, FileSignature, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // Fetch real data
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

  // Derived Metrics & Chart Data
  const { metrics, revenueData, projectData, recentInvoices, recentTimesheets } = useMemo(() => {
    if (!invoices || !timesheets || !projects) {
      return { 
        metrics: { revenue: 0, expenses: 0, profitMargin: 0, occupancyRate: 0 },
        revenueData: [],
        projectData: [],
        recentInvoices: [],
        recentTimesheets: []
      };
    }

    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalExpenses = 0;
    
    let profitMargin = 0;
    if (totalRevenue > 0) {
      profitMargin = ((totalRevenue - totalExpenses) / totalRevenue) * 100;
    }

    const totalDurationMinutes = timesheets.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
    const totalBudgetHours = projects.reduce((sum, p) => sum + (p.budget_hours || 0), 0);
    const totalBudgetMinutes = totalBudgetHours * 60;

    let occupancyRate = 0;
    if (totalBudgetMinutes > 0) {
      occupancyRate = (totalDurationMinutes / totalBudgetMinutes) * 100;
    } else if (totalDurationMinutes > 0) {
      occupancyRate = projects.length > 0 ? 100 : 0;
    }

    const revenueByMonth = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    paidInvoices.forEach(inv => {
      const date = new Date(inv.date || inv.created_at);
      const monthIndex = date.getMonth(); 
      const monthName = months[monthIndex];
      revenueByMonth[monthName] = (revenueByMonth[monthName] || 0) + (inv.total || 0);
    });

    const chartDataRevenue = Object.entries(revenueByMonth).map(([name, amount]) => ({
      name,
      amount
    })).sort((a, b) => months.indexOf(a.name) - months.indexOf(b.name));

    const revenueByClient = {};
    paidInvoices.forEach(inv => {
      const clientName = inv.client?.company_name || 'Unknown Client';
      revenueByClient[clientName] = (revenueByClient[clientName] || 0) + (inv.total || 0);
    });

    const chartDataProject = Object.entries(revenueByClient).map(([name, value]) => ({
      name,
      value
    }));

    const recentInvoicesList = [...invoices]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
      
    const recentTimesheetsList = [...timesheets]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    return {
      metrics: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        profitMargin,
        occupancyRate
      },
      revenueData: chartDataRevenue,
      projectData: chartDataProject,
      recentInvoices: recentInvoicesList,
      recentTimesheets: recentTimesheetsList
    };
  }, [invoices, timesheets, projects]);

  const isLoading = invoicesLoading || timesheetsLoading || projectsLoading;
  const COLORS = ['#FFD700', '#3B82F6', '#10B981', '#A855F7', '#F59E0B', '#EC4899'];

  const stats = [
    { 
      label: "Total Revenue", 
      value: formatCurrency(metrics.revenue), 
      icon: DollarSign, 
      color: 'from-blue-500 to-cyan-500' 
    },
    { 
      label: "Profit Margin", 
      value: `${Math.round(metrics.profitMargin)}%`, 
      icon: TrendingUp, 
      color: 'from-green-500 to-emerald-500' 
    },
    { 
      label: "Occupancy Rate", 
      value: `${Math.round(metrics.occupancyRate)}%`, 
      icon: Activity, 
      color: 'from-purple-500 to-pink-500' 
    }
  ];

  const quickActions = [
    { label: t('dashboard.newTimesheet'), path: '/timesheets', icon: Clock, color: 'from-yellow-500 to-orange-500' },
    { label: t('dashboard.newInvoice'), path: '/invoices', icon: FileText, color: 'from-green-500 to-teal-500' },
    { label: t('dashboard.newClient'), path: '/clients', icon: Users, color: 'from-purple-500 to-indigo-500' }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t('dashboard.title')} - {t('app.name')}</title>
      </Helmet>

      <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-400 via-blue-500 to-purple-500 bg-clip-text text-transparent mb-2">
              {t('dashboard.title')}
            </h1>
            <p className="text-gray-400 text-sm md:text-base">{t('app.tagline')}</p>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg hover:shadow-2xl transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                    <p className="text-2xl md:text-3xl font-bold text-white">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color}`}>
                    <stat.icon className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Revenue Chart */}
            <motion.div 
              className="lg:col-span-2 bg-gray-900 rounded-xl p-4 md:p-6 border border-gray-800 shadow-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-lg md:text-xl font-bold text-white mb-6">Revenue Overview</h2>
              <div className="h-[250px] md:h-[300px] w-full">
                {revenueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value) => [formatCurrency(value), 'Revenue']}
                      />
                      <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                   <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                     No revenue data available
                   </div>
                )}
              </div>
            </motion.div>

            {/* Distribution Chart */}
            <motion.div 
              className="lg:col-span-1 bg-gray-900 rounded-xl p-4 md:p-6 border border-gray-800 shadow-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-lg md:text-xl font-bold text-white mb-6">Revenue by Client</h2>
              <div className="h-[250px] md:h-[300px] w-full">
                {projectData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={projectData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {projectData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                        formatter={(value) => [formatCurrency(value), 'Revenue']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                    No data available
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6 mr-2 text-yellow-400" />
              {t('dashboard.quickActions')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickActions.map((action, index) => (
                <Link key={index} to={action.path} className="block w-full">
                  <motion.div
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={`p-4 md:p-6 rounded-xl bg-gradient-to-br ${action.color} shadow-lg cursor-pointer flex items-center space-x-4`}>
                      <div className="bg-white/20 p-2 rounded-lg">
                        <action.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                      </div>
                      <p className="text-white font-semibold text-base md:text-lg">{action.label}</p>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Lists Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Recent Invoices */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gray-900 rounded-xl p-4 md:p-6 border border-gray-800 shadow-lg"
            >
               <h2 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center">
                 <FileText className="w-5 h-5 mr-2 text-blue-500" />
                 Recent Invoices
               </h2>
               <div className="space-y-4">
                 {recentInvoices.length > 0 ? (
                   recentInvoices.map((inv) => (
                     <div key={inv.id} className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                       <div>
                         <p className="text-white font-medium text-sm md:text-base">{inv.invoice_number}</p>
                         <p className="text-xs md:text-sm text-gray-400">{inv.client?.company_name}</p>
                       </div>
                       <div className="text-right">
                         <p className="text-white font-bold text-sm md:text-base">{formatCurrency(inv.total)}</p>
                         <span className={`text-[10px] md:text-xs px-2 py-1 rounded-full ${
                           inv.status === 'paid' ? 'bg-green-500/20 text-green-400' : 
                           inv.status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                           'bg-gray-500/20 text-gray-400'
                         }`}>
                           {inv.status}
                         </span>
                       </div>
                     </div>
                   ))
                 ) : (
                   <p className="text-gray-500 text-center py-4 text-sm">No recent invoices found</p>
                 )}
               </div>
            </motion.div>

            {/* Recent Timesheets */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gray-900 rounded-xl p-4 md:p-6 border border-gray-800 shadow-lg"
            >
               <h2 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center">
                 <Clock className="w-5 h-5 mr-2 text-yellow-500" />
                 Recent Timesheets
               </h2>
               <div className="space-y-4">
                 {recentTimesheets.length > 0 ? (
                   recentTimesheets.map((ts) => (
                     <div key={ts.id} className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                       <div>
                         <p className="text-white font-medium text-sm md:text-base">{ts.task?.name || 'Untitled Task'}</p>
                         <p className="text-xs md:text-sm text-gray-400">{ts.project?.name || 'No Project'}</p>
                       </div>
                       <div className="text-right">
                         <p className="text-white font-bold text-sm md:text-base">
                           {Math.floor(ts.duration_minutes / 60)}h {ts.duration_minutes % 60}m
                         </p>
                         <p className="text-xs text-gray-400">{new Date(ts.date).toLocaleDateString()}</p>
                       </div>
                     </div>
                   ))
                 ) : (
                   <p className="text-gray-500 text-center py-4 text-sm">No recent timesheets found</p>
                 )}
               </div>
            </motion.div>
          </div>
      </div>
    </>
  );
};

export default Dashboard;
