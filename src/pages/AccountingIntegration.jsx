
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BarChart3, FileText, Scale, TrendingUp, Receipt, Calculator, Settings, Percent, Landmark } from 'lucide-react';
import { useAccountingData } from '@/hooks/useAccountingData';
import { useCompany } from '@/hooks/useCompany';
import PeriodSelector from '@/components/accounting/PeriodSelector';
import AccountingDashboard from '@/components/accounting/AccountingDashboard';
import ChartOfAccounts from '@/components/accounting/ChartOfAccounts';
import BalanceSheet from '@/components/accounting/BalanceSheet';
import IncomeStatement from '@/components/accounting/IncomeStatement';
import VATDeclaration from '@/components/accounting/VATDeclaration';
import TaxEstimation from '@/components/accounting/TaxEstimation';
import AccountingMappings from '@/components/accounting/AccountingMappings';
import TaxRatesManager from '@/components/accounting/TaxRatesManager';
import BankReconciliation from '@/components/accounting/BankReconciliation';
import {
  exportBalanceSheetPDF,
  exportIncomeStatementPDF,
  exportVATDeclarationPDF,
  exportTaxEstimationPDF
} from '@/services/exportAccountingPDF';

const AccountingIntegration = () => {
  const now = new Date();
  const year = now.getFullYear();

  const [period, setPeriod] = useState({
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`
  });

  const { company } = useCompany();

  const {
    loading,
    error,
    // Raw data
    accounts,
    mappings,
    taxRates,
    // Computed
    revenue,
    totalExpenses,
    netIncome,
    outputVAT,
    inputVAT,
    vatPayable,
    vatBreakdown,
    balanceSheet,
    incomeStatement,
    taxEstimate,
    monthlyData,
    refresh
  } = useAccountingData(period.startDate, period.endDate);

  const companyInfo = company ? {
    company_name: company.company_name || company.name || 'Ma Société',
    address: company.address,
    siret: company.siret,
    vat_number: company.vat_number
  } : { company_name: 'Ma Société' };

  // PDF export handlers
  const handleExportBalanceSheetPDF = () => {
    exportBalanceSheetPDF(balanceSheet, companyInfo, period);
  };

  const handleExportIncomeStatementPDF = () => {
    exportIncomeStatementPDF(incomeStatement, companyInfo, period);
  };

  const handleExportVATPDF = () => {
    exportVATDeclarationPDF({ outputVAT, inputVAT, vatPayable }, companyInfo, period);
  };

  const handleExportTaxPDF = () => {
    exportTaxEstimationPDF({ netIncome, taxEstimate }, companyInfo, period);
  };

  const tabs = [
    { value: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
    { value: 'coa', label: 'Plan comptable', icon: FileText },
    { value: 'balance', label: 'Bilan', icon: Scale },
    { value: 'income', label: 'Compte de résultat', icon: TrendingUp },
    { value: 'vat', label: 'TVA', icon: Receipt },
    { value: 'tax', label: 'Estimation impôt', icon: Calculator },
    { value: 'mappings', label: 'Mappings', icon: Settings },
    { value: 'rates', label: 'Taux de TVA', icon: Percent },
    { value: 'reconciliation', label: 'Rapprochement', icon: Landmark },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gradient">
          Comptabilité
        </h1>
        <p className="text-gray-400 mt-1 text-sm sm:text-base">
          Plan comptable, rapports financiers, TVA et estimation d'impôt.
        </p>
      </div>

      {/* Period Selector — global */}
      <PeriodSelector
        startDate={period.startDate}
        endDate={period.endDate}
        onChange={setPeriod}
      />

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-orange-400 mr-3" />
          <span className="text-gray-400">Chargement des données comptables...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Erreur : {error}
        </div>
      )}

      {/* Tabs */}
      {!loading && (
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="w-full bg-gray-900 border border-gray-800 overflow-x-auto flex-nowrap justify-start h-auto p-1 gap-0.5">
            {tabs.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="min-w-[90px] text-xs sm:text-sm px-2 sm:px-3 py-1.5 data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 whitespace-nowrap"
              >
                <tab.icon className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="mt-6">
            <AccountingDashboard
              revenue={revenue}
              totalExpenses={totalExpenses}
              netIncome={netIncome}
              vatPayable={vatPayable}
              monthlyData={monthlyData}
              accounts={accounts}
              mappings={mappings}
            />
          </TabsContent>

          {/* Chart of Accounts */}
          <TabsContent value="coa" className="mt-6">
            <ChartOfAccounts />
          </TabsContent>

          {/* Balance Sheet */}
          <TabsContent value="balance" className="mt-6">
            <BalanceSheet
              balanceSheet={balanceSheet}
              period={period}
              onExportPDF={handleExportBalanceSheetPDF}
            />
          </TabsContent>

          {/* Income Statement */}
          <TabsContent value="income" className="mt-6">
            <IncomeStatement
              incomeStatement={incomeStatement}
              period={period}
              onExportPDF={handleExportIncomeStatementPDF}
            />
          </TabsContent>

          {/* VAT Declaration */}
          <TabsContent value="vat" className="mt-6">
            <VATDeclaration
              outputVAT={outputVAT}
              inputVAT={inputVAT}
              vatPayable={vatPayable}
              vatBreakdown={vatBreakdown}
              monthlyData={monthlyData}
              period={period}
              onExportPDF={handleExportVATPDF}
            />
          </TabsContent>

          {/* Tax Estimation */}
          <TabsContent value="tax" className="mt-6">
            <TaxEstimation
              netIncome={netIncome}
              taxEstimate={taxEstimate}
              period={period}
              onExportPDF={handleExportTaxPDF}
            />
          </TabsContent>

          {/* Mappings */}
          <TabsContent value="mappings" className="mt-6">
            <AccountingMappings />
          </TabsContent>

          {/* Tax Rates */}
          <TabsContent value="rates" className="mt-6">
            <TaxRatesManager />
          </TabsContent>

          {/* Bank Reconciliation */}
          <TabsContent value="reconciliation" className="mt-6">
            <BankReconciliation period={period} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default AccountingIntegration;
