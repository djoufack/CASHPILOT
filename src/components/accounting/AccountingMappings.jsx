
import React, { useState, useEffect } from 'react';
import { useAccounting } from '@/hooks/useAccounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle, ArrowRight, Settings, Zap, Loader2 } from 'lucide-react';

const SOURCE_TYPES = [
  { value: 'invoice', label: 'Facture client (vente)' },
  { value: 'expense', label: 'Dépense' },
  { value: 'supplier_invoice', label: 'Facture fournisseur (achat)' },
  { value: 'payment', label: 'Paiement client' },
  { value: 'credit_note', label: 'Note de crédit' },
  { value: 'supplier_payment', label: 'Paiement fournisseur' },
];

const EXPENSE_CATEGORIES = [
  'general', 'office', 'travel', 'meals', 'transport', 'software',
  'hardware', 'marketing', 'legal', 'insurance', 'rent', 'utilities',
  'telecom', 'training', 'consulting', 'other'
];

const INVOICE_CATEGORIES = ['revenue', 'service', 'product'];
const SUPPLIER_CATEGORIES = ['purchase', 'service', 'supply'];
const PAYMENT_CATEGORIES = ['cash', 'bank_transfer', 'card', 'check', 'paypal', 'other'];
const CREDIT_NOTE_CATEGORIES = ['general'];

// Preset mappings Belgique — PCG belge
const BELGIAN_MAPPINGS = [
  // Factures clients (ventes) → Débit: Clients / Crédit: Produits
  { source_type: 'invoice', source_category: 'revenue', debit_account_code: '400', credit_account_code: '700', description: 'Ventes de marchandises' },
  { source_type: 'invoice', source_category: 'service', debit_account_code: '400', credit_account_code: '7061', description: 'Prestations de services' },
  { source_type: 'invoice', source_category: 'product', debit_account_code: '400', credit_account_code: '701', description: 'Ventes de produits finis' },
  // Dépenses → Débit: Charge / Crédit: Banque
  { source_type: 'expense', source_category: 'general', debit_account_code: '6180', credit_account_code: '512', description: 'Frais généraux divers' },
  { source_type: 'expense', source_category: 'office', debit_account_code: '6064', credit_account_code: '512', description: 'Fournitures administratives' },
  { source_type: 'expense', source_category: 'travel', debit_account_code: '6251', credit_account_code: '512', description: 'Voyages et déplacements' },
  { source_type: 'expense', source_category: 'meals', debit_account_code: '6257', credit_account_code: '512', description: 'Réceptions et frais de repas' },
  { source_type: 'expense', source_category: 'transport', debit_account_code: '6241', credit_account_code: '512', description: 'Transport de biens et matériel' },
  { source_type: 'expense', source_category: 'software', debit_account_code: '6116', credit_account_code: '512', description: 'Logiciels et abonnements numériques' },
  { source_type: 'expense', source_category: 'hardware', debit_account_code: '6063', credit_account_code: '512', description: 'Matériel informatique (petit équipement)' },
  { source_type: 'expense', source_category: 'marketing', debit_account_code: '6231', credit_account_code: '512', description: 'Publicité et marketing' },
  { source_type: 'expense', source_category: 'legal', debit_account_code: '6226', credit_account_code: '512', description: 'Honoraires juridiques et comptables' },
  { source_type: 'expense', source_category: 'insurance', debit_account_code: '616', credit_account_code: '512', description: 'Primes d\'assurance' },
  { source_type: 'expense', source_category: 'rent', debit_account_code: '6132', credit_account_code: '512', description: 'Loyers immobiliers' },
  { source_type: 'expense', source_category: 'utilities', debit_account_code: '6061', credit_account_code: '512', description: 'Énergie (eau, gaz, électricité)' },
  { source_type: 'expense', source_category: 'telecom', debit_account_code: '626', credit_account_code: '512', description: 'Téléphone et Internet' },
  { source_type: 'expense', source_category: 'training', debit_account_code: '6333', credit_account_code: '512', description: 'Formation professionnelle' },
  { source_type: 'expense', source_category: 'consulting', debit_account_code: '6226', credit_account_code: '512', description: 'Honoraires de conseil' },
  { source_type: 'expense', source_category: 'other', debit_account_code: '658', credit_account_code: '512', description: 'Charges diverses de gestion' },
  // Factures fournisseurs → Débit: Charge / Crédit: Fournisseurs
  { source_type: 'supplier_invoice', source_category: 'purchase', debit_account_code: '601', credit_account_code: '401', description: 'Achats de matières et marchandises' },
  { source_type: 'supplier_invoice', source_category: 'service', debit_account_code: '604', credit_account_code: '401', description: 'Achats de prestations de services' },
  { source_type: 'supplier_invoice', source_category: 'supply', debit_account_code: '6022', credit_account_code: '401', description: 'Achats de fournitures consommables' },
  // Paiements clients
  { source_type: 'payment', source_category: 'cash', debit_account_code: '550', credit_account_code: '400', description: 'Encaissement - espèces' },
  { source_type: 'payment', source_category: 'bank_transfer', debit_account_code: '550', credit_account_code: '400', description: 'Encaissement - virement' },
  { source_type: 'payment', source_category: 'card', debit_account_code: '550', credit_account_code: '400', description: 'Encaissement - carte' },
  { source_type: 'payment', source_category: 'check', debit_account_code: '550', credit_account_code: '400', description: 'Encaissement - chèque' },
  // Notes de crédit
  { source_type: 'credit_note', source_category: 'general', debit_account_code: '700', credit_account_code: '400', description: 'Avoir client' },
];

const FRENCH_MAPPINGS = [
  // Factures clients (ventes) → Débit: Clients / Crédit: Produits
  { source_type: 'invoice', source_category: 'revenue', debit_account_code: '411', credit_account_code: '701', description: 'Ventes de marchandises' },
  { source_type: 'invoice', source_category: 'service', debit_account_code: '411', credit_account_code: '706', description: 'Prestations de services' },
  { source_type: 'invoice', source_category: 'product', debit_account_code: '411', credit_account_code: '701', description: 'Ventes de produits finis' },
  // Paiements clients
  { source_type: 'payment', source_category: 'cash', debit_account_code: '530', credit_account_code: '411', description: 'Encaissement - espèces' },
  { source_type: 'payment', source_category: 'bank_transfer', debit_account_code: '512', credit_account_code: '411', description: 'Encaissement - virement' },
  { source_type: 'payment', source_category: 'card', debit_account_code: '512', credit_account_code: '411', description: 'Encaissement - carte' },
  { source_type: 'payment', source_category: 'check', debit_account_code: '514', credit_account_code: '411', description: 'Encaissement - chèque' },
  // Notes de crédit
  { source_type: 'credit_note', source_category: 'general', debit_account_code: '701', credit_account_code: '411', description: 'Avoir client' },
  // Dépenses
  { source_type: 'expense', source_category: 'general', debit_account_code: '618', credit_account_code: '512', description: 'Frais généraux divers' },
  { source_type: 'expense', source_category: 'office', debit_account_code: '6064', credit_account_code: '512', description: 'Fournitures administratives' },
  { source_type: 'expense', source_category: 'travel', debit_account_code: '6251', credit_account_code: '512', description: 'Voyages et déplacements' },
  { source_type: 'expense', source_category: 'meals', debit_account_code: '6257', credit_account_code: '512', description: 'Réceptions et frais de repas' },
  { source_type: 'expense', source_category: 'transport', debit_account_code: '6241', credit_account_code: '512', description: 'Transport de biens' },
  { source_type: 'expense', source_category: 'software', debit_account_code: '6116', credit_account_code: '512', description: 'Logiciels et abonnements' },
  { source_type: 'expense', source_category: 'hardware', debit_account_code: '6063', credit_account_code: '512', description: 'Matériel informatique' },
  { source_type: 'expense', source_category: 'marketing', debit_account_code: '6231', credit_account_code: '512', description: 'Publicité et marketing' },
  { source_type: 'expense', source_category: 'legal', debit_account_code: '6226', credit_account_code: '512', description: 'Honoraires juridiques' },
  { source_type: 'expense', source_category: 'insurance', debit_account_code: '616', credit_account_code: '512', description: 'Primes d\'assurance' },
  { source_type: 'expense', source_category: 'rent', debit_account_code: '6132', credit_account_code: '512', description: 'Loyers immobiliers' },
  { source_type: 'expense', source_category: 'utilities', debit_account_code: '6061', credit_account_code: '512', description: 'Énergie' },
  { source_type: 'expense', source_category: 'telecom', debit_account_code: '626', credit_account_code: '512', description: 'Téléphone et Internet' },
  { source_type: 'expense', source_category: 'training', debit_account_code: '6333', credit_account_code: '512', description: 'Formation professionnelle' },
  { source_type: 'expense', source_category: 'consulting', debit_account_code: '6226', credit_account_code: '512', description: 'Honoraires de conseil' },
  { source_type: 'expense', source_category: 'other', debit_account_code: '658', credit_account_code: '512', description: 'Charges diverses' },
  // Factures fournisseurs
  { source_type: 'supplier_invoice', source_category: 'purchase', debit_account_code: '601', credit_account_code: '401', description: 'Achats marchandises' },
  { source_type: 'supplier_invoice', source_category: 'service', debit_account_code: '604', credit_account_code: '401', description: 'Achats prestations services' },
  { source_type: 'supplier_invoice', source_category: 'supply', debit_account_code: '6022', credit_account_code: '401', description: 'Achats fournitures' },
];

// Preset mappings OHADA — SYSCOHADA révisé
const OHADA_MAPPINGS = [
  // Factures clients (ventes) → Débit: Clients / Crédit: Produits
  { source_type: 'invoice', source_category: 'revenue', debit_account_code: '411', credit_account_code: '701', description: 'Ventes de marchandises' },
  { source_type: 'invoice', source_category: 'service', debit_account_code: '411', credit_account_code: '706', description: 'Services vendus' },
  { source_type: 'invoice', source_category: 'product', debit_account_code: '411', credit_account_code: '702', description: 'Ventes de produits finis' },
  // Paiements clients
  { source_type: 'payment', source_category: 'cash', debit_account_code: '571', credit_account_code: '411', description: 'Encaissement - espèces' },
  { source_type: 'payment', source_category: 'bank_transfer', debit_account_code: '521', credit_account_code: '411', description: 'Encaissement - virement' },
  { source_type: 'payment', source_category: 'card', debit_account_code: '521', credit_account_code: '411', description: 'Encaissement - carte' },
  { source_type: 'payment', source_category: 'check', debit_account_code: '513', credit_account_code: '411', description: 'Encaissement - chèque' },
  // Notes de crédit
  { source_type: 'credit_note', source_category: 'general', debit_account_code: '701', credit_account_code: '411', description: 'Avoir client' },
  // Dépenses
  { source_type: 'expense', source_category: 'general', debit_account_code: '638', credit_account_code: '521', description: 'Autres charges externes' },
  { source_type: 'expense', source_category: 'office', debit_account_code: '6053', credit_account_code: '521', description: 'Fournitures de bureau' },
  { source_type: 'expense', source_category: 'travel', debit_account_code: '6371', credit_account_code: '521', description: 'Voyages et déplacements' },
  { source_type: 'expense', source_category: 'meals', debit_account_code: '636', credit_account_code: '521', description: 'Frais de réceptions' },
  { source_type: 'expense', source_category: 'transport', debit_account_code: '618', credit_account_code: '521', description: 'Autres frais de transport' },
  { source_type: 'expense', source_category: 'software', debit_account_code: '634', credit_account_code: '521', description: 'Redevances pour logiciels' },
  { source_type: 'expense', source_category: 'hardware', debit_account_code: '6054', credit_account_code: '521', description: 'Fournitures informatiques' },
  { source_type: 'expense', source_category: 'marketing', debit_account_code: '627', credit_account_code: '521', description: 'Publicité et relations publiques' },
  { source_type: 'expense', source_category: 'legal', debit_account_code: '6324', credit_account_code: '521', description: 'Honoraires' },
  { source_type: 'expense', source_category: 'insurance', debit_account_code: '625', credit_account_code: '521', description: 'Primes d\'assurance' },
  { source_type: 'expense', source_category: 'rent', debit_account_code: '6222', credit_account_code: '521', description: 'Locations de bâtiments' },
  { source_type: 'expense', source_category: 'utilities', debit_account_code: '6051', credit_account_code: '521', description: 'Eau, énergie' },
  { source_type: 'expense', source_category: 'telecom', debit_account_code: '628', credit_account_code: '521', description: 'Frais de télécommunications' },
  { source_type: 'expense', source_category: 'training', debit_account_code: '633', credit_account_code: '521', description: 'Formation du personnel' },
  { source_type: 'expense', source_category: 'consulting', debit_account_code: '6324', credit_account_code: '521', description: 'Honoraires de conseil' },
  { source_type: 'expense', source_category: 'other', debit_account_code: '658', credit_account_code: '521', description: 'Charges diverses' },
  // Factures fournisseurs
  { source_type: 'supplier_invoice', source_category: 'purchase', debit_account_code: '601', credit_account_code: '401', description: 'Achats de marchandises' },
  { source_type: 'supplier_invoice', source_category: 'service', debit_account_code: '604', credit_account_code: '401', description: 'Achats de matières et fournitures' },
  { source_type: 'supplier_invoice', source_category: 'supply', debit_account_code: '605', credit_account_code: '401', description: 'Autres achats' },
];

const AccountingMappings = () => {
  const { accounts, mappings, fetchAccounts, fetchMappings, createMapping, deleteMapping, bulkCreateMappings, loading } = useAccounting();
  const [showDialog, setShowDialog] = useState(false);
  const [showPresetConfirm, setShowPresetConfirm] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
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
      case 'payment': return PAYMENT_CATEGORIES;
      case 'credit_note': return CREDIT_NOTE_CATEGORIES;
      case 'supplier_payment': return PAYMENT_CATEGORIES;
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

  const handleLoadBelgianPreset = async () => {
    setPresetLoading(true);
    try {
      await bulkCreateMappings(BELGIAN_MAPPINGS);
      setShowPresetConfirm(false);
    } catch (err) {
      console.error('Erreur chargement preset mappings:', err);
    } finally {
      setPresetLoading(false);
    }
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
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Mappings comptables</h3>
          <p className="text-sm text-gray-400">Associez chaque catégorie de transaction à un compte du plan comptable.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPresetConfirm(true)} className="border-gray-700 text-gray-300 hover:text-white hover:border-purple-500">
            <Zap className="w-4 h-4 mr-2" /> Preset Belgique
          </Button>
          <Button variant="outline" onClick={() => bulkCreateMappings(FRENCH_MAPPINGS)} className="border-gray-700 text-gray-300 hover:text-white hover:border-blue-500">
            <Zap className="w-4 h-4 mr-2" /> Preset France
          </Button>
          <Button variant="outline" onClick={() => bulkCreateMappings(OHADA_MAPPINGS)} className="border-gray-700 text-gray-300 hover:text-white hover:border-green-500">
            <Zap className="w-4 h-4 mr-2" /> Preset OHADA
          </Button>
          <Button onClick={() => setShowDialog(true)} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4 mr-2" /> Ajouter un mapping
          </Button>
        </div>
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

      {/* Belgian Preset Confirmation Dialog */}
      <Dialog open={showPresetConfirm} onOpenChange={setShowPresetConfirm}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gradient flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Mappings Belgique — PCG belge
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-gray-300 text-sm">
              Chargement de <strong>{BELGIAN_MAPPINGS.length} mappings</strong> pré-configurés pour le Plan Comptable Général belge :
            </p>
            <div className="space-y-3 text-xs">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <p className="text-green-400 font-medium mb-1">Factures clients (ventes)</p>
                <p className="text-gray-400">revenue → 400/700 · service → 400/7061 · product → 400/701</p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                <p className="text-orange-400 font-medium mb-1">Dépenses (16 catégories)</p>
                <p className="text-gray-400">Bureau, loyer, logiciels, déplacements, marketing, assurances, télécom, formation…</p>
                <p className="text-gray-500 mt-1">Débit: compte de charge (classe 6) / Crédit: 512 Banque</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 font-medium mb-1">Factures fournisseurs (achats)</p>
                <p className="text-gray-400">purchase → 601/401 · service → 604/401 · supply → 6022/401</p>
              </div>
            </div>
            <p className="text-gray-400 text-xs">
              Les mappings existants avec la même catégorie seront mis à jour. Vous pouvez les modifier ensuite individuellement.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowPresetConfirm(false)} className="border-gray-700">
                Annuler
              </Button>
              <Button onClick={handleLoadBelgianPreset} disabled={presetLoading} className="bg-purple-600 hover:bg-purple-700">
                {presetLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Charger les {BELGIAN_MAPPINGS.length} mappings
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountingMappings;
