import { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Building2, CalendarDays, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getLocale } from '@/utils/dateLocale';
import { useConsolidation } from '@/hooks/useConsolidation';
import ConsolidationKpiCards from '@/components/consolidation/ConsolidationKpiCards';
import CompanyBreakdownChart from '@/components/consolidation/CompanyBreakdownChart';
import IntercompanyTable from '@/components/consolidation/IntercompanyTable';
import ConsolidatedEntitiesTable from '@/components/consolidation/ConsolidatedEntitiesTable';
import {
  buildConsolidatedEntityRows,
  filterConsolidatedEntityRows,
  summarizeConsolidatedEntities,
} from '@/services/consolidationEntityInsights';

function getDefaultPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const startDate = `${year}-01-01`;
  const endDate = now.toISOString().split('T')[0];
  return { startDate, endDate };
}

function getPreviousPeriod(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1); // day before start
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return {
    startDate: prevStart.toISOString().split('T')[0],
    endDate: prevEnd.toISOString().split('T')[0],
  };
}

const PERIOD_OPTIONS = [
  { value: 'ytd', label: 'consolidation.periodYtd' },
  { value: 'q1', label: 'consolidation.periodQ1' },
  { value: 'q2', label: 'consolidation.periodQ2' },
  { value: 'q3', label: 'consolidation.periodQ3' },
  { value: 'q4', label: 'consolidation.periodQ4' },
  { value: 'last12m', label: 'consolidation.periodLast12m' },
  { value: 'custom', label: 'consolidation.periodCustom' },
];

function resolvePeriod(periodKey) {
  const now = new Date();
  const year = now.getFullYear();

  switch (periodKey) {
    case 'q1':
      return { startDate: `${year}-01-01`, endDate: `${year}-03-31` };
    case 'q2':
      return { startDate: `${year}-04-01`, endDate: `${year}-06-30` };
    case 'q3':
      return { startDate: `${year}-07-01`, endDate: `${year}-09-30` };
    case 'q4':
      return { startDate: `${year}-10-01`, endDate: `${year}-12-31` };
    case 'last12m': {
      const past = new Date(now);
      past.setFullYear(past.getFullYear() - 1);
      return {
        startDate: past.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      };
    }
    case 'ytd':
    default:
      return getDefaultPeriod();
  }
}

export default function ConsolidationDashboardPage() {
  const { t } = useTranslation();
  const {
    portfolios,
    consolidatedPnl,
    consolidatedBalance,
    cashPosition,
    intercompanyTransactions,
    loading,
    error,
    fetchPortfolios,
    fetchConsolidatedPnl,
    fetchConsolidatedBalance,
    fetchCashPosition,
    fetchIntercompanyTransactions,
  } = useConsolidation();

  const [selectedPortfolioId, setSelectedPortfolioId] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('ytd');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [previousPnl, setPreviousPnl] = useState(null);
  const [previousBalance, setPreviousBalance] = useState(null);
  const [previousCash, setPreviousCash] = useState(null);
  const [activeTab, setActiveTab] = useState('pnl');
  const [entityScope, setEntityScope] = useState('all');

  // Load portfolios on mount
  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  // Auto-select first portfolio
  useEffect(() => {
    if (portfolios.length > 0 && !selectedPortfolioId) {
      setSelectedPortfolioId(portfolios[0].id);
    }
  }, [portfolios, selectedPortfolioId]);

  const currentPeriod = useMemo(() => {
    if (selectedPeriod === 'custom' && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    return resolvePeriod(selectedPeriod);
  }, [selectedPeriod, customStart, customEnd]);

  const loadAllData = useCallback(async () => {
    if (!selectedPortfolioId) return;

    const { startDate, endDate } = currentPeriod;
    const prev = getPreviousPeriod(startDate, endDate);

    // Load all data concurrently with partial failure tolerance
    const _consolResults = await Promise.allSettled([
      fetchConsolidatedPnl(selectedPortfolioId, startDate, endDate),
      fetchConsolidatedBalance(selectedPortfolioId, endDate),
      fetchCashPosition(selectedPortfolioId),
      fetchIntercompanyTransactions(selectedPortfolioId),
      fetchConsolidatedPnl(selectedPortfolioId, prev.startDate, prev.endDate),
      fetchConsolidatedBalance(selectedPortfolioId, prev.endDate),
      fetchCashPosition(selectedPortfolioId),
    ]);

    const _consolLabels = ['pnl', 'balance', 'cash', 'intercompany', 'prevPnl', 'prevBalance', 'prevCash'];
    _consolResults.forEach((r, i) => {
      if (r.status === 'rejected')
        console.error(`ConsolidationDashboard fetch "${_consolLabels[i]}" failed:`, r.reason);
    });

    const _cv = (i) => (_consolResults[i].status === 'fulfilled' ? _consolResults[i].value : null);
    const prevPnlData = _cv(4);
    const prevBalanceData = _cv(5);
    const prevCashData = _cv(6);

    setPreviousPnl(prevPnlData);
    setPreviousBalance(prevBalanceData);
    setPreviousCash(prevCashData);
  }, [
    selectedPortfolioId,
    currentPeriod,
    fetchConsolidatedPnl,
    fetchConsolidatedBalance,
    fetchCashPosition,
    fetchIntercompanyTransactions,
  ]);

  // Reload data when portfolio or period changes
  useEffect(() => {
    if (selectedPortfolioId) {
      loadAllData();
    }
  }, [selectedPortfolioId, loadAllData]);

  const selectedPortfolio = portfolios.find((p) => p.id === selectedPortfolioId);
  const currency = selectedPortfolio?.base_currency || 'EUR';

  const entityRows = useMemo(
    () =>
      buildConsolidatedEntityRows({
        pnlByCompany: consolidatedPnl?.by_company || [],
        balanceByCompany: consolidatedBalance?.by_company || [],
        cashByCompany: cashPosition?.by_company || [],
        intercompanyTransactions: intercompanyTransactions || [],
      }),
    [consolidatedPnl?.by_company, consolidatedBalance?.by_company, cashPosition?.by_company, intercompanyTransactions]
  );

  const visibleEntityRows = useMemo(
    () => filterConsolidatedEntityRows(entityRows, entityScope),
    [entityRows, entityScope]
  );
  const entitySummary = useMemo(() => summarizeConsolidatedEntities(entityRows), [entityRows]);
  const scopedCompanyIds = useMemo(
    () => new Set(visibleEntityRows.map((row) => String(row.companyId))),
    [visibleEntityRows]
  );

  const filterRowsByScope = useCallback(
    (rows = []) => {
      if (entityScope === 'all') return rows;
      return (rows || []).filter((row, index) => {
        const companyId = String(
          row?.company_id ||
            row?.companyId ||
            row?.id ||
            row?.company_name ||
            row?.companyName ||
            `company-${index + 1}`
        );
        return scopedCompanyIds.has(companyId);
      });
    },
    [entityScope, scopedCompanyIds]
  );

  const scopedPnlByCompany = useMemo(
    () => filterRowsByScope(consolidatedPnl?.by_company || []),
    [consolidatedPnl?.by_company, filterRowsByScope]
  );
  const scopedBalanceByCompany = useMemo(
    () => filterRowsByScope(consolidatedBalance?.by_company || []),
    [consolidatedBalance?.by_company, filterRowsByScope]
  );
  const scopedCashByCompany = useMemo(
    () => filterRowsByScope(cashPosition?.by_company || []),
    [cashPosition?.by_company, filterRowsByScope]
  );
  const scopedIntercompanyTransactions = useMemo(() => {
    if (entityScope === 'all') return intercompanyTransactions || [];

    return (intercompanyTransactions || []).filter((transaction) => {
      const sourceId = String(
        transaction?.company_id ||
          transaction?.companyId ||
          transaction?.source_company_id ||
          transaction?.source_company?.id ||
          ''
      );
      const targetId = String(
        transaction?.linked_company_id || transaction?.target_company_id || transaction?.target_company?.id || ''
      );
      return scopedCompanyIds.has(sourceId) || scopedCompanyIds.has(targetId);
    });
  }, [entityScope, intercompanyTransactions, scopedCompanyIds]);

  return (
    <>
      <Helmet>
        <title>{t('consolidation.pageTitle')} - CashPilot</title>
      </Helmet>

      <div className="min-h-screen bg-[#0a0e1a] p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <Building2 className="h-7 w-7 text-cyan-400" />
            {t('consolidation.pageTitle')}
          </h1>
          <p className="text-slate-400 text-sm mt-1">{t('consolidation.pageSubtitle')}</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Portfolio selector */}
          <div className="flex-1 max-w-xs">
            <Select value={selectedPortfolioId} onValueChange={setSelectedPortfolioId}>
              <SelectTrigger className="bg-[#141c33] border-white/10 text-white">
                <SelectValue placeholder={t('consolidation.selectPortfolio')} />
              </SelectTrigger>
              <SelectContent className="bg-[#141c33] border-white/10">
                {portfolios.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.portfolio_name}
                    {p.company_portfolio_members?.length > 0 && (
                      <span className="text-slate-500 ml-1">({p.company_portfolio_members.length})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Period selector */}
          <div className="flex-1 max-w-xs">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="bg-[#141c33] border-white/10 text-white">
                <CalendarDays className="h-4 w-4 text-slate-400 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141c33] border-white/10">
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom date fields */}
          {selectedPeriod === 'custom' && (
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-[#141c33] border border-white/10 rounded-md px-3 py-2 text-white text-sm"
              />
              <span className="text-slate-500 text-sm">{t('consolidation.to')}</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-[#141c33] border border-white/10 rounded-md px-3 py-2 text-white text-sm"
              />
            </div>
          )}

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllData}
            disabled={loading || !selectedPortfolioId}
            className="border-white/10 text-white hover:bg-white/10"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {t('consolidation.refresh')}
          </Button>
        </div>

        {/* Error state */}
        {error && (
          <Card className="bg-red-500/10 border-red-500/30 mb-6">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!loading && portfolios.length === 0 && (
          <Card className="bg-[#0f1528]/80 border-white/10 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <Building2 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-white text-lg font-semibold mb-2">{t('consolidation.noPortfolios')}</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">{t('consolidation.noPortfoliosDescription')}</p>
            </CardContent>
          </Card>
        )}

        {/* Main content */}
        {selectedPortfolioId && (
          <>
            {/* KPI Cards */}
            <div className="mb-6">
              <ConsolidationKpiCards
                pnlData={consolidatedPnl}
                balanceData={consolidatedBalance}
                cashData={cashPosition}
                previousPnl={previousPnl}
                previousBalance={previousBalance}
                previousCash={previousCash}
                currency={currency}
              />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-[#141c33] border border-white/10">
                <TabsTrigger
                  value="pnl"
                  className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
                >
                  {t('consolidation.tabPnl')}
                </TabsTrigger>
                <TabsTrigger
                  value="balance"
                  className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
                >
                  {t('consolidation.tabBalance')}
                </TabsTrigger>
                <TabsTrigger
                  value="cash"
                  className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
                >
                  {t('consolidation.tabCash')}
                </TabsTrigger>
                <TabsTrigger
                  value="intercompany"
                  className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
                >
                  {t('consolidation.tabIntercompany')}
                </TabsTrigger>
                <TabsTrigger
                  value="entities"
                  className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
                >
                  {t('consolidation.tabEntities', 'Entites')}
                </TabsTrigger>
              </TabsList>

              {/* P&L Tab */}
              <TabsContent value="pnl" className="space-y-4">
                <CompanyBreakdownChart data={scopedPnlByCompany} mode="pnl" currency={currency} />
                {consolidatedPnl?.eliminations > 0 && (
                  <Card className="bg-[#0f1528]/80 border-white/10 backdrop-blur-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                      <span className="text-slate-400 text-sm">{t('consolidation.intercompanyEliminations')}</span>
                      <span className="text-amber-400 font-semibold text-sm">
                        -{formatCurrencyValue(consolidatedPnl.eliminations, currency)}
                      </span>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Balance Sheet Tab */}
              <TabsContent value="balance" className="space-y-4">
                <CompanyBreakdownChart data={scopedBalanceByCompany} mode="balance" currency={currency} />
              </TabsContent>

              {/* Cash Tab */}
              <TabsContent value="cash" className="space-y-4">
                <CompanyBreakdownChart data={scopedCashByCompany} mode="cash" currency={currency} />
              </TabsContent>

              {/* Intercompany Tab */}
              <TabsContent value="intercompany">
                <IntercompanyTable transactions={scopedIntercompanyTransactions} currency={currency} />
              </TabsContent>

              {/* Consolidated entities tab */}
              <TabsContent value="entities">
                <ConsolidatedEntitiesTable
                  rows={visibleEntityRows}
                  scope={entityScope}
                  summary={entitySummary}
                  onScopeChange={setEntityScope}
                  currency={currency}
                />
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Loading overlay */}
        {loading && selectedPortfolioId && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-[#141c33] border border-white/10 rounded-xl p-6 flex items-center gap-3 pointer-events-auto">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              <span className="text-white text-sm">{t('consolidation.loadingData')}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Helper to format currency inline (avoiding import issues in JSX)
function formatCurrencyValue(amount, currency = 'EUR') {
  try {
    return new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    return `${(amount || 0).toFixed(2)} ${currency}`;
  }
}
