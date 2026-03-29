import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Download, Scale, Building2, Printer, List, LayoutGrid } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';
import { formatDate, formatTime } from '@/utils/dateLocale';

/**
 * Professional SYSCOHADA Balance Sheet Component
 * Two views: Résumé (SYSCOHADA sections) and Détaillé (flat table for expert-comptable verification)
 */
const BalanceSheet = ({ balanceSheet, period, currency = 'EUR', companyInfo, onExportPDF, onExportHTML }) => {
  const [viewMode, setViewMode] = useState('summary'); // 'summary' | 'detailed'

  if (!balanceSheet) return null;

  const { totalAssets, totalPassif, balanced, syscohada } = balanceSheet;
  const fmt = (amount) => formatCurrency(amount, currency);

  // If no SYSCOHADA data, show empty state
  if (!syscohada) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Scale className="w-8 h-8 mx-auto mb-3 opacity-50" />
        <p>Aucune donnée comptable disponible pour cette période.</p>
        <p className="text-xs mt-1">Initialisez le plan comptable et saisissez des écritures.</p>
      </div>
    );
  }

  const difference = Math.abs(totalAssets - totalPassif);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl font-bold text-gradient flex items-center gap-2">
            <Scale className="w-5 h-5" /> Bilan Comptable SYSCOHADA
          </h2>
          {companyInfo && (
            <div className="mt-1 space-y-0.5">
              <p className="text-sm text-gray-300 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {companyInfo.company_name}
              </p>
              {companyInfo.registration_number && (
                <p className="text-xs text-gray-500">N° {companyInfo.registration_number}</p>
              )}
            </div>
          )}
          {period && (
            <p className="text-xs text-gray-500 mt-1">
              Exercice du {formatDate(period.startDate)} au {formatDate(period.endDate)}
            </p>
          )}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* View mode toggle */}
          <div className="flex bg-gray-800 rounded-lg p-0.5 border border-gray-700">
            <button
              onClick={() => setViewMode('summary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'summary' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Résumé
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'detailed' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Détaillé
            </button>
          </div>
          {onExportPDF && (
            <Button variant="outline" size="sm" onClick={onExportPDF} className="border-gray-700 text-gray-300">
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
          )}
          {onExportHTML && (
            <Button variant="outline" size="sm" onClick={onExportHTML} className="border-gray-700 text-gray-300">
              <Printer className="w-4 h-4 mr-1" /> Imprimer
            </Button>
          )}
        </div>
      </div>

      {/* Equilibre comptable */}
      <Card
        className={`border ${balanced ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-red-500/5 border-red-500/30'}`}
      >
        <CardContent className="py-3 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {balanced ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            )}
            <span className={`text-sm font-medium ${balanced ? 'text-emerald-400' : 'text-red-400'}`}>
              {balanced ? 'Bilan équilibré — Actif = Passif' : `Bilan déséquilibré — Écart : ${fmt(difference)}`}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span className="text-gray-400">
              Total Actif: <span className="font-mono text-blue-400 font-semibold">{fmt(totalAssets)}</span>
            </span>
            <span className="text-gray-400">
              Total Passif: <span className="font-mono text-red-400 font-semibold">{fmt(totalPassif)}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* View content */}
      {viewMode === 'summary' ? (
        <SummaryView
          syscohada={syscohada}
          totalAssets={totalAssets}
          totalPassif={totalPassif}
          fmt={fmt}
          currency={currency}
        />
      ) : (
        <DetailedView
          syscohada={syscohada}
          totalAssets={totalAssets}
          totalPassif={totalPassif}
          fmt={fmt}
          currency={currency}
        />
      )}

      {/* Footer */}
      <p className="text-[10px] text-gray-600 text-center">
        Bilan généré le {formatDate(new Date())} à {formatTime(new Date())}
        {' — '} CashPilot
      </p>
    </div>
  );
};

/** Summary view: SYSCOHADA grouped sections (existing view) */
const SummaryView = ({ syscohada, totalAssets, totalPassif, fmt, currency }) => {
  const renderSection = (section) => {
    const nonZeroGroups = (section.groups || []).filter((g) => Math.abs(g.subtotal) >= 0.01);

    if (nonZeroGroups.length === 0) {
      return (
        <div key={section.key} className="mb-4">
          <div className="flex justify-between items-center py-2 px-3 bg-gray-800/40 rounded">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{section.label}</span>
            <span className="font-mono text-sm text-gray-500">{fmt(0)}</span>
          </div>
        </div>
      );
    }

    return (
      <div key={section.key} className="mb-4">
        <div className="flex justify-between items-center py-2 px-3 bg-gray-800/40 rounded mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{section.label}</span>
          <span className="font-mono text-sm font-semibold text-gray-300">{fmt(section.total)}</span>
        </div>
        {nonZeroGroups.map((group) => {
          const nonZeroAccounts = group.accounts.filter((a) => Math.abs(a.balance) >= 0.01);
          return (
            <div key={group.classCode} className="ml-2 mb-2">
              <div className="flex justify-between items-center py-1.5 px-2 border-b border-gray-800">
                <span className="text-xs font-semibold text-orange-400 uppercase tracking-wide">
                  <span className="font-mono mr-2">{group.classCode}</span>
                  {group.className}
                </span>
                <span className="font-mono text-xs font-medium text-orange-400">{fmt(group.subtotal)}</span>
              </div>
              {nonZeroAccounts.map((account) => (
                <div
                  key={account.account_code}
                  className="flex justify-between items-center py-1 px-2 pl-6 hover:bg-gray-800/30 transition-colors"
                >
                  <span className="text-xs text-gray-300">
                    <span className="font-mono text-gray-500 mr-2 inline-block w-12">{account.account_code}</span>
                    {account.account_name}
                  </span>
                  <span className="font-mono text-xs text-white">{fmt(account.balance)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-blue-400 text-sm uppercase tracking-wider flex items-center justify-between">
            <span>ACTIF</span>
            <span className="font-mono text-base">{fmt(totalAssets)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex justify-between items-center py-1.5 px-2 border-b border-gray-700 mb-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Compte / Libellé</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Montant ({currency})</span>
          </div>
          {syscohada.actif.map(renderSection)}
          <div className="border-t-2 border-blue-500/50 mt-3 pt-3 flex justify-between items-center">
            <span className="font-bold text-white text-sm uppercase tracking-wider">TOTAL ACTIF</span>
            <span className="font-bold font-mono text-blue-400 text-lg">{fmt(totalAssets)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-red-400 text-sm uppercase tracking-wider flex items-center justify-between">
            <span>PASSIF</span>
            <span className="font-mono text-base">{fmt(totalPassif)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex justify-between items-center py-1.5 px-2 border-b border-gray-700 mb-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Compte / Libellé</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Montant ({currency})</span>
          </div>
          {syscohada.passif.map(renderSection)}
          <div className="border-t-2 border-red-500/50 mt-3 pt-3 flex justify-between items-center">
            <span className="font-bold text-white text-sm uppercase tracking-wider">TOTAL PASSIF</span>
            <span className="font-bold font-mono text-red-400 text-lg">{fmt(totalPassif)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/** Detailed view: complete chart of accounts for expert-comptable verification.
 *  Shows ALL accounts including those with 0 balance. */
const DetailedView = ({ syscohada, totalAssets, totalPassif, fmt }) => {
  // Flatten ALL accounts from SYSCOHADA sections — no zero filtering
  const flattenSections = (sections) => {
    const rows = [];
    for (const section of sections) {
      rows.push({ type: 'section', label: section.label, total: section.total });
      for (const group of section.groups || []) {
        // Always show the group header, even if subtotal is 0
        rows.push({ type: 'group', classCode: group.classCode, className: group.className, subtotal: group.subtotal });
        // Show ALL accounts, including those at 0
        for (const account of group.accounts) {
          rows.push({
            type: 'account',
            account_code: account.account_code,
            account_name: account.account_name,
            debit: account.balance > 0 ? account.balance : 0,
            credit: account.balance < 0 ? Math.abs(account.balance) : 0,
            balance: account.balance,
            isZero: Math.abs(account.balance) < 0.01,
          });
        }
      }
    }
    return rows;
  };

  const actifRows = flattenSections(syscohada.actif);
  const passifRows = flattenSections(syscohada.passif);

  const renderTable = (title, rows, total, colorClass, borderColor) => {
    const accountRows = rows.filter((r) => r.type === 'account');
    const totalDebit = accountRows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = accountRows.reduce((s, r) => s + r.credit, 0);

    return (
      <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className={`${colorClass} text-sm uppercase tracking-wider flex items-center justify-between`}>
            <span>{title}</span>
            <span className="font-mono text-base">{fmt(total)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr className="border-b-2 border-gray-600 text-gray-400 uppercase tracking-wider text-[10px]">
                  <th className="text-left py-2.5 px-1.5 w-16">Code</th>
                  <th className="text-left py-2.5 px-1.5">Libellé du compte</th>
                  <th className="text-right py-2.5 px-1.5 whitespace-nowrap">Débit</th>
                  <th className="text-right py-2.5 px-1.5 whitespace-nowrap">Crédit</th>
                  <th className="text-right py-2.5 px-1.5 whitespace-nowrap">Solde</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  if (row.type === 'section') {
                    return (
                      <tr key={`s-${i}`} className="bg-gray-800/70 border-t-2 border-gray-600">
                        <td
                          colSpan={4}
                          className="py-2.5 px-1.5 font-bold text-white uppercase tracking-wide text-[11px]"
                        >
                          {row.label}
                        </td>
                        <td className="py-2.5 px-1.5 text-right font-bold font-mono text-white">{fmt(row.total)}</td>
                      </tr>
                    );
                  }
                  if (row.type === 'group') {
                    return (
                      <tr key={`g-${i}`} className="bg-gray-800/30 border-t border-gray-700">
                        <td className="py-1.5 px-1.5 font-mono font-bold text-orange-400">{row.classCode}</td>
                        <td className="py-1.5 px-1.5 font-bold text-orange-400 uppercase text-[11px]">
                          {row.className}
                        </td>
                        <td colSpan={2}></td>
                        <td className="py-1.5 px-1.5 text-right font-mono font-bold text-orange-400">
                          {fmt(row.subtotal)}
                        </td>
                      </tr>
                    );
                  }
                  // Account row — zero balances shown in gray
                  const isZero = row.isZero;
                  return (
                    <tr
                      key={`a-${row.account_code}-${i}`}
                      className={`border-t border-gray-800/40 transition-colors ${
                        isZero ? 'opacity-50' : 'hover:bg-gray-800/20'
                      }`}
                    >
                      <td className="py-1 px-1.5 font-mono text-gray-400 pl-3">{row.account_code}</td>
                      <td className={`py-1 px-1.5 ${isZero ? 'text-gray-600' : 'text-gray-300'}`}>
                        {row.account_name}
                      </td>
                      <td className="py-1 px-1.5 text-right font-mono whitespace-nowrap">
                        {isZero ? (
                          <span className="text-gray-700">—</span>
                        ) : row.debit > 0 ? (
                          <span className="text-green-400">{fmt(row.debit)}</span>
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="py-1 px-1.5 text-right font-mono whitespace-nowrap">
                        {isZero ? (
                          <span className="text-gray-700">—</span>
                        ) : row.credit > 0 ? (
                          <span className="text-red-400">{fmt(row.credit)}</span>
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="py-1 px-1.5 text-right font-mono whitespace-nowrap">
                        {isZero ? (
                          <span className="text-gray-700">0</span>
                        ) : (
                          <span className="text-white font-medium">{fmt(row.balance)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr className={`border-t-2 ${borderColor}`}>
                  <td colSpan={2} className="py-2.5 px-1.5 font-bold text-white uppercase tracking-wider">
                    TOTAL {title}
                  </td>
                  <td className="py-2.5 px-1.5 text-right font-bold font-mono text-green-400 whitespace-nowrap">
                    {fmt(totalDebit)}
                  </td>
                  <td className="py-2.5 px-1.5 text-right font-bold font-mono text-red-400 whitespace-nowrap">
                    {fmt(totalCredit)}
                  </td>
                  <td
                    className={`py-2.5 px-1.5 text-right font-bold font-mono text-lg ${colorClass} whitespace-nowrap`}
                  >
                    {fmt(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-2.5 text-xs text-blue-300 flex items-center gap-2">
        <List className="w-4 h-4 shrink-0" />
        Vue détaillée — Plan comptable complet avec tous les postes (y compris soldes à 0) pour vérification
        expert-comptable.
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderTable('ACTIF', actifRows, totalAssets, 'text-blue-400', 'border-blue-500/50')}
        {renderTable('PASSIF', passifRows, totalPassif, 'text-red-400', 'border-red-500/50')}
      </div>
    </div>
  );
};

export default BalanceSheet;
