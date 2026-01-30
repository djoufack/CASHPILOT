
import React, { useState, useEffect } from 'react';
import { useBillingSettings } from '@/hooks/useBillingSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ResponsiveTable from '@/components/ui/ResponsiveTable';
import { CreditCard, Download, Trash2, Check, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const BillingSettings = () => {
  const { billingInfo, paymentMethods, invoices, subscription, loading, updateBilling, addPaymentMethod, deletePaymentMethod, setDefaultPaymentMethod, cancelSubscription } = useBillingSettings();
  const [formData, setFormData] = useState({});

  useEffect(() => {
    setFormData(billingInfo);
  }, [billingInfo]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveBilling = (e) => {
    e.preventDefault();
    updateBilling(formData);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Subscription Info */}
        <Card className="bg-gray-900 border-gray-800 text-white">
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription className="text-gray-400">Manage your subscription and billing cycle.</CardDescription>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                   <div>
                      <h3 className="text-2xl font-bold text-gradient">{subscription.plan} Plan</h3>
                      <p className="text-gray-400 text-sm">Next billing date: {subscription.next_billing}</p>
                   </div>
                   <div className="text-right">
                      <div className="text-2xl font-bold text-gradient">${subscription.price}<span className="text-sm text-gray-400 font-normal">/{subscription.interval}</span></div>
                      <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border-none mt-1">Active</Badge>
                   </div>
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1 bg-orange-500 hover:bg-orange-600">Upgrade Plan</Button>
                  <Button variant="outline" onClick={cancelSubscription} className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">Cancel Subscription</Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-400 mb-4">You don't have an active subscription.</p>
                <Button className="bg-orange-500 hover:bg-orange-600">View Plans</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="bg-gray-900 border-gray-800 text-white">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                 <CardTitle>Payment Methods</CardTitle>
                 <CardDescription className="text-gray-400">Manage your credit cards.</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="border-gray-700"><Plus size={16} className="mr-2"/> Add Card</Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-900 border-gray-800 text-white">
                  <DialogHeader><DialogTitle>Add New Card</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                     <div className="space-y-2">
                        <Label>Card Number</Label>
                        <Input placeholder="0000 0000 0000 0000" className="bg-gray-800 border-gray-700"/>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <Label>Expiry</Label>
                           <Input placeholder="MM/YY" className="bg-gray-800 border-gray-700"/>
                        </div>
                        <div className="space-y-2">
                           <Label>CVC</Label>
                           <Input placeholder="123" className="bg-gray-800 border-gray-700"/>
                        </div>
                     </div>
                     <Button onClick={() => addPaymentMethod({ number: '4242' })} className="w-full bg-blue-600">Save Card</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
             <div className="space-y-3">
                {paymentMethods.map(method => (
                  <div key={method.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-800 bg-gray-900/50">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-800 rounded">
                           <CreditCard size={20} className="text-gray-400"/>
                        </div>
                        <div>
                           <p className="font-medium text-sm text-gradient">{method.brand} ending in {method.last4}</p>
                           <p className="text-xs text-gray-500">Expires {method.exp_month}/{method.exp_year}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        {method.is_default && <Badge variant="secondary" className="bg-orange-900/30 text-orange-400 text-[10px]">Default</Badge>}
                        {!method.is_default && (
                           <Button size="icon" variant="ghost" onClick={() => setDefaultPaymentMethod(method.id)} title="Set Default">
                              <Check size={16} className="text-gray-500 hover:text-green-500"/>
                           </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => deletePaymentMethod(method.id)}>
                           <Trash2 size={16} className="text-gray-500 hover:text-red-500"/>
                        </Button>
                     </div>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Billing Details Form */}
      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
           <CardTitle>Billing Information</CardTitle>
           <CardDescription className="text-gray-400">This information will appear on your invoices.</CardDescription>
        </CardHeader>
        <CardContent>
           <form onSubmit={handleSaveBilling} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <Label>Company Name</Label>
                 <Input name="company_name" value={formData.company_name || ''} onChange={handleChange} className="bg-gray-800 border-gray-700 text-white" required />
              </div>
              <div className="space-y-2">
                 <Label>VAT Number</Label>
                 <Input name="vat_number" value={formData.vat_number || ''} onChange={handleChange} className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-2 md:col-span-2">
                 <Label>Billing Address</Label>
                 <Input name="address" value={formData.address || ''} onChange={handleChange} className="bg-gray-800 border-gray-700 text-white" required />
              </div>
              <div className="space-y-2">
                 <Label>City</Label>
                 <Input name="city" value={formData.city || ''} onChange={handleChange} className="bg-gray-800 border-gray-700 text-white" required />
              </div>
              <div className="space-y-2">
                 <Label>Postal Code</Label>
                 <Input name="postal_code" value={formData.postal_code || ''} onChange={handleChange} className="bg-gray-800 border-gray-700 text-white" required />
              </div>
              <div className="md:col-span-2 flex justify-end">
                 <Button type="submit" className="bg-orange-500 hover:bg-orange-600">Save Billing Info</Button>
              </div>
           </form>
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
           <CardTitle>Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
           <ResponsiveTable
             data={invoices}
             columns={[
               { header: 'Date', accessor: 'date' },
               { header: 'Amount', accessor: (inv) => <span className="text-gradient font-medium">${inv.amount.toFixed(2)}</span> },
               { header: 'Status', accessor: (inv) => (
                 <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 capitalize">{inv.status}</Badge>
               )},
               { header: 'Action', accessor: () => (
                 <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                   <Download size={16} className="text-gray-400 hover:text-white" />
                 </Button>
               ), className: 'text-right' }
             ]}
             renderCard={(inv) => (
               <Card className="bg-gray-800 border-gray-700">
                 <CardContent className="p-4">
                   <div className="flex justify-between items-center">
                     <div>
                       <p className="text-gray-400 text-sm">{inv.date}</p>
                       <p className="text-gradient font-bold text-lg mt-1">${inv.amount.toFixed(2)}</p>
                     </div>
                     <div className="flex items-center gap-2">
                       <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 capitalize">{inv.status}</Badge>
                       <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                         <Download size={16} className="text-gray-400" />
                       </Button>
                     </div>
                   </div>
                 </CardContent>
               </Card>
             )}
             loading={loading}
             emptyMessage="No invoices found."
           />
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingSettings;
