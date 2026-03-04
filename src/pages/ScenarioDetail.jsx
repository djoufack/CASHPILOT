/**
 * Scenario Detail Page
 * Shows scenario details, assumptions management, and simulation results
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  PlayCircle,
  Settings,
  BarChart3,
  FileText,
  Calendar,
  AlertCircle,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import useFinancialScenarios from '@/hooks/useFinancialScenarios';
import { useAccountingData } from '@/hooks/useAccountingData';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import {
  exportScenarioSimulationPDF,
  exportScenarioSimulationHTML,
} from '@/services/exportScenarioPDF';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';
import AssumptionsBuilder from '@/components/scenarios/AssumptionsBuilder';
import SimulationResults from '@/components/scenarios/SimulationResults';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { extractFinancialPosition } from '@/utils/financialMetrics';
import { resolvePilotageRegion } from '@/utils/pilotagePreferences';

function getAnnualizationFactor(startDate, endDate) {
  if (!startDate || !endDate) {
    return 1;
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const durationMs = end.getTime() - start.getTime();

  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return 1;
  }

  const periodDays = Math.max(1, Math.round(durationMs / 86400000) + 1);
  return 365 / periodDays;
}

const ScenarioDetail = () => {
  const { scenarioId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    getScenarioWithAssumptions,
    runSimulation,
    getScenarioResults,
    updateScenario,
    loading,
  } = useFinancialScenarios();

  // Get current financial state from accounting data
  const {
    financialDiagnostic,
    balanceSheet,
    totalExpenses,
    accountingSettings,
    period,
  } = useAccountingData();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();
  const scenarioCurrency = resolveAccountingCurrency(company);

  const [scenario, setScenario] = useState(null);
  const [assumptions, setAssumptions] = useState([]);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('assumptions');
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);

  // Load scenario details
  const loadScenario = useCallback(async () => {
    const data = await getScenarioWithAssumptions(scenarioId);
    if (data) {
      setScenario(data);
      setAssumptions(data.assumptions || []);

      // Load results if scenario is completed
      if (data.status === 'completed') {
        const scenarioResults = await getScenarioResults(scenarioId, {
          startDate: data.base_date,
          endDate: data.end_date,
        });
        setResults(scenarioResults);
      }
    }
  }, [getScenarioResults, getScenarioWithAssumptions, scenarioId]);

  useEffect(() => {
    loadScenario();
  }, [loadScenario]);

  // Refresh assumptions list
  const handleAssumptionsChanged = async () => {
    await loadScenario();
  };

  // Run simulation
  const handleRunSimulation = async () => {
    if (!scenario) return;

    // Validate that we have financial data
    if (!financialDiagnostic || financialDiagnostic.valid === false || !balanceSheet) {
      toast({
        title: 'Données manquantes',
        description: 'Assurez-vous d\'avoir des données comptables avant de lancer une simulation',
        variant: 'destructive',
      });
      return;
    }

    const annualizationFactor = getAnnualizationFactor(period?.startDate, period?.endDate);
    const annualRevenue = (financialDiagnostic.margins?.revenue || 0) * annualizationFactor;
    const annualExpenses = financialDiagnostic.margins
      ? Math.max(
          0,
          ((financialDiagnostic.margins.revenue || 0) - (financialDiagnostic.margins.ebitda || 0)) *
            annualizationFactor
        )
      : (totalExpenses || 0) * annualizationFactor;
    const scenarioRegion = resolvePilotageRegion({
      accountingCountry: accountingSettings?.country,
      companyCountry: company?.country,
    }).region;
    const financialPosition = extractFinancialPosition(balanceSheet, scenarioRegion);

    // Build current financial state from diagnostic
    const currentFinancialState = {
      // Revenue components
      revenue: annualRevenue,
      avgPrice: 100, // Default, could be calculated from invoices
      volume: annualRevenue / 100 || 0,

      // Expense components
      expenses: annualExpenses,
      fixedExpenses: annualExpenses * 0.6,
      variableExpenses: annualExpenses * 0.3,
      salaries: annualExpenses * 0.1,

      // Balance sheet items
      cash: financialPosition.cash || 0,
      receivables: financialPosition.receivables || 0,
      payables: financialPosition.tradePayables || 0,
      inventory: financialPosition.inventory || 0,
      fixedAssets: financialPosition.fixedAssets || 0,
      equity: financialPosition.equity || 0,
      debt: financialPosition.totalDebt || 0,

      // Working capital
      bfr: financialDiagnostic.financing?.bfr || 0,
    };

    try {
      setIsRunningSimulation(true);
      const simulationResults = await runSimulation(scenarioId, currentFinancialState);

      if (simulationResults) {
        setResults(simulationResults);
        setActiveTab('results');
        toast({
          title: 'Simulation terminée',
          description: `${simulationResults.length} périodes calculées avec succès`,
        });
      }
    } catch (error) {
      console.error('Simulation error:', error);
      toast({
        title: 'Erreur de simulation',
        description: error.message || 'Une erreur est survenue lors de la simulation',
        variant: 'destructive',
      });
    } finally {
      setIsRunningSimulation(false);
    }
  };

  // Export handlers
  const handleExportPDF = () => {
    if (!scenario || !results) return;
    guardedAction(
      CREDIT_COSTS.PDF_SCENARIO,
      'Scenario Simulation PDF',
      async () => {
        await exportScenarioSimulationPDF(scenario, results, assumptions);
        toast({
          title: 'Export réussi',
          description: 'Le rapport PDF a été téléchargé',
        });
      }
    );
  };

  const handleExportHTML = () => {
    if (!scenario || !results) return;
    guardedAction(
      CREDIT_COSTS.EXPORT_HTML,
      'Scenario Simulation HTML',
      () => {
        exportScenarioSimulationHTML(scenario, results, assumptions);
        toast({
          title: 'Export réussi',
          description: 'Le rapport HTML a été téléchargé',
        });
      }
    );
  };

  // Status colors
  const statusColors = {
    draft: 'border border-white/10 bg-white/5 text-slate-200',
    active: 'border border-blue-400/20 bg-blue-500/10 text-blue-200',
    completed: 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    archived: 'border border-orange-400/20 bg-orange-500/10 text-orange-200',
  };

  const statusLabels = {
    draft: 'Brouillon',
    active: 'Actif',
    completed: 'Complété',
    archived: 'Archivé',
  };

  if (loading && !scenario) {
    return (
      <div className="container mx-auto py-8 px-4 text-white">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-400">Chargement du scénario...</p>
        </div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="container mx-auto py-8 px-4 text-white">
        <Card className="border-white/10 bg-slate-950/80">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Scénario introuvable
            </h3>
            <p className="text-slate-400 mb-6">
              Le scénario demandé n'existe pas ou vous n'y avez pas accès
            </p>
            <Button onClick={() => navigate('/app/scenarios')} className="bg-orange-500 text-white hover:bg-orange-600">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux scénarios
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <CreditsGuardModal {...modalProps} />
      <div className="container mx-auto max-w-7xl px-4 py-8 text-white">
        {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/app/scenarios')}
          className="mb-4 text-slate-200 hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux scénarios
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">
                {scenario.name}
              </h1>
              <Badge className={statusColors[scenario.status]}>
                {statusLabels[scenario.status]}
              </Badge>
              {scenario.is_baseline && (
                <Badge variant="secondary">Référence</Badge>
              )}
            </div>

            <p className="text-slate-400 mb-4">
              {scenario.description || 'Aucune description'}
            </p>

            <div className="flex items-center gap-4 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  Du {format(new Date(scenario.base_date), 'dd MMMM yyyy', { locale: fr })}
                  {' au '}
                  {format(new Date(scenario.end_date), 'dd MMMM yyyy', { locale: fr })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>{assumptions.length} hypothèse(s)</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {results && (
              <>
                <Button
                  onClick={handleExportPDF}
                  variant="outline"
                  size="lg"
                  className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF ({CREDIT_COSTS.PDF_SCENARIO})
                </Button>
                <Button
                  onClick={handleExportHTML}
                  variant="outline"
                  size="lg"
                  className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  HTML ({CREDIT_COSTS.EXPORT_HTML})
                </Button>
              </>
            )}
            <Button
              onClick={handleRunSimulation}
              disabled={isRunningSimulation || assumptions.length === 0}
              size="lg"
              className="bg-orange-500 text-white hover:bg-orange-600 disabled:bg-slate-700 disabled:text-slate-300"
            >
              {isRunningSimulation ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Simulation en cours...
                </>
              ) : (
                <>
                  <PlayCircle className="w-5 h-5 mr-2" />
                  Lancer la simulation
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 grid w-full grid-cols-3 border border-white/10 bg-slate-950/80">
          <TabsTrigger value="assumptions" className="flex items-center gap-2 text-slate-400 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
            <Settings className="w-4 h-4" />
            Hypothèses
          </TabsTrigger>
          <TabsTrigger
            value="results"
            disabled={!results}
            className="flex items-center gap-2 text-slate-400 data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <BarChart3 className="w-4 h-4" />
            Résultats
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-2 text-slate-400 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
            <FileText className="w-4 h-4" />
            Informations
          </TabsTrigger>
        </TabsList>

        {/* Assumptions Tab */}
        <TabsContent value="assumptions">
          <AssumptionsBuilder
            scenarioId={scenarioId}
            assumptions={assumptions}
            onAssumptionsChanged={handleAssumptionsChanged}
          />
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results">
          {results ? (
            <SimulationResults
              scenario={scenario}
              results={results}
              assumptions={assumptions}
              currency={scenarioCurrency}
            />
          ) : (
            <Card className="border-white/10 bg-slate-950/80 text-white">
              <CardContent className="py-12 text-center">
                <BarChart3 className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  Aucun résultat disponible
                </h3>
                <p className="text-slate-400 mb-6">
                  Configurez vos hypothèses puis lancez la simulation pour voir les projections
                </p>
                <Button onClick={() => setActiveTab('assumptions')} className="bg-orange-500 text-white hover:bg-orange-600">
                  <Settings className="w-4 h-4 mr-2" />
                  Configurer les hypothèses
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info">
          <Card className="border-white/10 bg-slate-950/80 text-white">
            <CardHeader>
              <CardTitle className="text-white">Informations du scénario</CardTitle>
              <CardDescription className="text-slate-400">
                Détails et paramètres de la simulation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-500">Nom</Label>
                    <p className="mt-1 text-sm text-white">{scenario.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-500">Statut</Label>
                    <p className="mt-1">
                      <Badge className={statusColors[scenario.status]}>
                        {statusLabels[scenario.status]}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-500">Date de début</Label>
                    <p className="mt-1 text-sm text-white">
                      {format(new Date(scenario.base_date), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-500">Date de fin</Label>
                    <p className="mt-1 text-sm text-white">
                      {format(new Date(scenario.end_date), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-500">Créé le</Label>
                    <p className="mt-1 text-sm text-white">
                      {format(new Date(scenario.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-500">Modifié le</Label>
                    <p className="mt-1 text-sm text-white">
                      {format(new Date(scenario.updated_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>

                {scenario.description && (
                  <div>
                    <Label className="text-sm font-medium text-slate-500">Description</Label>
                    <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">
                      {scenario.description}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </>
  );
};

// Small Label component for info section
const Label = ({ children, className = '' }) => (
  <label className={`block ${className}`}>{children}</label>
);

export default ScenarioDetail;
