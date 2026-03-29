import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  UserCircle,
  Calendar,
  Receipt,
  FileText,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Briefcase,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLocale, formatDate } from '@/utils/dateLocale';
import { useEmployeePortal } from '@/hooks/useEmployeePortal';
import EmployeeLeavePanel from '@/components/employee/EmployeeLeavePanel';
import EmployeeExpensePanel from '@/components/employee/EmployeeExpensePanel';
import EmployeePayslipPanel from '@/components/employee/EmployeePayslipPanel';

const TABS = [
  { key: 'leave', icon: Calendar, color: 'blue' },
  { key: 'expenses', icon: Receipt, color: 'purple' },
  { key: 'payslips', icon: FileText, color: 'emerald' },
];

const KpiCard = ({ icon: Icon, label, value, subtext, colorClass }) => (
  <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl backdrop-blur-sm p-4">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 truncate">{label}</p>
        <p className="text-lg font-bold text-white truncate">{value}</p>
        {subtext && <p className="text-xs text-gray-500 truncate">{subtext}</p>}
      </div>
    </div>
  </div>
);

const PersonalInfoCard = ({ employee }) => {
  const { t } = useTranslation();

  if (!employee) return null;

  const fields = [
    {
      icon: UserCircle,
      label: t('employee.info.name', 'Nom complet'),
      value: employee.full_name || `${employee.first_name} ${employee.last_name}`,
    },
    {
      icon: Briefcase,
      label: t('employee.info.jobTitle', 'Poste'),
      value: employee.job_title,
    },
    {
      icon: Mail,
      label: t('employee.info.email', 'Email professionnel'),
      value: employee.work_email,
    },
    {
      icon: Calendar,
      label: t('employee.info.hireDate', "Date d'embauche"),
      value: employee.hire_date
        ? formatDate(employee.hire_date, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : null,
    },
  ];

  const statusColors = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    on_leave: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    inactive: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    terminated: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="bg-[#0f1528]/80 backdrop-blur-xl rounded-xl border border-white/10 p-5">
      <div className="flex items-center gap-2 mb-4">
        <UserCircle className="w-5 h-5 text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">{t('employee.info.title', 'Informations personnelles')}</h3>
        {employee.status && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ml-auto ${
              statusColors[employee.status] || statusColors.active
            }`}
          >
            {t(`employee.info.status.${employee.status}`, employee.status)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields
          .filter((f) => f.value)
          .map((field, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-[#141c33]/60 rounded-lg p-3 border border-white/5">
              <field.icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-400">{field.label}</p>
                <p className="text-sm text-white truncate">{field.value}</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

const NoAccessState = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-600/20 flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8 text-yellow-400" />
      </div>
      <h2 className="text-lg font-bold text-white mb-2">{t('employee.noAccess.title', 'Acces non configure')}</h2>
      <p className="text-sm text-gray-400 text-center max-w-md">
        {t(
          'employee.noAccess.description',
          "Votre compte n'est pas encore lie a un dossier employe. Contactez votre administrateur pour obtenir l'acces au portail."
        )}
      </p>
    </div>
  );
};

const EmployeePortalPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('leave');

  const {
    loading,
    error,
    portalAccess,
    employeeInfo,
    leaveBalance,
    leaveRequests,
    contracts,
    expenseReports,
    createLeaveRequest,
    createExpenseReport,
    refresh,
  } = useEmployeePortal();

  const hasAccess = !!portalAccess;

  // Compute KPI values
  const kpis = useMemo(() => {
    // Leave balance: total remaining days
    const totalLeaveRemaining = (leaveBalance || []).reduce((sum, item) => sum + (Number(item.days_remaining) || 0), 0);
    const totalLeaveAllowance = (leaveBalance || []).reduce(
      (sum, item) => sum + (Number(item.total_allowance) || 0),
      0
    );

    // Pending expenses: count of submitted expense reports
    const pendingExpenses = (expenseReports || []).filter((r) => r.status === 'submitted');
    const pendingTotal = pendingExpenses.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);

    // Active contract
    const activeContract = (contracts || []).find((c) => c.status === 'active');

    // Next payday: estimate as end of current month
    const now = new Date();
    const nextPayday = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysUntilPayday = Math.max(0, Math.ceil((nextPayday - now) / (1000 * 60 * 60 * 24)));

    return {
      totalLeaveRemaining,
      totalLeaveAllowance,
      pendingExpenses,
      pendingTotal,
      activeContract,
      nextPayday,
      daysUntilPayday,
    };
  }, [leaveBalance, expenseReports, contracts]);

  return (
    <>
      <Helmet>
        <title>{t('employee.page.title', 'Mon Espace')} - CashPilot</title>
      </Helmet>

      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
              <UserCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {employeeInfo
                  ? `${t('employee.page.greeting', 'Bonjour')}, ${employeeInfo.first_name || employeeInfo.full_name || ''}`
                  : t('employee.page.title', 'Mon Espace')}
              </h1>
              <p className="text-sm text-gray-400">
                {t('employee.page.subtitle', 'Gerez vos conges, fiches de paie et notes de frais')}
              </p>
            </div>
          </div>
          {hasAccess && (
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="border-white/10 text-gray-300 hover:bg-white/5 self-start sm:self-auto"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {t('employee.page.refresh', 'Actualiser')}
            </Button>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300">{error}</div>
        )}

        {/* Loading state */}
        {loading && !employeeInfo && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        )}

        {/* No access state */}
        {!loading && !hasAccess && !error && <NoAccessState />}

        {/* Dashboard content */}
        {hasAccess && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                icon={Calendar}
                label={t('employee.kpi.leaveBalance', 'Solde de conges')}
                value={`${kpis.totalLeaveRemaining} ${t('employee.leave.days', 'jours')}`}
                subtext={`${kpis.totalLeaveAllowance} ${t('employee.kpi.totalAllowance', 'total')}`}
                colorClass="bg-gradient-to-br from-blue-500 to-blue-600"
              />
              <KpiCard
                icon={Receipt}
                label={t('employee.kpi.pendingExpenses', 'Notes en attente')}
                value={`${kpis.pendingExpenses.length}`}
                subtext={
                  kpis.pendingTotal > 0
                    ? new Intl.NumberFormat(getLocale(), {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      }).format(kpis.pendingTotal)
                    : t('employee.kpi.noPending', 'Aucune en attente')
                }
                colorClass="bg-gradient-to-br from-purple-500 to-purple-600"
              />
              <KpiCard
                icon={Briefcase}
                label={t('employee.kpi.currentContract', 'Contrat actuel')}
                value={
                  kpis.activeContract
                    ? t(
                        `employee.payslip.types.${kpis.activeContract.contract_type}`,
                        kpis.activeContract.contract_type || '---'
                      )
                    : '---'
                }
                subtext={kpis.activeContract?.job_title || t('employee.kpi.noContract', 'Non renseigne')}
                colorClass="bg-gradient-to-br from-emerald-500 to-emerald-600"
              />
              <KpiCard
                icon={FileText}
                label={t('employee.kpi.nextPayday', 'Prochaine paie')}
                value={formatDate(kpis.nextPayday, { day: 'numeric', month: 'short' })}
                subtext={`${kpis.daysUntilPayday} ${t('employee.kpi.daysLeft', 'jours restants')}`}
                colorClass="bg-gradient-to-br from-amber-500 to-orange-600"
              />
            </div>

            {/* Personal Info */}
            <PersonalInfoCard employee={employeeInfo} />

            {/* Tab Navigation */}
            <div className="flex bg-[#141c33] rounded-lg border border-gray-700/50 overflow-hidden w-fit">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t(`employee.tabs.${tab.key}`, tab.key)}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div>
              {activeTab === 'leave' && (
                <EmployeeLeavePanel
                  leaveRequests={leaveRequests}
                  leaveBalance={leaveBalance}
                  onCreateRequest={createLeaveRequest}
                  loading={loading}
                />
              )}
              {activeTab === 'expenses' && (
                <EmployeeExpensePanel
                  expenseReports={expenseReports}
                  onCreateReport={createExpenseReport}
                  loading={loading}
                />
              )}
              {activeTab === 'payslips' && <EmployeePayslipPanel contracts={contracts} loading={loading} />}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default EmployeePortalPage;
