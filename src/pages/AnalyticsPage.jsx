
import React, { useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useInvoices } from '@/hooks/useInvoices';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useExpenses } from '@/hooks/useExpenses';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, TrendingUp, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { 
  aggregateRevenueByMonth, 
  aggregateExpensesByMonth, 
  aggregateRevenueByClient, 
  aggregateProjectPerformance, 
  formatChartData 
} from '@/utils/analyticsCalculations';
import { formatCurrency } from '@/utils/calculations';

const AnalyticsPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

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

  const handleRefresh = async () => {
    try {
      await Promise.all([
        fetchInvoices(),
        fetchTimesheets(),
        fetchExpenses()
      ]);
      toast({
        title: t('common.success'),
        description: "Analytics data refreshed successfully",
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: "Failed to refresh data",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (user) {
      handleRefresh();
    }
  }, [user]);

  // Calculations
  const chartData = useMemo(() => {
    const revByMonth = aggregateRevenueByMonth(invoices);
    const expByMonth = aggregateExpensesByMonth(expenses);
    return formatChartData(revByMonth, expByMonth);
  }, [invoices, expenses]);

  const clientRevenueData = useMemo(() => {
    return aggregateRevenueByClient(invoices);
  }, [invoices]);

  const projectPerformanceData = useMemo(() => {
    return aggregateProjectPerformance(timesheets, invoices);
  }, [timesheets, invoices]);

  const isLoading = loadingInvoices || loadingTimesheets || loadingExpenses;
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  return (
    <>
      <Helmet>
        <title>Analytics - {t('app.name')}</title>
      </Helmet>
      
        <div className="container mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 bg-clip-text text-transparent mb-2">
                        Analytics & Reporting
                    </h1>
                    <p className="text-gray-400 text-sm md:text-base">Financial insights and performance metrics</p>
                </div>
                <Button 
                  onClick={handleRefresh} 
                  disabled={isLoading}
                  className="w-full md:w-auto bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Refresh Data
                </Button>
            </div>

            {/* Revenue vs Expenses Chart */}
            <div className="bg-gray-900 p-4 md:p-6 rounded-xl border border-gray-800 shadow-lg mb-8">
                <h3 className="text-lg md:text-xl font-bold text-white mb-6 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
                  Revenue vs Expenses
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
                                  formatter={(value) => formatCurrency(value)}
                              />
                              <Legend />
                              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#10B981" strokeWidth={3} activeDot={{ r: 8 }} />
                              <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" strokeWidth={3} />
                          </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        Aucune donnée disponible
                      </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Revenue by Client */}
              <div className="bg-gray-900 p-4 md:p-6 rounded-xl border border-gray-800 shadow-lg">
                <h3 className="text-lg md:text-xl font-bold text-white mb-6 flex items-center">
                  <PieChartIcon className="w-5 h-5 mr-2 text-blue-500" />
                  Revenue by Client
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
                          formatter={(value) => formatCurrency(value)}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Aucune donnée disponible
                    </div>
                  )}
                </div>
              </div>

              {/* Project Performance */}
              <div className="bg-gray-900 p-4 md:p-6 rounded-xl border border-gray-800 shadow-lg">
                <h3 className="text-lg md:text-xl font-bold text-white mb-6 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-purple-500" />
                  Project Performance (Hours)
                </h3>
                <div className="h-[300px] md:h-[350px]">
                  {projectPerformanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectPerformanceData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" stroke="#9CA3AF" fontSize={12} />
                        <YAxis dataKey="name" type="category" stroke="#9CA3AF" width={80} fontSize={12} />
                        <Tooltip 
                          cursor={{fill: 'transparent'}}
                          contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                        />
                        <Bar dataKey="hours" name="Hours Worked" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Aucune donnée disponible
                    </div>
                  )}
                </div>
              </div>
            </div>
        </div>
    </>
  );
};

export default AnalyticsPage;
