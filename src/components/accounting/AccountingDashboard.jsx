import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Receipt, AlertTriangle, FileText } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';

const AccountingDashboard = ({ revenue, totalExpenses, netIncome, vatPayable, monthlyData, accounts, mappings, currency }) => {
  const isProfit = netIncome >= 0;
  const hasAccounts = accounts && accounts.length > 0;
  const hasMappings = mappings && mappings.length > 0;
  const dashboardInfo = {
    revenue: {
      title: "Chiffre d'affaires HT",
      definition: "Montant des produits hors TVA sur la période sélectionnée.",
      dataSource: 'Agrégat `revenue` issu des fonctions SQL comptables via `useAccountingData`.',
      formula: "CA HT = Somme des comptes de produits (classe 7) retenus sur la période.",
      calculationMethod:
        "La valeur est calculée côté base par les RPC comptables puis affichée dans la devise de la société.",
    },
    expenses: {
      title: 'Total des charges',
      definition: 'Montant total des charges comptabilisées sur la période.',
      dataSource: 'Agrégat `totalExpenses` issu des fonctions SQL comptables via `useAccountingData`.',
      formula: 'Total charges = Somme des comptes de charges (classe 6) sur la période.',
      calculationMethod:
        'La valeur est calculée côté base via les fonctions comptables puis exposée au dashboard.',
    },
    netIncome: {
      title: 'Résultat net',
      definition: 'Résultat de la période après prise en compte des produits et charges.',
      dataSource: 'Agrégat `netIncome` issu de la fonction SQL de compte de résultat.',
      formula: 'Résultat net = Produits - Charges',
      calculationMethod: 'Différence entre total produits et total charges calculés côté base.',
    },
    vatPayable: {
      title: 'TVA à payer',
      definition: 'Position TVA nette due sur la période.',
      dataSource: 'Agrégat `vatPayable` issu du résumé TVA SQL.',
      formula: 'TVA à payer = TVA collectée - TVA déductible',
      calculationMethod:
        'Calcule séparément les bases collectées et déductibles puis affiche le solde net.',
    },
    revenueVsExpenses: {
      title: 'Revenus vs Charges',
      definition: 'Comparaison mensuelle des produits et charges.',
      dataSource: 'Série `monthlyData` issue de la fonction SQL `f_monthly_chart_data`.',
      formula: 'Par mois: produits et charges agrégés séparément.',
      calculationMethod:
        'Agrége les montants par période mensuelle et trace les deux séries dans un histogramme.',
    },
    netTrend: {
      title: 'Tendance Résultat Net',
      definition: 'Évolution mensuelle du résultat net sur la période.',
      dataSource: 'Série `monthlyData` transformée localement en `net = revenue - expense`.',
      formula: 'Net mensuel = revenue - expense',
      calculationMethod:
        'Calcule le net pour chaque mois puis affiche une courbe de tendance.',
    },
  };

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
            <CardTitle className="text-sm font-medium text-gray-400 inline-flex items-center gap-1.5">
              <PanelInfoPopover {...dashboardInfo.revenue} />
              <span>Chiffre d'affaires HT</span>
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gradient">{formatCurrency(revenue || 0, currency)}</div>
            <p className="text-xs text-gray-500">Factures payées</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 inline-flex items-center gap-1.5">
              <PanelInfoPopover {...dashboardInfo.expenses} />
              <span>Total des charges</span>
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{formatCurrency(totalExpenses || 0, currency)}</div>
            <p className="text-xs text-gray-500">Dépenses + fournisseurs</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 inline-flex items-center gap-1.5">
              <PanelInfoPopover {...dashboardInfo.netIncome} />
              <span>Résultat net</span>
            </CardTitle>
            {isProfit ? <TrendingUp className="h-4 w-4 text-green-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(netIncome || 0, currency)}
            </div>
            <Badge className={`text-xs mt-1 ${isProfit ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {isProfit ? 'Bénéfice' : 'Perte'}
            </Badge>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 inline-flex items-center gap-1.5">
              <PanelInfoPopover {...dashboardInfo.vatPayable} />
              <span>TVA à payer</span>
            </CardTitle>
            <Receipt className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">{formatCurrency(vatPayable || 0, currency)}</div>
            <p className="text-xs text-gray-500">Collectée - Déductible</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue vs Expenses Bar Chart */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 inline-flex items-center gap-1.5">
              <PanelInfoPopover {...dashboardInfo.revenueVsExpenses} />
              <span>Revenus vs Charges</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {monthlyData && monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} barCategoryGap="20%">
                    <defs>
                      <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity={1} />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.6} />
                      </linearGradient>
                      <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity={1} />
                        <stop offset="100%" stopColor="#EF4444" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => formatCurrency(value, currency)}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#9CA3AF' }} />
                    <Bar dataKey="revenue" fill="url(#gradRevenue)" name="Revenus" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill="url(#gradExpense)" name="Charges" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p className="text-sm">Aucune donnée pour cette période</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Net Income Trend Area Chart */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 inline-flex items-center gap-1.5">
              <PanelInfoPopover {...dashboardInfo.netTrend} />
              <span>Tendance Résultat Net</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {monthlyData && monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData.map(m => ({ ...m, net: (m.revenue || 0) - (m.expense || 0) }))}>
                    <defs>
                      <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => formatCurrency(value, currency)}
                      cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <Area type="monotone" dataKey="net" stroke="#22C55E" strokeWidth={2} fill="url(#gradNet)" name="Résultat net" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p className="text-sm">Aucune donnée pour cette période</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccountingDashboard;
