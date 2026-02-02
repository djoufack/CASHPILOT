
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePayments } from '@/hooks/usePayments';
import { useClients } from '@/hooks/useClients';
import { formatCurrency } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Trash2, Receipt, Eye } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ReceiptPreview from '@/components/ReceiptPreview';

const PaymentHistory = ({ invoiceId = null, clientId = null, invoice = null }) => {
  const { t } = useTranslation();
  const { payments, fetchPayments, fetchPaymentsByInvoice, fetchPaymentsByClient, deletePayment, updateReceiptInfo } = usePayments();
  const { clients } = useClients();
  const [localPayments, setLocalPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let data = [];
      if (invoiceId) {
        data = await fetchPaymentsByInvoice(invoiceId);
      } else if (clientId) {
        data = await fetchPaymentsByClient(clientId);
      } else {
        data = payments;
      }
      setLocalPayments(data || []);
      setLoading(false);
    };
    load();
  }, [invoiceId, clientId]);

  const handleViewReceipt = async (payment) => {
    if (!payment.receipt_generated_at) {
      await updateReceiptInfo(payment.id);
    }
    setReceiptPayment(payment);
    setIsReceiptOpen(true);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await deletePayment(deleteId);
      setLocalPayments(prev => prev.filter(p => p.id !== deleteId));
      setIsDeleteOpen(false);
      setDeleteId(null);
    }
  };

  const getClient = (payment) => {
    const cid = payment.client_id || payment.invoice?.client_id;
    return clients.find(c => c.id === cid);
  };

  if (loading) {
    return <p className="text-gray-400 text-sm py-4">{t('invoiceSettings.loading')}</p>;
  }

  if (localPayments.length === 0) {
    return <p className="text-gray-500 text-sm py-4">{t('receipts.noPayments')}</p>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('payments.history')}</h3>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {localPayments.map(payment => {
          const client = getClient(payment);
          const currency = client?.preferred_currency || client?.preferredCurrency || 'EUR';
          return (
            <div key={payment.id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{formatCurrency(Number(payment.amount), currency)}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-600 text-gray-300">{t(`payments.${payment.payment_method}`)}</span>
                  {payment.is_lump_sum && <span className="text-xs px-2 py-0.5 rounded bg-purple-600/30 text-purple-300">{t('payments.lumpSum')}</span>}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span>{payment.payment_date ? format(new Date(payment.payment_date), 'dd/MM/yyyy') : '-'}</span>
                  {payment.receipt_number && <span className="font-mono">{payment.receipt_number}</span>}
                  {payment.reference && <span>Ref: {payment.reference}</span>}
                  {payment.invoice?.invoice_number && <span>| {payment.invoice.invoice_number}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewReceipt(payment)}
                  className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20 h-8 w-8 p-0"
                  title={t('receipts.viewReceipt')}
                >
                  <Receipt className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(payment.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Receipt Preview Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="w-full sm:max-w-[95%] md:max-w-3xl bg-gray-800 border-gray-700 text-white p-4 md:p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gradient">{t('receipts.title')}</DialogTitle>
          </DialogHeader>
          {receiptPayment && (
            <ReceiptPreview
              payment={receiptPayment}
              invoice={invoice || receiptPayment.invoice}
              client={getClient(receiptPayment)}
              allocations={receiptPayment.allocations || []}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-gray-800 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {t('receipts.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-700">{t('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">{t('buttons.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PaymentHistory;
