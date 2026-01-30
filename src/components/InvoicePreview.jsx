
import React from "react";
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/calculations';
import { exportInvoiceToPDF } from '@/services/exportPDF';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useCompany } from '@/hooks/useCompany';

const InvoicePreview = ({ invoice, client, items }) => {
  const { t } = useTranslation();
  const invoiceRef = useRef();
  const { toast } = useToast();
  const { company } = useCompany();

  const handleExportPDF = async () => {
    try {
      await exportInvoiceToPDF(invoiceRef.current, invoice.invoiceNumber);
      toast({
        title: "Success",
        description: t('messages.success.pdfExported')
      });
    } catch (error) {
      toast({
        title: "Error",
        description: t('messages.error.pdfExportFailed'),
        variant: "destructive"
      });
    }
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={handleExportPDF}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Download className="w-4 h-4 mr-2" />
            {t('invoices.exportPDF')}
          </Button>
        </motion.div>
      </div>

      <div ref={invoiceRef} className="bg-white text-black p-4 md:p-8 rounded-lg shadow-xl">
        {/* Header: Company info + Invoice number */}
        <div className="flex flex-col sm:flex-row justify-between items-start mb-6 md:mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {company?.logo_url && (
                <img src={company.logo_url} alt="Logo" className="h-12 w-auto object-contain" />
              )}
              <h1 className="text-3xl font-bold text-gray-900">
                {company?.company_name || t('app.name')}
              </h1>
            </div>
            {company ? (
              <div className="text-sm text-gray-600 space-y-0.5">
                {company.address && <p>{company.address}</p>}
                {(company.postal_code || company.city) && (
                  <p>{company.postal_code} {company.city}{company.country ? `, ${company.country}` : ''}</p>
                )}
                {company.phone && <p>Tél: {company.phone}</p>}
                {company.email && <p>{company.email}</p>}
                {company.registration_number && <p>SIRET: {company.registration_number}</p>}
                {company.tax_id && <p>TVA: {company.tax_id}</p>}
              </div>
            ) : (
              <p className="text-gray-600">{t('app.tagline')}</p>
            )}
          </div>
          <div className="sm:text-right">
            <div className="text-2xl font-bold text-gray-900 mb-2">
              {t('invoices.invoiceNumber')}: {invoice.invoiceNumber}
            </div>
            <div className={`inline-block px-3 py-1 rounded text-white text-sm ${getStatusColor(invoice.status)}`}>
              {t(`status.${invoice.status}`)}
            </div>
          </div>
        </div>

        {/* Client + Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8 mb-6 md:mb-8">
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">{t('invoices.clientInfo')}</h3>
            <div className="text-gray-900">
              <p className="font-bold">{client.companyName}</p>
              <p>{client.contactName}</p>
              <p className="whitespace-pre-line">{client.address}</p>
              {(client.postal_code || client.city) && (
                <p>{client.postal_code} {client.city}{client.country ? `, ${client.country}` : ''}</p>
              )}
              {client.vatNumber && <p>TVA: {client.vatNumber}</p>}
              <p>{client.email}</p>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="space-y-1">
              <div>
                <span className="text-gray-600">{t('invoices.issueDate')}: </span>
                <span className="text-gray-900 font-semibold">
                  {format(new Date(invoice.issueDate), 'MMM dd, yyyy')}
                </span>
              </div>
              <div>
                <span className="text-gray-600">{t('invoices.dueDate')}: </span>
                <span className="text-gray-900 font-semibold">
                  {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto mb-6 md:mb-8">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-3 text-gray-700">{t('invoices.description')}</th>
              <th className="text-right py-3 text-gray-700">{t('invoices.quantity')}</th>
              <th className="text-right py-3 text-gray-700">{t('invoices.unitPrice')}</th>
              <th className="text-right py-3 text-gray-700">{t('invoices.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="py-3 text-gray-900">{item.description}</td>
                <td className="text-right py-3 text-gray-900">{item.quantity.toFixed(2)}</td>
                <td className="text-right py-3 text-gray-900">
                  {formatCurrency(item.unitPrice, client.preferredCurrency)}
                </td>
                <td className="text-right py-3 text-gray-900">
                  {formatCurrency(item.amount, client.preferredCurrency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="flex justify-end mb-6 md:mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-gray-900">
              <span>{t('invoices.totalHT')}:</span>
              <span className="font-semibold">{formatCurrency(invoice.subtotal, client.preferredCurrency)}</span>
            </div>
            <div className="flex justify-between text-gray-900">
              <span>{t('invoices.taxAmount')} ({(invoice.taxRate * 100).toFixed(0)}%):</span>
              <span>{formatCurrency(invoice.taxAmount, client.preferredCurrency)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold border-t-2 border-gray-300 pt-2 text-gray-900">
              <span>{t('invoices.totalTTC')}:</span>
              <span>{formatCurrency(invoice.total, client.preferredCurrency)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="border-t border-gray-300 pt-4">
            <h3 className="font-semibold text-gray-700 mb-2">{t('timesheets.notes')}</h3>
            <p className="text-gray-900 whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}

        {/* Bank Details Footer */}
        {company && (company.iban || company.bank_name) && (
          <div className="border-t border-gray-300 mt-6 pt-4">
            <h3 className="font-semibold text-gray-700 mb-2 text-sm">Coordonnées bancaires</h3>
            <div className="text-sm text-gray-600 grid grid-cols-2 gap-x-4 gap-y-1">
              {company.bank_name && <p>Banque: <span className="text-gray-900">{company.bank_name}</span></p>}
              {company.iban && <p>IBAN: <span className="text-gray-900 font-mono text-xs">{company.iban}</span></p>}
              {company.swift && <p>BIC: <span className="text-gray-900 font-mono text-xs">{company.swift}</span></p>}
            </div>
          </div>
        )}

        <div className="border-t border-gray-300 mt-6 pt-4 text-center text-sm text-gray-600">
          <p>{company?.company_name || t('app.name')} — Merci pour votre confiance !</p>
          {company?.registration_number && <p className="text-xs mt-1">SIRET: {company.registration_number} {company.tax_id ? `• TVA: ${company.tax_id}` : ''}</p>}
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;
