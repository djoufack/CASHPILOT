
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Download, FileText, Scale } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

const BalanceSheet = ({ balanceSheet, period, onExportPDF, onExportHTML }) => {
  if (!balanceSheet) return null;

  const { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, totalPassif, balanced } = balanceSheet;

  const renderSection = (groups, title, emptyMsg) => (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-white border-b border-gray-700 pb-2">{title}</h3>
      {groups.length === 0 ? (
        <p className="text-sm text-gray-500 italic">{emptyMsg}</p>
      ) : (
        groups.map(group => (
          <div key={group.category} className="space-y-1">
            <p className="text-sm font-medium text-orange-400 uppercase tracking-wider">{group.category}</p>
            {group.accounts.filter(a => a.balance !== 0).map(account => (
              <div key={account.id || account.account_code} className="flex justify-between items-center py-1 px-2 hover:bg-gray-800/50 rounded">
                <span className="text-sm text-gray-300">
                  <span className="font-mono text-xs text-gray-500 mr-2">{account.account_code}</span>
                  {account.account_name}
                </span>
                <span className="font-mono text-sm text-white">{formatCurrency(account.balance)}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gradient flex items-center gap-2">
            <Scale className="w-5 h-5" /> Bilan
          </h2>
          {period && (
            <p className="text-sm text-gray-400">Au {new Date(period.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          )}
        </div>
        <div className="flex gap-2">
          {onExportPDF && (
            <Button variant="outline" size="sm" onClick={onExportPDF} className="border-gray-700 text-gray-300">
              <Download className="w-4 h-4 mr-2" /> Exporter PDF
            </Button>
          )}
          {onExportHTML && (
            <Button variant="outline" size="sm" onClick={onExportHTML} className="border-gray-700 text-gray-300">
              <FileText className="w-4 h-4 mr-2" /> Exporter HTML
            </Button>
          )}
        </div>
      </div>

      {/* Balance warning */}
      {!balanced && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">Le bilan n'est pas équilibré (Actif ≠ Passif)</span>
        </div>
      )}

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ACTIF */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-blue-400 text-sm uppercase tracking-wider">Actif</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderSection(assets, '', 'Aucun compte d\'actif')}
            <div className="border-t-2 border-blue-500/50 pt-3 flex justify-between">
              <span className="font-bold text-white">Total Actif</span>
              <span className="font-bold font-mono text-blue-400 text-lg">{formatCurrency(totalAssets)}</span>
            </div>
          </CardContent>
        </Card>

        {/* PASSIF + CAPITAUX */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-400 text-sm uppercase tracking-wider">Passif & Capitaux propres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderSection(liabilities, 'Passif', 'Aucun compte de passif')}
            <div className="border-t border-gray-700 pt-3">
              {renderSection(equity, 'Capitaux propres', 'Aucun compte de capitaux propres')}
            </div>
            <div className="border-t-2 border-red-500/50 pt-3 flex justify-between">
              <span className="font-bold text-white">Total Passif + Capitaux</span>
              <span className="font-bold font-mono text-red-400 text-lg">{formatCurrency(totalPassif || (totalLiabilities + totalEquity))}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BalanceSheet;
