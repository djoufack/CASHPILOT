/**
 * Scenario Builder Page
 * Main interface for creating and managing financial scenarios
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  TrendingUp,
  Users,
  DollarSign,
  Zap,
  ArrowUp,
  PlayCircle,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  FileText,
  Calendar,
  CalendarRange,
  BarChart3,
  GitCompare,
  Info,
  Sparkles,
} from 'lucide-react';
import { format, addMonths, differenceInCalendarDays, differenceInCalendarMonths, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import useFinancialScenarios from '@/hooks/useFinancialScenarios';
import { useCompany } from '@/hooks/useCompany';
import { Badge } from '@/components/ui/badge';
import ScenarioComparison from '@/components/scenarios/ScenarioComparison';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';

const DURATION_PRESETS = [12, 18, 24];

const getDefaultFormData = () => ({
  name: '',
  description: '',
  base_date: format(new Date(), 'yyyy-MM-dd'),
  end_date: format(addMonths(new Date(), 12), 'yyyy-MM-dd'),
});

const ScenarioBuilder = () => {
  const navigate = useNavigate();
  const {
    scenarios,
    templates,
    loading,
    createScenario,
    deleteScenario,
    createFromTemplate,
  } = useFinancialScenarios();
  const { company } = useCompany();
  const companyCurrency = resolveAccountingCurrency(company);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState(getDefaultFormData);

  const templateIcons = {
    TrendingUp,
    Users,
    DollarSign,
    Zap,
    ArrowUp,
  };

  const statusColors = {
    draft: 'border border-slate-400/20 bg-slate-500/15 text-slate-200',
    active: 'border border-blue-400/20 bg-blue-500/15 text-blue-200',
    completed: 'border border-emerald-400/20 bg-emerald-500/15 text-emerald-200',
    archived: 'border border-orange-400/20 bg-orange-500/15 text-orange-200',
  };

  const statusLabels = {
    draft: 'Brouillon',
    active: 'Actif',
    completed: 'Complété',
    archived: 'Archivé',
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const baseDateValue = formData.base_date ? parseISO(formData.base_date) : null;
  const endDateValue = formData.end_date ? parseISO(formData.end_date) : null;
  const hasValidDateRange = Boolean(
    baseDateValue &&
    endDateValue &&
    isValid(baseDateValue) &&
    isValid(endDateValue)
  );
  const hasInvalidDateRange = hasValidDateRange && endDateValue < baseDateValue;
  const durationMonths = hasValidDateRange && !hasInvalidDateRange
    ? differenceInCalendarMonths(endDateValue, baseDateValue)
    : null;
  const durationDays = hasValidDateRange && !hasInvalidDateRange
    ? differenceInCalendarDays(endDateValue, baseDateValue) + 1
    : null;
  const durationLabel = !hasValidDateRange || hasInvalidDateRange
    ? null
    : durationMonths >= 1
      ? `${durationMonths} mois de projection`
      : `${durationDays} jours de projection`;

  const handleApplyDurationPreset = (months) => {
    const base = baseDateValue && isValid(baseDateValue) ? baseDateValue : new Date();
    setFormData((prev) => ({
      ...prev,
      base_date: format(base, 'yyyy-MM-dd'),
      end_date: format(addMonths(base, months), 'yyyy-MM-dd'),
    }));
  };

  const resetCreateForm = () => {
    setFormData(getDefaultFormData());
  };

  const handleCreateScenario = async () => {
    if (hasInvalidDateRange) return;

    const result = await createScenario(formData);
    if (result) {
      setIsCreateDialogOpen(false);
      resetCreateForm();
      navigate(`/app/scenarios/${result.id}`);
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || hasInvalidDateRange) return;

    const result = await createFromTemplate(
      selectedTemplate.id,
      `${selectedTemplate.name} - ${format(new Date(), 'dd/MM/yyyy')}`,
      formData.base_date,
      formData.end_date
    );

    if (result) {
      setIsTemplateDialogOpen(false);
      setSelectedTemplate(null);
      navigate(`/app/scenarios/${result.id}`);
    }
  };

  const handleDeleteScenario = async (scenarioId, scenarioName) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le scénario "${scenarioName}" ?`)) {
      await deleteScenario(scenarioId);
    }
  };

  const handleOpenScenario = (scenarioId) => {
    navigate(`/app/scenarios/${scenarioId}`);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 text-white">
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="mb-2 text-4xl font-bold text-white">
              Simulations Financières
            </h1>
            <p className="text-slate-400">
              Créez des scénarios de projection, testez plusieurs hypothèses et comparez
              l’impact sur votre chiffre d’affaires, votre marge et votre trésorerie.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <FileText className="h-4 w-4" />
                  Depuis un template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto border-white/10 bg-slate-950 text-white">
                <DialogHeader>
                  <DialogTitle className="text-white">Choisir un template de scénario</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Sélectionnez un modèle prêt à l’emploi, puis ajustez sa période de projection.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2">
                  {templates.map((template) => {
                    const Icon = templateIcons[template.icon] || BarChart3;
                    const isSelected = selectedTemplate?.id === template.id;

                    return (
                      <Card
                        key={template.id}
                        className={`cursor-pointer border-white/10 bg-slate-900/70 transition-all hover:border-blue-400/40 hover:bg-slate-900 ${
                          isSelected ? 'border-blue-400/40 ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <CardHeader>
                          <div className="flex items-start gap-3">
                            <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-2">
                              <Icon className="h-6 w-6 text-blue-300" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg text-white">{template.name}</CardTitle>
                              <CardDescription className="mt-1 text-slate-400">
                                {template.description}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-200">
                              {template.category}
                            </Badge>
                            <span>•</span>
                            <span>{template.suggested_duration_months || 12} mois suggérés</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {selectedTemplate && (
                  <div className="space-y-4 border-t border-white/10 pt-4">
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4 text-sm text-slate-300">
                      Le template prépare la structure du scénario. Vous pourrez ensuite affiner
                      les hypothèses, les revenus, les coûts et la trésorerie dans l’écran de détail.
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {DURATION_PRESETS.map((months) => (
                        <Button
                          key={months}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyDurationPreset(months)}
                          className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        >
                          {months} mois
                        </Button>
                      ))}
                      {durationLabel && (
                        <span className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-200">
                          {durationLabel}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="template_base_date" className="text-slate-200">Date de début</Label>
                        <Input
                          id="template_base_date"
                          name="base_date"
                          type="date"
                          value={formData.base_date}
                          onChange={handleInputChange}
                          className="mt-2 border-white/10 bg-slate-900 text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="template_end_date" className="text-slate-200">Date de fin</Label>
                        <Input
                          id="template_end_date"
                          name="end_date"
                          type="date"
                          value={formData.end_date}
                          onChange={handleInputChange}
                          className="mt-2 border-white/10 bg-slate-900 text-white"
                        />
                      </div>
                    </div>

                    {hasInvalidDateRange && (
                      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                        La date de fin doit être postérieure à la date de début.
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      setIsTemplateDialogOpen(false);
                      setSelectedTemplate(null);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleCreateFromTemplate}
                    disabled={!selectedTemplate || hasInvalidDateRange}
                    className="bg-orange-500 text-white hover:bg-orange-600"
                  >
                    Créer le scénario
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2 bg-orange-500 text-white hover:bg-orange-600">
                  <Plus className="h-4 w-4" />
                  Nouveau scénario
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[720px] border-white/10 bg-slate-950 text-white">
                <DialogHeader>
                  <DialogTitle className="text-white">Créer un nouveau scénario</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Définissez les paramètres de base de votre simulation financière
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                      <Sparkles className="h-4 w-4 text-orange-300" />
                      Comment ça fonctionne
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">1. Identifier</p>
                        <p className="mt-1 text-sm text-slate-200">Donnez un nom clair au scénario pour le retrouver et le comparer.</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">2. Définir la période</p>
                        <p className="mt-1 text-sm text-slate-200">Choisissez l’horizon de projection adapté: 12, 18 ou 24 mois.</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">3. Configurer</p>
                        <p className="mt-1 text-sm text-slate-200">Vous serez ensuite redirigé pour saisir hypothèses, charges et trésorerie.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-cyan-300" />
                      <p className="text-sm font-medium text-white">Identité du scénario</p>
                    </div>

                    <div>
                      <Label htmlFor="name" className="text-slate-200">Nom du scénario *</Label>
                      <p className="mt-1 text-xs text-slate-500">Visible dans la liste, les comparaisons et les exports.</p>
                      <Input
                        id="name"
                        name="name"
                        placeholder="Ex: Croissance agressive 2026"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="mt-2 border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="description" className="text-slate-200">Description</Label>
                      <p className="mt-1 text-xs text-slate-500">Optionnel. Résumez l’objectif: hausse des prix, recrutement, stress trésorerie, etc.</p>
                      <Textarea
                        id="description"
                        name="description"
                        placeholder="Décrivez les objectifs et le contexte de ce scénario..."
                        value={formData.description}
                        onChange={handleInputChange}
                        className="mt-2 border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <div className="flex items-center gap-2">
                      <CalendarRange className="h-4 w-4 text-orange-300" />
                      <p className="text-sm font-medium text-white">Période de simulation</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {DURATION_PRESETS.map((months) => (
                        <Button
                          key={months}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyDurationPreset(months)}
                          className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        >
                          {months} mois
                        </Button>
                      ))}
                      {durationLabel && (
                        <span className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-200">
                          {durationLabel}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="base_date" className="text-slate-200">Date de début *</Label>
                        <p className="mt-1 text-xs text-slate-500">Point de départ de vos hypothèses et projections.</p>
                        <Input
                          id="base_date"
                          name="base_date"
                          type="date"
                          value={formData.base_date}
                          onChange={handleInputChange}
                          className="mt-2 border-white/10 bg-slate-950 text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="end_date" className="text-slate-200">Date de fin *</Label>
                        <p className="mt-1 text-xs text-slate-500">Fin de la projection à comparer avec vos autres scénarios.</p>
                        <Input
                          id="end_date"
                          name="end_date"
                          type="date"
                          value={formData.end_date}
                          onChange={handleInputChange}
                          className="mt-2 border-white/10 bg-slate-950 text-white"
                          required
                        />
                      </div>
                    </div>

                    {hasInvalidDateRange && (
                      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                        La date de fin doit être postérieure à la date de début.
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    Le scénario s’ouvrira ensuite sur l’écran de configuration détaillée.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={handleCreateScenario}
                      disabled={!formData.name || !formData.base_date || !formData.end_date || hasInvalidDateRange}
                      className="bg-orange-500 text-white hover:bg-orange-600"
                    >
                      Créer et configurer
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Tabs defaultValue="scenarios" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 border border-white/10 bg-slate-950/80">
          <TabsTrigger value="scenarios" className="flex items-center gap-2 text-slate-400 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
            <BarChart3 className="h-4 w-4" />
            Mes Scénarios
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2 text-slate-400 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
            <GitCompare className="h-4 w-4" />
            Comparaison
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="space-y-6">
          {loading && scenarios.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <p className="mt-4 text-slate-400">Chargement des scénarios...</p>
            </div>
          ) : scenarios.length === 0 ? (
            <Card className="border-white/10 bg-slate-950/70">
              <CardContent className="py-12 text-center">
                <BarChart3 className="mx-auto mb-4 h-16 w-16 text-slate-500" />
                <h3 className="mb-2 text-xl font-semibold text-white">
                  Aucun scénario créé
                </h3>
                <p className="mx-auto mb-6 max-w-md text-slate-400">
                  Créez votre premier scénario pour projeter l’évolution de votre entreprise
                  et mesurer rapidement l’effet de vos décisions.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-orange-500 text-white hover:bg-orange-600">
                  <Plus className="mr-2 h-4 w-4" />
                  Créer mon premier scénario
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {scenarios.map((scenario) => (
                <Card
                  key={scenario.id}
                  className="cursor-pointer border-white/10 bg-slate-950/70 transition-all hover:border-orange-400/30 hover:bg-slate-950 hover:shadow-lg"
                  onClick={() => handleOpenScenario(scenario.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <CardTitle className="text-lg text-white">{scenario.name}</CardTitle>
                          {scenario.is_baseline && (
                            <Badge variant="secondary" className="border border-orange-400/20 bg-orange-500/15 text-xs text-orange-200">
                              Référence
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="line-clamp-2 text-slate-400">
                          {scenario.description || 'Aucune description'}
                        </CardDescription>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-white/5 hover:text-white">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleOpenScenario(scenario.id);
                          }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                          }}>
                            <Copy className="mr-2 h-4 w-4" />
                            Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteScenario(scenario.id, scenario.name);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Badge className={statusColors[scenario.status]}>
                          {statusLabels[scenario.status]}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Calendar className="h-4 w-4 text-slate-500" />
                        <span>
                          {format(new Date(scenario.base_date), 'dd MMM yyyy', { locale: fr })}
                          {' → '}
                          {format(new Date(scenario.end_date), 'dd MMM yyyy', { locale: fr })}
                        </span>
                      </div>

                      <Button
                        variant="outline"
                        className="mt-4 w-full border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenScenario(scenario.id);
                        }}
                      >
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {scenario.status === 'draft' ? 'Configurer' : 'Voir les résultats'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <ScenarioComparison scenarios={scenarios} currency={companyCurrency} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScenarioBuilder;
