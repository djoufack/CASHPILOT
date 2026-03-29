/**
 * Assumptions Builder Component
 * Interface for creating and managing scenario assumptions with templates
 */

import { useState } from 'react';
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
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, TrendingUp, DollarSign, Calendar, Percent, Users } from 'lucide-react';
import useFinancialScenarios from '@/hooks/useFinancialScenarios';
import { useCompany } from '@/hooks/useCompany';
import { getCurrencySymbol } from '@/utils/currencyService';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';
import { SCENARIO_ALLOWED_TYPES_BY_CATEGORY, normalizeScenarioAssumption } from '@/utils/scenarioAssumptionRules';
import { getLocale } from '@/utils/dateLocale';

const AssumptionsBuilder = ({ scenarioId, assumptions, onAssumptionsChanged }) => {
  const { addAssumption, updateAssumption, deleteAssumption } = useFinancialScenarios();
  const { company } = useCompany();
  const companyCurrency = resolveAccountingCurrency(company);

  // Get company currency symbol
  const currencySymbol = getCurrencySymbol(companyCurrency);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssumption, setEditingAssumption] = useState(null);
  const [normalizationMessage, setNormalizationMessage] = useState('');

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
    setNormalizationMessage('');
  };

  // Open dialog for new assumption
  const handleAddNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Open dialog for editing
  const handleEdit = (assumption) => {
    const normalizedAssumption = normalizeScenarioAssumption(assumption);

    setEditingAssumption(assumption);
    setFormData({
      name: normalizedAssumption.name,
      description: normalizedAssumption.description || '',
      category: normalizedAssumption.category,
      assumption_type: normalizedAssumption.assumption_type,
      parameters: normalizedAssumption.parameters || {},
      start_date: normalizedAssumption.start_date || '',
      end_date: normalizedAssumption.end_date || '',
    });
    setNormalizationMessage(
      normalizedAssumption.wasNormalized
        ? 'Cette hypothèse héritée était incohérente. Le formulaire a été réajusté automatiquement avant modification.'
        : ''
    );
    setIsDialogOpen(true);
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle parameter changes
  const handleParameterChange = (key, value) => {
    setFormData((prev) => ({
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
    { value: 'revenue', label: "Chiffre d'affaires", icon: TrendingUp },
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
    { value: 'payment_terms', label: 'Conditions de paiement' },
  ];

  const allowedTypeValues =
    SCENARIO_ALLOWED_TYPES_BY_CATEGORY[formData.category] || typeOptions.map((option) => option.value);
  const availableTypeOptions = typeOptions.filter((option) => allowedTypeValues.includes(option.value));

  // Category badge colors
  const categoryColors = {
    revenue: 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    expense: 'border border-rose-400/20 bg-rose-500/10 text-rose-200',
    salaries: 'border border-blue-400/20 bg-blue-500/10 text-blue-200',
    social_charges: 'border border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-200',
    investment: 'border border-orange-400/20 bg-orange-500/10 text-orange-200',
    equipment: 'border border-orange-400/20 bg-orange-500/10 text-orange-200',
    pricing: 'border border-amber-400/20 bg-amber-500/10 text-amber-200',
    expense_reduction: 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    payment_terms: 'border border-indigo-400/20 bg-indigo-500/10 text-indigo-200',
    working_capital: 'border border-cyan-400/20 bg-cyan-500/10 text-cyan-200',
  };

  // Type badge colors
  const typeColors = {
    growth_rate: 'border border-blue-400/20 bg-blue-500/10 text-blue-200',
    fixed_amount: 'border border-slate-400/20 bg-slate-500/10 text-slate-200',
    recurring: 'border border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-200',
    one_time: 'border border-orange-400/20 bg-orange-500/10 text-orange-200',
    percentage_change: 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    payment_terms: 'border border-indigo-400/20 bg-indigo-500/10 text-indigo-200',
  };

  // Render parameter inputs based on assumption type
  const renderParameterInputs = () => {
    switch (formData.assumption_type) {
      case 'growth_rate':
        return (
          <div>
            <Label htmlFor="rate" className="text-slate-200">
              Taux de croissance (%) *
            </Label>
            <Input
              id="rate"
              type="number"
              step="0.1"
              value={formData.parameters.rate || ''}
              onChange={(e) => handleParameterChange('rate', parseFloat(e.target.value))}
              placeholder="Ex: 10 pour 10%"
              className="mt-2 border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
              required
            />
          </div>
        );

      case 'fixed_amount':
      case 'recurring':
        return (
          <div>
            <Label htmlFor="amount" className="text-slate-200">
              Montant ({currencySymbol}) *
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.parameters.amount || ''}
              onChange={(e) => handleParameterChange('amount', parseFloat(e.target.value))}
              placeholder="Ex: 5000"
              className="mt-2 border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
              required
            />
          </div>
        );

      case 'one_time':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount" className="text-slate-200">
                Montant ({currencySymbol}) *
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.parameters.amount || ''}
                onChange={(e) => handleParameterChange('amount', parseFloat(e.target.value))}
                placeholder="Ex: 50000"
                className="mt-2 border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <div>
              <Label htmlFor="date" className="text-slate-200">
                Date de l'opération *
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.parameters.date || ''}
                onChange={(e) => handleParameterChange('date', e.target.value)}
                className="mt-2 border-white/10 bg-slate-950 text-white"
                required
              />
            </div>
          </div>
        );

      case 'percentage_change':
        return (
          <div>
            <Label htmlFor="rate" className="text-slate-200">
              Variation (%) *
            </Label>
            <Input
              id="rate"
              type="number"
              step="0.1"
              value={formData.parameters.rate || ''}
              onChange={(e) => handleParameterChange('rate', parseFloat(e.target.value))}
              placeholder="Ex: 15 pour +15% ou -10 pour -10%"
              className="mt-2 border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
              required
            />
          </div>
        );

      case 'payment_terms':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_days" className="text-slate-200">
                Délai client (jours)
              </Label>
              <Input
                id="customer_days"
                type="number"
                value={formData.parameters.customer_days || ''}
                onChange={(e) => handleParameterChange('customer_days', parseInt(e.target.value))}
                placeholder="Ex: 45"
                className="mt-2 border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>
            <div>
              <Label htmlFor="supplier_days" className="text-slate-200">
                Délai fournisseur (jours)
              </Label>
              <Input
                id="supplier_days"
                type="number"
                value={formData.parameters.supplier_days || ''}
                onChange={(e) => handleParameterChange('supplier_days', parseInt(e.target.value))}
                placeholder="Ex: 60"
                className="mt-2 border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getBehaviorHint = () => {
    if (!formData.category || !formData.assumption_type) {
      return null;
    }

    if (formData.assumption_type === 'payment_terms') {
      return `Cette hypothèse agit sur le BFR et la trésorerie, pas sur la forme de la courbe de chiffre d'affaires.`;
    }

    if (
      ['revenue', 'pricing', 'expense', 'salaries', 'social_charges'].includes(formData.category) &&
      formData.assumption_type === 'fixed_amount'
    ) {
      if (formData.start_date && formData.end_date) {
        return 'Avec une date de début et une date de fin, le montant fixe devient une cible progressive atteinte en fin de période. Sans plage de dates, il reste constant.';
      }

      return 'Sans plage de dates, un montant fixe applique une cible mensuelle constante. Pour une courbe qui évolue, définissez une date de fin ou utilisez "Taux de croissance" / "Variation en %".';
    }

    if (
      ['revenue', 'pricing'].includes(formData.category) &&
      ['growth_rate', 'percentage_change'].includes(formData.assumption_type)
    ) {
      return 'Cette hypothèse fera évoluer la courbe mois après mois sur toute la période sélectionnée.';
    }

    if (formData.assumption_type === 'recurring') {
      return `Le montant s'ajoute à chaque mois de la simulation. Idéal pour un coût récurrent ou un revenu additionnel stable.`;
    }

    return null;
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
        return new Intl.NumberFormat(getLocale(), {
          style: 'currency',
          currency: companyCurrency,
        }).format(params.amount || 0);

      case 'payment_terms':
        return `Clients: ${params.customer_days || 0}j, Fournisseurs: ${params.supplier_days || 0}j`;

      default:
        return JSON.stringify(params);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-slate-950/80 text-white shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Hypothèses de simulation</CardTitle>
              <CardDescription className="text-slate-400">
                Définissez les hypothèses qui vont influencer vos projections financières
              </CardDescription>
            </div>
            <Button onClick={handleAddNew} className="bg-orange-500 text-white hover:bg-orange-600">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une hypothèse
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {assumptions.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Aucune hypothèse définie</h3>
              <p className="text-slate-400 mb-6">
                Commencez par ajouter des hypothèses pour simuler l'évolution de votre entreprise
              </p>
              <Button onClick={handleAddNew} className="bg-orange-500 text-white hover:bg-orange-600">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter ma première hypothèse
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-slate-300">Nom</TableHead>
                  <TableHead className="text-slate-300">Catégorie</TableHead>
                  <TableHead className="text-slate-300">Type</TableHead>
                  <TableHead className="text-slate-300">Paramètres</TableHead>
                  <TableHead className="text-slate-300">Période</TableHead>
                  <TableHead className="text-right text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assumptions.map((assumption) => {
                  const categoryOption = categoryOptions.find((opt) => opt.value === assumption.category);

                  return (
                    <TableRow key={assumption.id} className="border-white/10">
                      <TableCell className="font-medium text-white">
                        {assumption.name}
                        {assumption.description && (
                          <p className="text-xs text-slate-500 mt-1">{assumption.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={categoryColors[assumption.category]}>
                          {categoryOption?.label || assumption.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={typeColors[assumption.assumption_type]}>
                          {typeOptions.find((t) => t.value === assumption.assumption_type)?.label ||
                            assumption.assumption_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-200">
                        {formatParameters(assumption.parameters, assumption.assumption_type)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-400">
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
                            className="text-slate-300 hover:bg-white/5 hover:text-white"
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
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border border-white/10 bg-slate-950 text-white shadow-[0_40px_120px_rgba(2,6,23,0.75)]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingAssumption ? "Modifier l'hypothèse" : 'Ajouter une hypothèse'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Définissez les paramètres de votre hypothèse de simulation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {normalizationMessage && (
              <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {normalizationMessage}
              </div>
            )}

            {/* Name */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <Label htmlFor="name" className="text-slate-200">
                Nom de l'hypothèse *
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Ex: Croissance du CA +10%"
                className="mt-2 border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
                required
              />

              <div className="mt-4">
                <Label htmlFor="description" className="text-slate-200">
                  Description
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Décrivez les détails de cette hypothèse..."
                  rows={3}
                  className="mt-2 border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="category" className="text-slate-200">
                    Catégorie *
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => {
                      const nextAllowedTypes = SCENARIO_ALLOWED_TYPES_BY_CATEGORY[value] || [];
                      const nextType = nextAllowedTypes.includes(formData.assumption_type)
                        ? formData.assumption_type
                        : value === 'payment_terms'
                          ? 'payment_terms'
                          : nextAllowedTypes[0] || '';

                      setFormData((prev) => ({
                        ...prev,
                        category: value,
                        assumption_type: nextType,
                        parameters: nextType === prev.assumption_type ? prev.parameters : {},
                      }));
                    }}
                  >
                    <SelectTrigger className="mt-2 border-white/10 bg-slate-950 text-white">
                      <SelectValue placeholder="Sélectionnez..." />
                    </SelectTrigger>
                    <SelectContent className="z-[160] border-white/10 bg-slate-950 text-white">
                      {categoryOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="text-white focus:bg-white/10 focus:text-white"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="assumption_type" className="text-slate-200">
                    Type *
                  </Label>
                  <Select
                    value={formData.assumption_type}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, assumption_type: value, parameters: {} }))
                    }
                  >
                    <SelectTrigger className="mt-2 border-white/10 bg-slate-950 text-white">
                      <SelectValue placeholder="Sélectionnez..." />
                    </SelectTrigger>
                    <SelectContent className="z-[160] border-white/10 bg-slate-950 text-white">
                      {availableTypeOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="text-white focus:bg-white/10 focus:text-white"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.category && (
                    <p className="mt-2 text-xs text-slate-500">
                      Types disponibles pour cette catégorie:{' '}
                      {availableTypeOptions.map((option) => option.label).join(', ')}.
                    </p>
                  )}
                </div>
              </div>

              {getBehaviorHint() && (
                <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                  {getBehaviorHint()}
                </div>
              )}
            </div>

            {/* Dynamic parameter inputs */}
            {formData.assumption_type && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <h4 className="text-sm font-medium mb-3 text-white">Paramètres</h4>
                {renderParameterInputs()}
              </div>
            )}

            {/* Date range (optional) */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <h4 className="text-sm font-medium mb-3 text-white">Période d'application (optionnel)</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="start_date" className="text-slate-200">
                    Date de début
                  </Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    className="mt-2 border-white/10 bg-slate-950 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="end_date" className="text-slate-200">
                    Date de fin
                  </Label>
                  <Input
                    id="end_date"
                    name="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    className="mt-2 border-white/10 bg-slate-950 text-white"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Laissez vide pour appliquer l'hypothèse sur toute la durée du scénario. Pour un montant fixe progressif,
                renseignez une date de fin.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              className="bg-orange-500 text-white hover:bg-orange-600"
              disabled={!formData.name || !formData.category || !formData.assumption_type}
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
