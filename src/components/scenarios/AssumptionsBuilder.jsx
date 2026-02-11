/**
 * Assumptions Builder Component
 * Interface for creating and managing scenario assumptions with templates
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  DollarSign,
  Calendar,
  Percent,
  Users,
} from 'lucide-react';
import useFinancialScenarios from '@/hooks/useFinancialScenarios';
import { useCompany } from '@/hooks/useCompany';
import { getCurrencySymbol } from '@/utils/currencyService';

const AssumptionsBuilder = ({ scenarioId, assumptions, onAssumptionsChanged }) => {
  const { addAssumption, updateAssumption, deleteAssumption } = useFinancialScenarios();
  const { company } = useCompany();

  // Get company currency symbol
  const currencySymbol = getCurrencySymbol(company?.currency || 'EUR');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssumption, setEditingAssumption] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    assumption_type: '',
    parameters: {},
    start_date: '',
    end_date: '',
  });

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      assumption_type: '',
      parameters: {},
      start_date: '',
      end_date: '',
    });
    setEditingAssumption(null);
  };

  // Open dialog for new assumption
  const handleAddNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Open dialog for editing
  const handleEdit = (assumption) => {
    setEditingAssumption(assumption);
    setFormData({
      name: assumption.name,
      description: assumption.description || '',
      category: assumption.category,
      assumption_type: assumption.assumption_type,
      parameters: assumption.parameters || {},
      start_date: assumption.start_date || '',
      end_date: assumption.end_date || '',
    });
    setIsDialogOpen(true);
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle parameter changes
  const handleParameterChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [key]: value,
      },
    }));
  };

  // Save assumption
  const handleSave = async () => {
    if (editingAssumption) {
      await updateAssumption(editingAssumption.id, formData);
    } else {
      await addAssumption(scenarioId, formData);
    }

    setIsDialogOpen(false);
    resetForm();
    onAssumptionsChanged();
  };

  // Delete assumption
  const handleDelete = async (assumptionId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette hypothèse ?')) {
      await deleteAssumption(assumptionId);
      onAssumptionsChanged();
    }
  };

  // Category options
  const categoryOptions = [
    { value: 'revenue', label: 'Chiffre d\'affaires', icon: TrendingUp },
    { value: 'expense', label: 'Dépenses', icon: DollarSign },
    { value: 'salaries', label: 'Salaires', icon: Users },
    { value: 'social_charges', label: 'Charges sociales', icon: Percent },
    { value: 'investment', label: 'Investissement', icon: DollarSign },
    { value: 'equipment', label: 'Équipement', icon: DollarSign },
    { value: 'pricing', label: 'Tarification', icon: Percent },
    { value: 'expense_reduction', label: 'Réduction de coûts', icon: TrendingUp },
    { value: 'payment_terms', label: 'Conditions de paiement', icon: Calendar },
    { value: 'working_capital', label: 'BFR', icon: DollarSign },
  ];

  // Type options
  const typeOptions = [
    { value: 'growth_rate', label: 'Taux de croissance' },
    { value: 'fixed_amount', label: 'Montant fixe' },
    { value: 'recurring', label: 'Récurrent' },
    { value: 'one_time', label: 'Ponctuel' },
    { value: 'percentage_change', label: 'Variation en %' },
  ];

  // Category badge colors
  const categoryColors = {
    revenue: 'bg-green-100 text-green-800',
    expense: 'bg-red-100 text-red-800',
    salaries: 'bg-blue-100 text-blue-800',
    social_charges: 'bg-purple-100 text-purple-800',
    investment: 'bg-orange-100 text-orange-800',
    equipment: 'bg-orange-100 text-orange-800',
    pricing: 'bg-yellow-100 text-yellow-800',
    expense_reduction: 'bg-green-100 text-green-800',
    payment_terms: 'bg-indigo-100 text-indigo-800',
    working_capital: 'bg-cyan-100 text-cyan-800',
  };

  // Type badge colors
  const typeColors = {
    growth_rate: 'bg-blue-50 text-blue-700',
    fixed_amount: 'bg-gray-50 text-gray-700',
    recurring: 'bg-purple-50 text-purple-700',
    one_time: 'bg-orange-50 text-orange-700',
    percentage_change: 'bg-green-50 text-green-700',
  };

  // Render parameter inputs based on assumption type
  const renderParameterInputs = () => {
    switch (formData.assumption_type) {
      case 'growth_rate':
        return (
          <div>
            <Label htmlFor="rate">Taux de croissance (%) *</Label>
            <Input
              id="rate"
              type="number"
              step="0.1"
              value={formData.parameters.rate || ''}
              onChange={(e) => handleParameterChange('rate', parseFloat(e.target.value))}
              placeholder="Ex: 10 pour 10%"
              required
            />
          </div>
        );

      case 'fixed_amount':
      case 'recurring':
        return (
          <div>
            <Label htmlFor="amount">Montant ({currencySymbol}) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.parameters.amount || ''}
              onChange={(e) => handleParameterChange('amount', parseFloat(e.target.value))}
              placeholder="Ex: 5000"
              required
            />
          </div>
        );

      case 'one_time':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Montant ({currencySymbol}) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.parameters.amount || ''}
                onChange={(e) => handleParameterChange('amount', parseFloat(e.target.value))}
                placeholder="Ex: 50000"
                required
              />
            </div>
            <div>
              <Label htmlFor="date">Date de l'opération *</Label>
              <Input
                id="date"
                type="date"
                value={formData.parameters.date || ''}
                onChange={(e) => handleParameterChange('date', e.target.value)}
                required
              />
            </div>
          </div>
        );

      case 'percentage_change':
        return (
          <div>
            <Label htmlFor="rate">Variation (%) *</Label>
            <Input
              id="rate"
              type="number"
              step="0.1"
              value={formData.parameters.rate || ''}
              onChange={(e) => handleParameterChange('rate', parseFloat(e.target.value))}
              placeholder="Ex: 15 pour +15% ou -10 pour -10%"
              required
            />
          </div>
        );

      case 'payment_terms':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_days">Délai client (jours)</Label>
              <Input
                id="customer_days"
                type="number"
                value={formData.parameters.customer_days || ''}
                onChange={(e) => handleParameterChange('customer_days', parseInt(e.target.value))}
                placeholder="Ex: 45"
              />
            </div>
            <div>
              <Label htmlFor="supplier_days">Délai fournisseur (jours)</Label>
              <Input
                id="supplier_days"
                type="number"
                value={formData.parameters.supplier_days || ''}
                onChange={(e) => handleParameterChange('supplier_days', parseInt(e.target.value))}
                placeholder="Ex: 60"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Format parameter display
  const formatParameters = (params, type) => {
    if (!params) return '-';

    switch (type) {
      case 'growth_rate':
      case 'percentage_change':
        return `${params.rate > 0 ? '+' : ''}${params.rate}%`;

      case 'fixed_amount':
      case 'recurring':
      case 'one_time':
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR',
        }).format(params.amount || 0);

      case 'payment_terms':
        return `Clients: ${params.customer_days || 0}j, Fournisseurs: ${params.supplier_days || 0}j`;

      default:
        return JSON.stringify(params);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Hypothèses de simulation</CardTitle>
              <CardDescription>
                Définissez les hypothèses qui vont influencer vos projections financières
              </CardDescription>
            </div>
            <Button onClick={handleAddNew}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une hypothèse
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {assumptions.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucune hypothèse définie
              </h3>
              <p className="text-gray-600 mb-6">
                Commencez par ajouter des hypothèses pour simuler l'évolution de votre entreprise
              </p>
              <Button onClick={handleAddNew}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter ma première hypothèse
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Paramètres</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assumptions.map(assumption => {
                  const categoryOption = categoryOptions.find(
                    opt => opt.value === assumption.category
                  );

                  return (
                    <TableRow key={assumption.id}>
                      <TableCell className="font-medium">
                        {assumption.name}
                        {assumption.description && (
                          <p className="text-xs text-gray-500 mt-1">
                            {assumption.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={categoryColors[assumption.category]}>
                          {categoryOption?.label || assumption.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={typeColors[assumption.assumption_type]}>
                          {typeOptions.find(t => t.value === assumption.assumption_type)?.label ||
                            assumption.assumption_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatParameters(assumption.parameters, assumption.assumption_type)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {assumption.start_date || assumption.end_date ? (
                          <>
                            {assumption.start_date || '∞'} → {assumption.end_date || '∞'}
                          </>
                        ) : (
                          'Toute la durée'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(assumption)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(assumption.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAssumption ? 'Modifier l\'hypothèse' : 'Ajouter une hypothèse'}
            </DialogTitle>
            <DialogDescription>
              Définissez les paramètres de votre hypothèse de simulation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div>
              <Label htmlFor="name">Nom de l'hypothèse *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Ex: Croissance du CA +10%"
                required
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Décrivez les détails de cette hypothèse..."
                rows={2}
              />
            </div>

            {/* Category and Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Catégorie *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="assumption_type">Type *</Label>
                <Select
                  value={formData.assumption_type}
                  onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, assumption_type: value, parameters: {} }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez..." />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dynamic parameter inputs */}
            {formData.assumption_type && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Paramètres</h4>
                {renderParameterInputs()}
              </div>
            )}

            {/* Date range (optional) */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Période d'application (optionnel)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Date de début</Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">Date de fin</Label>
                  <Input
                    id="end_date"
                    name="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Laissez vide pour appliquer l'hypothèse sur toute la durée du scénario
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !formData.name ||
                !formData.category ||
                !formData.assumption_type
              }
            >
              {editingAssumption ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssumptionsBuilder;
