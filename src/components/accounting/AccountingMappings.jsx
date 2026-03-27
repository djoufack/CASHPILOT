import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAccounting } from '@/hooks/useAccounting';
import { useAccountingInit } from '@/hooks/useAccountingInit';
import { getAccountingMappingTemplates } from '@/services/referenceDataService';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle, ArrowRight, Settings, Zap, Loader2, Lightbulb } from 'lucide-react';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';

const EMPTY_FORM = {
  source_type: '',
  source_category: '',
  debit_account_code: '',
  credit_account_code: '',
  description: '',
};

const normalizeCountryCode = (countryCode) =>
  String(countryCode || '')
    .trim()
    .toUpperCase();

const MAPPINGS_INFO = {
  title: 'Mappings comptables',
  definition: 'Table de correspondance entre categories de transactions et comptes debit/credit.',
  dataSource:
    'Table `accounting_mappings` chargee via `useAccounting`, plus references `reference_accounting_source_*`.',
  formula: 'Ecriture auto = mapping(source_type, source_category) -> compte debit / compte credit',
  calculationMethod:
    'A chaque flux financier, le moteur applique la combinaison type/categorie pour determiner les comptes cibles.',
  notes: 'Les presets chargent des mappings standards par pays et mettent a jour les doublons type/categorie.',
};

const AccountingMappings = () => {
  const { accounts, mappings, fetchAccounts, fetchMappings, createMapping, deleteMapping, bulkCreateMappings } =
    useAccounting();
  const { country } = useAccountingInit();
  const { toast } = useToast();

  const [showDialog, setShowDialog] = useState(false);
  const [presetCountryCode, setPresetCountryCode] = useState(null);
  const [presetLoading, setPresetLoading] = useState(false);
  const [isSuggested, setIsSuggested] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [sourceTypes, setSourceTypes] = useState([]);
  const [sourceCategories, setSourceCategories] = useState([]);
  const [presetCountryCodes, setPresetCountryCodes] = useState([]);
  const [templateMappingsByCountry, setTemplateMappingsByCountry] = useState({});

  const activeCountryCode = normalizeCountryCode(country) || 'BE';

  const sourceTypesByCode = useMemo(
    () => Object.fromEntries(sourceTypes.map((item) => [item.code, item])),
    [sourceTypes]
  );

  const categoriesByType = useMemo(
    () =>
      sourceCategories.reduce((accumulator, category) => {
        if (!accumulator[category.source_type]) {
          accumulator[category.source_type] = [];
        }
        accumulator[category.source_type].push(category);
        return accumulator;
      }, {}),
    [sourceCategories]
  );

  const loadCountryTemplates = useCallback(
    async (countryCode, { force = false } = {}) => {
      const normalizedCode = normalizeCountryCode(countryCode);
      if (!normalizedCode) return [];

      if (!force && templateMappingsByCountry[normalizedCode]) {
        return templateMappingsByCountry[normalizedCode];
      }

      const templates = await getAccountingMappingTemplates(normalizedCode);
      const normalizedTemplates = (templates || []).map((template) => ({
        source_type: template.source_type,
        source_category: template.source_category,
        debit_account_code: template.debit_account_code,
        credit_account_code: template.credit_account_code,
        description: template.description || '',
      }));

      setTemplateMappingsByCountry((prev) => ({
        ...prev,
        [normalizedCode]: normalizedTemplates,
      }));

      return normalizedTemplates;
    },
    [templateMappingsByCountry]
  );

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      fetchAccounts();
      fetchMappings();

      if (!supabase) return;

      try {
        const _mapResults = await Promise.allSettled([
          supabase
            .from('reference_accounting_source_types')
            .select('code, label, sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('reference_accounting_source_categories')
            .select('source_type, code, label, sort_order')
            .eq('is_active', true)
            .order('source_type', { ascending: true })
            .order('sort_order', { ascending: true }),
          supabase.from('accounting_mapping_templates').select('country_code'),
        ]);

        const _mapLabels = ['sourceTypes', 'sourceCategories', 'templateCountries'];
        _mapResults.forEach((r, i) => {
          if (r.status === 'rejected') console.error(`AccountingMappings fetch "${_mapLabels[i]}" failed:`, r.reason);
        });

        const sourceTypesRes =
          _mapResults[0].status === 'fulfilled' ? _mapResults[0].value : { data: null, error: null };
        const sourceCategoriesRes =
          _mapResults[1].status === 'fulfilled' ? _mapResults[1].value : { data: null, error: null };
        const templateCountriesRes =
          _mapResults[2].status === 'fulfilled' ? _mapResults[2].value : { data: null, error: null };

        if (sourceTypesRes.error) console.error('AccountingMappings sourceTypes error:', sourceTypesRes.error);
        if (sourceCategoriesRes.error)
          console.error('AccountingMappings sourceCategories error:', sourceCategoriesRes.error);
        if (templateCountriesRes.error)
          console.error('AccountingMappings templateCountries error:', templateCountriesRes.error);

        if (!mounted) return;

        setSourceTypes(sourceTypesRes.data || []);
        setSourceCategories(sourceCategoriesRes.data || []);

        const distinctCountryCodes = Array.from(
          new Set(
            (templateCountriesRes.data || []).map((row) => normalizeCountryCode(row.country_code)).filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));

        setPresetCountryCodes(distinctCountryCodes);
      } catch (error) {
        console.error('Error loading accounting mapping references:', error);
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les catalogues de mappings comptables.',
          variant: 'destructive',
        });
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [fetchAccounts, fetchMappings, toast]);

  useEffect(() => {
    loadCountryTemplates(activeCountryCode).catch((error) => {
      console.error('Error loading templates for active country:', error);
    });
  }, [activeCountryCode, loadCountryTemplates]);

  useEffect(() => {
    if (!presetCountryCode) return;
    loadCountryTemplates(presetCountryCode).catch((error) => {
      console.error('Error loading templates for selected preset country:', error);
    });
  }, [presetCountryCode, loadCountryTemplates]);

  const getSuggestedMapping = useCallback(
    (sourceType, sourceCategory, countryCode) => {
      const normalizedCode = normalizeCountryCode(countryCode);
      if (!sourceType || !sourceCategory || !normalizedCode) return null;

      const templates = templateMappingsByCountry[normalizedCode] || [];
      return (
        templates.find((mapping) => mapping.source_type === sourceType && mapping.source_category === sourceCategory) ||
        null
      );
    },
    [templateMappingsByCountry]
  );

  useEffect(() => {
    if (!form.source_type || !form.source_category) return;

    const suggestion = getSuggestedMapping(form.source_type, form.source_category, activeCountryCode);
    if (suggestion) {
      setForm((prev) => ({
        ...prev,
        debit_account_code: suggestion.debit_account_code,
        credit_account_code: suggestion.credit_account_code,
        description: suggestion.description || '',
      }));
      setIsSuggested(true);
    }
  }, [activeCountryCode, form.source_category, form.source_type, getSuggestedMapping]);

  const getCategoriesForType = useCallback((type) => categoriesByType[type] || [], [categoriesByType]);

  const getSourceLabel = useCallback(
    (sourceType) => sourceTypesByCode[sourceType]?.label || sourceType,
    [sourceTypesByCode]
  );

  const getCategoryLabel = useCallback(
    (sourceType, categoryCode) =>
      (categoriesByType[sourceType] || []).find((category) => category.code === categoryCode)?.label || categoryCode,
    [categoriesByType]
  );

  const handleCreate = async () => {
    if (!form.source_type || !form.source_category || !form.debit_account_code || !form.credit_account_code) return;

    await createMapping(form);
    setShowDialog(false);
    setForm(EMPTY_FORM);
    setIsSuggested(false);
  };

  const handleDialogClose = (open) => {
    setShowDialog(open);
    if (!open) {
      setForm(EMPTY_FORM);
      setIsSuggested(false);
    }
  };

  const handleLoadCountryPreset = async (countryCode) => {
    const normalizedCode = normalizeCountryCode(countryCode);
    if (!normalizedCode) return;

    setPresetLoading(true);
    try {
      const templates = await loadCountryTemplates(normalizedCode, { force: true });
      if (!templates.length) {
        toast({
          title: 'Aucun preset',
          description: `Aucun mapping de reference disponible pour ${normalizedCode}.`,
          variant: 'destructive',
        });
        return;
      }

      await bulkCreateMappings(templates);
      setPresetCountryCode(null);
    } catch (error) {
      console.error('Erreur chargement preset mappings:', error);
      toast({
        title: 'Erreur',
        description: error?.message || 'Impossible de charger les presets comptables.',
        variant: 'destructive',
      });
    } finally {
      setPresetLoading(false);
    }
  };

  const unmapped = useMemo(() => {
    const mapped = new Set(mappings.map((mapping) => `${mapping.source_type}:${mapping.source_category}`));
    return sourceCategories
      .filter((category) => !mapped.has(`${category.source_type}:${category.code}`))
      .map((category) => ({ type: category.source_type, category: category.code }));
  }, [mappings, sourceCategories]);

  const selectedPresetTemplates = useMemo(
    () => (presetCountryCode ? templateMappingsByCountry[normalizeCountryCode(presetCountryCode)] || [] : []),
    [presetCountryCode, templateMappingsByCountry]
  );

  const selectedPresetTypes = useMemo(
    () => Array.from(new Set(selectedPresetTemplates.map((template) => template.source_type))),
    [selectedPresetTemplates]
  );

  return (
    <div className="space-y-6">
      {unmapped.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium text-sm">
              {unmapped.length} categorie(s) non associee(s) a un compte comptable
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Les montants de ces categories n'apparaitront pas dans les rapports comptables.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-white inline-flex items-center gap-1.5">
            <PanelInfoPopover {...MAPPINGS_INFO} />
            <span>Mappings comptables</span>
          </h3>
          <p className="text-sm text-gray-400">
            Associez chaque categorie de transaction a un compte du plan comptable.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {presetCountryCodes.map((countryCode) => (
            <Button
              key={countryCode}
              variant="outline"
              onClick={() => setPresetCountryCode(countryCode)}
              className="border-gray-700 text-gray-300 hover:text-white"
            >
              <Zap className="w-4 h-4 mr-2" /> Preset {countryCode}
            </Button>
          ))}
          <Button onClick={() => setShowDialog(true)} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4 mr-2" /> Ajouter un mapping
          </Button>
        </div>
      </div>

      {mappings.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/50 border border-gray-800 rounded-lg">
          <Settings className="w-12 h-12 mx-auto mb-4 opacity-30 text-gray-500" />
          <p className="text-gray-400">Aucun mapping configure</p>
          <p className="text-xs text-gray-600 mt-1">
            Creez des mappings pour associer vos transactions aux comptes comptables.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {mappings.map((mapping) => (
            <Card key={mapping.id} className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 flex items-center gap-3 flex-wrap">
                  <Badge className="bg-blue-500/20 text-blue-400 text-xs">{getSourceLabel(mapping.source_type)}</Badge>
                  <Badge className="bg-gray-700 text-gray-300 text-xs">
                    {getCategoryLabel(mapping.source_type, mapping.source_category)}
                  </Badge>
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                  <div className="text-sm">
                    <span className="text-green-400 font-mono">{mapping.debit_account_code}</span>
                    <span className="text-gray-600 mx-2">/</span>
                    <span className="text-red-400 font-mono">{mapping.credit_account_code}</span>
                  </div>
                  {mapping.description && <span className="text-xs text-gray-500">- {mapping.description}</span>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete mapping"
                  onClick={() => deleteMapping(mapping.id)}
                >
                  <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-400" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gradient">Nouveau mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type de source</Label>
              <Select
                value={form.source_type}
                onValueChange={(value) => {
                  setForm((prev) => ({ ...prev, source_type: value, source_category: '' }));
                  setIsSuggested(false);
                }}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Selectionner" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {sourceTypes.map((sourceType) => (
                    <SelectItem key={sourceType.code} value={sourceType.code}>
                      {sourceType.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.source_type && (
              <div className="space-y-2">
                <Label>Categorie</Label>
                <Select
                  value={form.source_category}
                  onValueChange={(value) => {
                    setForm((prev) => ({ ...prev, source_category: value }));
                    setIsSuggested(false);
                  }}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Selectionner" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-[200px]">
                    {getCategoriesForType(form.source_type).map((category) => (
                      <SelectItem key={category.code} value={category.code}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isSuggested && form.debit_account_code && form.credit_account_code && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-blue-400 font-medium">Suggestion automatique</p>
                  <p className="text-gray-400 mt-0.5">
                    Comptes suggeres depuis les templates de reference pour {activeCountryCode}. Vous pouvez les
                    modifier si necessaire.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Compte debit</Label>
                <Select
                  value={form.debit_account_code}
                  onValueChange={(value) => {
                    setForm((prev) => ({ ...prev, debit_account_code: value }));
                    setIsSuggested(false);
                  }}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Debit" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-[200px]">
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.account_code}>
                        {account.account_code} - {account.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Compte credit</Label>
                <Select
                  value={form.credit_account_code}
                  onValueChange={(value) => {
                    setForm((prev) => ({ ...prev, credit_account_code: value }));
                    setIsSuggested(false);
                  }}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Credit" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-[200px]">
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.account_code}>
                        {account.account_code} - {account.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description (optionnel)</Label>
              <Input
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Ex: Ventes de prestations de services"
                className="bg-gray-800 border-gray-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)} className="border-gray-700">
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              className="bg-orange-500 hover:bg-orange-600"
              disabled={
                !form.source_type || !form.source_category || !form.debit_account_code || !form.credit_account_code
              }
            >
              Creer le mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!presetCountryCode}
        onOpenChange={(open) => {
          if (!open) setPresetCountryCode(null);
        }}
      >
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gradient flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Preset comptable {presetCountryCode}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-gray-300 text-sm">
              Chargement de <strong>{selectedPresetTemplates.length}</strong> mappings pre-configures depuis la base de
              reference.
            </p>

            {selectedPresetTypes.length > 0 && (
              <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-2">Types de source couverts</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPresetTypes.map((sourceType) => (
                    <Badge key={sourceType} className="bg-gray-700 text-gray-300 text-xs">
                      {getSourceLabel(sourceType)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <p className="text-gray-400 text-xs">
              Les mappings existants avec la meme combinaison type/categorie seront mis a jour.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setPresetCountryCode(null)} className="border-gray-700">
                Annuler
              </Button>
              <Button
                onClick={() => handleLoadCountryPreset(presetCountryCode)}
                disabled={presetLoading || !presetCountryCode}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {presetLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Charger les {selectedPresetTemplates.length} mappings
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountingMappings;
