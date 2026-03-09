import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const defaults = {
  label: '',
  cash_point_name: '',
  custodian: '',
  location: '',
  currency: 'EUR',
  opening_balance: 0,
  max_authorized_balance: '',
  reconciliation_frequency: 'manual',
  is_default: false,
};

export function CashForm({ open, onOpenChange, instrument, onSubmit }) {
  const { t } = useTranslation();
  const isEdit = !!instrument;
  const [form, setForm] = useState(defaults);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (instrument) {
      const cashDetail = instrument.payment_instrument_cash_accounts?.[0] || {};
      setForm({
        label: instrument.label || '',
        cash_point_name: cashDetail.cash_point_name || instrument.label || '',
        custodian: cashDetail.custodian_user_id || '',
        location: cashDetail.location || '',
        currency: instrument.currency || 'EUR',
        opening_balance: instrument.opening_balance || 0,
        max_authorized_balance: cashDetail.max_authorized_balance || '',
        reconciliation_frequency: cashDetail.reconciliation_frequency || 'manual',
        is_default: instrument.is_default || false,
      });
    } else {
      setForm(defaults);
    }
  }, [instrument, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        label: form.label,
        currency: form.currency,
        opening_balance: Number(form.opening_balance) || 0,
        is_default: form.is_default,
        cash_details: {
          cash_point_name: form.cash_point_name || form.label,
          location: form.location || null,
          max_authorized_balance: form.max_authorized_balance ? Number(form.max_authorized_balance) : null,
          reconciliation_frequency: form.reconciliation_frequency,
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f1528] border-gray-800 text-white sm:max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit
              ? t('financialInstruments.editCash', 'Modifier la caisse')
              : t('financialInstruments.addCashRegister', 'Ajouter une caisse')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-400">{t('common.name', 'Nom')} *</Label>
            <Input
              className="bg-[#141c33] border-gray-700 text-white"
              value={form.label}
              onChange={(e) => set('label', e.target.value)}
              placeholder="Caisse principale"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-400">{t('financialInstruments.cashPointName', 'Nom du point de caisse')}</Label>
            <Input
              className="bg-[#141c33] border-gray-700 text-white"
              value={form.cash_point_name}
              onChange={(e) => set('cash_point_name', e.target.value)}
              placeholder="Caisse magasin 1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-400">{t('financialInstruments.location', 'Emplacement')}</Label>
              <Input
                className="bg-[#141c33] border-gray-700 text-white"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Bureau principal"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-400">{t('common.currency', 'Devise')}</Label>
              <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                <SelectTrigger className="bg-[#141c33] border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141c33] border-gray-700">
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="XOF">XOF</SelectItem>
                  <SelectItem value="XAF">XAF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-400">{t('financialInstruments.openingBalance', 'Solde d\'ouverture')}</Label>
              <Input
                className="bg-[#141c33] border-gray-700 text-white"
                type="number"
                step="0.01"
                value={form.opening_balance}
                onChange={(e) => set('opening_balance', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-400">{t('financialInstruments.maxBalance', 'Solde max autorisé')}</Label>
              <Input
                className="bg-[#141c33] border-gray-700 text-white"
                type="number"
                step="0.01"
                value={form.max_authorized_balance}
                onChange={(e) => set('max_authorized_balance', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-400">{t('financialInstruments.reconciliationFrequency', 'Fréquence de rapprochement')}</Label>
            <Select value={form.reconciliation_frequency} onValueChange={(v) => set('reconciliation_frequency', v)}>
              <SelectTrigger className="bg-[#141c33] border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141c33] border-gray-700">
                <SelectItem value="daily">{t('financialInstruments.daily', 'Quotidien')}</SelectItem>
                <SelectItem value="weekly">{t('financialInstruments.weekly', 'Hebdomadaire')}</SelectItem>
                <SelectItem value="monthly">{t('financialInstruments.monthly', 'Mensuel')}</SelectItem>
                <SelectItem value="manual">{t('financialInstruments.manual', 'Manuel')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="cash-default"
              checked={form.is_default}
              onCheckedChange={(checked) => set('is_default', !!checked)}
            />
            <Label htmlFor="cash-default" className="text-gray-400 text-sm cursor-pointer">
              {t('financialInstruments.setAsDefault', 'Définir comme caisse par défaut')}
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="border-gray-700 text-gray-400 hover:bg-gray-800"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              disabled={submitting || !form.label.trim()}
            >
              {submitting
                ? t('common.saving', 'Enregistrement...')
                : isEdit
                  ? t('common.save', 'Enregistrer')
                  : t('common.create', 'Créer')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
