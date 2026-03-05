import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { AUTO_FIXABLE_AUDIT_CHECK_IDS, useAuditComptable } from '@/hooks/useAuditComptable';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Loader2, Play, Download, CheckCircle, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, Calendar, Wand2, Wrench, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateInput } from '@/utils/dateFormatting';

const getPeriodPresets = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3);
  const qStart = new Date(year, quarter * 3, 1);
  const qEnd = new Date(year, quarter * 3 + 3, 0);
  return [
    { label: 'Annee en cours', start: `${year}-01-01`, end: formatDateInput(now) },
    { label: 'Annee precedente', start: `${year - 1}-01-01`, end: `${year - 1}-12-31` },
    { label: 'Trimestre en cours', start: formatDateInput(qStart), end: formatDateInput(qEnd) },
    { label: 'Mois en cours', start: `${year}-${String(month + 1).padStart(2, '0')}-01`, end: formatDateInput(now) },
  ];
};

const StatusIcon = ({ status, className = 'w-5 h-5' }) => {
  if (status === 'pass') return <CheckCircle className={`${className} text-green-400`} />;
  if (status === 'warning') return <AlertTriangle className={`${className} text-yellow-400`} />;
  return <XCircle className={`${className} text-red-400`} />;
};

const AUTO_FIXABLE_CHECKS = new Set(AUTO_FIXABLE_AUDIT_CHECK_IDS);

const MANUAL_GUIDANCE = {
  balance_debit_credit: {
    why: 'La correction automatique risquerait de modifier des montants comptables sans piece justificative.',
    how: 'Identifiez le journal ou la piece source, puis corrigez le debit/credit de la ligne d origine.',
    where: 'Module Comptabilite > Ecritures.',
  },
  balance_sheet_equilibrium: {
    why: 'Le reclassement actif/passif/capitaux depend d un choix comptable et fiscal.',
    how: 'Revoyez le type/categorie des comptes concernes dans le plan comptable.',
    where: 'Module Comptabilite > Plan comptable.',
  },
  entry_sequence: {
    why: 'Les ruptures de sequence peuvent provenir de suppressions legitimes ou d archivage historique.',
    how: 'Controlez les numeros manquants et documentez les ecarts dans vos procedures.',
    where: 'Module Comptabilite > Journaux.',
  },
  suspense_accounts: {
    why: 'Le lettrage des comptes 47x exige une affectation metier au bon compte definitif.',
    how: 'Analysez chaque solde 47x et passez les ecritures de reclassement appropriees.',
    where: 'Module Comptabilite > Ecritures / Grand livre.',
  },
  date_coherence: {
    why: 'Changer automatiquement une date peut deplacer une ecriture sur un mauvais exercice.',
    how: 'Corrigez les dates en fonction des pieces et de l exercice comptable cible.',
    where: 'Module Comptabilite > Ecritures.',
  },
  vat_rates_valid: {
    why: 'Le bon taux TVA depend du regime fiscal, du client et du type d operation.',
    how: 'Ajustez le taux TVA sur les factures concernees et regenerer les ecritures si besoin.',
    where: 'Module Factures > Editer facture.',
  },
  vat_declaration: {
    why: 'Le credit ou solde de TVA peut etre legitime selon la periode et vos deducibilites.',
    how: 'Validez la coherence avec votre declaration et les justificatifs de TVA deducible.',
    where: 'Module Fiscalite / TVA.',
  },
  vat_reconciliation: {
    why: 'Un ecart TVA peut etre temporel (decalage de periode) ou provenir de cas particuliers.',
    how: 'Rapprochez les comptes 4457 avec les factures emises puis corrigez les ecritures manquantes.',
    where: 'Module Comptabilite > Comptes TVA.',
  },
  invoices_without_vat: {
    why: 'Certaines factures sans TVA sont autorisees (exoneration, autoliquidation, export).',
    how: 'Ajoutez la mention legale adaptee ou appliquez le bon taux si la facture est taxable.',
    where: 'Module Factures > Mentions et taux.',
  },
  duplicates: {
    why: 'Deux lignes identiques peuvent etre valides selon le contexte (acompte, correction, reprise).',
    how: 'Controlez les references de piece et supprimez uniquement les doublons confirmes.',
    where: 'Module Comptabilite > Ecritures.',
  },
  abnormal_amounts: {
    why: 'Un montant statistiquement anormal n est pas forcement une erreur comptable.',
    how: 'Revoyez les justificatifs et corrigez uniquement les saisies erronees.',
    where: 'Module Comptabilite > Ecritures.',
  },
  round_amounts: {
    why: 'Les montants ronds peuvent etre normaux selon le secteur ou la devise.',
    how: 'Verifiez les pieces des ecritures signalees et documentez les estimations.',
    where: 'Module Comptabilite > Ecritures.',
  },
  rarely_used_accounts: {
    why: 'Un compte peu utilise peut etre legitime pour un cas ponctuel.',
    how: 'Verifiez la coherence du code compte avec le plan comptable et la piece.',
    where: 'Module Comptabilite > Plan comptable.',
  },
  bank_reconciliation: {
    why: 'Le rapprochement bancaire depend de la nature de chaque transaction.',
    how: 'Lancez le rapprochement auto puis traitez manuellement les lignes restantes.',
    where: 'Module Banque > Rapprochement.',
  },
};

const DEFAULT_GUIDANCE = {
  why: 'Cette correction demande une validation metier avant modification des donnees comptables.',
  how: 'Utilisez la recommandation d audit puis corrigez depuis le module source.',
  where: 'Module Comptabilite.',
};

const collectOpenIssues = (result) => {
  if (!result?.categories) return [];
  const issues = [];

  Object.entries(result.categories).forEach(([categoryKey, category]) => {
    (category?.checks || []).forEach((check) => {
      if (check.status === 'pass') return;
      issues.push({
        ...check,
        category_key: categoryKey,
        category_label: category?.label || categoryKey,
      });
    });
  });

  const severityOrder = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => {
    const sa = severityOrder[a.severity] ?? 9;
    const sb = severityOrder[b.severity] ?? 9;
    if (sa !== sb) return sa - sb;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
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
        {check.status === 'pass' ? (
          <span className="text-xs px-2 py-0.5 rounded bg-green-400/10 text-green-400">ok</span>
        ) : (
          <span className={`text-xs px-2 py-0.5 rounded ${
            check.severity === 'error' ? 'bg-red-400/10 text-red-400' :
            check.severity === 'warning' ? 'bg-yellow-400/10 text-yellow-400' :
            'bg-blue-400/10 text-blue-400'
          }`}>{check.severity === 'error' ? 'erreur' : check.severity === 'warning' ? 'alerte' : 'info'}</span>
        )}
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
  const { toast } = useToast();
  const {
    auditResult,
    loading,
    error,
    runAudit,
    applyAutoFixes,
    fixing,
    fixReport,
  } = useAuditComptable(false);
  const presets = useMemo(() => getPeriodPresets(), []);
  const [periodStart, setPeriodStart] = useState(presets[0].start);
  const [periodEnd, setPeriodEnd] = useState(presets[0].end);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);

  const handleRunAudit = () => runAudit(periodStart, periodEnd);

  const allOpenIssues = useMemo(() => collectOpenIssues(auditResult), [auditResult]);
  const autoFixableIssues = useMemo(
    () => allOpenIssues.filter((issue) => AUTO_FIXABLE_CHECKS.has(issue.id)),
    [allOpenIssues],
  );
  const manualIssues = useMemo(
    () => allOpenIssues.filter((issue) => !AUTO_FIXABLE_CHECKS.has(issue.id)),
    [allOpenIssues],
  );

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

  const handleAutoFix = async () => {
    if (!auditResult) return;
    const response = await applyAutoFixes({
      auditSnapshot: auditResult,
      periodStart,
      periodEnd,
    });

    if (!response?.report) return;

    if (response.report.totals.failed_steps > 0) {
      toast({
        title: 'Correction automatique incomplete',
        description: 'Une ou plusieurs corrections automatiques ont echoue. Consultez le detail ci-dessous.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Correction automatique terminee',
      description: `${response.report.totals.affected_records} element(s) corrige(s) automatiquement.`,
    });

    const refreshedManualCount = collectOpenIssues(response.refreshedAudit)
      .filter((issue) => !AUTO_FIXABLE_CHECKS.has(issue.id)).length;
    if (refreshedManualCount > 0) {
      setManualDialogOpen(true);
    }
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
            <div className="flex flex-wrap gap-2 ml-auto w-full sm:w-auto">
              {auditResult && (
                <Button size="sm" variant="outline" onClick={handleDownload}
                  className="border-gray-600 hover:bg-gray-700 text-gray-300">
                  <Download className="w-4 h-4 mr-2" /> Telecharger
                </Button>
              )}
              {auditResult && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setManualDialogOpen(true)}
                  disabled={manualIssues.length === 0}
                  className="border-gray-600 hover:bg-gray-700 text-gray-300"
                >
                  <Info className="w-4 h-4 mr-2" />
                  {manualIssues.length > 0
                    ? `Actions manuelles (${manualIssues.length})`
                    : 'Actions manuelles'}
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

            <div className="glass-card rounded-2xl p-4 sm:p-5 border border-white/5 mb-6">
              <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <div>
                  <p className="text-white font-semibold">Correction intelligente post-audit</p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1">
                    {autoFixableIssues.length > 0
                      ? `${autoFixableIssues.length} point(s) peuvent etre corriges automatiquement.`
                      : 'Aucune correction automatique disponible pour les points restants.'}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <Button
                    size="sm"
                    onClick={handleAutoFix}
                    disabled={loading || fixing || autoFixableIssues.length === 0}
                    className="bg-green-500 hover:bg-green-600 text-white w-full sm:w-auto"
                  >
                    {fixing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                    {fixing ? 'Correction en cours...' : `Corriger automatiquement (${autoFixableIssues.length})`}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setManualDialogOpen(true)}
                    disabled={manualIssues.length === 0}
                    className="border-gray-600 hover:bg-gray-700 text-gray-300 w-full sm:w-auto"
                  >
                    <Wrench className="w-4 h-4 mr-2" />
                    {manualIssues.length > 0
                      ? `Corrections manuelles (${manualIssues.length})`
                      : 'Corrections manuelles'}
                  </Button>
                </div>
              </div>
            </div>

            {fixReport && (
              <div className="glass-card rounded-2xl p-4 sm:p-5 border border-white/5 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <h3 className="text-base sm:text-lg font-semibold text-white">Derniere correction automatique</h3>
                  <span className="text-xs text-gray-500">
                    {fixReport.totals.affected_records} element(s) ajustes
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {fixReport.steps.map((step) => (
                    <div
                      key={`${step.check_id}-${step.label}`}
                      className={`rounded-lg border px-3 py-2 ${
                        step.status === 'applied'
                          ? 'border-green-500/20 bg-green-500/10'
                          : step.status === 'failed'
                            ? 'border-red-500/20 bg-red-500/10'
                            : 'border-gray-700 bg-gray-800/30'
                      }`}
                    >
                      <p className="text-xs text-gray-300 font-medium">{step.label}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{step.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

        <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader className="text-left">
              <DialogTitle className="text-xl text-white">
                Corrections manuelles recommandees
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Points detectes non corriges automatiquement, avec explications sur le pourquoi et le comment.
              </DialogDescription>
            </DialogHeader>

            {manualIssues.length === 0 ? (
              <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
                <p className="text-sm text-green-300">
                  Aucune correction manuelle restante sur les controles actuellement en echec.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
                {manualIssues.map((issue) => {
                  const guidance = MANUAL_GUIDANCE[issue.id] || DEFAULT_GUIDANCE;
                  return (
                    <div key={`${issue.category_key}-${issue.id}`} className="rounded-lg border border-white/10 bg-gray-800/40 p-3">
                      <div className="flex items-start gap-2">
                        <StatusIcon status={issue.status} className="w-4 h-4 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">{issue.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{issue.category_label}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${
                          issue.severity === 'error'
                            ? 'bg-red-400/20 text-red-300'
                            : issue.severity === 'warning'
                              ? 'bg-yellow-400/20 text-yellow-300'
                              : 'bg-blue-400/20 text-blue-300'
                        }`}>
                          {issue.severity}
                        </span>
                      </div>

                      <p className="text-xs text-gray-300 mt-2">{issue.details}</p>

                      <div className="mt-3 space-y-2">
                        <div className="rounded-md bg-black/20 border border-white/5 p-2">
                          <p className="text-[11px] text-gray-400">Pourquoi pas automatique</p>
                          <p className="text-xs text-gray-200 mt-1">{guidance.why}</p>
                        </div>
                        <div className="rounded-md bg-black/20 border border-white/5 p-2">
                          <p className="text-[11px] text-gray-400">Comment corriger</p>
                          <p className="text-xs text-gray-200 mt-1">{guidance.how}</p>
                        </div>
                        <div className="rounded-md bg-black/20 border border-white/5 p-2">
                          <p className="text-[11px] text-gray-400">Ou agir</p>
                          <p className="text-xs text-gray-200 mt-1">{guidance.where}</p>
                        </div>
                      </div>

                      {issue.recommendation && (
                        <p className="text-xs text-orange-300 mt-3">
                          Recommandation audit: {issue.recommendation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default AuditComptable;
