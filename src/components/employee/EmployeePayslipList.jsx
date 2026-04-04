import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/dateLocale';
import { formatDisplayCurrency } from '@/utils/displayFormatting';
import { FileText, Download, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const formatPeriod = (start, end) => {
  if (!start || !end) return '---';
  const s = new Date(start);
  const _e = new Date(end);
  const monthNames = [
    'Janvier',
    'Fevrier',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Aout',
    'Septembre',
    'Octobre',
    'Novembre',
    'Decembre',
  ];
  return `${monthNames[s.getMonth()]} ${s.getFullYear()}`;
};

const formatMoney = (value, currency = 'EUR') => {
  return formatDisplayCurrency(value, {
    currency,
    fallback: '---',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const StatusBadge = ({ status }) => {
  const { t } = useTranslation();
  const colors = {
    validated: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    exported: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    closed: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };
  const labels = {
    validated: t('employee.payslip.validated', 'Valide'),
    exported: t('employee.payslip.exported', 'Exporte'),
    closed: t('employee.payslip.closed', 'Cloture'),
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[status] || colors.closed}`}>
      {labels[status] || status}
    </span>
  );
};

const PayslipRow = ({ payslip, isExpanded, onToggle }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-[#141c33]/60 rounded-lg border border-white/5 hover:border-white/10 transition-colors overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{formatPeriod(payslip.period_start, payslip.period_end)}</p>
            <p className="text-xs text-gray-400">
              {payslip.period_start} - {payslip.period_end}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-white">{formatMoney(payslip.net_amount)}</p>
            <StatusBadge status={payslip.period_status} />
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <span className="text-gray-400">{t('employee.payslip.period', 'Periode')}:</span>
              <span className="text-white ml-1">
                {payslip.period_start} - {payslip.period_end}
              </span>
            </div>
            <div>
              <span className="text-gray-400">{t('employee.payslip.status', 'Statut')}:</span>
              <span className="text-white ml-1">{payslip.period_status}</span>
            </div>
            {payslip.generated_at && (
              <div className="col-span-2">
                <span className="text-gray-400">{t('employee.payslip.generatedAt', 'Genere le')}:</span>
                <span className="text-white ml-1">{formatDate(payslip.generated_at)}</span>
              </div>
            )}
          </div>

          {payslip.file_url ? (
            <a
              href={payslip.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {t('employee.payslip.download', 'Telecharger PDF')}
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <p className="text-xs text-gray-500 italic">{t('employee.payslip.noFile', 'Fichier non disponible')}</p>
          )}
        </div>
      )}
    </div>
  );
};

const EmployeePayslipList = ({ payslips }) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState(null);

  const handleToggle = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-[#0f1528]/80 backdrop-blur-xl rounded-xl border border-white/10 p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">{t('employee.payslip.title', 'Fiches de paie')}</h3>
        {payslips && payslips.length > 0 && (
          <span className="text-xs text-gray-400 ml-auto">
            {payslips.length} {t('employee.payslip.entries', 'bulletins')}
          </span>
        )}
      </div>

      {payslips && payslips.length > 0 ? (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
          {payslips.map((payslip) => (
            <PayslipRow
              key={payslip.period_id}
              payslip={payslip}
              isExpanded={expandedId === payslip.period_id}
              onToggle={() => handleToggle(payslip.period_id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <FileText className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{t('employee.payslip.empty', 'Aucune fiche de paie disponible.')}</p>
          <p className="text-xs text-gray-500 mt-1">
            {t('employee.payslip.emptyHint', 'Les bulletins apparaitront ici apres validation.')}
          </p>
        </div>
      )}
    </div>
  );
};

export default EmployeePayslipList;
