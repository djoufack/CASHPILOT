
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const RejectApprovalDialog = ({
  open,
  reason,
  onReasonChange,
  onConfirm,
  onOpenChange,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gradient text-lg">
            {t('supplierInvoices.rejectReasonTitle', 'Rejection reason')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-gray-400">
            {t(
              'supplierInvoices.rejectReasonDesc',
              'Explain why this invoice is rejected before continuing.'
            )}
          </p>
          <Input
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            className="bg-gray-800 border-gray-700 text-white"
            placeholder={t('supplierInvoices.rejectReasonPlaceholder', 'Reason (optional)')}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white">
            {t('supplierInvoices.rejectAction', 'Confirm rejection')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RejectApprovalDialog;
