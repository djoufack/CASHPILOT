import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Send, Trash2, Loader2, FileText, CheckCircle2, Clock, XCircle, Calculator, Eye } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

const statusConfig = {
  draft: {
    color: 'bg-gray-700 text-gray-300',
    icon: FileText,
    borderColor: 'border-gray-700',
  },
  computed: {
    color: 'bg-blue-900/50 text-blue-300',
    icon: Calculator,
    borderColor: 'border-blue-800',
  },
  validated: {
    color: 'bg-purple-900/50 text-purple-300',
    icon: Eye,
    borderColor: 'border-purple-800',
  },
  submitted: {
    color: 'bg-amber-900/50 text-amber-300',
    icon: Clock,
    borderColor: 'border-amber-800',
  },
  accepted: {
    color: 'bg-emerald-900/50 text-emerald-300',
    icon: CheckCircle2,
    borderColor: 'border-emerald-800',
  },
  rejected: {
    color: 'bg-red-900/50 text-red-300',
    icon: XCircle,
    borderColor: 'border-red-800',
  },
};

const typeLabels = {
  vat: 'TVA',
  corporate_tax: 'IS',
  income_tax: 'IR',
  patente: 'Patente',
  cfe: 'CFE',
};

const TaxDeclarationList = ({ declarations, loading, submitting, onSubmit, onDelete, onValidate }) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!declarations || declarations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <FileText className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg">{t('taxFiling.noDeclarations', 'No declarations yet')}</p>
        <p className="text-sm mt-1">
          {t('taxFiling.createFirst', 'Compute a VAT or corporate tax declaration to get started')}
        </p>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="space-y-3">
      {declarations.map((decl) => {
        const config = statusConfig[decl.status] || statusConfig.draft;
        const StatusIcon = config.icon;
        const canSubmit = ['computed', 'validated'].includes(decl.status);
        const canValidate = decl.status === 'computed';
        const canDelete = ['draft', 'computed', 'rejected'].includes(decl.status);

        return (
          <div
            key={decl.id}
            className={`bg-gray-900/50 rounded-xl border ${config.borderColor} p-5 hover:bg-gray-900/70 transition-colors`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Left: Type + Period */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-900/40 text-blue-300 text-xs font-semibold uppercase">
                    {typeLabels[decl.declaration_type] || decl.declaration_type}
                  </span>
                  <span className="text-xs text-gray-500">{decl.country_code}</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {t(`taxFiling.status.${decl.status}`, decl.status)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="text-gray-400">
                    {t('taxFiling.period', 'Period')}:{' '}
                    <span className="text-white">
                      {formatDate(decl.period_start)} - {formatDate(decl.period_end)}
                    </span>
                  </span>
                  {decl.filing_reference && (
                    <span className="text-gray-400">
                      {t('taxFiling.reference', 'Ref')}:{' '}
                      <span className="text-amber-300 font-mono text-xs">{decl.filing_reference}</span>
                    </span>
                  )}
                  {decl.filed_at && (
                    <span className="text-gray-400">
                      {t('taxFiling.filedAt', 'Filed')}: <span className="text-white">{formatDate(decl.filed_at)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Center: Amounts */}
              <div className="flex gap-6 items-center">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">{t('taxFiling.taxBase', 'Base')}</p>
                  <p className="text-sm font-mono text-gray-300">{formatCurrency(decl.tax_base || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">{t('taxFiling.deductions', 'Deductions')}</p>
                  <p className="text-sm font-mono text-red-300">{formatCurrency(decl.deductions || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">{t('taxFiling.netPayable', 'Net')}</p>
                  <p
                    className={`text-sm font-bold font-mono ${
                      (decl.net_payable || 0) >= 0 ? 'text-blue-300' : 'text-amber-300'
                    }`}
                  >
                    {formatCurrency(decl.net_payable || 0)}
                  </p>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex gap-2 items-center flex-shrink-0">
                {canValidate && onValidate && (
                  <Button
                    size="sm"
                    onClick={() => onValidate(decl.id)}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    {t('taxFiling.validate', 'Validate')}
                  </Button>
                )}
                {canSubmit && (
                  <Button
                    size="sm"
                    onClick={() => onSubmit(decl.id)}
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1" />
                    )}
                    {t('taxFiling.submit', 'Submit')}
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(decl.id)}
                    className="text-gray-400 hover:text-red-400 hover:bg-red-900/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Submission response info */}
            {decl.response_data && (
              <div className="mt-3 pt-3 border-t border-gray-800/50">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {decl.response_data.authority && (
                    <span>
                      {t('taxFiling.authority', 'Authority')}:{' '}
                      <span className="text-gray-400">{decl.response_data.authority}</span>
                    </span>
                  )}
                  {decl.response_data.acknowledgment && (
                    <span>
                      <span className="text-gray-400">{decl.response_data.acknowledgment}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TaxDeclarationList;
