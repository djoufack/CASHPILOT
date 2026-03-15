import { useState, useMemo, useCallback } from 'react';
import { ArrowRight, Banknote, Loader2, Send, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function isValidIban(iban) {
  const cleaned = iban.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleaned);
}

function formatIban(iban) {
  const cleaned = iban.replace(/\s+/g, '').toUpperCase();
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

export default function BankTransferForm({ open, onOpenChange, connections, onSubmit }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formData, setFormData] = useState({
    connection_id: '',
    recipient_name: '',
    recipient_iban: '',
    amount: '',
    currency: 'EUR',
    reference: '',
    invoice_id: '',
  });
  const [errors, setErrors] = useState({});

  const activeConnections = useMemo(() => {
    return (connections || []).filter((c) => c.status === 'active');
  }, [connections]);

  const selectedConnection = useMemo(() => {
    return activeConnections.find((c) => c.id === formData.connection_id) || null;
  }, [activeConnections, formData.connection_id]);

  const formatAmount = useCallback(
    (value, currency = 'EUR') => {
      const amount = Number(value || 0);
      return (
        new Intl.NumberFormat(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount) + ` ${String(currency || 'EUR').toUpperCase()}`
      );
    },
    [locale]
  );

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const errs = {};

    if (!formData.connection_id) {
      errs.connection_id = t('banking.errorSourceRequired');
    }

    if (!formData.recipient_name.trim()) {
      errs.recipient_name = t('banking.errorRecipientRequired');
    }

    if (!formData.recipient_iban.trim()) {
      errs.recipient_iban = t('banking.errorIbanRequired');
    } else if (!isValidIban(formData.recipient_iban)) {
      errs.recipient_iban = t('banking.errorIbanInvalid');
    }

    const amount = Number(formData.amount);
    if (!formData.amount || amount <= 0) {
      errs.amount = t('banking.errorAmountRequired');
    } else if (selectedConnection && amount > Number(selectedConnection.balance || 0)) {
      errs.amount = t('banking.errorInsufficientBalance');
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePreSubmit = () => {
    if (!validate()) return;
    setShowConfirmation(true);
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirmation(false);
    setSubmitting(true);
    try {
      const payload = {
        connection_id: formData.connection_id,
        recipient_name: formData.recipient_name.trim(),
        recipient_iban: formData.recipient_iban.replace(/\s+/g, '').toUpperCase(),
        amount: Number(formData.amount),
        currency: formData.currency,
        reference: formData.reference.trim() || null,
        invoice_id: formData.invoice_id || null,
      };
      await onSubmit(payload);
      resetForm();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      connection_id: '',
      recipient_name: '',
      recipient_iban: '',
      amount: '',
      currency: 'EUR',
      reference: '',
      invoice_id: '',
    });
    setErrors({});
    setShowConfirmation(false);
  };

  const handleOpenChange = (open) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  return (
    <>
      <Dialog open={open && !showConfirmation} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg border-gray-800 bg-gray-950 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-400" />
              {t('banking.transferTitle')}
            </DialogTitle>
            <DialogDescription className="text-gray-400">{t('banking.transferDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Source account */}
            <div className="space-y-2">
              <Label htmlFor="transfer-source">{t('banking.sourceAccount')}</Label>
              <Select value={formData.connection_id} onValueChange={(v) => updateField('connection_id', v)}>
                <SelectTrigger id="transfer-source" className="border-gray-700 bg-gray-900 text-white">
                  <SelectValue placeholder={t('banking.selectSourceAccount')} />
                </SelectTrigger>
                <SelectContent className="border-gray-800 bg-gray-950 text-white">
                  {activeConnections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.institution_name} - {conn.account_name || conn.iban || conn.id.slice(0, 8)}
                      {conn.balance != null && ` (${formatAmount(conn.balance, conn.currency)})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.connection_id && <p className="text-xs text-red-400">{errors.connection_id}</p>}
              {selectedConnection?.balance != null && (
                <p className="text-xs text-gray-500">
                  {t('banking.availableBalance')}:{' '}
                  {formatAmount(selectedConnection.balance, selectedConnection.currency)}
                </p>
              )}
            </div>

            {/* Recipient name */}
            <div className="space-y-2">
              <Label htmlFor="transfer-recipient">{t('banking.recipientName')}</Label>
              <Input
                id="transfer-recipient"
                value={formData.recipient_name}
                onChange={(e) => updateField('recipient_name', e.target.value)}
                placeholder={t('banking.recipientNamePlaceholder')}
                className="border-gray-700 bg-gray-900 text-white"
              />
              {errors.recipient_name && <p className="text-xs text-red-400">{errors.recipient_name}</p>}
            </div>

            {/* Recipient IBAN */}
            <div className="space-y-2">
              <Label htmlFor="transfer-iban">{t('banking.recipientIban')}</Label>
              <Input
                id="transfer-iban"
                value={formData.recipient_iban}
                onChange={(e) => updateField('recipient_iban', e.target.value)}
                placeholder="FR76 1234 5678 9012 3456 7890 123"
                className="border-gray-700 bg-gray-900 font-mono text-white"
              />
              {errors.recipient_iban && <p className="text-xs text-red-400">{errors.recipient_iban}</p>}
            </div>

            {/* Amount + Currency */}
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div className="space-y-2">
                <Label htmlFor="transfer-amount">{t('banking.amount')}</Label>
                <Input
                  id="transfer-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => updateField('amount', e.target.value)}
                  placeholder="0.00"
                  className="border-gray-700 bg-gray-900 text-white"
                />
                {errors.amount && <p className="text-xs text-red-400">{errors.amount}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-currency">{t('banking.currency')}</Label>
                <Select value={formData.currency} onValueChange={(v) => updateField('currency', v)}>
                  <SelectTrigger id="transfer-currency" className="border-gray-700 bg-gray-900 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-gray-800 bg-gray-950 text-white">
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="XOF">XOF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label htmlFor="transfer-reference">{t('banking.reference')}</Label>
              <Input
                id="transfer-reference"
                value={formData.reference}
                onChange={(e) => updateField('reference', e.target.value)}
                placeholder={t('banking.referencePlaceholder')}
                className="border-gray-700 bg-gray-900 text-white"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => handleOpenChange(false)} className="border-gray-700 text-gray-300">
              {t('common.cancel')}
            </Button>
            <Button onClick={handlePreSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              <ArrowRight className="mr-2 h-4 w-4" />
              {t('banking.reviewTransfer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-md border-gray-800 bg-gray-950 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              {t('banking.confirmTransferTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-900/50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">{t('banking.recipientName')}</span>
              <span className="font-medium text-white">{formData.recipient_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">{t('banking.recipientIban')}</span>
              <span className="font-mono text-white">{formatIban(formData.recipient_iban)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">{t('banking.amount')}</span>
              <span className="text-lg font-bold text-white">{formatAmount(formData.amount, formData.currency)}</span>
            </div>
            {formData.reference && (
              <div className="flex justify-between">
                <span className="text-gray-400">{t('banking.reference')}</span>
                <span className="text-white">{formData.reference}</span>
              </div>
            )}
            {selectedConnection && (
              <div className="flex justify-between border-t border-gray-800 pt-2">
                <span className="text-gray-400">{t('banking.fromAccount')}</span>
                <span className="text-white">{selectedConnection.institution_name}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-amber-300">
            <Banknote className="mr-1 inline h-3 w-3" />
            {t('banking.confirmTransferWarning')}
          </p>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
              className="border-gray-700 text-gray-300"
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirmedSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {t('banking.confirmAndSend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
