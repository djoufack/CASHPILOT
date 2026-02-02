
import React from "react";
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { exportInvoiceToPDF } from '@/services/exportPDF';
import { Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useCompany } from '@/hooks/useCompany';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { getTheme } from '@/config/invoiceThemes';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';

import ClassicTemplate from '@/components/invoice-templates/ClassicTemplate';
import ModernTemplate from '@/components/invoice-templates/ModernTemplate';
import MinimalTemplate from '@/components/invoice-templates/MinimalTemplate';
import BoldTemplate from '@/components/invoice-templates/BoldTemplate';
import ProfessionalTemplate from '@/components/invoice-templates/ProfessionalTemplate';

const templateComponents = {
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
  const TemplateComponent = templateComponents[settings.template_id] || ClassicTemplate;

  return (
    <div className="space-y-4">
      <CreditsGuardModal {...modalProps} />
      <div className="flex justify-end">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={handleExportPDF}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Download className="w-4 h-4 mr-2" />
            {t('invoices.exportPDF')} ({CREDIT_COSTS.PDF_INVOICE} {t('credits.creditsLabel')})
          </Button>
        </motion.div>
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
