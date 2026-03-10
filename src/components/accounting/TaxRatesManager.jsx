import React, { useEffect, useState } from 'react';
import { useAccounting } from '@/hooks/useAccounting';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Percent, Zap } from 'lucide-react';

const inferTaxType = (row) => {
  const explicit = String(row.tax_type || '').trim().toLowerCase();
  if (explicit === 'input' || explicit === 'output') {
    return explicit;
  }

  const label = String(row.preset_name || row.name || '').toLowerCase();
  if (label.includes('deduct') || label.includes('déduct')) {
    return 'input';
  }

  return 'output';
};

const normalizePreset = (row) => ({
  name: row.preset_name || row.name || 'VAT',
  rate: Number(row.rate || 0),
  tax_type: inferTaxType(row),
  account_code: row.account_code || '',
});

const TaxRatesManager = () => {
  const { accounts, taxRates, fetchAccounts, fetchTaxRates, createTaxRate, deleteTaxRate } = useAccounting();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: '', rate: '', tax_type: 'output', account_code: '', is_default: false });
  const [presets, setPresets] = useState({});
  const [presetsLoading, setPresetsLoading] = useState(true);

  useEffect(() => {
    fetchAccounts();
    fetchTaxRates();
  }, [fetchAccounts, fetchTaxRates]);

  useEffect(() => {
    let alive = true;

    const loadPresets = async () => {
      setPresetsLoading(true);
      try {
        const { data, error } = await supabase
          .from('tax_rate_presets')
          .select('country_code, preset_name, rate, tax_type, account_code, sort_order, is_active')
          .eq('is_active', true)
          .order('country_code', { ascending: true })
          .order('sort_order', { ascending: true });

        if (error) throw error;

        const grouped = {};
        for (const row of data || []) {
          const countryCode = String(row.country_code || '').trim().toLowerCase();
          if (!countryCode) continue;
          if (!grouped[countryCode]) grouped[countryCode] = [];
          grouped[countryCode].push(normalizePreset(row));
        }

        if (alive) {
          setPresets(grouped);
        }
      } catch (error) {
        console.error('[CashPilot] Failed to load tax rate presets from DB:', error);
        if (alive) {
          setPresets({});
        }
      } finally {
        if (alive) {
          setPresetsLoading(false);
        }
      }
    };

    loadPresets();

    return () => {
      alive = false;
    };
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.rate) return;
    await createTaxRate({ ...form, rate: parseFloat(form.rate) });
    setShowDialog(false);
    setForm({ name: '', rate: '', tax_type: 'output', account_code: '', is_default: false });
  };

  const loadPreset = async (countryCode) => {
    const preset = presets[countryCode];
    if (!preset?.length) return;

    for (const rate of preset) {
      await createTaxRate(rate);
    }
  };

  const presetCountryCodes = Object.keys(presets).sort();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Taux de TVA</h3>
          <p className="text-sm text-gray-400">Configurez les taux de TVA applicables a vos transactions.</p>
        </div>
        <div className="flex gap-2">
          {taxRates.length === 0 && presetCountryCodes.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {presetCountryCodes.map((countryCode) => (
                <Button
                  key={countryCode}
                  variant="outline"
                  size="sm"
                  onClick={() => loadPreset(countryCode)}
                  className="border-gray-700 text-gray-300"
                >
                  <Zap className="w-4 h-4 mr-1" /> Preset {countryCode.toUpperCase()}
                </Button>
              ))}
            </div>
          )}
          <Button onClick={() => setShowDialog(true)} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4 mr-2" /> Ajouter un taux
          </Button>
        </div>
      </div>

      {taxRates.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/50 border border-gray-800 rounded-lg">
          <Percent className="w-12 h-12 mx-auto mb-4 opacity-30 text-gray-500" />
          <p className="text-gray-400">Aucun taux de TVA configure</p>
          <p className="text-xs text-gray-600 mt-1">
            {presetsLoading
              ? 'Chargement des presets depuis la base de donnees...'
              : 'Ajoutez vos taux manuellement ou appliquez un preset depuis la base de donnees.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {taxRates.map((rate) => (
            <Card key={rate.id} className="bg-gray-900 border-gray-800">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-white text-sm">{rate.name}</h4>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-2xl font-bold text-gradient">
                        {(Number(rate.rate || 0) * 100).toFixed(1)}%
                      </span>
                      <Badge className={rate.tax_type === 'output' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}>
                        {rate.tax_type === 'output' ? 'Collectee' : 'Deductible'}
                      </Badge>
                    </div>
                    {rate.account_code && (
                      <p className="text-xs text-gray-500 mt-1 font-mono">Compte : {rate.account_code}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Delete tax rate" onClick={() => deleteTaxRate(rate.id)}>
                    <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gradient">Nouveau taux de TVA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((previous) => ({ ...previous, name: e.target.value }))}
                placeholder="Ex: TVA 20% (normal)"
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Taux (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.rate}
                  onChange={(e) => setForm((previous) => ({ ...previous, rate: e.target.value }))}
                  placeholder="20"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.tax_type} onValueChange={(value) => setForm((previous) => ({ ...previous, tax_type: value }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="output">Collectee (ventes)</SelectItem>
                    <SelectItem value="input">Deductible (achats)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Compte comptable (optionnel)</Label>
              <Select value={form.account_code} onValueChange={(value) => setForm((previous) => ({ ...previous, account_code: value }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700"><SelectValue placeholder="Selectionner" /></SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-[200px]">
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.account_code}>{account.account_code} - {account.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="border-gray-700">Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.name || !form.rate} className="bg-orange-500 hover:bg-orange-600">
              Creer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaxRatesManager;
