import { useTranslation } from 'react-i18next';
import { FileText, Briefcase, Loader2 } from 'lucide-react';

const CONTRACT_TYPE_COLORS = {
  cdi: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cdd: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  intern: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  freelance: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  expired: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  terminated: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const formatMoney = (value, currency = 'EUR') => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '---';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num);
};

const EmployeePayslipPanel = ({ contracts, loading }) => {
  const { t } = useTranslation();
  const contractList = contracts || [];

  // Find active contract
  const activeContract = contractList.find((c) => c.status === 'active') || contractList[0];

  return (
    <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl backdrop-blur-sm p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">
          {t('employee.payslip.panelTitle', 'Contrat & Fiches de paie')}
        </h3>
      </div>

      {/* Active contract info */}
      {activeContract && (
        <div className="bg-[#141c33]/60 rounded-lg p-4 border border-white/5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">
                {t('employee.payslip.currentContract', 'Contrat actif')}
              </span>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${
                CONTRACT_TYPE_COLORS[activeContract.status] || CONTRACT_TYPE_COLORS.active
              }`}
            >
              {t(`employee.payslip.contractStatus.${activeContract.status}`, activeContract.status)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Position */}
            {activeContract.job_title && (
              <div className="bg-[#0a0e1a]/60 rounded-lg p-3 border border-gray-800/30">
                <span className="text-xs text-gray-500 block mb-0.5">{t('employee.payslip.position', 'Poste')}</span>
                <span className="text-sm font-medium text-white">{activeContract.job_title}</span>
              </div>
            )}

            {/* Department */}
            {activeContract.hr_departments?.name && (
              <div className="bg-[#0a0e1a]/60 rounded-lg p-3 border border-gray-800/30">
                <span className="text-xs text-gray-500 block mb-0.5">
                  {t('employee.payslip.department', 'Departement')}
                </span>
                <span className="text-sm font-medium text-white">{activeContract.hr_departments.name}</span>
              </div>
            )}

            {/* Contract type */}
            {activeContract.contract_type && (
              <div className="bg-[#0a0e1a]/60 rounded-lg p-3 border border-gray-800/30">
                <span className="text-xs text-gray-500 block mb-0.5">
                  {t('employee.payslip.contractType', 'Type de contrat')}
                </span>
                <span className="text-sm font-medium text-white">
                  {t(`employee.payslip.types.${activeContract.contract_type}`, activeContract.contract_type)}
                </span>
              </div>
            )}

            {/* Salary */}
            {activeContract.monthly_salary != null && (
              <div className="bg-[#0a0e1a]/60 rounded-lg p-3 border border-gray-800/30">
                <span className="text-xs text-gray-500 block mb-0.5">
                  {t('employee.payslip.salary', 'Salaire mensuel')}
                </span>
                <span className="text-sm font-bold text-white">
                  {formatMoney(activeContract.monthly_salary, activeContract.currency || 'EUR')}
                </span>
              </div>
            )}

            {/* Start date */}
            {activeContract.start_date && (
              <div className="bg-[#0a0e1a]/60 rounded-lg p-3 border border-gray-800/30">
                <span className="text-xs text-gray-500 block mb-0.5">
                  {t('employee.payslip.startDate', 'Date de debut')}
                </span>
                <span className="text-sm font-medium text-white">
                  {new Date(activeContract.start_date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}

            {/* End date */}
            {activeContract.end_date && (
              <div className="bg-[#0a0e1a]/60 rounded-lg p-3 border border-gray-800/30">
                <span className="text-xs text-gray-500 block mb-0.5">
                  {t('employee.payslip.endDate', 'Date de fin')}
                </span>
                <span className="text-sm font-medium text-white">
                  {new Date(activeContract.end_date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Other contracts */}
      {contractList.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
            {t('employee.payslip.otherContracts', 'Historique des contrats')}
          </h4>
          {contractList
            .filter((c) => c.id !== activeContract?.id)
            .map((contract) => (
              <div
                key={contract.id}
                className="flex items-center justify-between bg-[#141c33]/60 rounded-lg p-3 border border-white/5"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">
                    {contract.job_title || t('employee.payslip.noTitle', 'Sans titre')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {contract.start_date} - {contract.end_date || t('employee.payslip.ongoing', 'En cours')}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                    CONTRACT_TYPE_COLORS[contract.status] || CONTRACT_TYPE_COLORS.expired
                  }`}
                >
                  {t(`employee.payslip.contractStatus.${contract.status}`, contract.status)}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Payslip placeholder info */}
      {contractList.length > 0 && (
        <div className="mt-4 bg-[#141c33]/40 rounded-lg p-3 border border-white/5 text-center">
          <p className="text-xs text-gray-500">
            {t(
              'employee.payslip.payslipHint',
              'Les fiches de paie sont generees par le module RH et apparaissent dans la section dediee.'
            )}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && contractList.length === 0 && (
        <div className="text-center py-6">
          <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-400">{t('employee.payslip.noContract', 'Aucun contrat disponible.')}</p>
          <p className="text-xs text-gray-500 mt-1">
            {t('employee.payslip.noContractHint', 'Les contrats apparaitront ici une fois configures par les RH.')}
          </p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
        </div>
      )}
    </div>
  );
};

export default EmployeePayslipPanel;
