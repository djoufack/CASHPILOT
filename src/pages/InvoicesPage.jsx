
import React from "react";
import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import InvoiceGenerator from '@/components/InvoiceGenerator';
import QuickInvoice from '@/components/QuickInvoice';
import InvoicePreview from '@/components/InvoicePreview';
import PaymentRecorder from '@/components/PaymentRecorder';
import PaymentHistory from '@/components/PaymentHistory';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Eye, Trash2, FileText, DollarSign, Banknote, History, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/calculations';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const InvoicesPage = () => {
  const { t } = useTranslation();
  const { invoices, deleteInvoice, updateInvoiceStatus, getInvoiceItems, fetchInvoices } = useInvoices();
  const { clients } = useClients();
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [quickMode, setQuickMode] = useState(() => localStorage.getItem('invoiceQuickMode') === 'true');
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isLumpSumOpen, setIsLumpSumOpen] = useState(false);
  const [lumpSumClientId, setLumpSumClientId] = useState(null);
  const [historyInvoice, setHistoryInvoice] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const handleViewInvoice = (invoice) => {
    setViewingInvoice(invoice);
  };

  const handleDeleteClick = (invoice) => {
    setInvoiceToDelete(invoice);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (invoiceToDelete) {
      await deleteInvoice(invoiceToDelete.id);
      setIsDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const handleStatusChange = async (invoiceId, newStatus) => {
    await updateInvoiceStatus(invoiceId, newStatus);
  };

  const handleRecordPayment = (invoice) => {
    setPaymentInvoice(invoice);
    setIsPaymentOpen(true);
  };

  const handleLumpSumPayment = () => {
    // Use the first client with pending invoices or let user pick
    setLumpSumClientId(null);
    setIsLumpSumOpen(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500';
      case 'sent':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPaymentStatusBadge = (paymentStatus) => {
    switch (paymentStatus) {
      case 'paid':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">{t('payments.paid')}</span>;
      case 'partial':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">{t('payments.partial')}</span>;
      case 'overpaid':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">{t('payments.overpaid')}</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">{t('payments.unpaid')}</span>;
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('invoices.title')} - {t('app.name')}</title>
        <meta name="description" content="Generate and manage invoices" />
      </Helmet>

        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                  {t('invoices.title')}
                </h1>
                <p className="text-gray-400 text-sm md:text-base">Create and manage professional invoices</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto flex-wrap">
                <Button
                  onClick={() => setShowGenerator(!showGenerator)}
                  className="flex-1 md:flex-none bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {showGenerator ? 'View Invoices' : t('invoices.generateInvoice')}
                </Button>
                {showGenerator && (
                  <Button
                    variant="outline"
                    onClick={() => { const next = !quickMode; setQuickMode(next); localStorage.setItem('invoiceQuickMode', String(next)); }}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {quickMode ? t('quickInvoice.switchToStandard') : t('quickInvoice.switchToQuick')}
                  </Button>
                )}
                {!showGenerator && (
                  <Button
                    onClick={handleLumpSumPayment}
                    variant="outline"
                    className="flex-1 md:flex-none border-green-600 text-green-400 hover:bg-green-900/20"
                  >
                    <Banknote className="w-4 h-4 mr-2" />
                    {t('payments.lumpSum')}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>

          {showGenerator ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {quickMode ? (
                <QuickInvoice onSuccess={() => { setShowGenerator(false); fetchInvoices(); }} />
              ) : (
                <InvoiceGenerator onSuccess={() => { setShowGenerator(false); fetchInvoices(); }} />
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden"
            >
              {invoices.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  {t('invoices.noInvoices')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          {t('invoices.invoiceNumber')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                          {t('clients.companyName')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell">
                          {t('invoices.issueDate')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          {t('invoices.total')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                          {t('payments.balanceDue')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          {t('invoices.status')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                          {t('payments.title')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {invoices.map((invoice) => {
                        const client = clients.find(c => c.id === (invoice.client_id || invoice.clientId));
                        const currency = client?.preferred_currency || client?.preferredCurrency || 'EUR';
                        return (
                          <tr key={invoice.id} className="hover:bg-gray-700/50 transition-colors">
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gradient">
                              {invoice.invoice_number || invoice.invoiceNumber}
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden sm:table-cell">
                              {client?.company_name || client?.companyName || 'Unknown'}
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden md:table-cell">
                              {(invoice.date || invoice.issueDate) ? format(new Date(invoice.date || invoice.issueDate), 'MMM dd, yyyy') : '-'}
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {formatCurrency(Number(invoice.total_ttc || invoice.total || 0), currency)}
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm hidden lg:table-cell">
                              <span className={Number(invoice.balance_due || 0) > 0 ? 'text-orange-400 font-medium' : 'text-green-400'}>
                                {formatCurrency(Number(invoice.balance_due || invoice.total_ttc || 0), currency)}
                              </span>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                              <Select
                                value={invoice.status}
                                onValueChange={(value) => handleStatusChange(invoice.id, value)}
                              >
                                <SelectTrigger className={`w-28 md:w-32 ${getStatusColor(invoice.status)} text-white border-none h-8`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-700 border-gray-600 text-white">
                                  <SelectItem value="draft">{t('status.draft')}</SelectItem>
                                  <SelectItem value="sent">{t('status.sent')}</SelectItem>
                                  <SelectItem value="paid">{t('status.paid')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm hidden sm:table-cell">
                              {getPaymentStatusBadge(invoice.payment_status)}
                            </td>
                            <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end space-x-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRecordPayment(invoice)}
                                  className="text-green-400 hover:text-green-300 hover:bg-green-900/20 h-8 w-8 p-0"
                                  title={t('payments.recordPayment')}
                                >
                                  <DollarSign className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setHistoryInvoice(invoice); setIsHistoryOpen(true); }}
                                  className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20 h-8 w-8 p-0"
                                  title={t('payments.history')}
                                >
                                  <History className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewInvoice(invoice)}
                                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 h-8 w-8 p-0"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(invoice)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 w-8 p-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </div>

      {/* Invoice Preview Dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={() => setViewingInvoice(null)}>
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
        onOpenChange={setIsPaymentOpen}
        invoice={paymentInvoice}
        isLumpSum={false}
        onSuccess={() => fetchInvoices()}
      />

      {/* Lump Sum Payment Dialog */}
      <PaymentRecorder
        open={isLumpSumOpen}
        onOpenChange={setIsLumpSumOpen}
        clientId={lumpSumClientId}
        isLumpSum={true}
        onSuccess={() => fetchInvoices()}
      />

      {/* Payment History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
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
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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
    </>
  );
};

export default InvoicesPage;
