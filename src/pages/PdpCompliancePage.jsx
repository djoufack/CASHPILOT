import { useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { usePdpCompliance } from '@/hooks/usePdpCompliance';
import { useToast } from '@/components/ui/use-toast';
import ComplianceProgressCard from '@/components/compliance/ComplianceProgressCard';
import AuditTrailTable from '@/components/compliance/AuditTrailTable';
import ArchiveStats from '@/components/compliance/ArchiveStats';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Loader2,
  RefreshCw,
  ClipboardCheck,
  FileSearch,
  Archive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

const CERT_TYPES = ['nf525', 'pdp', 'facturx', 'chorus_pro'];

const TAB_KEYS = ['audit', 'archives'];

const PdpCompliancePage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    complianceStatus,
    auditTrail,
    archiveStats,
    loading,
    loadingAudit,
    loadingArchive,
    auditing,
    updateStatus,
    runAudit,
    refetchStatus,
    refetchAudit,
    refetchArchive,
  } = usePdpCompliance();

  const [activeTab, setActiveTab] = useState('audit');
  const [auditResult, setAuditResult] = useState(null);

  // ─── Map compliance status by certification type ───
  const statusByType = useMemo(() => {
    const map = {};
    for (const cert of complianceStatus) {
      map[cert.certification_type] = cert;
    }
    return map;
  }, [complianceStatus]);

  // ─── KPIs ───
  const kpis = useMemo(() => {
    const total = CERT_TYPES.length;
    const certified = complianceStatus.filter((c) => c.status === 'certified').length;
    const inProgress = complianceStatus.filter((c) => c.status === 'in_progress').length;
    const expired = complianceStatus.filter((c) => c.status === 'expired').length;
    const avgProgress =
      complianceStatus.length > 0
        ? Math.round(complianceStatus.reduce((s, c) => s + (c.progress_percent || 0), 0) / total)
        : 0;
    return { total, certified, inProgress, expired, avgProgress };
  }, [complianceStatus]);

  // ─── Handlers ───
  const handleUpdateStatus = useCallback(
    async (certType, updates) => {
      try {
        await updateStatus(certType, updates);
        toast({
          title: t('compliance.toast.statusUpdated'),
          description: t(`compliance.certTypes.${certType}`),
        });
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err.message,
          variant: 'destructive',
        });
      }
    },
    [updateStatus, toast, t]
  );

  const handleRunAudit = useCallback(async () => {
    try {
      const result = await runAudit();
      setAuditResult(result);
      toast({
        title: t('compliance.toast.auditComplete'),
        description: t('compliance.toast.auditCoverage', { coverage: result.coverage }),
      });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.message,
        variant: 'destructive',
      });
    }
  }, [runAudit, toast, t]);

  const handleRefresh = useCallback(() => {
    refetchStatus();
    refetchAudit();
    refetchArchive();
  }, [refetchStatus, refetchAudit, refetchArchive]);

  return (
    <>
      <Helmet>
        <title>{t('compliance.pageTitle')} — CashPilot</title>
      </Helmet>

      <div className="min-h-screen bg-[#0a0e1a] px-4 py-6 sm:px-6 lg:px-8">
        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15">
              <Shield className="h-6 w-6 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('compliance.title')}</h1>
              <p className="text-sm text-gray-400">{t('compliance.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('compliance.refresh')}
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleRunAudit}
              disabled={auditing}
            >
              {auditing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ClipboardCheck className="h-4 w-4 mr-2" />
              )}
              {t('compliance.runAudit')}
            </Button>
          </div>
        </div>

        {/* ─── KPI Cards ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-gray-800 bg-[#0f1528]/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-gray-400">{t('compliance.kpi.certified')}</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {kpis.certified}
              <span className="text-sm text-gray-500">/{kpis.total}</span>
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0f1528]/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-gray-400">{t('compliance.kpi.inProgress')}</span>
            </div>
            <p className="text-2xl font-bold text-white">{kpis.inProgress}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0f1528]/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-gray-400">{t('compliance.kpi.expired')}</span>
            </div>
            <p className="text-2xl font-bold text-white">{kpis.expired}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0f1528]/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-indigo-400" />
              <span className="text-xs text-gray-400">{t('compliance.kpi.avgProgress')}</span>
            </div>
            <p className="text-2xl font-bold text-white">{kpis.avgProgress}%</p>
          </div>
        </div>

        {/* ─── Audit Result Banner ─── */}
        {auditResult && (
          <div
            className={`rounded-xl border p-4 mb-6 ${
              auditResult.coverage === 100 ? 'border-emerald-800 bg-emerald-900/20' : 'border-amber-800 bg-amber-900/20'
            }`}
          >
            <div className="flex items-center gap-3">
              {auditResult.coverage === 100 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-white">
                  {t('compliance.auditResult.title', { coverage: auditResult.coverage })}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t('compliance.auditResult.detail', {
                    audited: auditResult.audited,
                    total: auditResult.totalInvoices,
                    missing: auditResult.missing,
                  })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-gray-400 hover:text-white"
                onClick={() => setAuditResult(null)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ─── Certification Cards ─── */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            {t('compliance.certificationsTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CERT_TYPES.map((certType) => (
              <ComplianceProgressCard
                key={certType}
                certification={statusByType[certType] || { certification_type: certType }}
                onUpdate={handleUpdateStatus}
              />
            ))}
          </div>
        </div>

        {/* ─── Tabs: Audit Trail | Archives ─── */}
        <div className="mb-6">
          <div className="flex items-center gap-1 border-b border-gray-800 mb-6">
            {TAB_KEYS.map((tab) => {
              const TabIcon = tab === 'audit' ? FileSearch : Archive;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-indigo-500 text-indigo-300'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <TabIcon className="h-4 w-4" />
                  {t(`compliance.tabs.${tab}`)}
                </button>
              );
            })}
          </div>

          {activeTab === 'audit' && <AuditTrailTable entries={auditTrail} loading={loadingAudit} />}

          {activeTab === 'archives' && <ArchiveStats stats={archiveStats} loading={loadingArchive} />}
        </div>
      </div>
    </>
  );
};

export default PdpCompliancePage;
