import React from 'react';
import { useTranslation } from 'react-i18next';
import InvoicePreview from '@/components/InvoicePreview';
import PaymentRecorder from '@/components/PaymentRecorder';
import PaymentHistory from '@/components/PaymentHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Send, Loader2 } from 'lucide-react';
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
import { formatCurrency } from '@/utils/calculations';

const InvoiceDialogs = ({
  dialog,
  setDialog,
  closeDialog,
  clients,
  getInvoiceItems,
  fetchInvoices,
  handleConfirmDelete,
  emailSending,
  handleConfirmSendEmail,
  company,
}) => {
  // Derive dialog visibility and data from consolidated state
  const viewingInvoice = dialog.type === 'preview' ? dialog.invoice : null;
  const isPaymentOpen = dialog.type === 'payment';
  const paymentInvoice = dialog.type === 'payment' ? dialog.invoice : null;
  const isLumpSumOpen = dialog.type === 'lumpSum';
  const lumpSumClientId = dialog.lumpSumClientId;
  const isHistoryOpen = dialog.type === 'history';
  const historyInvoice = dialog.type === 'history' ? dialog.invoice : null;
  const isDeleteDialogOpen = dialog.type === 'delete';
  const emailModalInvoice = dialog.type === 'email' ? dialog.invoice : null;
  const emailModalAddress = dialog.emailAddress || '';
  const { t } = useTranslation();

  return (
    <>
      {/* Invoice Preview Dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={() => closeDialog()}>
        <DialogContent className="w-full sm:max-w-[95%] md:max-w-4xl bg-gray-800 border-gray-700 text-white p-4 md:p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl font-bold text-gradient">
              {t('invoices.invoiceDetails')}
            </DialogTitle>
          </DialogHeader>
          {viewingInvoice && (
            <InvoicePreview
              invoice={viewingInvoice}
              client={clients.find(c => c.id === (viewingInvoice.client_id || viewingInvoice.clientId))}
              items={viewingInvoice.items || getInvoiceItems(viewingInvoice.id)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Recorder Dialog (single invoice) */}
      <PaymentRecorder
        open={isPaymentOpen}
        onOpenChange={(open) => { if (!open) closeDialog(); }}
        invoice={paymentInvoice}
        isLumpSum={false}
        onSuccess={() => fetchInvoices()}
      />

      {/* Lump Sum Payment Dialog */}
      <PaymentRecorder
        open={isLumpSumOpen}
        onOpenChange={(open) => { if (!open) closeDialog(); }}
        clientId={lumpSumClientId}
        isLumpSum={true}
        onSuccess={() => fetchInvoices()}
      />

      {/* Payment History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="w-full sm:max-w-[95%] md:max-w-2xl bg-gray-800 border-gray-700 text-white p-4 md:p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gradient">
              {t('payments.history')} — {historyInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {historyInvoice && (
            <PaymentHistory invoiceId={historyInvoice.id} invoice={historyInvoice} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <AlertDialogContent className="w-full sm:max-w-[90%] md:max-w-lg bg-gray-800 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto mt-0">
              {t('buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
            >
              {t('buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Email Modal */}
      <Dialog open={!!emailModalInvoice} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="w-full sm:max-w-[90%] md:max-w-md bg-gray-800 border-gray-700 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gradient flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {t('email.sendInvoice')}
            </DialogTitle>
          </DialogHeader>
          {emailModalInvoice && (() => {
            const emailClient = emailModalInvoice.client || clients.find(c => c.id === (emailModalInvoice.client_id || emailModalInvoice.clientId)) || {};
            const emailCurrency = emailClient.preferred_currency || emailClient.preferredCurrency || 'EUR';
            return (
              <div className="space-y-4">
                {/* Invoice summary */}
                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                  <p className="text-sm text-gray-400">{t('invoices.invoiceNumber')}</p>
                  <p className="text-white font-medium">{emailModalInvoice.invoice_number || emailModalInvoice.invoiceNumber}</p>
                  <p className="text-sm text-gray-400 mt-2">{t('clients.companyName')}</p>
                  <p className="text-white">{emailClient.company_name || emailClient.companyName || 'N/A'}</p>
                  <p className="text-sm text-gray-400 mt-2">{t('invoices.total')}</p>
                  <p className="text-white font-medium">{formatCurrency(Number(emailModalInvoice.total_ttc || emailModalInvoice.total || 0), emailCurrency)}</p>
                </div>

                {/* Subject preview */}
                <div>
                  <Label className="text-sm text-gray-400">{t('email.subject.invoice')}</Label>
                  <p className="text-white text-sm mt-1 bg-gray-900/30 rounded px-3 py-2 border border-gray-700">
                    {t('email.subjectPreview', {
                      invoiceNumber: emailModalInvoice.invoice_number || emailModalInvoice.invoiceNumber || '',
                      companyName: company?.company_name || 'CashPilot'
                    })}
                  </p>
                </div>

                {/* Email input */}
                <div>
                  <Label htmlFor="email-recipient" className="text-sm text-gray-400">
                    {t('email.recipientEmail')}
                  </Label>
                  <Input
                    id="email-recipient"
                    type="email"
                    value={emailModalAddress}
                    onChange={(e) => setDialog(prev => ({ ...prev, emailAddress: e.target.value }))}
                    placeholder="client@example.com"
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => closeDialog()}
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    {t('buttons.cancel')}
                  </Button>
                  <Button
                    onClick={handleConfirmSendEmail}
                    disabled={emailSending || !emailModalAddress.trim()}
                    className="flex-1 bg-sky-600 hover:bg-sky-700 text-white"
                  >
                    {emailSending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('email.sending')}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {t('email.send')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InvoiceDialogs;
