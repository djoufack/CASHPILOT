
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Download, Scale, Building2, Printer } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

/**
 * Professional SYSCOHADA Balance Sheet Component
 * Displays the full chart of accounts with all categories, even at 0
 */
const BalanceSheet = ({ balanceSheet, period, currency = 'XAF', companyInfo, onExportPDF, onExportHTML }) => {
  if (!balanceSheet) return null;

  const { totalAssets, totalPassif, balanced, syscohada } = balanceSheet;
  const fmt = (amount) => formatCurrency(amount, currency);

  // Render a SYSCOHADA section (e.g., ACTIF IMMOBILISÉ)
  const renderSection = (section) => {
    if (!section.groups || section.groups.length === 0) {
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
        {/* Section header */}
        <div className="flex justify-between items-center py-2 px-3 bg-gray-800/40 rounded mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{section.label}</span>
          <span className="font-mono text-sm font-semibold text-gray-300">{fmt(section.total)}</span>
        </div>

        {/* Class groups within the section */}
        {section.groups.map((group) => (
          <div key={group.classCode} className="ml-2 mb-2">
            {/* Class header (2-digit code) */}
            <div className="flex justify-between items-center py-1.5 px-2 border-b border-gray-800">
              <span className="text-xs font-semibold text-orange-400 uppercase tracking-wide">
                <span className="font-mono mr-2">{group.classCode}</span>
                {group.className}
              </span>
              <span className="font-mono text-xs font-medium text-orange-400">{fmt(group.subtotal)}</span>
            </div>

            {/* Individual accounts (3+ digit codes) */}
            {group.accounts.map((account) => (
              <div
                key={account.account_code}
                className={`flex justify-between items-center py-1 px-2 pl-6 hover:bg-gray-800/30 transition-colors ${
                  account.balance === 0 ? 'opacity-50' : ''
                }`}
              >
                <span className="text-xs text-gray-300">
                  <span className="font-mono text-gray-500 mr-2 inline-block w-12">{account.account_code}</span>
                  {account.account_name}
                </span>
                <span className={`font-mono text-xs ${account.balance === 0 ? 'text-gray-600' : 'text-white'}`}>
                  {fmt(account.balance)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  // If no SYSCOHADA data, show legacy view
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
      <div className="flex justify-between items-start">
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
              Exercice du {new Date(period.startDate).toLocaleDateString('fr-FR')} au{' '}
              {new Date(period.endDate).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
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
      <Card className={`border ${balanced ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
        <CardContent className="py-3 px-4 flex items-center justify-between">
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
          <div className="flex gap-6 text-xs">
            <span className="text-gray-400">Total Actif: <span className="font-mono text-blue-400 font-semibold">{fmt(totalAssets)}</span></span>
            <span className="text-gray-400">Total Passif: <span className="font-mono text-red-400 font-semibold">{fmt(totalPassif)}</span></span>
          </div>
        </CardContent>
      </Card>

      {/* Two columns: ACTIF | PASSIF */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ACTIF */}
        <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-blue-400 text-sm uppercase tracking-wider flex items-center justify-between">
              <span>ACTIF</span>
              <span className="font-mono text-base">{fmt(totalAssets)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Table header */}
            <div className="flex justify-between items-center py-1.5 px-2 border-b border-gray-700 mb-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Compte / Libellé</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Montant ({currency})</span>
            </div>

            {syscohada.actif.map(renderSection)}

            {/* Total ACTIF */}
            <div className="border-t-2 border-blue-500/50 mt-3 pt-3 flex justify-between items-center">
              <span className="font-bold text-white text-sm uppercase tracking-wider">TOTAL ACTIF</span>
              <span className="font-bold font-mono text-blue-400 text-lg">{fmt(totalAssets)}</span>
            </div>
          </CardContent>
        </Card>

        {/* PASSIF */}
        <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-red-400 text-sm uppercase tracking-wider flex items-center justify-between">
              <span>PASSIF</span>
              <span className="font-mono text-base">{fmt(totalPassif)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Table header */}
            <div className="flex justify-between items-center py-1.5 px-2 border-b border-gray-700 mb-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Compte / Libellé</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Montant ({currency})</span>
            </div>

            {syscohada.passif.map(renderSection)}

            {/* Total PASSIF */}
            <div className="border-t-2 border-red-500/50 mt-3 pt-3 flex justify-between items-center">
              <span className="font-bold text-white text-sm uppercase tracking-wider">TOTAL PASSIF</span>
              <span className="font-bold font-mono text-red-400 text-lg">{fmt(totalPassif)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer - Print date */}
      <p className="text-[10px] text-gray-600 text-center">
        Bilan généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}
        {' — '} CashPilot
      </p>
    </div>
  );
};

export default BalanceSheet;
