import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useAuditComptable } from '@/hooks/useAuditComptable';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Loader2, Play, Download, CheckCircle, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const getPeriodPresets = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3);
  const qStart = new Date(year, quarter * 3, 1);
  const qEnd = new Date(year, quarter * 3 + 3, 0);
  return [
    { label: 'Annee en cours', start: `${year}-01-01`, end: now.toISOString().split('T')[0] },
    { label: 'Annee precedente', start: `${year - 1}-01-01`, end: `${year - 1}-12-31` },
    { label: 'Trimestre en cours', start: qStart.toISOString().split('T')[0], end: qEnd.toISOString().split('T')[0] },
    { label: 'Mois en cours', start: `${year}-${String(month + 1).padStart(2, '0')}-01`, end: now.toISOString().split('T')[0] },
  ];
};

const StatusIcon = ({ status, className = 'w-5 h-5' }) => {
  if (status === 'pass') return <CheckCircle className={`${className} text-green-400`} />;
  if (status === 'warning') return <AlertTriangle className={`${className} text-yellow-400`} />;
  return <XCircle className={`${className} text-red-400`} />;
};

const CheckRow = ({ check }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-white/5 rounded-lg overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left">
        <StatusIcon status={check.status} />
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{check.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{check.details}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded ${
          check.severity === 'error' ? 'bg-red-400/10 text-red-400' :
          check.severity === 'warning' ? 'bg-yellow-400/10 text-yellow-400' :
          'bg-blue-400/10 text-blue-400'
        }`}>{check.severity}</span>
        {(check.recommendation || check.items) && (
          expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {expanded && (check.recommendation || check.items) && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          {check.recommendation && (
            <p className="text-sm text-orange-300 mb-2">Recommandation: {check.recommendation}</p>
          )}
          {check.items && check.items.length > 0 && (
            <div className="bg-black/20 rounded-lg p-3 mt-2">
              <p className="text-xs text-gray-400 mb-2">Elements concernes:</p>
              <pre className="text-xs text-gray-300 overflow-x-auto">{JSON.stringify(check.items, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CategoryContent = ({ category }) => {
  if (!category) return null;
  const scoreColor = category.score >= 85 ? 'text-green-400' : category.score >= 70 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{category.label}</h3>
        <span className={`text-2xl font-bold ${scoreColor}`}>{category.score}%</span>
      </div>
      <div className="space-y-2">
        {category.checks.map((check) => <CheckRow key={check.id} check={check} />)}
      </div>
    </div>
  );
};

const AuditComptable = () => {
  const { t } = useTranslation();
  const { auditResult, loading, error, runAudit } = useAuditComptable(false);
  const presets = useMemo(() => getPeriodPresets(), []);
  const [periodStart, setPeriodStart] = useState(presets[0].start);
  const [periodEnd, setPeriodEnd] = useState(presets[0].end);

  const handleRunAudit = () => runAudit(periodStart, periodEnd);

  const handlePreset = (preset) => {
    setPeriodStart(preset.start);
    setPeriodEnd(preset.end);
  };

  const handleDownload = () => {
    if (!auditResult) return;
    const blob = new Blob([JSON.stringify(auditResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-comptable-${auditResult.period.start}-${auditResult.period.end}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Helmet><title>Audit Comptable - {t('app.name')}</title></Helmet>
      <div className="container mx-auto p-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="w-8 h-8 text-orange-400" />
            <h1 className="text-3xl md:text-4xl font-bold text-gradient">Audit Comptable</h1>
          </div>
          <p className="text-gray-500 text-sm">Verification et validation automatisee de votre comptabilite</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-6 border border-white/5 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex gap-2 flex-wrap">
              {presets.map((preset) => (
                <Button key={preset.label} size="sm" variant="outline"
                  onClick={() => handlePreset(preset)}
                  className={`border-gray-600 text-xs ${
                    periodStart === preset.start && periodEnd === preset.end
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                      : 'hover:bg-gray-700 text-gray-400'
                  }`}>{preset.label}</Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white" />
              <span className="text-gray-500">-</span>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white" />
            </div>
            <div className="flex gap-2 ml-auto">
              {auditResult && (
                <Button size="sm" variant="outline" onClick={handleDownload}
                  className="border-gray-600 hover:bg-gray-700 text-gray-300">
                  <Download className="w-4 h-4 mr-2" /> Telecharger
                </Button>
              )}
              <Button size="sm" onClick={handleRunAudit} disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 text-white">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                {loading ? 'Audit en cours...' : "Lancer l'audit"}
              </Button>
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm">Erreur: {error}</p>
          </div>
        )}

        {auditResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="glass-card rounded-2xl p-6 border border-white/5 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Score global</p>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className={`text-5xl font-bold ${
                      auditResult.score >= 85 ? 'text-green-400' : auditResult.score >= 70 ? 'text-yellow-400' : 'text-red-400'
                    }`}>{auditResult.score}</span>
                    <span className="text-2xl text-gray-500">/100</span>
                    <span className={`text-xl font-semibold ml-2 ${
                      auditResult.score >= 85 ? 'text-green-400' : auditResult.score >= 70 ? 'text-yellow-400' : 'text-red-400'
                    }`}>{auditResult.grade}</span>
                  </div>
                </div>
                <div className="flex gap-6 text-center">
                  <div><p className="text-2xl font-bold text-green-400">{auditResult.summary.passed}</p><p className="text-xs text-gray-500">Passes</p></div>
                  <div><p className="text-2xl font-bold text-yellow-400">{auditResult.summary.warnings}</p><p className="text-xs text-gray-500">Alertes</p></div>
                  <div><p className="text-2xl font-bold text-red-400">{auditResult.summary.errors}</p><p className="text-xs text-gray-500">Erreurs</p></div>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                Periode: {auditResult.period.start} - {auditResult.period.end} | Pays: {auditResult.country} | {auditResult.data_summary.entries_count} ecritures, {auditResult.data_summary.invoices_count} factures
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-white/5">
              <Tabs defaultValue="balance">
                <TabsList className="bg-gray-800/50 mb-6">
                  {auditResult.categories.balance && <TabsTrigger value="balance" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">Equilibre ({auditResult.categories.balance.score}%)</TabsTrigger>}
                  {auditResult.categories.fiscal && <TabsTrigger value="fiscal" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">Fiscal ({auditResult.categories.fiscal.score}%)</TabsTrigger>}
                  {auditResult.categories.anomalies && <TabsTrigger value="anomalies" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">Anomalies ({auditResult.categories.anomalies.score}%)</TabsTrigger>}
                </TabsList>
                <TabsContent value="balance"><CategoryContent category={auditResult.categories.balance} /></TabsContent>
                <TabsContent value="fiscal"><CategoryContent category={auditResult.categories.fiscal} /></TabsContent>
                <TabsContent value="anomalies"><CategoryContent category={auditResult.categories.anomalies} /></TabsContent>
              </Tabs>
            </div>

            {auditResult.recommendations.length > 0 && (
              <div className="glass-card rounded-2xl p-6 border border-white/5 mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Recommandations</h3>
                <div className="space-y-3">
                  {auditResult.recommendations.map((rec, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                      rec.priority === 'high' ? 'bg-red-400/10' : rec.priority === 'medium' ? 'bg-yellow-400/10' : 'bg-blue-400/10'
                    }`}>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded mt-0.5 ${
                        rec.priority === 'high' ? 'bg-red-400/20 text-red-400' : rec.priority === 'medium' ? 'bg-yellow-400/20 text-yellow-400' : 'bg-blue-400/20 text-blue-400'
                      }`}>{rec.priority === 'high' ? 'URGENT' : rec.priority === 'medium' ? 'MOYEN' : 'INFO'}</span>
                      <p className="text-sm text-gray-300">{rec.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {!auditResult && !loading && !error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <ShieldCheck className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-gray-400 mb-2">Aucun audit lance</h3>
            <p className="text-gray-500 text-sm mb-6">Selectionnez une periode et lancez l'audit pour verifier votre comptabilite.</p>
          </motion.div>
        )}
      </div>
    </>
  );
};

export default AuditComptable;
