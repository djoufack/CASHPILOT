
import React, { useEffect } from 'react';
import { useSupplierReports } from '@/hooks/useSupplierReports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Loader2, DollarSign, Package, Truck, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/calculations';

const SupplierReports = () => {
  const { reportData, loading, generateReports } = useSupplierReports();

  useEffect(() => {
    generateReports();
  }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (loading) {
     return <div className="h-screen flex items-center justify-center bg-gray-950 text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl sm:text-3xl font-bold text-gradient">
             Supplier Reports
           </h1>
           <p className="text-gray-400 mt-2 text-sm">Analyze spending, performance, and trends.</p>
        </div>
        <Button variant="outline" className="border-gray-700 text-gray-300">
           <Download className="w-4 h-4 mr-2" /> Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium text-gray-400">Total Spent</CardTitle>
               <DollarSign className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold text-gradient">{formatCurrency(reportData.totalSpent || 0)}</div>
            </CardContent>
         </Card>
         <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium text-gray-400">Total Orders</CardTitle>
               <Package className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold text-gradient">{reportData.ordersCount || 0}</div>
            </CardContent>
         </Card>
         <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium text-gray-400">On-Time Delivery</CardTitle>
               <Truck className="w-4 h-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold text-gradient">92%</div>
            </CardContent>
         </Card>
      </div>

      <Tabs defaultValue="spending" className="w-full">
         <TabsList className="bg-gray-900 border-gray-800 w-full overflow-x-auto justify-start h-auto p-1">
             <TabsTrigger value="spending" className="flex-1 min-w-[100px]">Spending</TabsTrigger>
             <TabsTrigger value="orders" className="flex-1 min-w-[100px]">Orders</TabsTrigger>
             <TabsTrigger value="delivery" className="flex-1 min-w-[100px]">Delivery</TabsTrigger>
         </TabsList>

         <TabsContent value="spending" className="mt-6">
            <Card className="bg-gray-900 border-gray-800">
               <CardHeader>
                  <CardTitle>Monthly Spending Trend</CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="h-[300px] sm:h-[400px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={reportData.spending}>
                           <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                           <XAxis dataKey="date" stroke="#9CA3AF" />
                           <YAxis stroke="#9CA3AF" />
                           <Tooltip 
                              contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }} 
                              formatter={(val) => formatCurrency(val)}
                           />
                           <Line type="monotone" dataKey="amount" stroke="#8884d8" strokeWidth={2} />
                        </LineChart>
                     </ResponsiveContainer>
                  </div>
               </CardContent>
            </Card>
         </TabsContent>

         <TabsContent value="orders" className="mt-6">
             <div className="p-12 text-center border border-dashed border-gray-800 rounded-lg text-gray-500">
                 Order volume charts loading...
             </div>
         </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupplierReports;
