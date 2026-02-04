/**
 * Scenario Detail Page
 * Shows scenario details, assumptions management, and simulation results
 */

import React, { useState, useEffect } from 'react';
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
  Save,
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
import AssumptionsBuilder from '@/components/scenarios/AssumptionsBuilder';
import SimulationResults from '@/components/scenarios/SimulationResults';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

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
  const { financialDiagnostic, balanceSheet } = useAccountingData();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();

  const [scenario, setScenario] = useState(null);
  const [assumptions, setAssumptions] = useState([]);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('assumptions');
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);

  // Load scenario details
  useEffect(() => {
    loadScenario();
  }, [scenarioId]);

  const loadScenario = async () => {
    const data = await getScenarioWithAssumptions(scenarioId);
    if (data) {
      setScenario(data);
      setAssumptions(data.assumptions || []);

      // Load results if scenario is completed
      if (data.status === 'completed') {
        const scenarioResults = await getScenarioResults(scenarioId);
        setResults(scenarioResults);
      }
    }
  };

  // Refresh assumptions list
  const handleAssumptionsChanged = async () => {
    await loadScenario();
  };

  // Run simulation
  const handleRunSimulation = async () => {
    if (!scenario) return;

    // Validate that we have financial data
    if (!financialDiagnostic || !balanceSheet) {
      toast({
        title: 'Données manquantes',
        description: 'Assurez-vous d\'avoir des données comptables avant de lancer une simulation',
        variant: 'destructive',
      });
      return;
    }

    // Build current financial state from diagnostic
    const currentFinancialState = {
      // Revenue components
      revenue: financialDiagnostic.margins?.revenue * 12 || 0,
      avgPrice: 100, // Default, could be calculated from invoices
      volume: (financialDiagnostic.margins?.revenue * 12) / 100 || 0,

      // Expense components
      expenses: financialDiagnostic.margins?.expenses * 12 || 0,
      fixedExpenses: financialDiagnostic.margins?.expenses * 12 * 0.6 || 0,
      variableExpenses: financialDiagnostic.margins?.expenses * 12 * 0.3 || 0,
      salaries: financialDiagnostic.margins?.expenses * 12 * 0.1 || 0,

      // Balance sheet items
      cash: balanceSheet.cash || 0,
      receivables: balanceSheet.receivables || 0,
      payables: balanceSheet.payables || 0,
      inventory: balanceSheet.inventory || 0,
      fixedAssets: balanceSheet.fixedAssets || 0,
      equity: balanceSheet.equity || 0,
      debt: balanceSheet.debt || 0,

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
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    archived: 'bg-orange-100 text-orange-800',
  };

  const statusLabels = {
    draft: 'Brouillon',
    active: 'Actif',
    completed: 'Complété',
    archived: 'Archivé',
  };

  if (loading && !scenario) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du scénario...</p>
        </div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Scénario introuvable
            </h3>
            <p className="text-gray-600 mb-6">
              Le scénario demandé n'existe pas ou vous n'y avez pas accès
            </p>
            <Button onClick={() => navigate('/scenarios')}>
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
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/scenarios')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux scénarios
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">
                {scenario.name}
              </h1>
              <Badge className={statusColors[scenario.status]}>
                {statusLabels[scenario.status]}
              </Badge>
              {scenario.is_baseline && (
                <Badge variant="secondary">Référence</Badge>
              )}
            </div>

            <p className="text-gray-600 mb-4">
              {scenario.description || 'Aucune description'}
            </p>

            <div className="flex items-center gap-4 text-sm text-gray-600">
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
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF ({CREDIT_COSTS.PDF_SCENARIO})
                </Button>
                <Button
                  onClick={handleExportHTML}
                  variant="outline"
                  size="lg"
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
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="assumptions" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Hypothèses
          </TabsTrigger>
          <TabsTrigger
            value="results"
            disabled={!results}
            className="flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Résultats
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-2">
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
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Aucun résultat disponible
                </h3>
                <p className="text-gray-600 mb-6">
                  Configurez vos hypothèses puis lancez la simulation pour voir les projections
                </p>
                <Button onClick={() => setActiveTab('assumptions')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Configurer les hypothèses
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Informations du scénario</CardTitle>
              <CardDescription>
                Détails et paramètres de la simulation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Nom</Label>
                    <p className="mt-1 text-sm text-gray-900">{scenario.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Statut</Label>
                    <p className="mt-1">
                      <Badge className={statusColors[scenario.status]}>
                        {statusLabels[scenario.status]}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Date de début</Label>
                    <p className="mt-1 text-sm text-gray-900">
                      {format(new Date(scenario.base_date), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Date de fin</Label>
                    <p className="mt-1 text-sm text-gray-900">
                      {format(new Date(scenario.end_date), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Créé le</Label>
                    <p className="mt-1 text-sm text-gray-900">
                      {format(new Date(scenario.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Modifié le</Label>
                    <p className="mt-1 text-sm text-gray-900">
                      {format(new Date(scenario.updated_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>

                {scenario.description && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Description</Label>
                    <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
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
