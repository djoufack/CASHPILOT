import { useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useTaxFiling } from '@/hooks/useTaxFiling';
import VatDeclarationForm from '@/components/tax/VatDeclarationForm';
import CorporateTaxForm from '@/components/tax/CorporateTaxForm';
import TaxDeclarationHistory from '@/components/tax/TaxDeclarationHistory';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Receipt,
  FileText,
  Plus,
  Loader2,
  AlertTriangle,
  Calculator,
  Building2,
  Clock,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

const TaxFilingPage = () => {
  const { t } = useTranslation();
  const {
    declarations,
    loading,
    computing,
    submitting,
    error,
    computeVat,
    computeCorporateTax,
    createDeclaration,
    updateDeclaration: _updateDeclaration,
    submitDeclaration,
    refetchDeclarations: _refetchDeclarations,
  } = useTaxFiling();

  const [activeTab, setActiveTab] = useState('vat');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newDeclType, setNewDeclType] = useState('vat');
  const [selectedDeclaration, setSelectedDeclaration] = useState(null);

  // ---------------------------------------------------------------------------
  // KPI computations
  // ---------------------------------------------------------------------------
  const kpis = useMemo(() => {
    const total = declarations.length;
    const pending = declarations.filter((d) => ['draft', 'computed', 'validated'].includes(d.status)).length;
    const submitted = declarations.filter((d) => ['submitted', 'accepted'].includes(d.status)).length;
    const totalAmount = declarations.reduce((sum, d) => sum + (d.net_payable || 0), 0);
    return { total, pending, submitted, totalAmount };
  }, [declarations]);

  // ---------------------------------------------------------------------------
  // VAT declarations for the VAT tab
  // ---------------------------------------------------------------------------
  const vatDeclarations = useMemo(() => declarations.filter((d) => d.declaration_type === 'vat'), [declarations]);

  const corporateDeclarations = useMemo(
    () => declarations.filter((d) => d.declaration_type === 'corporate_tax'),
    [declarations]
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleComputeVat = useCallback(
    async (startDate, endDate) => {
      return computeVat(startDate, endDate);
    },
    [computeVat]
  );

  const handleComputeCorporateTax = useCallback(
    async (year) => {
      return computeCorporateTax(year);
    },
    [computeCorporateTax]
  );

  const handleSubmitDeclaration = useCallback(
    async (id) => {
      await submitDeclaration(id);
    },
    [submitDeclaration]
  );

  const handleCreateNew = useCallback(async () => {
    const now = new Date();
    const year = now.getFullYear();

    let payload;
    if (newDeclType === 'vat') {
      const quarterEnd = new Date(year, Math.floor(now.getMonth() / 3) * 3, 0);
      const quarterStart = new Date(quarterEnd.getFullYear(), quarterEnd.getMonth() - 2, 1);
      payload = {
        declaration_type: 'vat',
        country_code: 'FR',
        period_start: quarterStart.toISOString().split('T')[0],
        period_end: quarterEnd.toISOString().split('T')[0],
        status: 'draft',
        tax_base: 0,
        tax_amount: 0,
        deductions: 0,
        net_payable: 0,
      };
    } else {
      payload = {
        declaration_type: 'corporate_tax',
        country_code: 'FR',
        period_start: `${year - 1}-01-01`,
        period_end: `${year - 1}-12-31`,
        status: 'draft',
        tax_base: 0,
        tax_amount: 0,
        deductions: 0,
        net_payable: 0,
      };
    }

    const decl = await createDeclaration(payload);
    if (decl) {
      setSelectedDeclaration(decl);
      setActiveTab(newDeclType === 'vat' ? 'vat' : 'corporate');
      setShowNewDialog(false);
    }
  }, [newDeclType, createDeclaration]);

  const handleSelectFromHistory = useCallback((decl) => {
    setSelectedDeclaration(decl);
    if (decl.declaration_type === 'vat') {
      setActiveTab('vat');
    } else if (decl.declaration_type === 'corporate_tax') {
      setActiveTab('corporate');
    }
  }, []);

  // ---------------------------------------------------------------------------
  // KPI cards configuration
  // ---------------------------------------------------------------------------
  const kpiCards = [
    {
      key: 'total',
      label: t('tax.kpi.totalDeclarations', 'Total Declarations'),
      value: kpis.total,
      icon: FileText,
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      borderColor: 'border-blue-500/20',
      formatted: false,
    },
    {
      key: 'pending',
      label: t('tax.kpi.pending', 'Pending'),
      value: kpis.pending,
      icon: Clock,
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      borderColor: 'border-amber-500/20',
      formatted: false,
    },
    {
      key: 'submitted',
      label: t('tax.kpi.submitted', 'Submitted'),
      value: kpis.submitted,
      icon: Send,
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/20',
      formatted: false,
    },
    {
      key: 'totalAmount',
      label: t('tax.kpi.totalAmount', 'Total Tax Amount'),
      value: kpis.totalAmount,
      icon: CheckCircle2,
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
      borderColor: 'border-purple-500/20',
      formatted: true,
    },
  ];

  return (
    <>
      <Helmet>
        <title>{t('tax.page.title', 'Tax Filing')} - CashPilot</title>
      </Helmet>

      <div className="p-4 md:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">{t('tax.page.title', 'Tax Filing')}</h1>
              <p className="text-sm text-gray-400">
                {t('tax.page.description', 'VAT, Corporate Tax declarations for France, Belgium, OHADA')}
              </p>
            </div>
          </div>

          <Button onClick={() => setShowNewDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            {t('tax.page.newDeclaration', 'New Declaration')}
          </Button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        )}

        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-5 backdrop-blur-sm animate-pulse"
              >
                <div className="h-4 w-24 bg-gray-700/50 rounded mb-3" />
                <div className="h-8 w-32 bg-gray-700/50 rounded mb-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.key}
                  className={`bg-[#0f1528]/80 border ${card.borderColor} rounded-2xl p-5 backdrop-blur-sm transition-all hover:shadow-lg`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-sm font-medium">{card.label}</span>
                    <div className={`p-2 rounded-lg ${card.iconBg}`}>
                      <Icon className={`w-4 h-4 ${card.iconColor}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {card.formatted ? formatCurrency(card.value) : card.value}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs: VAT | Corporate Tax | History */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-[#141c33] border border-gray-700/50 rounded-lg p-1">
            <TabsTrigger
              value="vat"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              <Calculator className="w-4 h-4 mr-2" />
              {t('tax.tab.vat', 'VAT')}
            </TabsTrigger>
            <TabsTrigger
              value="corporate"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              <Building2 className="w-4 h-4 mr-2" />
              {t('tax.tab.corporate', 'Corporate Tax')}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              <FileText className="w-4 h-4 mr-2" />
              {t('tax.tab.history', 'History')}
            </TabsTrigger>
          </TabsList>

          {/* VAT Tab */}
          <TabsContent value="vat" className="space-y-6">
            <VatDeclarationForm
              declaration={selectedDeclaration?.declaration_type === 'vat' ? selectedDeclaration : null}
              onSubmit={handleSubmitDeclaration}
              onCompute={handleComputeVat}
              loading={computing || submitting}
            />

            {/* Recent VAT declarations */}
            {vatDeclarations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {t('tax.vat.recentDeclarations', 'Recent VAT Declarations')}
                </h3>
                <TaxDeclarationHistory
                  declarations={vatDeclarations}
                  loading={false}
                  onSelect={handleSelectFromHistory}
                />
              </div>
            )}
          </TabsContent>

          {/* Corporate Tax Tab */}
          <TabsContent value="corporate" className="space-y-6">
            <CorporateTaxForm
              declaration={selectedDeclaration?.declaration_type === 'corporate_tax' ? selectedDeclaration : null}
              onSubmit={handleSubmitDeclaration}
              onCompute={handleComputeCorporateTax}
              loading={computing || submitting}
            />

            {/* Recent Corporate declarations */}
            {corporateDeclarations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {t('tax.corporate.recentDeclarations', 'Recent Corporate Tax Declarations')}
                </h3>
                <TaxDeclarationHistory
                  declarations={corporateDeclarations}
                  loading={false}
                  onSelect={handleSelectFromHistory}
                />
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <TaxDeclarationHistory declarations={declarations} loading={loading} onSelect={handleSelectFromHistory} />
          </TabsContent>
        </Tabs>
      </div>

      {/* New Declaration Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="bg-[#0f1528] border border-gray-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{t('tax.dialog.title', 'New Tax Declaration')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-400">
              {t('tax.dialog.selectType', 'Select the type of declaration to create')}
            </p>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setNewDeclType('vat')}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                  newDeclType === 'vat'
                    ? 'bg-blue-900/30 border-blue-700 text-blue-300'
                    : 'bg-[#0a0e1a] border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <Calculator className="w-5 h-5" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">{t('tax.dialog.vat', 'VAT Declaration')}</p>
                  <p className="text-xs text-gray-500">
                    {t('tax.dialog.vatDescription', 'Monthly, quarterly, or annual VAT')}
                  </p>
                </div>
              </button>

              <button
                onClick={() => setNewDeclType('corporate_tax')}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                  newDeclType === 'corporate_tax'
                    ? 'bg-blue-900/30 border-blue-700 text-blue-300'
                    : 'bg-[#0a0e1a] border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <Building2 className="w-5 h-5" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">
                    {t('tax.dialog.corporateTax', 'Corporate Tax Declaration')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t('tax.dialog.corporateTaxDescription', 'Annual corporate income tax')}
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowNewDialog(false)}
                className="text-gray-400 hover:text-white hover:bg-gray-800"
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button onClick={handleCreateNew} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {t('tax.dialog.create', 'Create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TaxFilingPage;
