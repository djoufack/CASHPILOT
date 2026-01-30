
import React, { useEffect, useState, useMemo } from 'react';
import { useAccounting } from '@/hooks/useAccounting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Upload, Search, FileText } from 'lucide-react';
import ResponsiveTable from '@/components/ui/ResponsiveTable';
import { Card, CardContent } from '@/components/ui/card';
import CSVImportModal from './CSVImportModal';

const TYPE_LABELS = {
  asset: { label: 'Actif', color: 'bg-blue-500/20 text-blue-400' },
  liability: { label: 'Passif', color: 'bg-red-500/20 text-red-400' },
  equity: { label: 'Capitaux', color: 'bg-purple-500/20 text-purple-400' },
  revenue: { label: 'Produit', color: 'bg-green-500/20 text-green-400' },
  expense: { label: 'Charge', color: 'bg-orange-500/20 text-orange-400' }
};

const ChartOfAccounts = () => {
  const { accounts, fetchAccounts, createAccount, bulkCreateAccounts, deleteAccount, loading } = useAccounting();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
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

  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => {
      const matchSearch = !search ||
        a.account_code.toLowerCase().includes(search.toLowerCase()) ||
        a.account_name.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'all' || a.account_type === typeFilter;
      return matchSearch && matchType;
    });
  }, [accounts, search, typeFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createAccount(formData);
    setIsModalOpen(false);
    setFormData({ account_code: '', account_name: '', account_type: 'asset', account_category: '', description: '' });
  };

  const handleCSVImport = async (accountsData) => {
    const result = await bulkCreateAccounts(accountsData);
    return result;
  };

  const columns = [
    { header: 'Code', accessor: 'account_code', className: 'font-mono text-orange-400' },
    { header: 'Nom', accessor: 'account_name', className: 'font-medium text-gradient' },
    { header: 'Type', accessor: (row) => {
      const info = TYPE_LABELS[row.account_type] || { label: row.account_type, color: 'bg-gray-500/20 text-gray-400' };
      return <Badge className={`text-xs ${info.color}`}>{info.label}</Badge>;
    }},
    { header: 'Catégorie', accessor: (row) => row.account_category || '—' },
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
        <div className="flex items-center gap-2 mt-2">
          {(() => {
            const info = TYPE_LABELS[account.account_type] || { label: account.account_type, color: 'bg-gray-500/20 text-gray-400' };
            return <Badge className={`text-xs ${info.color}`}>{info.label}</Badge>;
          })()}
          {account.account_category && <span className="text-xs text-gray-400">{account.account_category}</span>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gradient">Plan comptable</h2>
          <p className="text-gray-400 text-sm">
            {accounts.length} compte{accounts.length > 1 ? 's' : ''} enregistré{accounts.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowImport(true)} className="border-gray-700 text-gray-300 hover:text-white hover:border-orange-500">
            <Upload className="w-4 h-4 mr-2" /> Importer CSV
          </Button>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600">
                <Plus className="mr-2 h-4 w-4" /> Ajouter un compte
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md w-full">
              <DialogHeader>
                <DialogTitle className="text-gradient">Nouveau compte</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Input
                      value={formData.account_code}
                      onChange={(e) => setFormData({...formData, account_code: e.target.value})}
                      placeholder="ex: 411000"
                      className="bg-gray-700 border-gray-600 font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={formData.account_type} onValueChange={(val) => setFormData({...formData, account_type: val})}>
                      <SelectTrigger className="bg-gray-700 border-gray-600"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-white">
                        <SelectItem value="asset">Actif</SelectItem>
                        <SelectItem value="liability">Passif</SelectItem>
                        <SelectItem value="equity">Capitaux propres</SelectItem>
                        <SelectItem value="revenue">Produit</SelectItem>
                        <SelectItem value="expense">Charge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nom du compte</Label>
                  <Input
                    value={formData.account_name}
                    onChange={(e) => setFormData({...formData, account_name: e.target.value})}
                    placeholder="ex: Clients"
                    className="bg-gray-700 border-gray-600"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Catégorie (optionnel)</Label>
                  <Input
                    value={formData.account_category}
                    onChange={(e) => setFormData({...formData, account_category: e.target.value})}
                    placeholder="ex: Créances"
                    className="bg-gray-700 border-gray-600"
                  />
                </div>
                <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={loading}>
                  Créer le compte
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Rechercher par code ou nom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-800 border-gray-700 pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="bg-gray-800 border-gray-700 w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700 text-white">
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="asset">Actif</SelectItem>
            <SelectItem value="liability">Passif</SelectItem>
            <SelectItem value="equity">Capitaux propres</SelectItem>
            <SelectItem value="revenue">Produit</SelectItem>
            <SelectItem value="expense">Charge</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Accounts count */}
      {search || typeFilter !== 'all' ? (
        <p className="text-xs text-gray-500">
          {filteredAccounts.length} résultat{filteredAccounts.length > 1 ? 's' : ''} sur {accounts.length}
        </p>
      ) : null}

      {/* Table */}
      <ResponsiveTable
        data={filteredAccounts}
        columns={columns}
        renderCard={renderCard}
        loading={loading}
      />

      {/* CSV Import Modal */}
      <CSVImportModal
        open={showImport}
        onOpenChange={setShowImport}
        onImport={handleCSVImport}
      />
    </div>
  );
};

export default ChartOfAccounts;
