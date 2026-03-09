import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight } from 'lucide-react';
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
import { formatCurrency } from '@/utils/currencyService';

const emptyForm = {
  from_instrument_id: '',
  to_instrument_id: '',
  amount: '',
  fee: '',
  transfer_date: new Date().toISOString().split('T')[0],
  notes: '',
};

export function TransferDialog({ open, onOpenChange, instruments = [], onSubmit }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const activeInstruments = instruments.filter((i) => i.status === 'active');

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.from_instrument_id === form.to_instrument_id) return;
    setSubmitting(true);
    try {
      await onSubmit({
        from_instrument_id: form.from_instrument_id,
        to_instrument_id: form.to_instrument_id,
        amount: parseFloat(form.amount) || 0,
        fee: parseFloat(form.fee) || 0,
        transfer_date: form.transfer_date,
        notes: form.notes,
      });
      setForm(emptyForm);
    } finally {
      setSubmitting(false);
    }
  };

  const fromInstrument = activeInstruments.find((i) => i.id === form.from_instrument_id);
  const toInstrument = activeInstruments.find((i) => i.id === form.to_instrument_id);
  const isValid =
    form.from_instrument_id &&
    form.to_instrument_id &&
    form.from_instrument_id !== form.to_instrument_id &&
    parseFloat(form.amount) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141c33] border-gray-800/50 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <ArrowLeftRight className="h-5 w-5 text-amber-500" />
            {t('financialInstruments.transfer', 'Virement interne')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* From */}
          <div className="space-y-1.5">
            <Label className="text-gray-400">{t('financialInstruments.transferFrom', 'De')} *</Label>
            <Select value={form.from_instrument_id} onValueChange={(v) => handleChange('from_instrument_id', v)}>
              <SelectTrigger className="bg-[#0f1528] border-gray-800/50 text-white">
                <SelectValue placeholder={t('financialInstruments.selectInstrument', 'Selectionner un compte')} />
              </SelectTrigger>
              <SelectContent className="bg-[#141c33] border-gray-800/50">
                {activeInstruments.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id} className="text-gray-300">
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{inst.label}</span>
                      <span className="text-gray-500 text-xs">
                        {formatCurrency(inst.current_balance || 0, inst.currency || 'EUR')}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fromInstrument && (
              <p className="text-xs text-gray-600">
                {t('financialInstruments.availableBalance', 'Solde disponible')}:{' '}
                <span className="text-gray-400">
                  {formatCurrency(fromInstrument.current_balance || 0, fromInstrument.currency || 'EUR')}
                </span>
              </p>
            )}
          </div>

          {/* Arrow indicator */}
          <div className="flex justify-center">
            <div className="p-2 rounded-full bg-amber-500/10">
              <ArrowLeftRight className="h-4 w-4 text-amber-500 rotate-90" />
            </div>
          </div>

          {/* To */}
          <div className="space-y-1.5">
            <Label className="text-gray-400">{t('financialInstruments.transferTo', 'Vers')} *</Label>
            <Select value={form.to_instrument_id} onValueChange={(v) => handleChange('to_instrument_id', v)}>
              <SelectTrigger className="bg-[#0f1528] border-gray-800/50 text-white">
                <SelectValue placeholder={t('financialInstruments.selectInstrument', 'Selectionner un compte')} />
              </SelectTrigger>
              <SelectContent className="bg-[#141c33] border-gray-800/50">
                {activeInstruments
                  .filter((inst) => inst.id !== form.from_instrument_id)
                  .map((inst) => (
                    <SelectItem key={inst.id} value={inst.id} className="text-gray-300">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{inst.label}</span>
                        <span className="text-gray-500 text-xs">
                          {formatCurrency(inst.current_balance || 0, inst.currency || 'EUR')}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount + Fee */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-gray-400">{t('financialInstruments.amount', 'Montant')} *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                className="bg-[#0f1528] border-gray-800/50 text-white text-lg"
                value={form.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400">{t('financialInstruments.fee', 'Frais')}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="bg-[#0f1528] border-gray-800/50 text-white"
                value={form.fee}
                onChange={(e) => handleChange('fee', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-gray-400">{t('financialInstruments.transferDate', 'Date')}</Label>
            <Input
              type="date"
              className="bg-[#0f1528] border-gray-800/50 text-white"
              value={form.transfer_date}
              onChange={(e) => handleChange('transfer_date', e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-gray-400">{t('financialInstruments.notes', 'Notes')}</Label>
            <Input
              className="bg-[#0f1528] border-gray-800/50 text-white"
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder={t('financialInstruments.placeholders.transferNotes', 'Motif du virement...')}
            />
          </div>

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
              disabled={submitting || !isValid}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              {submitting
                ? t('common.processing', 'Traitement...')
                : t('financialInstruments.executeTransfer', 'Effectuer le virement')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
