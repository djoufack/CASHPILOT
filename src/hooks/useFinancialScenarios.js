/**
 * Hook for Financial Scenarios Management
 * Provides CRUD operations, simulation execution, and scenario comparison
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { FinancialSimulationEngine } from '@/utils/scenarioSimulationEngine';

export function useFinancialScenarios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scenarios, setScenarios] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [simulationEngine] = useState(() => new FinancialSimulationEngine());

  // Fetch all scenarios for current user
  const fetchScenarios = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('financial_scenarios')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setScenarios(data || []);
    } catch (error) {
      console.error('Error fetching scenarios:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les scénarios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, supabase, toast]);

  // Fetch scenario templates
  const fetchTemplates = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('scenario_templates')
        .select('*')
        .or(`is_public.eq.true,user_id.eq.${user.id}`)
        .order('category');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }, [user, supabase]);

  // Initial data fetch
  useEffect(() => {
    fetchScenarios();
    fetchTemplates();
  }, [fetchScenarios, fetchTemplates]);

  // Create new scenario
  const createScenario = useCallback(async (scenarioData) => {
    if (!user) return null;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('financial_scenarios')
        .insert([{
          user_id: user.id,
          name: scenarioData.name,
          description: scenarioData.description,
          base_date: scenarioData.base_date,
          end_date: scenarioData.end_date,
          status: scenarioData.status || 'draft',
          is_baseline: scenarioData.is_baseline || false,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Scénario créé',
        description: `Le scénario "${data.name}" a été créé avec succès`,
      });

      await fetchScenarios();
      return data;
    } catch (error) {
      console.error('Error creating scenario:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le scénario',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, supabase, toast, fetchScenarios]);

  // Update scenario
  const updateScenario = useCallback(async (scenarioId, updates) => {
    if (!user) return null;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('financial_scenarios')
        .update(updates)
        .eq('id', scenarioId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Scénario mis à jour',
        description: 'Les modifications ont été enregistrées',
      });

      await fetchScenarios();
      return data;
    } catch (error) {
      console.error('Error updating scenario:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le scénario',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, supabase, toast, fetchScenarios]);

  // Delete scenario
  const deleteScenario = useCallback(async (scenarioId) => {
    if (!user) return false;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('financial_scenarios')
        .delete()
        .eq('id', scenarioId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Scénario supprimé',
        description: 'Le scénario a été supprimé avec succès',
      });

      await fetchScenarios();
      return true;
    } catch (error) {
      console.error('Error deleting scenario:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le scénario',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, supabase, toast, fetchScenarios]);

  // Get scenario with assumptions
  const getScenarioWithAssumptions = useCallback(async (scenarioId) => {
    if (!user) return null;

    try {
      const { data: scenario, error: scenarioError } = await supabase
        .from('financial_scenarios')
        .select('*')
        .eq('id', scenarioId)
        .eq('user_id', user.id)
        .single();

      if (scenarioError) throw scenarioError;

      const { data: assumptions, error: assumptionsError } = await supabase
        .from('scenario_assumptions')
        .select('*')
        .eq('scenario_id', scenarioId)
        .order('created_at');

      if (assumptionsError) throw assumptionsError;

      return {
        ...scenario,
        assumptions: assumptions || [],
      };
    } catch (error) {
      console.error('Error fetching scenario details:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les détails du scénario',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, supabase, toast]);

  // Add assumption to scenario
  const addAssumption = useCallback(async (scenarioId, assumptionData) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('scenario_assumptions')
        .insert([{
          scenario_id: scenarioId,
          name: assumptionData.name,
          description: assumptionData.description,
          category: assumptionData.category,
          assumption_type: assumptionData.assumption_type,
          parameters: assumptionData.parameters,
          start_date: assumptionData.start_date,
          end_date: assumptionData.end_date,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Hypothèse ajoutée',
        description: `L'hypothèse "${data.name}" a été ajoutée au scénario`,
      });

      return data;
    } catch (error) {
      console.error('Error adding assumption:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter l\'hypothèse',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, supabase, toast]);

  // Update assumption
  const updateAssumption = useCallback(async (assumptionId, updates) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('scenario_assumptions')
        .update(updates)
        .eq('id', assumptionId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Hypothèse mise à jour',
        description: 'Les modifications ont été enregistrées',
      });

      return data;
    } catch (error) {
      console.error('Error updating assumption:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour l\'hypothèse',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, supabase, toast]);

  // Delete assumption
  const deleteAssumption = useCallback(async (assumptionId) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('scenario_assumptions')
        .delete()
        .eq('id', assumptionId);

      if (error) throw error;

      toast({
        title: 'Hypothèse supprimée',
        description: 'L\'hypothèse a été supprimée avec succès',
      });

      return true;
    } catch (error) {
      console.error('Error deleting assumption:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'hypothèse',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, supabase, toast]);

  // Run simulation
  const runSimulation = useCallback(async (scenarioId, currentFinancialState) => {
    if (!user) return null;

    try {
      setLoading(true);

      // Fetch scenario with assumptions
      const scenarioData = await getScenarioWithAssumptions(scenarioId);
      if (!scenarioData) return null;

      // Run simulation using the engine
      const results = await simulationEngine.simulateScenario(
        scenarioData,
        scenarioData.assumptions,
        currentFinancialState
      );

      // Save results to database
      const resultsToInsert = results.map(result => ({
        scenario_id: scenarioId,
        calculation_date: result.date,
        period_label: result.period_label,
        metrics: {
          revenue: result.revenue,
          expenses: result.expenses,
          grossMargin: result.grossMargin,
          ebitda: result.ebitda,
          ebitdaMargin: result.ebitdaMargin,
          depreciation: result.depreciation,
          operatingResult: result.operatingResult,
          operatingMargin: result.operatingMargin,
          netIncome: result.netIncome,
          netMargin: result.netMargin,
          caf: result.caf,
          bfrChange: result.bfrChange,
          operatingCashFlow: result.operatingCashFlow,
          cashBalance: result.cashBalance,
          currentAssets: result.currentAssets,
          fixedAssets: result.fixedAssets,
          totalAssets: result.totalAssets,
          currentLiabilities: result.currentLiabilities,
          debt: result.debt,
          totalLiabilities: result.totalLiabilities,
          equity: result.equity,
          bfr: result.bfr,
          currentRatio: result.currentRatio,
          quickRatio: result.quickRatio,
          cashRatio: result.cashRatio,
          debtToEquity: result.debtToEquity,
          roe: result.roe,
          roce: result.roce,
        },
      }));

      // Delete existing results for this scenario
      await supabase
        .from('scenario_results')
        .delete()
        .eq('scenario_id', scenarioId);

      // Insert new results
      const { error: insertError } = await supabase
        .from('scenario_results')
        .insert(resultsToInsert);

      if (insertError) throw insertError;

      // Update scenario status to 'completed'
      await updateScenario(scenarioId, { status: 'completed' });

      toast({
        title: 'Simulation terminée',
        description: `${results.length} périodes calculées avec succès`,
      });

      return results;
    } catch (error) {
      console.error('Error running simulation:', error);
      toast({
        title: 'Erreur de simulation',
        description: error.message || 'Impossible d\'exécuter la simulation',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, supabase, toast, simulationEngine, getScenarioWithAssumptions, updateScenario]);

  // Get scenario results
  const getScenarioResults = useCallback(async (scenarioId) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('scenario_results')
        .select('*')
        .eq('scenario_id', scenarioId)
        .order('calculation_date');

      if (error) throw error;

      // Transform results to flat structure
      return data.map(result => ({
        date: result.calculation_date,
        period_label: result.period_label,
        ...result.metrics,
      }));
    } catch (error) {
      console.error('Error fetching scenario results:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les résultats',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, supabase, toast]);

  // Compare two scenarios
  const compareScenarios = useCallback(async (scenario1Id, scenario2Id) => {
    if (!user) return null;

    try {
      setLoading(true);

      // Fetch results for both scenarios
      const results1 = await getScenarioResults(scenario1Id);
      const results2 = await getScenarioResults(scenario2Id);

      if (!results1 || !results2) {
        throw new Error('Impossible de charger les résultats des scénarios');
      }

      // Use simulation engine to compare
      const comparison = simulationEngine.compareScenarios(results1, results2);

      // Save comparison to database
      const { data, error } = await supabase
        .from('scenario_comparisons')
        .insert([{
          user_id: user.id,
          name: `Comparaison ${new Date().toLocaleDateString()}`,
          scenario_ids: [scenario1Id, scenario2Id],
          comparison_metrics: comparison,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Comparaison effectuée',
        description: 'Les scénarios ont été comparés avec succès',
      });

      return comparison;
    } catch (error) {
      console.error('Error comparing scenarios:', error);
      toast({
        title: 'Erreur de comparaison',
        description: error.message || 'Impossible de comparer les scénarios',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, supabase, toast, simulationEngine, getScenarioResults]);

  // Create scenario from template
  const createFromTemplate = useCallback(async (templateId, scenarioName, baseDate, endDate) => {
    if (!user) return null;

    try {
      setLoading(true);

      // Fetch template
      const { data: template, error: templateError } = await supabase
        .from('scenario_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      // Create scenario
      const scenario = await createScenario({
        name: scenarioName || template.name,
        description: template.description,
        base_date: baseDate,
        end_date: endDate,
        status: 'draft',
      });

      if (!scenario) return null;

      // Add assumptions from template
      const defaultAssumptions = template.default_assumptions || [];
      for (const assumption of defaultAssumptions) {
        await addAssumption(scenario.id, {
          name: assumption.name || `Hypothèse ${assumption.type}`,
          description: assumption.description || '',
          category: assumption.category,
          assumption_type: assumption.type,
          parameters: assumption.parameters || {},
          start_date: baseDate,
          end_date: endDate,
        });
      }

      toast({
        title: 'Scénario créé depuis le template',
        description: `Le scénario "${scenario.name}" a été créé avec ${defaultAssumptions.length} hypothèses`,
      });

      return scenario;
    } catch (error) {
      console.error('Error creating from template:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le scénario depuis le template',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, supabase, toast, createScenario, addAssumption]);

  return {
    // State
    scenarios,
    templates,
    loading,

    // CRUD operations
    fetchScenarios,
    createScenario,
    updateScenario,
    deleteScenario,
    getScenarioWithAssumptions,

    // Assumptions
    addAssumption,
    updateAssumption,
    deleteAssumption,

    // Simulation
    runSimulation,
    getScenarioResults,
    compareScenarios,

    // Templates
    createFromTemplate,
  };
}

export default useFinancialScenarios;
