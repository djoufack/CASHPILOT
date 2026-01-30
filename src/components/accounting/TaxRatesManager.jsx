
import React, { useState, useEffect } from 'react';
import { useAccounting } from '@/hooks/useAccounting';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Percent, Zap } from 'lucide-react';

const PRESETS = {
  france: [
    { name: 'TVA 20% (normal)', rate: 0.2, tax_type: 'output', account_code: '445710' },
    { name: 'TVA 10% (intermédiaire)', rate: 0.1, tax_type: 'output', account_code: '445710' },
    { name: 'TVA 5.5% (réduit)', rate: 0.055, tax_type: 'output', account_code: '445710' },
    { name: 'TVA 2.1% (super-réduit)', rate: 0.021, tax_type: 'output', account_code: '445710' },
    { name: 'TVA déductible 20%', rate: 0.2, tax_type: 'input', account_code: '445660' },
    { name: 'TVA déductible 10%', rate: 0.1, tax_type: 'input', account_code: '445660' },
  ],
  belgique: [
    { name: 'TVA 21% (normal)', rate: 0.21, tax_type: 'output', account_code: '451000' },
    { name: 'TVA 12% (intermédiaire)', rate: 0.12, tax_type: 'output', account_code: '451000' },
    { name: 'TVA 6% (réduit)', rate: 0.06, tax_type: 'output', account_code: '451000' },
    { name: 'TVA déductible 21%', rate: 0.21, tax_type: 'input', account_code: '411000' },
  ]
};

const TaxRatesManager = () => {
  const { accounts, taxRates, fetchAccounts, fetchTaxRates, createTaxRate, deleteTaxRate } = useAccounting();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: '', rate: '', tax_type: 'output', account_code: '', is_default: false });

  useEffect(() => {
    fetchAccounts();
    fetchTaxRates();
  }, [fetchAccounts, fetchTaxRates]);

  const handleCreate = async () => {
    if (!form.name || !form.rate) return;
    await createTaxRate({ ...form, rate: parseFloat(form.rate) });
    setShowDialog(false);
    setForm({ name: '', rate: '', tax_type: 'output', account_code: '', is_default: false });
  };

  const loadPreset = async (country) => {
    const preset = PRESETS[country];
    if (!preset) return;
    for (const rate of preset) {
      await createTaxRate(rate);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Taux de TVA</h3>
          <p className="text-sm text-gray-400">Configurez les taux de TVA applicables à vos transactions.</p>
        </div>
        <div className="flex gap-2">
          {taxRates.length === 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => loadPreset('france')} className="border-gray-700 text-gray-300">
                <Zap className="w-4 h-4 mr-1" /> Preset France
              </Button>
              <Button variant="outline" size="sm" onClick={() => loadPreset('belgique')} className="border-gray-700 text-gray-300">
                <Zap className="w-4 h-4 mr-1" /> Preset Belgique
              </Button>
            </div>
          )}
          <Button onClick={() => setShowDialog(true)} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4 mr-2" /> Ajouter un taux
          </Button>
        </div>
      </div>

      {/* Tax rates list */}
      {taxRates.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/50 border border-gray-800 rounded-lg">
          <Percent className="w-12 h-12 mx-auto mb-4 opacity-30 text-gray-500" />
          <p className="text-gray-400">Aucun taux de TVA configuré</p>
          <p className="text-xs text-gray-600 mt-1">Utilisez un preset ou ajoutez vos taux manuellement.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {taxRates.map(rate => (
            <Card key={rate.id} className="bg-gray-900 border-gray-800">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-white text-sm">{rate.name}</h4>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-2xl font-bold text-gradient">
                        {(rate.rate * 100).toFixed(1)}%
                      </span>
                      <Badge className={rate.tax_type === 'output' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}>
                        {rate.tax_type === 'output' ? 'Collectée' : 'Déductible'}
                      </Badge>
                    </div>
                    {rate.account_code && (
                      <p className="text-xs text-gray-500 mt-1 font-mono">Compte : {rate.account_code}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteTaxRate(rate.id)}>
                    <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gradient">Nouveau taux de TVA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: TVA 20% (normal)" className="bg-gray-800 border-gray-700" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Taux (%)</Label>
                <Input type="number" step="0.01" min="0" max="100"
                  value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))}
                  placeholder="20" className="bg-gray-800 border-gray-700" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.tax_type} onValueChange={v => setForm(p => ({ ...p, tax_type: v }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="output">Collectée (ventes)</SelectItem>
                    <SelectItem value="input">Déductible (achats)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Compte comptable (optionnel)</Label>
              <Select value={form.account_code} onValueChange={v => setForm(p => ({ ...p, account_code: v }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-[200px]">
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.account_code}>{a.account_code} - {a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="border-gray-700">Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.name || !form.rate} className="bg-orange-500 hover:bg-orange-600">
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaxRatesManager;
