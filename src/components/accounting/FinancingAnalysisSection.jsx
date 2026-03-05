import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, DollarSign, ArrowRightLeft, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';
import RatioInfoPopover from './RatioInfoPopover';

/**
 * Section Analyse du Financement
 * Affiche: CAF, BFR, Variation BFR, Flux de tresorerie, Endettement net
 */
const FinancingAnalysisSection = ({ data, currency = 'EUR' }) => {
  if (!data) {
    return (
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <Wallet className="w-5 h-5" />
            Analyse du Financement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">Aucune donnee disponible</p>
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

  // Composant pour une carte de metrique de financement
  const FinanceMetricCard = ({ icon: Icon, label, value, subLabel, colorClass, badge, info }) => (
    <Card className="bg-gray-900/50 border border-gray-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="p-2 bg-gray-800 rounded-lg">
            <Icon className={`w-5 h-5 ${colorClass || 'text-purple-400'}`} />
          </div>
          <div className="flex items-center gap-2">
            {badge && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.className}`}>
                {badge.text}
              </span>
            )}
            {info && <RatioInfoPopover {...info} />}
          </div>
        </div>
        <p className="text-sm text-gray-400 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${
          value >= 0 ? 'text-gray-100' : 'text-red-400'
        }`}>
          {formatCurrency(value, currency)}
        </p>
        {subLabel && (
          <p className="text-xs text-gray-500 mt-1">{subLabel}</p>
        )}
      </CardContent>
    </Card>
  );

  // Determiner le badge pour la variation du BFR
  const getBFRVariationBadge = () => {
    if (bfrVariation === 0) {
      return { text: 'Stable', className: 'bg-gray-700 text-gray-300' };
    } else if (bfrVariation < 0) {
      return { text: 'Amelioration', className: 'bg-green-500/20 text-green-400' };
    } else {
      return { text: 'Augmentation', className: 'bg-orange-500/20 text-orange-400' };
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tete de section */}
      <div className="flex items-center gap-2">
        <Wallet className="w-6 h-6 text-purple-400" />
        <h2 className="text-2xl font-bold text-gray-100">Analyse du Financement</h2>
      </div>

      {/* Grid de metriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <FinanceMetricCard
          icon={DollarSign}
          label="Capacite d'Autofinancement (CAF)"
          value={caf}
          subLabel="Ressources generees par l'activite"
          colorClass={caf >= 0 ? 'text-green-400' : 'text-red-400'}
          info={{
            title: "Capacite d'Autofinancement (CAF)",
            formula: 'CAF = resultat net + charges calculees - produits calcules',
            definition: "La CAF mesure la capacite de l'entreprise a generer du cash via son activite.",
            utility: "Elle aide a estimer la capacite a rembourser la dette, investir, ou distribuer des dividendes.",
            interpretation: "CAF positive: creation de ressources internes. CAF negative: dependance au financement externe.",
          }}
        />
        <FinanceMetricCard
          icon={ArrowRightLeft}
          label="Besoin en Fonds de Roulement (BFR)"
          value={bfr}
          subLabel="Besoin de financement du cycle d'exploitation"
          colorClass={bfr >= 0 ? 'text-orange-400' : 'text-green-400'}
          badge={getBFRVariationBadge()}
          info={{
            title: 'Besoin en Fonds de Roulement (BFR)',
            formula: 'BFR = stocks + creances clients - dettes fournisseurs',
            definition: "Le BFR represente le cash immobilise dans l'exploitation courante.",
            utility: "Il permet de piloter les delais de paiement clients/fournisseurs et la gestion des stocks.",
            interpretation: "BFR eleve: l'activite consomme du cash. BFR faible ou negatif: cycle d'exploitation plus favorable.",
          }}
        />
        <FinanceMetricCard
          icon={TrendingUp}
          label="Flux de Tresorerie d'Exploitation"
          value={operatingCashFlow}
          subLabel="CAF - Variation BFR"
          colorClass={operatingCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}
          info={{
            title: "Flux de Tresorerie d'Exploitation",
            formula: "Flux d'exploitation = CAF - variation du BFR",
            definition: "Ce flux indique la tresorerie generee ou consommee par le coeur d'activite.",
            utility: "Il aide a verifier si l'activite finance ses besoins sans recourir systematiquement a la dette.",
            interpretation: "Flux positif: activite saine en cash. Flux negatif: tension de tresorerie a surveiller rapidement.",
          }}
        />
      </div>

      {/* Deuxieme ligne: Endettement et Structure financiere */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Endettement Net */}
        <Card className="bg-gray-900/50 border border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-gray-100">
              <CreditCard className="w-5 h-5" />
              Endettement Net
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-3xl font-bold text-gray-100">
                  {formatCurrency(netDebt, currency)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Dettes financieres - Tresorerie
                </p>
              </div>

              {/* Detail de la composition */}
              <div className="pt-3 border-t border-gray-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Dettes totales</span>
                  <span className="text-sm font-semibold text-red-400">
                    {formatCurrency(totalDebt, currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Capitaux propres</span>
                  <span className="text-sm font-semibold text-green-400">
                    {formatCurrency(equity, currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold text-gray-300">
                      Ratio d'endettement
                    </span>
                    <RatioInfoPopover
                      title="Ratio d'endettement"
                      formula="Ratio = dettes totales / capitaux propres"
                      definition="Ce ratio mesure le poids de la dette par rapport aux fonds propres."
                      utility="Il sert a evaluer le risque financier et la marge de manoeuvre pour emprunter."
                      interpretation="Au-dela de 1, la dette depasse les fonds propres. Plus il monte, plus la structure est sensible aux chocs."
                    />
                  </div>
                  <span className={`text-sm font-bold ${
                    (totalDebt / equity) > 1 ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    {equity !== 0 ? (totalDebt / equity).toFixed(2) : '-'}
                  </span>
                </div>
              </div>

              {/* Barre de progression */}
              <div className="pt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Structure financiere</span>
                  <span>
                    {equity + totalDebt !== 0
                      ? ((totalDebt / (equity + totalDebt)) * 100).toFixed(0)
                      : 0}% dette
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
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

        {/* Analyse de la tresorerie */}
        <Card className="bg-gray-900/50 border border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-gray-100">
              <TrendingUp className="w-5 h-5" />
              Analyse de la Tresorerie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Fonds de roulement */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-400">Fonds de Roulement</span>
                  <span className={`text-lg font-bold ${
                    workingCapital >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(workingCapital, currency)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Ressources stables - Actifs immobilises
                </p>
              </div>

              <div className="pt-2 border-t border-gray-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-400">BFR</span>
                  <span className={`text-lg font-bold ${
                    bfr >= 0 ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    {formatCurrency(bfr, currency)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Besoins de l'exploitation
                </p>
              </div>

              <div className="pt-2 border-t border-gray-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-400">Variation du BFR</span>
                  <span className={`text-lg font-bold ${
                    bfrVariation <= 0 ? 'text-green-400' : 'text-orange-400'
                  }`}>
                    {bfrVariation >= 0 ? '+' : ''}{formatCurrency(bfrVariation, currency)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {bfrVariation < 0
                    ? 'Liberation de tresorerie'
                    : bfrVariation > 0
                    ? 'Consommation de tresorerie'
                    : 'Pas de changement'}
                </p>
              </div>

              {/* Tresorerie nette */}
              <div className="pt-3 border-t border-gray-800">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-300">
                    Tresorerie Nette Theorique
                  </span>
                  <span className={`text-lg font-bold ${
                    (workingCapital - bfr) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(workingCapital - bfr, currency)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Fonds de Roulement - BFR
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertes et recommandations */}
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-gray-100">Recommandations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {caf < 0 && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">
                  <strong>Alerte:</strong> La CAF est negative. L'entreprise ne genere pas
                  suffisamment de ressources par son activite.
                </p>
              </div>
            )}

            {bfrVariation > 0 && bfrVariation > caf * 0.5 && (
              <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-sm text-orange-400">
                  <strong>Attention:</strong> L'augmentation du BFR consomme une part importante
                  de la CAF. Envisagez d'optimiser vos delais clients/fournisseurs.
                </p>
              </div>
            )}

            {operatingCashFlow < 0 && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">
                  <strong>Critique:</strong> Le flux de tresorerie d'exploitation est negatif.
                  L'activite consomme de la tresorerie.
                </p>
              </div>
            )}

            {totalDebt / equity > 2 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  <strong>Attention:</strong> Le ratio d'endettement est eleve (&gt; 2).
                  Surveillez votre capacite de remboursement.
                </p>
              </div>
            )}

            {caf > 0 && operatingCashFlow > 0 && bfrVariation <= 0 && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-sm text-green-400">
                  <strong>Excellent:</strong> Votre activite genere de la tresorerie et votre BFR
                  est maitrise. Situation financiere saine.
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
