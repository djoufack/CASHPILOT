
import React, { useEffect } from 'react';
import { useAccounting } from '@/hooks/useAccounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

const AccountingDashboard = () => {
  const { entries, fetchEntries } = useAccounting();

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Mock aggregated data for visualization since entries might be sparse
  const data = [
    { name: 'Jan', revenue: 4000, expense: 2400 },
    { name: 'Feb', revenue: 3000, expense: 1398 },
    { name: 'Mar', revenue: 2000, expense: 9800 },
    { name: 'Apr', revenue: 2780, expense: 3908 },
    { name: 'May', revenue: 1890, expense: 4800 },
    { name: 'Jun', revenue: 2390, expense: 3800 },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <Card className="bg-gray-900 border-gray-800">
           <CardHeader className="flex flex-row items-center justify-between pb-2">
             <CardTitle className="text-sm font-medium text-gray-400">Total Assets</CardTitle>
             <DollarSign className="h-4 w-4 text-green-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-gradient">$45,231.89</div>
             <p className="text-xs text-gray-500">+20.1% from last month</p>
           </CardContent>
         </Card>
         <Card className="bg-gray-900 border-gray-800">
           <CardHeader className="flex flex-row items-center justify-between pb-2">
             <CardTitle className="text-sm font-medium text-gray-400">Total Liabilities</CardTitle>
             <TrendingDown className="h-4 w-4 text-red-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-gradient">$12,340.00</div>
             <p className="text-xs text-gray-500">+4% from last month</p>
           </CardContent>
         </Card>
         <Card className="bg-gray-900 border-gray-800">
           <CardHeader className="flex flex-row items-center justify-between pb-2">
             <CardTitle className="text-sm font-medium text-gray-400">Net Income</CardTitle>
             <TrendingUp className="h-4 w-4 text-orange-400" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-gradient">$32,891.89</div>
             <p className="text-xs text-gray-500">+12% from last month</p>
           </CardContent>
         </Card>
         <Card className="bg-gray-900 border-gray-800">
           <CardHeader className="flex flex-row items-center justify-between pb-2">
             <CardTitle className="text-sm font-medium text-gray-400">Cash Flow</CardTitle>
             <Activity className="h-4 w-4 text-yellow-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-gradient">$8,231.00</div>
             <p className="text-xs text-gray-500">Operating activities</p>
           </CardContent>
         </Card>
      </div>

      {/* Main Chart */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-gradient">Revenue vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={data}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                 <XAxis dataKey="name" stroke="#9CA3AF" />
                 <YAxis stroke="#9CA3AF" />
                 <Tooltip 
                   contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                   itemStyle={{ color: '#fff' }}
                 />
                 <Bar dataKey="revenue" fill="#F59E0B" name="Revenue" />
                 <Bar dataKey="expense" fill="#EF4444" name="Expenses" />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </CardContent>
      </Card>
      
      {/* Recent Entries */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h3 className="text-lg font-bold text-gradient mb-4">Recent Transactions</h3>
        {entries.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No recent transactions found.</p>
        ) : (
          <div className="space-y-2">
             {entries.map(entry => (
               <div key={entry.id} className="flex justify-between items-center p-2 bg-gray-800/50 rounded hover:bg-gray-800 transition">
                 <div>
                   <div className="text-gradient font-medium">{entry.description || 'Transaction'}</div>
                   <div className="text-xs text-gray-400">{entry.account_code} • {entry.transaction_date}</div>
                 </div>
                 <div className={`font-mono font-bold ${entry.debit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                   {entry.debit > 0 ? `+${formatCurrency(entry.debit)}` : `-${formatCurrency(entry.credit)}`}
                 </div>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountingDashboard;
