import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

function toNumber(value) {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAccount(account) {
  return {
    id: account?.id || account?.account_code || account?.code || `${account?.category || 'other'}-${account?.account_name || account?.label || 'row'}`,
    account_code: account?.account_code || account?.code || '',
    account_name: account?.account_name || account?.label || 'Compte sans libellé',
    amount: toNumber(account?.amount ?? account?.balance ?? 0),
  };
}

function normalizeGroups(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length === 0) return [];

  const hasNestedAccounts = list.some((item) => Array.isArray(item?.accounts));
  if (hasNestedAccounts) {
    return list.map((group, index) => ({
      category: group?.category || group?.label || `Section ${index + 1}`,
      accounts: (Array.isArray(group?.accounts) ? group.accounts : []).map(normalizeAccount),
    }));
  }

  const grouped = new Map();
  for (const item of list) {
    const category = item?.category || item?.group || 'Autres';
    if (!grouped.has(category)) {
      grouped.set(category, { category, accounts: [] });
    }
    grouped.get(category).accounts.push(normalizeAccount(item));
  }

  return Array.from(grouped.values());
}

const IncomeStatement = ({ incomeStatement, period, onExportPDF, onExportHTML, currency }) => {
  const revenueGroups = useMemo(() => normalizeGroups(incomeStatement?.revenueItems), [incomeStatement?.revenueItems]);
  const expenseGroups = useMemo(() => normalizeGroups(incomeStatement?.expenseItems), [incomeStatement?.expenseItems]);

  if (!incomeStatement) return null;

  const totalRevenue = toNumber(incomeStatement.totalRevenue);
  const totalExpenses = toNumber(incomeStatement.totalExpenses);
  const netIncome = toNumber(incomeStatement.netIncome);
  const isProfit = netIncome >= 0;

  const renderSection = (groups) => (
    groups.map((group) => {
      const accounts = (Array.isArray(group?.accounts) ? group.accounts : []).filter((account) => Math.abs(account.amount) > 0.001);
      if (accounts.length === 0) return null;

      return (
        <div key={group.category} className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{group.category}</p>
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-gray-800/50">
              <span className="text-sm text-gray-300">
                <span className="mr-2 font-mono text-xs text-gray-500">{account.account_code}</span>
                {account.account_name}
              </span>
              <span className={`font-mono text-sm ${account.amount < 0 ? 'text-amber-300' : 'text-white'}`}>
                {formatCurrency(account.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      );
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gradient">
            {isProfit ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            Compte de résultat
          </h2>
          {period && (
            <p className="text-sm text-gray-400">
              Du {new Date(period.startDate).toLocaleDateString('fr-FR')} au {new Date(period.endDate).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {onExportPDF && (
            <Button variant="outline" size="sm" onClick={onExportPDF} className="border-gray-700 text-gray-300">
              <Download className="mr-2 h-4 w-4" /> Exporter PDF
            </Button>
          )}
          {onExportHTML && (
            <Button variant="outline" size="sm" onClick={onExportHTML} className="border-gray-700 text-gray-300">
              <FileText className="mr-2 h-4 w-4" /> Exporter HTML
            </Button>
          )}
        </div>
      </div>

      <Card className="border-gray-800 bg-gray-900">
        <CardContent className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="border-b border-gray-700 pb-2 text-lg font-bold text-green-400">Produits</h3>
              {revenueGroups.length > 0 ? renderSection(revenueGroups) : (
                <div className="flex justify-between px-2 py-1">
                  <span className="text-sm text-gray-300">Chiffre d'affaires</span>
                  <span className="font-mono text-sm text-white">{formatCurrency(totalRevenue, currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-green-500/30 pt-2">
                <span className="font-medium text-green-400">Total Produits</span>
                <span className="font-mono font-bold text-green-400">{formatCurrency(totalRevenue, currency)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="border-b border-gray-700 pb-2 text-lg font-bold text-red-400">Charges</h3>
              {expenseGroups.length > 0 ? renderSection(expenseGroups) : (
                <div className="flex justify-between px-2 py-1">
                  <span className="text-sm text-gray-300">Total des charges</span>
                  <span className="font-mono text-sm text-white">{formatCurrency(totalExpenses, currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-red-500/30 pt-2">
                <span className="font-medium text-red-400">Total Charges</span>
                <span className="font-mono font-bold text-red-400">{formatCurrency(totalExpenses, currency)}</span>
              </div>
            </div>
          </div>

          <div className={`flex items-center justify-between border-t-2 pt-4 ${isProfit ? 'border-green-500' : 'border-red-500'}`}>
            <span className="text-xl font-bold text-white">
              Résultat Net ({isProfit ? 'Bénéfice' : 'Perte'})
            </span>
            <span className={`font-mono text-2xl font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(netIncome, currency)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IncomeStatement;


