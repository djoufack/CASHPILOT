
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePayments } from '@/hooks/usePayments';
import { useInvoices } from '@/hooks/useInvoices';
import { formatCurrency, allocateLumpSumPayment } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DollarSign, CreditCard, Banknote, Landmark, Globe, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';

const PAYMENT_METHODS = [
  { value: 'bank_transfer', icon: Landmark },
  { value: 'cash', icon: Banknote },
  { value: 'card', icon: CreditCard },
  { value: 'check', icon: DollarSign },
  { value: 'paypal', icon: Globe },
  { value: 'other', icon: MoreHorizontal },
];

const PaymentRecorder = ({
  open,
  onOpenChange,
  invoice = null,
  clientId = null,
  isLumpSum = false,
  onSuccess
}) => {
  const { t } = useTranslation();
  const { createPayment, createLumpSumPayment } = usePayments();
  const { invoices, getPendingInvoicesByClient, fetchInvoices } = useInvoices();

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedAllocations, setSelectedAllocations] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Get pending invoices for lump-sum mode
  const resolvedClientId = clientId || invoice?.client_id;
  const pendingInvoices = resolvedClientId ? getPendingInvoicesByClient(resolvedClientId) : [];

  useEffect(() => {
    if (open) {
      if (invoice && !isLumpSum) {
        const balance = Number(invoice.balance_due || invoice.total_ttc || 0);
        setAmount(balance > 0 ? balance.toFixed(2) : '');
      } else {
        setAmount('');
      }
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('bank_transfer');
      setReference('');
      setNotes('');
      setSelectedAllocations({});
    }
  }, [open, invoice, isLumpSum]);

  const handleAutoAllocate = () => {
    if (!amount || pendingInvoices.length === 0) return;
    const allocations = allocateLumpSumPayment(Number(amount), pendingInvoices);
    const newSelected = {};
    allocations.forEach(a => {
      newSelected[a.invoiceId] = a.allocatedAmount.toFixed(2);
    });
    setSelectedAllocations(newSelected);
  };

  const handleAllocationChange = (invoiceId, value) => {
    setSelectedAllocations(prev => {
      const next = { ...prev };
      if (value === '' || value === '0') {
        delete next[invoiceId];
      } else {
        next[invoiceId] = value;
      }
      return next;
    });
  };

  const totalAllocated = Object.values(selectedAllocations)
    .reduce((sum, val) => sum + Number(val || 0), 0);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSubmitting(true);
    try {
      if (isLumpSum) {
        const allocations = Object.entries(selectedAllocations)
          .filter(([, val]) => Number(val) > 0)
          .map(([invoiceId, val]) => ({
            invoiceId,
            allocatedAmount: Number(val)
          }));

        await createLumpSumPayment(
          resolvedClientId,
          Number(amount),
          paymentMethod,
          reference,
          notes,
          allocations
        );
      } else {
        await createPayment({
          invoice_id: invoice?.id,
          client_id: resolvedClientId,
          payment_date: paymentDate,
          amount: Number(amount),
          payment_method: paymentMethod,
          reference,
          notes
        });
      }

      await fetchInvoices();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Payment recording failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[95%] md:max-w-lg bg-gray-800 border-gray-700 text-white p-4 md:p-6 overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gradient flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            {isLumpSum ? t('payments.lumpSum') : t('payments.recordPayment')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoice reference (single payment mode) */}
          {invoice && !isLumpSum && (
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <p className="text-sm text-gray-400">{t('invoices.invoiceNumber')}</p>
              <p className="text-white font-semibold">{invoice.invoice_number}</p>
              <div className="flex justify-between mt-1 text-sm">
                <span className="text-gray-400">{t('invoices.totalTTC')}</span>
                <span className="text-white">{formatCurrency(Number(invoice.total_ttc || 0))}</span>
              </div>
              {Number(invoice.amount_paid || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{t('payments.amountPaid')}</span>
                  <span className="text-green-400">{formatCurrency(Number(invoice.amount_paid))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-gray-600 mt-1 pt-1">
                <span className="text-gray-300">{t('payments.balanceDue')}</span>
                <span className="text-orange-400">{formatCurrency(Number(invoice.balance_due || invoice.total_ttc || 0))}</span>
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label>{t('payments.amount')} *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
              placeholder="0.00"
              min="0.01"
              step="0.01"
            />
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label>{t('payments.date')}</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>{t('payments.method')}</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600 text-white">
                {PAYMENT_METHODS.map(method => (
                  <SelectItem key={method.value} value={method.value}>
                    <div className="flex items-center gap-2">
                      <method.icon className="w-4 h-4" />
                      {t(`payments.${method.value}`)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label>{t('payments.reference')}</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
              placeholder={t('payments.referencePlaceholder')}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>{t('timesheets.notes')}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="bg-gray-700 border-gray-600 text-white resize-none"
            />
          </div>

          {/* Lump Sum Allocation */}
          {isLumpSum && pendingInvoices.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">{t('payments.allocations')}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoAllocate}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 text-xs"
                  disabled={!amount}
                >
                  {t('payments.autoAllocate')}
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pendingInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-lg text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{inv.invoice_number}</p>
                      <p className="text-gray-400 text-xs">
                        {t('payments.balanceDue')}: {formatCurrency(Number(inv.balance_due || inv.total_ttc || 0))}
                      </p>
                    </div>
                    <Input
                      type="number"
                      value={selectedAllocations[inv.id] || ''}
                      onChange={(e) => handleAllocationChange(inv.id, e.target.value)}
                      className="bg-gray-600 border-gray-500 text-white w-28 ml-2"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      max={Number(inv.balance_due || inv.total_ttc || 0)}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-600">
                <span className="text-gray-400">{t('payments.totalAllocated')}</span>
                <span className={totalAllocated > Number(amount || 0) ? 'text-red-400' : 'text-green-400'}>
                  {formatCurrency(totalAllocated)} / {formatCurrency(Number(amount || 0))}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto"
          >
            {t('buttons.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !amount || Number(amount) <= 0}
            className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
          >
            {submitting ? '...' : t('payments.recordPayment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentRecorder;
