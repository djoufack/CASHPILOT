import { useTranslation } from 'react-i18next';
import { FileText, Loader2, Calculator, Eye, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

const statusConfig = {
  draft: {
    color: 'bg-gray-700/60 text-gray-300',
    icon: FileText,
    label: 'draft',
  },
  computed: {
    color: 'bg-blue-900/50 text-blue-300',
    icon: Calculator,
    label: 'computed',
  },
  validated: {
    color: 'bg-purple-900/50 text-purple-300',
    icon: Eye,
    label: 'validated',
  },
  submitted: {
    color: 'bg-amber-900/50 text-amber-300',
    icon: Clock,
    label: 'submitted',
  },
  accepted: {
    color: 'bg-emerald-900/50 text-emerald-300',
    icon: CheckCircle2,
    label: 'accepted',
  },
  rejected: {
    color: 'bg-red-900/50 text-red-300',
    icon: XCircle,
    label: 'rejected',
  },
};

const typeLabels = {
  vat: 'TVA',
  corporate_tax: 'IS',
  income_tax: 'IR',
  patente: 'Patente',
  cfe: 'CFE',
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
};

/**
 * History list of past tax declarations displayed as a table.
 *
 * @param {{ declarations: Array, loading: boolean, onSelect: Function }} props
 */
const TaxDeclarationHistory = ({ declarations = [], loading = false, onSelect }) => {
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
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-12 backdrop-blur-sm flex flex-col items-center justify-center text-gray-500">
        <FileText className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">{t('tax.history.noDeclarations', 'No declarations yet')}</p>
        <p className="text-sm mt-1">
          {t('tax.history.createFirst', 'Compute a VAT or corporate tax declaration to get started')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl backdrop-blur-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase border-b border-gray-800/50">
              <th className="text-left px-5 py-3">{t('tax.history.type', 'Type')}</th>
              <th className="text-left px-5 py-3">{t('tax.history.period', 'Period')}</th>
              <th className="text-left px-5 py-3">{t('tax.history.country', 'Country')}</th>
              <th className="text-right px-5 py-3">{t('tax.history.amount', 'Amount')}</th>
              <th className="text-center px-5 py-3">{t('tax.history.status', 'Status')}</th>
              <th className="text-left px-5 py-3">{t('tax.history.submitted', 'Submitted')}</th>
            </tr>
          </thead>
          <tbody>
            {declarations.map((decl) => {
              const config = statusConfig[decl.status] || statusConfig.draft;
              const StatusIcon = config.icon;

              return (
                <tr
                  key={decl.id}
                  onClick={() => onSelect && onSelect(decl)}
                  className="border-t border-gray-800/30 hover:bg-gray-800/30 transition-colors cursor-pointer"
                >
                  {/* Type */}
                  <td className="px-5 py-4">
                    <span className="px-2.5 py-0.5 rounded-md bg-blue-900/40 text-blue-300 text-xs font-semibold uppercase">
                      {typeLabels[decl.declaration_type] || decl.declaration_type}
                    </span>
                  </td>

                  {/* Period */}
                  <td className="px-5 py-4 text-white">
                    {formatDate(decl.period_start)} - {formatDate(decl.period_end)}
                  </td>

                  {/* Country */}
                  <td className="px-5 py-4">
                    <span className="text-gray-300 font-mono text-xs">{decl.country_code || '-'}</span>
                  </td>

                  {/* Amount */}
                  <td className="px-5 py-4 text-right">
                    <span
                      className={`font-mono font-semibold ${
                        (decl.net_payable || 0) >= 0 ? 'text-blue-300' : 'text-amber-300'
                      }`}
                    >
                      {formatCurrency(decl.net_payable || 0)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {t(`tax.status.${decl.status}`, decl.status)}
                    </span>
                  </td>

                  {/* Submitted date */}
                  <td className="px-5 py-4 text-gray-400 text-xs">{decl.filed_at ? formatDate(decl.filed_at) : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaxDeclarationHistory;
