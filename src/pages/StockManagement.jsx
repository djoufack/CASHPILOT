
import React, { useState, useEffect } from 'react';
import { useStockAlerts, useStockHistory } from '@/hooks/useStockHistory';
import { useSupplierProducts } from '@/hooks/useSupplierProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const StockManagement = () => {
  const { alerts, fetchAlerts, resolveAlert } = useStockAlerts();
  const { suppliers } = useSuppliers();
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  
  // Need to load all products to show stock table
  // Ideally useSupplierProducts would accept 'all' or we fetch all if no ID
  // For now, let's just fetch alerts and handle the UI structure
  
  useEffect(() => {
    fetchAlerts(selectedSupplier === 'all' ? null : selectedSupplier);
  }, [selectedSupplier]);

  return (
    <div className="p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            Stock Management
          </h1>
          <p className="text-gray-400">Monitor inventory levels, alerts, and movements.</p>
        </div>
        
        <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
            <SelectTrigger className="w-[200px] bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}
            </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <Card className="bg-gray-900 border-gray-800">
             <CardHeader className="pb-2">
                 <CardTitle className="text-sm font-medium text-gray-400">Total Alerts</CardTitle>
             </CardHeader>
             <CardContent>
                 <div className="text-2xl font-bold text-white">{alerts.length}</div>
             </CardContent>
         </Card>
         <Card className="bg-gray-900 border-gray-800">
             <CardHeader className="pb-2">
                 <CardTitle className="text-sm font-medium text-gray-400">Low Stock</CardTitle>
             </CardHeader>
             <CardContent>
                 <div className="text-2xl font-bold text-yellow-500">
                     {alerts.filter(a => a.alert_type === 'low_stock').length}
                 </div>
             </CardContent>
         </Card>
         <Card className="bg-gray-900 border-gray-800">
             <CardHeader className="pb-2">
                 <CardTitle className="text-sm font-medium text-gray-400">Out of Stock</CardTitle>
             </CardHeader>
             <CardContent>
                 <div className="text-2xl font-bold text-red-500">
                      {alerts.filter(a => a.alert_type === 'out_of_stock').length}
                 </div>
             </CardContent>
         </Card>
         <Card className="bg-gray-900 border-gray-800">
             <CardHeader className="pb-2">
                 <CardTitle className="text-sm font-medium text-gray-400">Overstock</CardTitle>
             </CardHeader>
             <CardContent>
                 <div className="text-2xl font-bold text-blue-500">
                      {alerts.filter(a => a.alert_type === 'overstock').length}
                 </div>
             </CardContent>
         </Card>
      </div>

      {alerts.length > 0 && (
          <div className="space-y-2">
              <h3 className="font-semibold text-lg">Active Alerts</h3>
              <div className="grid gap-2">
                  {alerts.map(alert => (
                      <Alert key={alert.id} className="bg-gray-900 border border-gray-800 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <AlertTriangle className={`h-5 w-5 ${alert.alert_type === 'out_of_stock' ? 'text-red-500' : 'text-yellow-500'}`} />
                              <div>
                                  <AlertTitle className="text-white">{alert.product?.product_name}</AlertTitle>
                                  <AlertDescription className="text-gray-400">
                                      Current: {alert.product?.stock_quantity} | Min: {alert.product?.min_stock_level}
                                  </AlertDescription>
                              </div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)}>Resolve</Button>
                      </Alert>
                  ))}
              </div>
          </div>
      )}

      <Tabs defaultValue="inventory" className="w-full">
          <TabsList className="bg-gray-900 border-gray-800">
              <TabsTrigger value="inventory">Inventory Overview</TabsTrigger>
              <TabsTrigger value="history">Stock History</TabsTrigger>
              <TabsTrigger value="adjustments">Manual Adjustments</TabsTrigger>
          </TabsList>
          
          <TabsContent value="inventory" className="mt-4">
              <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="p-0">
                      <div className="p-8 text-center text-gray-500">
                          Select a supplier to view specific inventory details.
                      </div>
                  </CardContent>
              </Card>
          </TabsContent>
          
          <TabsContent value="history" className="mt-4">
              <div className="p-8 border border-gray-800 rounded-lg bg-gray-900/50 text-center text-gray-400">
                  Select a product to view detailed history.
              </div>
          </TabsContent>
          
           <TabsContent value="adjustments" className="mt-4">
              <Card className="bg-gray-900 border-gray-800 max-w-lg mx-auto">
                  <CardHeader>
                      <CardTitle>Manual Stock Adjustment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="space-y-2">
                          <Label>Product</Label>
                          <Select>
                              <SelectTrigger className="bg-gray-800 border-gray-700">
                                  <SelectValue placeholder="Select product..." />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                  <SelectItem value="1">Product A</SelectItem>
                                  <SelectItem value="2">Product B</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                               <Label>New Quantity</Label>
                               <Input type="number" className="bg-gray-800 border-gray-700" />
                           </div>
                           <div className="space-y-2">
                               <Label>Reason</Label>
                               <Select defaultValue="adjustment">
                                  <SelectTrigger className="bg-gray-800 border-gray-700">
                                      <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                      <SelectItem value="adjustment">Adjustment</SelectItem>
                                      <SelectItem value="damage">Damage/Loss</SelectItem>
                                      <SelectItem value="return">Return</SelectItem>
                                  </SelectContent>
                              </Select>
                           </div>
                      </div>
                      <div className="space-y-2">
                          <Label>Notes</Label>
                          <Input className="bg-gray-800 border-gray-700" placeholder="Optional notes..." />
                      </div>
                      <Button className="w-full bg-blue-600">Update Stock</Button>
                  </CardContent>
              </Card>
          </TabsContent>
      </Tabs>
    </div>
  );
};

export default StockManagement;
