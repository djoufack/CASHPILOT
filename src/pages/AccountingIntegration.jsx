
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BarChart3, FileText, Scale, TrendingUp, Receipt, Calculator, Settings, Percent, Landmark, Book, BookOpen, Zap, Activity, Settings2 } from 'lucide-react';
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
import FinancialDiagnostic from '@/components/accounting/FinancialDiagnostic';
import BalanceSheetInitializer from '@/components/accounting/BalanceSheetInitializer';
import {
  exportBalanceSheetPDF,
  exportIncomeStatementPDF,
  exportVATDeclarationPDF,
  exportTaxEstimationPDF,
  exportFinancialDiagnosticPDF
} from '@/services/exportAccountingPDF';
import {
  exportBalanceSheetHTML,
  exportIncomeStatementHTML,
  exportVATDeclarationHTML,
  exportTaxEstimationHTML,
  exportFinancialDiagnosticHTML
} from '@/services/exportHTML';
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
    financialDiagnostic,
    refresh
  } = useAccountingData(period.startDate, period.endDate);

  const { guardedAction, modalProps } = useCreditsGuard();

  const companyInfo = company ? {
    company_name: company.company_name || company.name || 'Ma Société',
    address: company.address,
    siret: company.siret,
    vat_number: company.vat_number
  } : { company_name: 'Ma Société' };

  // PDF export handlers — credit-guarded (5 crédits pour génération états comptables)
  const handleExportBalanceSheetPDF = () => {
    guardedAction(CREDIT_COSTS.GENERATE_BALANCE_SHEET, 'Balance Sheet PDF', () =>
      exportBalanceSheetPDF(balanceSheet, companyInfo, period)
    );
  };

  const handleExportIncomeStatementPDF = () => {
    guardedAction(CREDIT_COSTS.GENERATE_INCOME_STATEMENT, 'Income Statement PDF', () =>
      exportIncomeStatementPDF(incomeStatement, companyInfo, period)
    );
  };

  const handleExportVATPDF = () => {
    guardedAction(CREDIT_COSTS.GENERATE_VAT_DECLARATION, 'VAT Declaration PDF', () =>
      exportVATDeclarationPDF({ outputVAT, inputVAT, vatPayable }, companyInfo, period)
    );
  };

  const handleExportTaxPDF = () => {
    guardedAction(CREDIT_COSTS.GENERATE_TAX_ESTIMATION, 'Tax Estimation PDF', () =>
      exportTaxEstimationPDF({ netIncome, taxEstimate }, companyInfo, period)
    );
  };

  const handleExportDiagnosticPDF = () => {
    guardedAction(CREDIT_COSTS.GENERATE_FINANCIAL_DIAGNOSTIC, 'Financial Diagnostic PDF', () =>
      exportFinancialDiagnosticPDF(financialDiagnostic, companyInfo, period)
    );
  };

  // HTML export handlers — credit-guarded (2 crédits pour téléchargement fichier HTML)
  const handleExportBalanceSheetHTML = () => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, 'Balance Sheet HTML', () =>
      exportBalanceSheetHTML(balanceSheet, companyInfo, `${period.startDate} - ${period.endDate}`)
    );
  };

  const handleExportIncomeStatementHTML = () => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, 'Income Statement HTML', () =>
      exportIncomeStatementHTML(incomeStatement, companyInfo, `${period.startDate} - ${period.endDate}`)
    );
  };

  const handleExportVATHTML = () => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, 'VAT Declaration HTML', () =>
      exportVATDeclarationHTML({ outputVAT, inputVAT, vatPayable }, companyInfo, `${period.startDate} - ${period.endDate}`)
    );
  };

  const handleExportTaxHTML = () => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, 'Tax Estimation HTML', () =>
      exportTaxEstimationHTML({ netIncome, taxEstimate }, companyInfo, `${period.startDate} - ${period.endDate}`)
    );
  };

  const handleExportDiagnosticHTML = () => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, 'Financial Diagnostic HTML', () =>
      exportFinancialDiagnosticHTML(financialDiagnostic, companyInfo, `${period.startDate} - ${period.endDate}`)
    );
  };

  const tabs = [
    { value: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
    { value: 'coa', label: 'Plan comptable', icon: FileText },
    { value: 'balance', label: 'Bilan', icon: Scale },
    { value: 'income', label: 'Compte de résultat', icon: TrendingUp },
    { value: 'diagnostic', label: 'Diagnostic Financier', icon: Activity },
    { value: 'vat', label: 'TVA', icon: Receipt },
    { value: 'tax', label: 'Estimation impôt', icon: Calculator },
    { value: 'mappings', label: 'Mappings', icon: Settings },
    { value: 'rates', label: 'Taux de TVA', icon: Percent },
    { value: 'reconciliation', label: 'Rapprochement', icon: Landmark },
    { value: 'init', label: 'Initialisation', icon: Settings2 },
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
                {/* Belgium Flag SVG */}
                <svg className="w-16 h-12 mb-4 mx-auto rounded shadow-lg" viewBox="0 0 3 2">
                  <rect width="1" height="2" x="0" fill="#000000"/>
                  <rect width="1" height="2" x="1" fill="#FDDA24"/>
                  <rect width="1" height="2" x="2" fill="#EF3340"/>
                </svg>
                <h3 className="text-lg font-bold text-white group-hover:text-orange-400">{t('accounting.belgiumPreset')}</h3>
                <p className="text-sm text-gray-500 mt-2">PCG belge · TVA 21%, 12%, 6%</p>
              </button>
              <button
                onClick={() => initializeForCountry('FR')}
                className="bg-gray-800 border-2 border-gray-700 hover:border-orange-500 rounded-xl p-8 transition-all group"
              >
                {/* France Flag SVG */}
                <svg className="w-16 h-12 mb-4 mx-auto rounded shadow-lg" viewBox="0 0 3 2">
                  <rect width="1" height="2" x="0" fill="#002654"/>
                  <rect width="1" height="2" x="1" fill="#FFFFFF"/>
                  <rect width="1" height="2" x="2" fill="#CE1126"/>
                </svg>
                <h3 className="text-lg font-bold text-white group-hover:text-orange-400">{t('accounting.francePreset')}</h3>
                <p className="text-sm text-gray-500 mt-2">PCG français · TVA 20%, 10%, 5.5%</p>
              </button>
              <button
                onClick={() => initializeForCountry('OHADA')}
                className="bg-gray-800 border-2 border-gray-700 hover:border-orange-500 rounded-xl p-8 transition-all group"
              >
                {/* OHADA Globe SVG */}
                <svg className="w-16 h-16 mb-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" className="stroke-emerald-400"/>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" className="stroke-emerald-400"/>
                </svg>
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
          <span className="text-xs text-gray-500">({country === 'BE' ? 'Belgique' : country === 'OHADA' ? 'OHADA' : 'France'})</span>
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
              onExportHTML={handleExportBalanceSheetHTML}
            />
          </TabsContent>

          {/* Income Statement */}
          <TabsContent value="income" className="mt-6">
            <IncomeStatement
              incomeStatement={incomeStatement}
              period={period}
              onExportPDF={handleExportIncomeStatementPDF}
              onExportHTML={handleExportIncomeStatementHTML}
            />
          </TabsContent>

          {/* Financial Diagnostic */}
          <TabsContent value="diagnostic" className="mt-6">
            <FinancialDiagnostic
              diagnostic={financialDiagnostic}
              period={period}
              onExportPDF={handleExportDiagnosticPDF}
              onExportHTML={handleExportDiagnosticHTML}
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
              onExportHTML={handleExportVATHTML}
            />
          </TabsContent>

          {/* Tax Estimation */}
          <TabsContent value="tax" className="mt-6">
            <TaxEstimation
              netIncome={netIncome}
              taxEstimate={taxEstimate}
              period={period}
              onExportPDF={handleExportTaxPDF}
              onExportHTML={handleExportTaxHTML}
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

          {/* Balance Sheet Initializer */}
          <TabsContent value="init" className="mt-6">
            <BalanceSheetInitializer onComplete={refresh} />
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
