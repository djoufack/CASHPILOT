
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Receipt, AlertTriangle, FileText } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

const AccountingDashboard = ({ revenue, totalExpenses, netIncome, vatPayable, monthlyData, accounts, mappings }) => {
  const isProfit = netIncome >= 0;
  const hasAccounts = accounts && accounts.length > 0;
  const hasMappings = mappings && mappings.length > 0;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {!hasAccounts && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <FileText className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium text-sm">Aucun plan comptable importé</p>
            <p className="text-xs text-gray-400 mt-1">
              Importez votre plan comptable via l'onglet "Plan comptable" pour activer les rapports Bilan et Compte de résultat.
            </p>
          </div>
        </div>
      )}

      {hasAccounts && !hasMappings && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium text-sm">Mappings non configurés</p>
            <p className="text-xs text-gray-400 mt-1">
              Configurez les mappings dans l'onglet "Mappings" pour associer vos transactions aux comptes comptables.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Chiffre d'affaires HT</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gradient">{formatCurrency(revenue || 0)}</div>
            <p className="text-xs text-gray-500">Factures payées</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total des charges</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{formatCurrency(totalExpenses || 0)}</div>
            <p className="text-xs text-gray-500">Dépenses + fournisseurs</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Résultat net</CardTitle>
            {isProfit ? <TrendingUp className="h-4 w-4 text-green-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(netIncome || 0)}
            </div>
            <Badge className={`text-xs mt-1 ${isProfit ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {isProfit ? 'Bénéfice' : 'Perte'}
            </Badge>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">TVA à payer</CardTitle>
            <Receipt className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">{formatCurrency(vatPayable || 0)}</div>
            <p className="text-xs text-gray-500">Collectée - Déductible</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-gradient">Revenus vs Charges par mois</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {monthlyData && monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#F59E0B" name="Revenus" />
                  <Bar dataKey="expense" fill="#EF4444" name="Charges" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Aucune donnée pour cette période</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountingDashboard;
