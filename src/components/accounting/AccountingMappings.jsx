
import React, { useState, useEffect } from 'react';
import { useAccounting } from '@/hooks/useAccounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle, ArrowRight, Settings } from 'lucide-react';

const SOURCE_TYPES = [
  { value: 'invoice', label: 'Facture client (vente)' },
  { value: 'expense', label: 'Dépense' },
  { value: 'supplier_invoice', label: 'Facture fournisseur (achat)' }
];

const EXPENSE_CATEGORIES = [
  'general', 'office', 'travel', 'meals', 'transport', 'software',
  'hardware', 'marketing', 'legal', 'insurance', 'rent', 'utilities',
  'telecom', 'training', 'consulting', 'other'
];

const INVOICE_CATEGORIES = ['revenue', 'service', 'product'];
const SUPPLIER_CATEGORIES = ['purchase', 'service', 'supply'];

const AccountingMappings = () => {
  const { accounts, mappings, fetchAccounts, fetchMappings, createMapping, deleteMapping } = useAccounting();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    source_type: '',
    source_category: '',
    debit_account_code: '',
    credit_account_code: '',
    description: ''
  });

  useEffect(() => {
    fetchAccounts();
    fetchMappings();
  }, [fetchAccounts, fetchMappings]);

  const getCategoriesForType = (type) => {
    switch (type) {
      case 'invoice': return INVOICE_CATEGORIES;
      case 'expense': return EXPENSE_CATEGORIES;
      case 'supplier_invoice': return SUPPLIER_CATEGORIES;
      default: return [];
    }
  };

  const getAccountName = (code) => {
    const acc = accounts.find(a => a.account_code === code);
    return acc ? `${code} - ${acc.account_name}` : code;
  };

  const getSourceLabel = (type) => {
    return SOURCE_TYPES.find(s => s.value === type)?.label || type;
  };

  const handleCreate = async () => {
    if (!form.source_type || !form.source_category || !form.debit_account_code || !form.credit_account_code) return;
    await createMapping(form);
    setShowDialog(false);
    setForm({ source_type: '', source_category: '', debit_account_code: '', credit_account_code: '', description: '' });
  };

  const unmappedCategories = () => {
    const mapped = new Set(mappings.map(m => `${m.source_type}:${m.source_category}`));
    const unmapped = [];
    EXPENSE_CATEGORIES.forEach(cat => {
      if (!mapped.has(`expense:${cat}`)) unmapped.push({ type: 'expense', category: cat });
    });
    INVOICE_CATEGORIES.forEach(cat => {
      if (!mapped.has(`invoice:${cat}`)) unmapped.push({ type: 'invoice', category: cat });
    });
    return unmapped;
  };

  const unmapped = unmappedCategories();

  return (
    <div className="space-y-6">
      {/* Alert for unmapped categories */}
      {unmapped.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium text-sm">
              {unmapped.length} catégorie(s) non associée(s) à un compte comptable
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Les montants de ces catégories n'apparaîtront pas dans les rapports comptables.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-white">Mappings comptables</h3>
          <p className="text-sm text-gray-400">Associez chaque catégorie de transaction à un compte du plan comptable.</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-2" /> Ajouter un mapping
        </Button>
      </div>

      {/* Mappings list */}
      {mappings.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/50 border border-gray-800 rounded-lg">
          <Settings className="w-12 h-12 mx-auto mb-4 opacity-30 text-gray-500" />
          <p className="text-gray-400">Aucun mapping configuré</p>
          <p className="text-xs text-gray-600 mt-1">Créez des mappings pour associer vos transactions aux comptes comptables.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mappings.map(mapping => (
            <Card key={mapping.id} className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 flex items-center gap-3 flex-wrap">
                  <Badge className="bg-blue-500/20 text-blue-400 text-xs">
                    {getSourceLabel(mapping.source_type)}
                  </Badge>
                  <Badge className="bg-gray-700 text-gray-300 text-xs">
                    {mapping.source_category}
                  </Badge>
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                  <div className="text-sm">
                    <span className="text-green-400 font-mono">{mapping.debit_account_code}</span>
                    <span className="text-gray-600 mx-2">/</span>
                    <span className="text-red-400 font-mono">{mapping.credit_account_code}</span>
                  </div>
                  {mapping.description && (
                    <span className="text-xs text-gray-500">— {mapping.description}</span>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteMapping(mapping.id)}>
                  <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-400" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gradient">Nouveau mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type de source</Label>
              <Select value={form.source_type} onValueChange={v => setForm(p => ({ ...p, source_type: v, source_category: '' }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {SOURCE_TYPES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.source_type && (
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={form.source_category} onValueChange={v => setForm(p => ({ ...p, source_category: v }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-[200px]">
                    {getCategoriesForType(form.source_type).map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Compte débit</Label>
                <Select value={form.debit_account_code} onValueChange={v => setForm(p => ({ ...p, debit_account_code: v }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700"><SelectValue placeholder="Débit" /></SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-[200px]">
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.account_code}>
                        {a.account_code} - {a.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Compte crédit</Label>
                <Select value={form.credit_account_code} onValueChange={v => setForm(p => ({ ...p, credit_account_code: v }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700"><SelectValue placeholder="Crédit" /></SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-[200px]">
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.account_code}>
                        {a.account_code} - {a.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description (optionnel)</Label>
              <Input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Ex: Ventes de prestations de services"
                className="bg-gray-800 border-gray-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="border-gray-700">Annuler</Button>
            <Button onClick={handleCreate} className="bg-orange-500 hover:bg-orange-600"
              disabled={!form.source_type || !form.source_category || !form.debit_account_code || !form.credit_account_code}>
              Créer le mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountingMappings;
