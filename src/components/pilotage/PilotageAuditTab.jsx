import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Play,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  FileText,
  Lightbulb,
} from 'lucide-react';
import { useAuditComptable } from '@/hooks/useAuditComptable';

// ---------------------------------------------------------------------------
// Animation variants (matching other pilotage tabs)
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score) {
  if (score >= 80) return '#22c55e'; // green-500
  if (score >= 50) return '#eab308'; // yellow-500
  return '#ef4444'; // red-500
}

function getScoreTextClass(score) {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBgClass(score) {
  if (score >= 80) return 'bg-green-500/10 border-green-500/30';
  if (score >= 50) return 'bg-yellow-500/10 border-yellow-500/30';
  return 'bg-red-500/10 border-red-500/30';
}

function getStatusIcon(status) {
  switch (status) {
    case 'pass':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    case 'fail':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return null;
  }
}

function getPriorityBadgeClass(priority) {
  switch (priority) {
    case 'high':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'low':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ScoreGauge = ({ score, grade }) => {
  const circumference = 2 * Math.PI * 45;
  const progress = (score / 100) * circumference;
  const scoreColor = getScoreColor(score);
  const textClass = getScoreTextClass(score);

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="140" height="140" className="transform -rotate-90">
          <circle
            cx="70"
            cy="70"
            r="45"
            stroke="#374151"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="70"
            cy="70"
            r="45"
            stroke={scoreColor}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${textClass}`}>{grade}</span>
          <span className="text-sm text-gray-400">{Math.round(score)}/100</span>
        </div>
      </div>
    </div>
  );
};

const SummaryBadges = ({ summary }) => {
  if (!summary) return null;
  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex items-center gap-1.5 text-sm">
        <CheckCircle className="w-4 h-4 text-green-400" />
        <span className="text-gray-300">{summary.passed}</span>
        <span className="text-gray-500">pass</span>
      </div>
      <div className="flex items-center gap-1.5 text-sm">
        <AlertTriangle className="w-4 h-4 text-yellow-400" />
        <span className="text-gray-300">{summary.warnings}</span>
        <span className="text-gray-500">warnings</span>
      </div>
      <div className="flex items-center gap-1.5 text-sm">
        <XCircle className="w-4 h-4 text-red-400" />
        <span className="text-gray-300">{summary.errors}</span>
        <span className="text-gray-500">errors</span>
      </div>
    </div>
  );
};

const CategoryCard = ({ categoryKey, category }) => {
  const scoreColor = getScoreColor(category.score);
  const textClass = getScoreTextClass(category.score);
  const bgClass = getScoreBgClass(category.score);
  const circumference = 2 * Math.PI * 22;
  const progress = (category.score / 100) * circumference;

  const passCount = category.checks.filter((c) => c.status === 'pass').length;
  const totalCount = category.checks.length;

  return (
    <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-100">
              {category.label}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {passCount}/{totalCount} checks passed
            </p>
          </div>
          <div className="relative flex-shrink-0">
            <svg width="56" height="56" className="transform -rotate-90">
              <circle
                cx="28"
                cy="28"
                r="22"
                stroke="#374151"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="28"
                cy="28"
                r="22"
                stroke={scoreColor}
                strokeWidth="4"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xs font-bold ${textClass}`}>
                {Math.round(category.score)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {category.checks.map((check) => (
            <div
              key={check.id}
              className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-gray-800/30 transition-colors"
            >
              {getStatusIcon(check.status)}
              <span className="text-gray-300 flex-1 truncate">{check.name}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  check.status === 'pass'
                    ? 'bg-green-500/10 text-green-400 border-green-500/30'
                    : check.status === 'warning'
                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}
              >
                {check.status}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const RecommendationCard = ({ recommendation }) => {
  const badgeClass = getPriorityBadgeClass(recommendation.priority);

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/20 hover:bg-gray-800/40 transition-colors">
      <Lightbulb className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badgeClass}`}
          >
            {recommendation.priority}
          </span>
          <span className="text-xs text-gray-500">{recommendation.category}</span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">
          {recommendation.action}
        </p>
        <p className="text-xs text-gray-500 mt-1">{recommendation.message}</p>
      </div>
    </div>
  );
};

const DataSummaryRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-800/30 transition-colors">
    <span className="text-sm text-gray-400">{label}</span>
    <span className="text-sm font-mono font-semibold text-gray-200">{value}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PilotageAuditTab = ({ startDate, endDate }) => {
  const { t } = useTranslation();
  const { auditResult, loading, error, runAudit, clearCache } =
    useAuditComptable({
      autoLoad: true,
      defaultPeriodStart: startDate,
      defaultPeriodEnd: endDate,
      cacheKey: `cashpilot_audit_cache:${startDate || 'default'}:${endDate || 'default'}`,
    });

  const handleRunAudit = useCallback(() => {
    if (!startDate || !endDate) return;
    runAudit(startDate, endDate);
  }, [endDate, runAudit, startDate]);

  const formattedDate = useMemo(() => {
    if (!auditResult?.generated_at) return null;
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(auditResult.generated_at));
    } catch {
      return auditResult.generated_at;
    }
  }, [auditResult?.generated_at]);

  const categoryEntries = useMemo(() => {
    if (!auditResult?.categories) return [];
    return Object.entries(auditResult.categories);
  }, [auditResult?.categories]);

  // ---------- Empty state ----------
  if (!loading && !auditResult) {
    return (
      <motion.div
        className="space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
            <CardContent className="p-12 flex flex-col items-center justify-center text-center">
              <ShieldCheck className="w-16 h-16 text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-300 mb-2">
                {t('pilotage.audit.noAudit')}
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-md">
                {t('pilotage.audit.title')}
              </p>
              {error && (
                <p className="text-sm text-red-400 mb-4">{error}</p>
              )}
              <Button
                onClick={handleRunAudit}
                className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              >
                <Play className="w-4 h-4" />
                {t('pilotage.audit.runAudit')}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    );
  }

  // ---------- Loading state ----------
  if (loading) {
    return (
      <motion.div
        className="space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
            <CardContent className="p-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-12 h-12 text-orange-400 animate-spin mb-4" />
              <h3 className="text-lg font-semibold text-gray-300">
                {t('pilotage.audit.auditInProgress')}
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                17 checks across 3 categories...
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    );
  }

  // ---------- Results state ----------
  const { score, grade, summary, categories, recommendations, data_summary, period } =
    auditResult;

  return (
    <motion.div
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Health Score + Summary */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-100">
              <ShieldCheck className="w-5 h-5 text-orange-400" />
              {t('pilotage.audit.score')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Gauge */}
              <ScoreGauge score={score} grade={grade} />

              {/* Right side info */}
              <div className="flex-1 space-y-4">
                <SummaryBadges summary={summary} />

                {/* Period */}
                {period && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>
                      {period.start} &rarr; {period.end}
                    </span>
                  </div>
                )}

                {/* Last audit date */}
                {formattedDate && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {t('pilotage.audit.lastAudit')}: {formattedDate}
                    </span>
                  </div>
                )}

                {/* Error display */}
                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}

                {/* Re-run button */}
                <Button
                  onClick={handleRunAudit}
                  disabled={loading}
                  variant="outline"
                  className="gap-2 border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  {t('pilotage.audit.runAudit')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Categories Grid */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-orange-400" />
          <h2 className="text-xl font-bold text-gray-100">
            {t('pilotage.audit.categories')}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryEntries.map(([key, category]) => (
            <CategoryCard key={key} categoryKey={key} category={category} />
          ))}
        </div>
      </motion.div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-100">
                <Lightbulb className="w-5 h-5 text-orange-400" />
                Recommendations
                <Badge className="ml-2 bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                  {recommendations.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.map((rec, idx) => (
                  <RecommendationCard key={`${rec.check_id}-${idx}`} recommendation={rec} />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Data Summary */}
      {data_summary && (
        <motion.div variants={itemVariants}>
          <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-100">
                <FileText className="w-5 h-5 text-orange-400" />
                Data Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                <DataSummaryRow
                  label="Accounting Entries"
                  value={data_summary.entries_count?.toLocaleString('fr-FR') ?? 0}
                />
                <DataSummaryRow
                  label="Accounts"
                  value={data_summary.accounts_count?.toLocaleString('fr-FR') ?? 0}
                />
                <DataSummaryRow
                  label="Invoices"
                  value={data_summary.invoices_count?.toLocaleString('fr-FR') ?? 0}
                />
                <DataSummaryRow
                  label="Expenses"
                  value={data_summary.expenses_count?.toLocaleString('fr-FR') ?? 0}
                />
                <DataSummaryRow
                  label="Bank Transactions"
                  value={data_summary.bank_transactions_count?.toLocaleString('fr-FR') ?? 0}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default PilotageAuditTab;
