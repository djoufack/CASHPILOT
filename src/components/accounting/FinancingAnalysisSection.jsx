import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingDown, TrendingUp, DollarSign, ArrowRightLeft, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

/**
 * Section Analyse du Financement
 * Affiche: CAF, BFR, Variation BFR, Flux de trésorerie, Endettement net
 */
const FinancingAnalysisSection = ({ data }) => {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Analyse du Financement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Aucune donnée disponible</p>
        </CardContent>
      </Card>
    );
  }

  const {
    caf,
    workingCapital,
    bfr,
    bfrVariation,
    operatingCashFlow,
    netDebt,
    equity,
    totalDebt
  } = data;

  // Composant pour une carte de métrique de financement
  const FinanceMetricCard = ({ icon: Icon, label, value, subLabel, colorClass, badge }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Icon className={`w-5 h-5 ${colorClass || 'text-purple-600'}`} />
          </div>
          {badge && (
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.className}`}>
              {badge.text}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${
          value >= 0 ? 'text-gray-900' : 'text-red-600'
        }`}>
          {formatCurrency(value)}
        </p>
        {subLabel && (
          <p className="text-xs text-gray-400 mt-1">{subLabel}</p>
        )}
      </CardContent>
    </Card>
  );

  // Déterminer le badge pour la variation du BFR
  const getBFRVariationBadge = () => {
    if (bfrVariation === 0) {
      return { text: 'Stable', className: 'bg-gray-100 text-gray-700' };
    } else if (bfrVariation < 0) {
      return { text: 'Amélioration', className: 'bg-green-100 text-green-700' };
    } else {
      return { text: 'Augmentation', className: 'bg-orange-100 text-orange-700' };
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tête de section */}
      <div className="flex items-center gap-2">
        <Wallet className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold text-gray-900">Analyse du Financement</h2>
      </div>

      {/* Grid de métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CAF */}
        <FinanceMetricCard
          icon={DollarSign}
          label="Capacité d'Autofinancement (CAF)"
          value={caf}
          subLabel="Ressources générées par l'activité"
          colorClass={caf >= 0 ? 'text-green-600' : 'text-red-600'}
        />

        {/* BFR */}
        <FinanceMetricCard
          icon={ArrowRightLeft}
          label="Besoin en Fonds de Roulement (BFR)"
          value={bfr}
          subLabel="Besoin de financement du cycle d'exploitation"
          colorClass={bfr >= 0 ? 'text-orange-600' : 'text-green-600'}
          badge={getBFRVariationBadge()}
        />

        {/* Flux de trésorerie d'exploitation */}
        <FinanceMetricCard
          icon={TrendingUp}
          label="Flux de Trésorerie d'Exploitation"
          value={operatingCashFlow}
          subLabel="CAF - Variation BFR"
          colorClass={operatingCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* Deuxième ligne: Endettement et Structure financière */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Endettement Net */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Endettement Net
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(netDebt)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Dettes financières - Trésorerie
                </p>
              </div>

              {/* Détail de la composition */}
              <div className="pt-3 border-t space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Dettes totales</span>
                  <span className="text-sm font-semibold text-red-600">
                    {formatCurrency(totalDebt)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Capitaux propres</span>
                  <span className="text-sm font-semibold text-green-600">
                    {formatCurrency(equity)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm font-semibold text-gray-700">
                    Ratio d'endettement
                  </span>
                  <span className={`text-sm font-bold ${
                    (totalDebt / equity) > 1 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {equity !== 0 ? (totalDebt / equity).toFixed(2) : '-'}
                  </span>
                </div>
              </div>

              {/* Barre de progression */}
              <div className="pt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Structure financière</span>
                  <span>
                    {equity + totalDebt !== 0
                      ? ((totalDebt / (equity + totalDebt)) * 100).toFixed(0)
                      : 0}% dette
                  </span>
                </div>
                <div className="w-full bg-green-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-red-500"
                    style={{
                      width: `${equity + totalDebt !== 0
                        ? Math.min((totalDebt / (equity + totalDebt)) * 100, 100)
                        : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analyse de la trésorerie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Analyse de la Trésorerie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Fonds de roulement */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Fonds de Roulement</span>
                  <span className={`text-lg font-bold ${
                    workingCapital >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(workingCapital)}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Ressources stables - Actifs immobilisés
                </p>
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">BFR</span>
                  <span className={`text-lg font-bold ${
                    bfr >= 0 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {formatCurrency(bfr)}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Besoins de l'exploitation
                </p>
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Variation du BFR</span>
                  <span className={`text-lg font-bold ${
                    bfrVariation <= 0 ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {bfrVariation >= 0 ? '+' : ''}{formatCurrency(bfrVariation)}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {bfrVariation < 0
                    ? 'Libération de trésorerie'
                    : bfrVariation > 0
                    ? 'Consommation de trésorerie'
                    : 'Pas de changement'}
                </p>
              </div>

              {/* Trésorerie nette */}
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">
                    Trésorerie Nette Théorique
                  </span>
                  <span className={`text-lg font-bold ${
                    (workingCapital - bfr) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(workingCapital - bfr)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Fonds de Roulement - BFR
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertes et recommandations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recommandations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {caf < 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Alerte:</strong> La CAF est négative. L'entreprise ne génère pas
                  suffisamment de ressources par son activité.
                </p>
              </div>
            )}

            {bfrVariation > 0 && bfrVariation > caf * 0.5 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  <strong>Attention:</strong> L'augmentation du BFR consomme une part importante
                  de la CAF. Envisagez d'optimiser vos délais clients/fournisseurs.
                </p>
              </div>
            )}

            {operatingCashFlow < 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Critique:</strong> Le flux de trésorerie d'exploitation est négatif.
                  L'activité consomme de la trésorerie.
                </p>
              </div>
            )}

            {totalDebt / equity > 2 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Attention:</strong> Le ratio d'endettement est élevé (&#62; 2).
                  Surveillez votre capacité de remboursement.
                </p>
              </div>
            )}

            {caf > 0 && operatingCashFlow > 0 && bfrVariation <= 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Excellent:</strong> Votre activité génère de la trésorerie et votre BFR
                  est maîtrisé. Situation financière saine.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancingAnalysisSection;
