
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

const IncomeStatement = ({ incomeStatement, period, onExportPDF, onExportHTML }) => {
  if (!incomeStatement) return null;

  const { revenueItems, expenseItems, totalRevenue, totalExpenses, netIncome } = incomeStatement;
  const isProfit = netIncome >= 0;

  const renderSection = (groups) => (
    groups.map(group => (
      <div key={group.category} className="space-y-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{group.category}</p>
        {group.accounts.filter(a => a.amount > 0).map(account => (
          <div key={account.id || account.account_code} className="flex justify-between items-center py-1 px-2 hover:bg-gray-800/50 rounded">
            <span className="text-sm text-gray-300">
              <span className="font-mono text-xs text-gray-500 mr-2">{account.account_code}</span>
              {account.account_name}
            </span>
            <span className="font-mono text-sm text-white">{formatCurrency(account.amount)}</span>
          </div>
        ))}
      </div>
    ))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gradient flex items-center gap-2">
            {isProfit ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            Compte de résultat
          </h2>
          {period && (
            <p className="text-sm text-gray-400">
              Du {new Date(period.startDate).toLocaleDateString('fr-FR')} au {new Date(period.endDate).toLocaleDateString('fr-FR')}
            </p>
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

      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6 space-y-6">
          {/* PRODUITS */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-green-400 border-b border-gray-700 pb-2">Produits</h3>
            {revenueItems.length > 0 ? renderSection(revenueItems) : (
              <div className="flex justify-between py-1 px-2">
                <span className="text-sm text-gray-300">Chiffre d'affaires</span>
                <span className="font-mono text-sm text-white">{formatCurrency(totalRevenue)}</span>
              </div>
            )}
            <div className="border-t border-green-500/30 pt-2 flex justify-between">
              <span className="font-medium text-green-400">Total Produits</span>
              <span className="font-bold font-mono text-green-400">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>

          {/* CHARGES */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-red-400 border-b border-gray-700 pb-2">Charges</h3>
            {expenseItems.length > 0 ? renderSection(expenseItems) : (
              <div className="flex justify-between py-1 px-2">
                <span className="text-sm text-gray-300">Total des charges</span>
                <span className="font-mono text-sm text-white">{formatCurrency(totalExpenses)}</span>
              </div>
            )}
            <div className="border-t border-red-500/30 pt-2 flex justify-between">
              <span className="font-medium text-red-400">Total Charges</span>
              <span className="font-bold font-mono text-red-400">{formatCurrency(totalExpenses)}</span>
            </div>
          </div>

          {/* RÉSULTAT NET */}
          <div className={`border-t-2 pt-4 flex justify-between items-center ${isProfit ? 'border-green-500' : 'border-red-500'}`}>
            <span className="text-xl font-bold text-white">
              Résultat Net ({isProfit ? 'Bénéfice' : 'Perte'})
            </span>
            <span className={`text-2xl font-bold font-mono ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(netIncome)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IncomeStatement;
