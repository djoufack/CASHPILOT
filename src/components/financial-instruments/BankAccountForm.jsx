import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
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

const ACCOUNT_KINDS = ['checking', 'savings', 'business', 'joint', 'other'];
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'MAD', 'XOF'];

const emptyForm = {
  label: '',
  bank_name: '',
  account_holder: '',
  iban: '',
  bic_swift: '',
  account_kind: 'checking',
  currency: 'EUR',
  opening_balance: 0,
  is_default: false,
};

export function BankAccountForm({ open, onOpenChange, instrument, onSubmit }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!instrument;

  useEffect(() => {
    if (instrument) {
      const bank = instrument.payment_instrument_bank_accounts?.[0] || {};
      setForm({
        label: instrument.label || '',
        bank_name: bank.bank_name || '',
        account_holder: bank.account_holder || '',
        iban: bank.iban_encrypted || '',
        bic_swift: bank.bic_swift || '',
        account_kind: bank.account_kind || 'checking',
        currency: instrument.currency || 'EUR',
        opening_balance: instrument.opening_balance || 0,
        is_default: instrument.is_default || false,
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
        currency: form.currency,
        opening_balance: parseFloat(form.opening_balance) || 0,
        is_default: form.is_default,
        bank_details: {
          bank_name: form.bank_name,
          account_holder: form.account_holder,
          iban: form.iban,
          bic_swift: form.bic_swift,
          account_kind: form.account_kind,
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
            <Building2 className="h-5 w-5 text-amber-500" />
            {isEdit
              ? t('financialInstruments.editBankAccount', 'Modifier le compte bancaire')
              : t('financialInstruments.addBankAccount', 'Ajouter un compte bancaire')}
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
              placeholder={t('financialInstruments.placeholders.bankLabel', 'Ex: Compte courant BNP')}
              required
            />
          </div>

          {/* Bank name + Account holder */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-400">{t('financialInstruments.fields.bankName', 'Banque')}</Label>
              <Input
                className="bg-[#0f1528] border-gray-800/50 text-white"
                value={form.bank_name}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                placeholder="BNP Paribas"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400">{t('financialInstruments.fields.accountHolder', 'Titulaire')}</Label>
              <Input
                className="bg-[#0f1528] border-gray-800/50 text-white"
                value={form.account_holder}
                onChange={(e) => handleChange('account_holder', e.target.value)}
              />
            </div>
          </div>

          {/* IBAN + BIC */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-gray-400">IBAN</Label>
              <Input
                className="bg-[#0f1528] border-gray-800/50 text-white font-mono"
                value={form.iban}
                onChange={(e) => handleChange('iban', e.target.value.toUpperCase())}
                placeholder="FR76 1234 5678 9012 3456 7890 123"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400">BIC/SWIFT</Label>
              <Input
                className="bg-[#0f1528] border-gray-800/50 text-white font-mono"
                value={form.bic_swift}
                onChange={(e) => handleChange('bic_swift', e.target.value.toUpperCase())}
                placeholder="BNPAFRPP"
              />
            </div>
          </div>

          {/* Account kind + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-400">{t('financialInstruments.fields.accountKind', 'Type de compte')}</Label>
              <Select value={form.account_kind} onValueChange={(v) => handleChange('account_kind', v)}>
                <SelectTrigger className="bg-[#0f1528] border-gray-800/50 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141c33] border-gray-800/50">
                  {ACCOUNT_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind} className="text-gray-300">
                      {t(`financialInstruments.accountKinds.${kind}`, kind)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400">{t('financialInstruments.fields.currency', 'Devise')}</Label>
              <Select value={form.currency} onValueChange={(v) => handleChange('currency', v)}>
                <SelectTrigger className="bg-[#0f1528] border-gray-800/50 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141c33] border-gray-800/50">
                  {CURRENCIES.map((cur) => (
                    <SelectItem key={cur} value={cur} className="text-gray-300">
                      {cur}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Opening balance */}
          <div className="space-y-1.5">
            <Label className="text-gray-400">{t('financialInstruments.fields.openingBalance', 'Solde d\'ouverture')}</Label>
            <Input
              type="number"
              step="0.01"
              className="bg-[#0f1528] border-gray-800/50 text-white"
              value={form.opening_balance}
              onChange={(e) => handleChange('opening_balance', e.target.value)}
            />
          </div>

          {/* Default checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => handleChange('is_default', e.target.checked)}
              className="rounded border-gray-700 bg-[#0f1528] text-amber-500 focus:ring-amber-500"
            />
            <span className="text-gray-400 text-sm">
              {t('financialInstruments.fields.isDefault', 'Compte par defaut')}
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
