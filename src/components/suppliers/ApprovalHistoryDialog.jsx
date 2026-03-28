import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';

const statusConfig = {
  approved: {
    icon: CheckCircle,
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  rejected: {
    icon: XCircle,
    color: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
  pending: {
    icon: Clock,
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
};

const ApprovalHistoryDialog = ({ open, onOpenChange, invoice }) => {
  const { t } = useTranslation();

  if (!invoice) return null;

  const status = invoice.approval_status || 'pending';
  const config = statusConfig[status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const approvalSteps = (Array.isArray(invoice.approval_steps) ? invoice.approval_steps : [])
    .filter((step) => step && Number.isFinite(Number(step.level)))
    .map((step) => ({
      ...step,
      level: Number(step.level),
      status: step.status || 'pending',
    }))
    .sort((left, right) => left.level - right.level);
  const hasTakenAction =
    status !== 'pending' || invoice.approved_at || approvalSteps.some((step) => step.status !== 'pending');

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900/95 border-gray-700/50 backdrop-blur-xl text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2 text-white">
            <Clock className="h-5 w-5 text-orange-400" />
            {t('supplierInvoices.approvalHistory', 'Approval history')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Invoice reference */}
          <div className="text-sm text-gray-400">{invoice.invoice_number || '—'}</div>

          {hasTakenAction ? (
            <div className="space-y-4">
              {/* Status badge */}
              <div className="flex items-center gap-3">
                <Badge className={`${config.color} border text-sm px-3 py-1`}>
                  <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
                  {status === 'approved'
                    ? t('supplierInvoices.approvalApproved', 'Approved')
                    : status === 'rejected'
                      ? t('supplierInvoices.approvalRejected', 'Rejected')
                      : t('supplierInvoices.approvalPending', 'Pending approval')}
                </Badge>
              </div>

              {approvalSteps.length > 0 && (
                <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 p-3 space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    {t('supplierInvoices.approvalWorkflowLevels', 'Workflow levels')}
                  </p>
                  <div className="space-y-2">
                    {approvalSteps.map((step) => {
                      const stepConfig = statusConfig[step.status] || statusConfig.pending;
                      const StepIcon = stepConfig.icon;
                      return (
                        <div key={step.id || step.level} className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`${stepConfig.color} border text-xs px-2 py-0.5`}>
                              <StepIcon className="h-3 w-3 mr-1" />
                              {t('supplierInvoices.approvalLevelShort', {
                                defaultValue: 'N{{level}}',
                                level: step.level,
                              })}
                            </Badge>
                            <span className="text-xs text-gray-300 capitalize">{step.status}</span>
                          </div>
                          <span className="text-[11px] text-gray-500">{formatDate(step.decided_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Approved by */}
              {invoice.approved_by && (
                <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 p-3 space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    {t('supplierInvoices.approvedBy', 'Approved by')}
                  </p>
                  <p className="text-sm text-gray-200 font-mono">{invoice.approved_by}</p>
                </div>
              )}

              {/* Approved at */}
              {invoice.approved_at && (
                <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 p-3 space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    {t('supplierInvoices.approvedAt', 'Approved on')}
                  </p>
                  <p className="text-sm text-gray-200">{formatDate(invoice.approved_at)}</p>
                </div>
              )}

              {/* Rejected reason */}
              {status === 'rejected' && invoice.rejected_reason && (
                <div className="rounded-lg bg-rose-950/30 border border-rose-500/20 p-3 space-y-1">
                  <p className="text-xs text-rose-400 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {t('supplierInvoices.rejectedReason', 'Rejection reason')}
                  </p>
                  <p className="text-sm text-rose-200">{invoice.rejected_reason}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Clock className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm">{t('supplierInvoices.noApprovalHistory', 'No approval action yet')}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApprovalHistoryDialog;
