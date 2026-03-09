import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CARD_TYPES = ['debit', 'credit', 'prepaid', 'virtual'];
const CARD_BRANDS = ['Visa', 'Mastercard', 'Amex', 'CB', 'Other'];

const emptyForm = {
  label: '',
  card_brand: 'Visa',
  card_type: 'debit',
  holder_name: '',
  last4: '',
  expiry_month: '',
  expiry_year: '',
  issuer_name: '',
  credit_limit: '',
  is_virtual: false,
};

export function CardForm({ open, onOpenChange, instrument, onSubmit }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!instrument;

  useEffect(() => {
    if (instrument) {
      const card = instrument.payment_instrument_cards?.[0] || {};
      setForm({
        label: instrument.label || '',
        card_brand: card.card_brand || 'Visa',
        card_type: card.card_type || 'debit',
        holder_name: card.holder_name || '',
        last4: card.last4 || '',
        expiry_month: card.expiry_month || '',
        expiry_year: card.expiry_year || '',
        issuer_name: card.issuer_name || '',
        credit_limit: card.credit_limit || '',
        is_virtual: card.is_virtual || false,
      });
    } else {
      setForm(emptyForm);
    }
  }, [instrument, open]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        label: form.label,
        card_details: {
          card_brand: form.card_brand,
          card_type: form.card_type,
          holder_name: form.holder_name,
          last4: form.last4,
          expiry_month: parseInt(form.expiry_month, 10) || null,
          expiry_year: parseInt(form.expiry_year, 10) || null,
          issuer_name: form.issuer_name,
          credit_limit: parseFloat(form.credit_limit) || null,
          is_virtual: form.is_virtual,
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141c33] border-gray-800/50 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <CreditCard className="h-5 w-5 text-amber-500" />
            {isEdit
              ? t('financialInstruments.editCard', 'Modifier la carte')
              : t('financialInstruments.addCard', 'Ajouter une carte')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Label */}
          <div className="space-y-1.5">
            <Label className="text-gray-400">{t('financialInstruments.fields.label', 'Libelle')} *</Label>
            <Input
              className="bg-[#0f1528] border-gray-800/50 text-white"
              value={form.label}
              onChange={(e) => handleChange('label', e.target.value)}
              placeholder={t('financialInstruments.placeholders.cardLabel', 'Ex: Carte Visa pro')}
              required
            />
          </div>

          {/* Brand + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-400">{t('financialInstruments.fields.cardBrand', 'Reseau')}</Label>
              <Select value={form.card_brand} onValueChange={(v) => handleChange('card_brand', v)}>
                <SelectTrigger className="bg-[#0f1528] border-gray-800/50 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141c33] border-gray-800/50">
                  {CARD_BRANDS.map((brand) => (
                    <SelectItem key={brand} value={brand} className="text-gray-300">
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400">{t('financialInstruments.fields.cardType', 'Type')}</Label>
              <Select value={form.card_type} onValueChange={(v) => handleChange('card_type', v)}>
                <SelectTrigger className="bg-[#0f1528] border-gray-800/50 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141c33] border-gray-800/50">
                  {CARD_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="text-gray-300">
                      {t(`financialInstruments.cardTypes.${type}`, type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Holder name */}
          <div className="space-y-1.5">
            <Label className="text-gray-400">{t('financialInstruments.fields.cardHolder', 'Titulaire')}</Label>
            <Input
              className="bg-[#0f1528] border-gray-800/50 text-white"
              value={form.holder_name}
              onChange={(e) => handleChange('holder_name', e.target.value)}
              placeholder="JEAN DUPONT"
            />
          </div>

          {/* Last4 + Expiry */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-400">{t('financialInstruments.fields.last4', '4 derniers chiffres')}</Label>
              <Input
                className="bg-[#0f1528] border-gray-800/50 text-white font-mono"
                value={form.last4}
                onChange={(e) => handleChange('last4', e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                maxLength={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400">{t('financialInstruments.fields.expiryMonth', 'Mois')}</Label>
              <Input
                type="number"
                min="1"
                max="12"
                className="bg-[#0f1528] border-gray-800/50 text-white"
                value={form.expiry_month}
                onChange={(e) => handleChange('expiry_month', e.target.value)}
                placeholder="MM"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400">{t('financialInstruments.fields.expiryYear', 'Annee')}</Label>
              <Input
                type="number"
                min="2024"
                max="2040"
                className="bg-[#0f1528] border-gray-800/50 text-white"
                value={form.expiry_year}
                onChange={(e) => handleChange('expiry_year', e.target.value)}
                placeholder="YYYY"
              />
            </div>
          </div>

          {/* Issuer + Credit limit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-400">{t('financialInstruments.fields.issuer', 'Emetteur')}</Label>
              <Input
                className="bg-[#0f1528] border-gray-800/50 text-white"
                value={form.issuer_name}
                onChange={(e) => handleChange('issuer_name', e.target.value)}
                placeholder="BNP Paribas"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400">{t('financialInstruments.fields.creditLimit', 'Plafond')}</Label>
              <Input
                type="number"
                step="0.01"
                className="bg-[#0f1528] border-gray-800/50 text-white"
                value={form.credit_limit}
                onChange={(e) => handleChange('credit_limit', e.target.value)}
                placeholder="5000"
              />
            </div>
          </div>

          {/* Virtual checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_virtual}
              onChange={(e) => handleChange('is_virtual', e.target.checked)}
              className="rounded border-gray-700 bg-[#0f1528] text-amber-500 focus:ring-amber-500"
            />
            <span className="text-gray-400 text-sm">
              {t('financialInstruments.fields.isVirtual', 'Carte virtuelle')}
            </span>
          </label>

          {/* Submit */}
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
              disabled={submitting || !form.label}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              {submitting
                ? t('common.saving', 'Enregistrement...')
                : isEdit
                  ? t('common.save', 'Enregistrer')
                  : t('common.create', 'Creer')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
