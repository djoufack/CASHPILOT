
import React, { useEffect, useState } from 'react';
import { useAccounting } from '@/hooks/useAccounting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit } from 'lucide-react';
import ResponsiveTable from '@/components/ui/ResponsiveTable';
import { Card, CardContent } from '@/components/ui/card';

const ChartOfAccounts = () => {
  const { accounts, fetchAccounts, createAccount, deleteAccount, loading } = useAccounting();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    account_code: '',
    account_name: '',
    account_type: 'asset',
    account_category: '',
    description: ''
  });

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createAccount(formData);
    setIsModalOpen(false);
    setFormData({ account_code: '', account_name: '', account_type: 'asset', account_category: '', description: '' });
  };

  const columns = [
    { header: 'Code', accessor: 'account_code', className: 'font-mono text-orange-400' },
    { header: 'Name', accessor: 'account_name', className: 'font-medium text-gradient' },
    { header: 'Type', accessor: (row) => <span className="capitalize">{row.account_type}</span> },
    { header: 'Category', accessor: 'account_category' },
    { header: 'Actions', accessor: (row) => (
       <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteAccount(row.id); }} className="text-red-400 hover:text-red-300">
         <Trash2 className="h-4 w-4" />
       </Button>
    ), className: 'text-right' }
  ];

  const renderCard = (account) => (
    <Card className="bg-gray-800 border-gray-700 mb-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <span className="font-mono text-xs text-orange-400 bg-orange-900/20 px-2 py-1 rounded">{account.account_code}</span>
            <h3 className="text-lg font-bold text-gradient mt-2">{account.account_name}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => deleteAccount(account.id)} className="text-red-400">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-400 mt-2">
           <div>Type: <span className="text-gray-300 capitalize">{account.account_type}</span></div>
           <div>Category: <span className="text-gray-300">{account.account_category || '-'}</span></div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-xl font-bold text-gradient">Chart of Accounts</h2>
           <p className="text-gray-400 text-sm">Manage your general ledger accounts.</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md w-full">
            <DialogHeader>
              <DialogTitle>Add New Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input 
                    value={formData.account_code}
                    onChange={(e) => setFormData({...formData, account_code: e.target.value})}
                    placeholder="e.g. 1000"
                    className="bg-gray-700 border-gray-600"
                    required
                  />
                </div>
                <div className="space-y-2">
                   <Label>Type</Label>
                   <Select value={formData.account_type} onValueChange={(val) => setFormData({...formData, account_type: val})}>
                     <SelectTrigger className="bg-gray-700 border-gray-600">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="bg-gray-800 border-gray-700 text-white">
                       <SelectItem value="asset">Asset</SelectItem>
                       <SelectItem value="liability">Liability</SelectItem>
                       <SelectItem value="equity">Equity</SelectItem>
                       <SelectItem value="revenue">Revenue</SelectItem>
                       <SelectItem value="expense">Expense</SelectItem>
                     </SelectContent>
                   </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input 
                  value={formData.account_name}
                  onChange={(e) => setFormData({...formData, account_name: e.target.value})}
                  className="bg-gray-700 border-gray-600"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input 
                  value={formData.account_category}
                  onChange={(e) => setFormData({...formData, account_category: e.target.value})}
                  placeholder="e.g. Current Assets"
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={loading}>Create Account</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ResponsiveTable 
        data={accounts}
        columns={columns}
        renderCard={renderCard}
        loading={loading}
      />
    </div>
  );
};

export default ChartOfAccounts;
