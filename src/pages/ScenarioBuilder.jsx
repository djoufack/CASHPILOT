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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  BarChart3,
  GitCompare,
} from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import useFinancialScenarios from '@/hooks/useFinancialScenarios';
import { Badge } from '@/components/ui/badge';
import ScenarioComparison from '@/components/scenarios/ScenarioComparison';

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

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(addMonths(new Date(), 12), 'yyyy-MM-dd'),
  });

  // Template icons mapping
  const templateIcons = {
    TrendingUp,
    Users,
    DollarSign,
    Zap,
    ArrowUp,
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

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Create blank scenario
  const handleCreateScenario = async () => {
    const result = await createScenario(formData);
    if (result) {
      setIsCreateDialogOpen(false);
      setFormData({
        name: '',
        description: '',
        base_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(addMonths(new Date(), 12), 'yyyy-MM-dd'),
      });
      navigate(`/scenarios/${result.id}`);
    }
  };

  // Create scenario from template
  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return;

    const result = await createFromTemplate(
      selectedTemplate.id,
      `${selectedTemplate.name} - ${format(new Date(), 'dd/MM/yyyy')}`,
      formData.base_date,
      formData.end_date
    );

    if (result) {
      setIsTemplateDialogOpen(false);
      setSelectedTemplate(null);
      navigate(`/scenarios/${result.id}`);
    }
  };

  // Delete scenario with confirmation
  const handleDeleteScenario = async (scenarioId, scenarioName) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le scénario "${scenarioName}" ?`)) {
      await deleteScenario(scenarioId);
    }
  };

  // Navigate to scenario details
  const handleOpenScenario = (scenarioId) => {
    navigate(`/scenarios/${scenarioId}`);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Simulations Financières
            </h1>
            <p className="text-gray-600">
              Créez et analysez des scénarios de projection financière
            </p>
          </div>

          <div className="flex gap-3">
            {/* Create from template button */}
            <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Depuis un template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Choisir un template de scénario</DialogTitle>
                  <DialogDescription>
                    Sélectionnez un template prédéfini pour démarrer rapidement
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                  {templates.map(template => {
                    const Icon = templateIcons[template.icon] || BarChart3;
                    const isSelected = selectedTemplate?.id === template.id;

                    return (
                      <Card
                        key={template.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          isSelected ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <CardHeader>
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                              <Icon className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg">{template.name}</CardTitle>
                              <CardDescription className="mt-1">
                                {template.description}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Badge variant="outline">{template.category}</Badge>
                            <span>•</span>
                            <span>
                              {template.suggested_duration_months || 12} mois suggérés
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {selectedTemplate && (
                  <div className="space-y-4 border-t pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="template_base_date">Date de début</Label>
                        <Input
                          id="template_base_date"
                          name="base_date"
                          type="date"
                          value={formData.base_date}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div>
                        <Label htmlFor="template_end_date">Date de fin</Label>
                        <Input
                          id="template_end_date"
                          name="end_date"
                          type="date"
                          value={formData.end_date}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsTemplateDialogOpen(false);
                      setSelectedTemplate(null);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleCreateFromTemplate}
                    disabled={!selectedTemplate}
                  >
                    Créer le scénario
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Create blank scenario button */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Nouveau scénario
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un nouveau scénario</DialogTitle>
                  <DialogDescription>
                    Définissez les paramètres de base de votre simulation financière
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="name">Nom du scénario *</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Ex: Croissance aggressive 2026"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Décrivez les objectifs et contexte de ce scénario..."
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="base_date">Date de début *</Label>
                      <Input
                        id="base_date"
                        name="base_date"
                        type="date"
                        value={formData.base_date}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="end_date">Date de fin *</Label>
                      <Input
                        id="end_date"
                        name="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleCreateScenario}
                    disabled={!formData.name || !formData.base_date || !formData.end_date}
                  >
                    Créer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="scenarios" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="scenarios" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Mes Scénarios
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <GitCompare className="w-4 h-4" />
            Comparaison
          </TabsTrigger>
        </TabsList>

        {/* Scenarios List Tab */}
        <TabsContent value="scenarios" className="space-y-6">
          {loading && scenarios.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Chargement des scénarios...</p>
            </div>
          ) : scenarios.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Aucun scénario créé
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Créez votre premier scénario de simulation financière pour projeter
              l'évolution de votre entreprise
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Créer mon premier scénario
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map(scenario => (
            <Card
              key={scenario.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleOpenScenario(scenario.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{scenario.name}</CardTitle>
                      {scenario.is_baseline && (
                        <Badge variant="secondary" className="text-xs">
                          Référence
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {scenario.description || 'Aucune description'}
                    </CardDescription>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleOpenScenario(scenario.id);
                      }}>
                        <Edit className="w-4 h-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement duplicate
                      }}>
                        <Copy className="w-4 h-4 mr-2" />
                        Dupliquer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteScenario(scenario.id, scenario.name);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {/* Status badge */}
                  <div>
                    <Badge className={statusColors[scenario.status]}>
                      {statusLabels[scenario.status]}
                    </Badge>
                  </div>

                  {/* Date range */}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {format(new Date(scenario.base_date), 'dd MMM yyyy', { locale: fr })}
                      {' → '}
                      {format(new Date(scenario.end_date), 'dd MMM yyyy', { locale: fr })}
                    </span>
                  </div>

                  {/* Action button */}
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenScenario(scenario.id);
                    }}
                  >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    {scenario.status === 'draft' ? 'Configurer' : 'Voir les résultats'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          <ScenarioComparison scenarios={scenarios} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScenarioBuilder;
