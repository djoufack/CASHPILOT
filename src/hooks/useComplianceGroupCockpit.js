import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

const CERT_STATUS_CERTIFIED = 'certified';
const CERT_STATUS_EXPIRED = 'expired';
const CERT_STATUS_IN_PROGRESS = 'in_progress';
const ELIM_PENDING_STATUSES = new Set(['draft', 'pending', 'queued']);
const REGULATORY_CRITICAL_SEVERITIES = new Set(['critical', 'high']);
const REGULATORY_OPEN_STATUSES = new Set(['new', 'pending', 'todo', 'in_review']);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const buildComplianceGroupCockpitMetrics = ({
  companies = [],
  portfolios = [],
  complianceStatus = [],
  eliminations = [],
  updates = [],
}) => {
  const now = Date.now();
  const upcomingThreshold = now + THIRTY_DAYS_MS;

  const peppolConfiguredCount = companies.filter((company) => Boolean(company?.peppol_endpoint_id)).length;

  const portfolioCompanyIds = new Set();
  for (const portfolio of portfolios) {
    for (const member of portfolio?.company_portfolio_members || []) {
      if (member?.company_id) {
        portfolioCompanyIds.add(member.company_id);
      }
    }
  }

  const certificationsCertified = complianceStatus.filter((item) => item?.status === CERT_STATUS_CERTIFIED).length;
  const certificationsExpired = complianceStatus.filter((item) => item?.status === CERT_STATUS_EXPIRED).length;
  const certificationsInProgress = complianceStatus.filter((item) => item?.status === CERT_STATUS_IN_PROGRESS).length;

  const pendingEliminations = eliminations.filter((item) =>
    ELIM_PENDING_STATUSES.has(String(item?.status || '').toLowerCase())
  );
  const eliminatedAmount = eliminations.reduce((sum, item) => sum + Number(item?.eliminated_amount || 0), 0);

  const criticalUpdates = updates.filter((item) => {
    const severity = String(item?.severity || '').toLowerCase();
    const status = String(item?.status || '').toLowerCase();
    return REGULATORY_CRITICAL_SEVERITIES.has(severity) && REGULATORY_OPEN_STATUSES.has(status);
  });

  const upcomingUpdates = updates.filter((item) => {
    if (!item?.effective_date) return false;
    const effectiveDate = new Date(item.effective_date).getTime();
    return Number.isFinite(effectiveDate) && effectiveDate >= now && effectiveDate <= upcomingThreshold;
  });

  const latestElimination = eliminations
    .map((item) => item?.created_at)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];

  return {
    companyCount: companies.length,
    peppolConfiguredCount,
    portfolioCount: portfolios.length,
    portfolioCompaniesCount: portfolioCompanyIds.size,
    certificationsTotal: complianceStatus.length,
    certificationsCertified,
    certificationsExpired,
    certificationsInProgress,
    pendingEliminationsCount: pendingEliminations.length,
    eliminatedAmount,
    criticalUpdatesCount: criticalUpdates.length,
    upcomingUpdatesCount: upcomingUpdates.length,
    latestEliminationAt: latestElimination || null,
  };
};

const EMPTY_METRICS = buildComplianceGroupCockpitMetrics({});

export function useComplianceGroupCockpit() {
  const { user } = useAuth();

  const {
    data: payload,
    loading,
    error,
    refetch,
  } = useSupabaseQuery(
    async () => {
      if (!user) {
        return {
          metrics: EMPTY_METRICS,
          warnings: [],
        };
      }

      const warnings = [];
      const settled = await Promise.allSettled([
        supabase.from('company').select('id, peppol_endpoint_id').eq('user_id', user.id),
        supabase.from('company_portfolios').select('id, company_portfolio_members(company_id)').eq('user_id', user.id),
        supabase.from('pdp_compliance_status').select('status').eq('user_id', user.id),
        supabase
          .from('intercompany_eliminations')
          .select('status, eliminated_amount, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('regulatory_updates')
          .select('severity, status, effective_date')
          .order('effective_date', { ascending: false })
          .limit(200),
      ]);

      const readRows = (index, label) => {
        const entry = settled[index];
        if (entry.status === 'rejected') {
          warnings.push(`${label}: ${entry.reason?.message || 'request failed'}`);
          return [];
        }

        const { data, error: queryError } = entry.value || {};
        if (queryError) {
          warnings.push(`${label}: ${queryError.message}`);
          return [];
        }

        return data || [];
      };

      const metrics = buildComplianceGroupCockpitMetrics({
        companies: readRows(0, 'company'),
        portfolios: readRows(1, 'company_portfolios'),
        complianceStatus: readRows(2, 'pdp_compliance_status'),
        eliminations: readRows(3, 'intercompany_eliminations'),
        updates: readRows(4, 'regulatory_updates'),
      });

      return { metrics, warnings };
    },
    {
      deps: [user?.id],
      defaultData: { metrics: EMPTY_METRICS, warnings: [] },
      enabled: true,
    }
  );

  const warnings = payload?.warnings || [];
  const metrics = payload?.metrics || EMPTY_METRICS;

  const hasIssues = useMemo(
    () =>
      metrics.criticalUpdatesCount > 0 ||
      metrics.certificationsExpired > 0 ||
      metrics.pendingEliminationsCount > 0 ||
      warnings.length > 0,
    [metrics.certificationsExpired, metrics.criticalUpdatesCount, metrics.pendingEliminationsCount, warnings.length]
  );

  return {
    metrics,
    warnings,
    hasIssues,
    loading,
    error,
    refetch,
  };
}
