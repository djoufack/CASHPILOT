
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BarChart3, FileText, Scale, TrendingUp, Receipt, Calculator, Settings, Percent, Landmark, Book, BookOpen, Zap } from 'lucide-react';
import { useAccountingData } from '@/hooks/useAccountingData';
import { useAccountingInit } from '@/hooks/useAccountingInit';
import { useCompany } from '@/hooks/useCompany';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
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
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';

const AccountingIntegration = () => {
  const { t } = useTranslation();
  const now = new Date();
  const year = now.getFullYear();

  const [period, setPeriod] = useState({
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`
  });

  const { company } = useCompany();
  const { isInitialized, isInitializing, country, settings, initializeForCountry, toggleAutoJournal } = useAccountingInit();

  const {
    loading,
    error,
    // Raw data
    accounts,
    mappings,
    taxRates,
    entries,
    hasAutoEntries,
    trialBalance,
    generalLedger,
    journalBook,
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

  const { guardedAction, modalProps } = useCreditsGuard();

  const companyInfo = company ? {
    company_name: company.company_name || company.name || 'Ma Société',
    address: company.address,
    siret: company.siret,
    vat_number: company.vat_number
  } : { company_name: 'Ma Société' };

  // PDF export handlers — credit-guarded
  const handleExportBalanceSheetPDF = () => {
    guardedAction(CREDIT_COSTS.PDF_BALANCE_SHEET, 'Balance Sheet PDF', () =>
      exportBalanceSheetPDF(balanceSheet, companyInfo, period)
    );
  };

  const handleExportIncomeStatementPDF = () => {
    guardedAction(CREDIT_COSTS.PDF_INCOME_STATEMENT, 'Income Statement PDF', () =>
      exportIncomeStatementPDF(incomeStatement, companyInfo, period)
    );
  };

  const handleExportVATPDF = () => {
    guardedAction(CREDIT_COSTS.PDF_VAT, 'VAT Declaration PDF', () =>
      exportVATDeclarationPDF({ outputVAT, inputVAT, vatPayable }, companyInfo, period)
    );
  };

  const handleExportTaxPDF = () => {
    guardedAction(CREDIT_COSTS.PDF_TAX, 'Tax Estimation PDF', () =>
      exportTaxEstimationPDF({ netIncome, taxEstimate }, companyInfo, period)
    );
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

  // ─── Initialization Wizard ─────────────────────────────────────────
  if (isInitialized === false) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white">
        <div className="max-w-2xl mx-auto text-center py-20">
          <Calculator className="w-16 h-16 text-orange-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gradient mb-4">{t('accounting.initWizard')}</h1>
          <p className="text-gray-400 mb-8">{t('accounting.chooseCountry')}</p>

          {isInitializing ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-orange-400 animate-spin" />
              <p className="text-gray-400">{t('accounting.initializing')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <button
                onClick={() => initializeForCountry('BE')}
                className="bg-gray-800 border-2 border-gray-700 hover:border-orange-500 rounded-xl p-8 transition-all group"
              >
                <span className="text-5xl mb-4 block">🇧🇪</span>
                <h3 className="text-lg font-bold text-white group-hover:text-orange-400">{t('accounting.belgiumPreset')}</h3>
                <p className="text-sm text-gray-500 mt-2">PCG belge · TVA 21%, 12%, 6%</p>
              </button>
              <button
                onClick={() => initializeForCountry('FR')}
                className="bg-gray-800 border-2 border-gray-700 hover:border-orange-500 rounded-xl p-8 transition-all group"
              >
                <span className="text-5xl mb-4 block">🇫🇷</span>
                <h3 className="text-lg font-bold text-white group-hover:text-orange-400">{t('accounting.francePreset')}</h3>
                <p className="text-sm text-gray-500 mt-2">PCG français · TVA 20%, 10%, 5.5%</p>
              </button>
              <button
                onClick={() => initializeForCountry('OHADA')}
                className="bg-gray-800 border-2 border-gray-700 hover:border-orange-500 rounded-xl p-8 transition-all group"
              >
                <span className="text-5xl mb-4 block">🌍</span>
                <h3 className="text-lg font-bold text-white group-hover:text-orange-400">{t('accounting.ohadaPreset')}</h3>
                <p className="text-sm text-gray-500 mt-2">SYSCOHADA révisé · TVA 18%</p>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <CreditsGuardModal {...modalProps} />
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gradient">
          Comptabilité
        </h1>
        <p className="text-gray-400 mt-1 text-sm sm:text-base">
          Plan comptable, rapports financiers, TVA et estimation d'impôt.
        </p>
      </div>

      {/* Auto-journal status badge */}
      {settings?.auto_journal_enabled && (
        <div className="flex items-center gap-2 mb-4 px-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-xs text-yellow-400 font-medium">{t('accounting.autoEnabled')}</span>
          <span className="text-xs text-gray-500">({country === 'BE' ? '🇧🇪 Belgique' : country === 'OHADA' ? '🌍 OHADA' : '🇫🇷 France'})</span>
        </div>
      )}

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
            <TabsTrigger value="generalLedger" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Book className="w-4 h-4" />{t('accounting.generalLedger')}
            </TabsTrigger>
            <TabsTrigger value="journal" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <BookOpen className="w-4 h-4" />{t('accounting.journalBook')}
            </TabsTrigger>
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

          {/* General Ledger (Grand Livre) */}
          <TabsContent value="generalLedger">
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Book className="w-5 h-5 text-orange-400" />
                {t('accounting.generalLedger')}
              </h2>
              {generalLedger.length === 0 ? (
                <div className="text-center py-16 text-gray-500">{t('accounting.noEntries')}</div>
              ) : (
                generalLedger.map(account => (
                  <div key={account.account_code} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="bg-gray-750 p-3 flex justify-between items-center border-b border-gray-700">
                      <div>
                        <span className="font-mono text-orange-400 mr-3">{account.account_code}</span>
                        <span className="text-white font-medium">{account.account_name}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-green-400 mr-4">D: {account.totalDebit.toFixed(2)} €</span>
                        <span className="text-red-400 mr-4">C: {account.totalCredit.toFixed(2)} €</span>
                        <span className="text-orange-400 font-bold">Solde: {account.balance.toFixed(2)} €</span>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs uppercase border-b border-gray-700/50">
                          <th className="text-left p-2 pl-4">Date</th>
                          <th className="text-left p-2">Réf.</th>
                          <th className="text-left p-2">Description</th>
                          <th className="text-right p-2">Débit</th>
                          <th className="text-right p-2 pr-4">Crédit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {account.entries.map((e, i) => (
                          <tr key={e.id || i} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                            <td className="p-2 pl-4 text-gray-400">{e.transaction_date ? format(new Date(e.transaction_date), 'dd/MM/yyyy') : '-'}</td>
                            <td className="p-2 font-mono text-xs text-gray-500">{e.entry_ref || '-'}</td>
                            <td className="p-2 text-gray-300">{e.description || '-'}</td>
                            <td className="p-2 text-right text-green-400">{parseFloat(e.debit) > 0 ? parseFloat(e.debit).toFixed(2) : ''}</td>
                            <td className="p-2 pr-4 text-right text-red-400">{parseFloat(e.credit) > 0 ? parseFloat(e.credit).toFixed(2) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Journal Book */}
          <TabsContent value="journal">
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-orange-400" />
                {t('accounting.journalBook')}
              </h2>
              {journalBook.length === 0 ? (
                <div className="text-center py-16 text-gray-500">{t('accounting.noEntries')}</div>
              ) : (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs uppercase border-b border-gray-700 bg-gray-750">
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Réf.</th>
                        <th className="text-left p-3">Journal</th>
                        <th className="text-left p-3">Compte</th>
                        <th className="text-left p-3">Description</th>
                        <th className="text-right p-3">Débit</th>
                        <th className="text-right p-3">Crédit</th>
                        <th className="text-center p-3">Auto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journalBook.map((group, gi) => (
                        group.lines.map((line, li) => (
                          <tr key={`${gi}-${li}`} className={`border-b border-gray-700/30 hover:bg-gray-700/20 ${li === 0 ? 'border-t border-gray-600/50' : ''}`}>
                            {li === 0 ? (
                              <>
                                <td className="p-2 pl-3 text-gray-400" rowSpan={group.lines.length}>{group.date ? format(new Date(group.date), 'dd/MM/yyyy') : '-'}</td>
                                <td className="p-2 font-mono text-xs text-orange-400" rowSpan={group.lines.length}>{group.entry_ref}</td>
                                <td className="p-2" rowSpan={group.lines.length}>
                                  <span className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-300">{group.journal}</span>
                                </td>
                              </>
                            ) : null}
                            <td className="p-2 font-mono text-xs text-gray-400">{line.account_code}</td>
                            <td className="p-2 text-gray-300">{line.description || '-'}</td>
                            <td className="p-2 text-right text-green-400">{parseFloat(line.debit) > 0 ? parseFloat(line.debit).toFixed(2) : ''}</td>
                            <td className="p-2 text-right text-red-400">{parseFloat(line.credit) > 0 ? parseFloat(line.credit).toFixed(2) : ''}</td>
                            {li === 0 ? (
                              <td className="p-2 text-center" rowSpan={group.lines.length}>
                                {group.is_auto ? <Zap className="w-3.5 h-3.5 text-yellow-400 inline" /> : <span className="text-gray-600">—</span>}
                              </td>
                            ) : null}
                          </tr>
                        ))
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default AccountingIntegration;
