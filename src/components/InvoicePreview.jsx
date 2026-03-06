
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { exportInvoiceToPDF } from '@/services/exportPDF';
import { Download, FileCode, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useCompany } from '@/hooks/useCompany';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { exportUBL } from '@/services/exportUBL';
import { usePeppolSend } from '@/hooks/usePeppolSend';
import PeppolStatusBadge from '@/components/peppol/PeppolStatusBadge';
import { getTheme } from '@/config/invoiceThemes';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';

import ClassicTemplate from '@/components/invoice-templates/ClassicTemplate';
import ModernTemplate from '@/components/invoice-templates/ModernTemplate';
import MinimalTemplate from '@/components/invoice-templates/MinimalTemplate';
import BoldTemplate from '@/components/invoice-templates/BoldTemplate';
import ProfessionalTemplate from '@/components/invoice-templates/ProfessionalTemplate';
import DMGDefaultTemplate from '@/components/invoice-templates/DMGDefaultTemplate';
import { DEFAULT_INVOICE_TEMPLATE_ID } from '@/config/invoiceTemplates';

const templateComponents = {
  dmg_default: DMGDefaultTemplate,
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  bold: BoldTemplate,
  professional: ProfessionalTemplate,
};

const InvoicePreview = ({ invoice, client, items }) => {
  const { t } = useTranslation();
  const invoiceRef = useRef();
  const { toast } = useToast();
  const { company } = useCompany();
  const { settings } = useInvoiceSettings();
  const { guardedAction, modalProps } = useCreditsGuard();
  const { sendViaPeppol, sending, canUsePeppol, creditsModalProps } = usePeppolSend();

  const handleExportUBL = async () => {
    try {
      const { blob, filename } = await exportUBL(invoice, company, client, items);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Success', description: t('peppol.exportUBL') });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSendPeppol = async () => {
    await sendViaPeppol(invoice, client, items);
  };

  const handleExportPDF = async () => {
    await guardedAction(
      CREDIT_COSTS.PDF_INVOICE,
      t('credits.costPdfExport'),
      async () => {
        try {
          await exportInvoiceToPDF(invoiceRef.current, invoice.invoice_number || invoice.invoiceNumber);
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
      }
    );
  };

  const theme = getTheme(settings.color_theme);
  const TemplateComponent = templateComponents[settings.template_id] || templateComponents[DEFAULT_INVOICE_TEMPLATE_ID];

  return (
    <div className="space-y-4">
      <CreditsGuardModal {...modalProps} />
      <CreditsGuardModal {...creditsModalProps} />
      <div className="flex justify-end gap-2 flex-wrap">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={handleExportPDF}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Download className="w-4 h-4 mr-2" />
            {t('invoices.exportPDF')} ({CREDIT_COSTS.PDF_INVOICE} {t('credits.creditsLabel')})
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button onClick={handleExportUBL} variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
            <FileCode className="w-4 h-4 mr-2" />
            {t('peppol.exportUBL')}
          </Button>
        </motion.div>

        {canUsePeppol && client?.peppol_endpoint_id && company?.peppol_endpoint_id && (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleSendPeppol}
              disabled={sending || invoice.peppol_status === 'sent' || invoice.peppol_status === 'delivered'}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Send className="w-4 h-4 mr-2" />
              {sending
                ? t('peppol.sending')
                : t('peppolPage.creditPolicy.tableSendLabel', {
                  credits: CREDIT_COSTS.PEPPOL_SEND_INVOICE,
                  unit: t('credits.creditsLabel'),
                  defaultValue: `${t('peppol.sendViaPeppol')} (${CREDIT_COSTS.PEPPOL_SEND_INVOICE} ${t('credits.creditsLabel')})`,
                })}
            </Button>
          </motion.div>
        )}

        {invoice.peppol_status && invoice.peppol_status !== 'none' && (
          <PeppolStatusBadge status={invoice.peppol_status} errorMessage={invoice.peppol_error_message} />
        )}
      </div>

      <div ref={invoiceRef} className="rounded-lg shadow-xl overflow-hidden">
        <TemplateComponent
          invoice={invoice}
          client={client}
          items={items}
          company={company}
          theme={theme}
          settings={settings}
        />
      </div>
    </div>
  );
};

export default InvoicePreview;
