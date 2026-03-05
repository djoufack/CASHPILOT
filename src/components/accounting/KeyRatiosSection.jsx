import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Droplets, Scale } from 'lucide-react';
import RatioGauge from './RatioGauge';
import RatioInfoPopover from './RatioInfoPopover';

const KeyRatiosSection = ({ data }) => {
  if (!data) {
    return (
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <BarChart3 className="w-5 h-5" />
            Ratios Cles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">Aucune donnee disponible</p>
        </CardContent>
      </Card>
    );
  }

  const { profitability, liquidity, leverage } = data;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-indigo-400" />
        <h2 className="text-2xl font-bold text-gray-100">Ratios Cles</h2>
      </div>

      {/* Rentabilite */}
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-gray-100">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Rentabilite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <RatioGauge
              label="Rentabilite des Capitaux Propres (ROE)"
              value={profitability.roe}
              format="percentage"
              thresholds={{ excellent: 20, good: 15, warning: 10, poor: 5 }}
              description="Resultat net / Capitaux propres"
              info={{
                title: 'ROE (Rentabilite des capitaux propres)',
                formula: 'ROE = resultat net / capitaux propres',
                definition: "Le ROE mesure le rendement genere pour les actionnaires.",
                utility: "Il permet d'evaluer l'efficacite de l'utilisation des fonds propres.",
                interpretation: "Plus le ROE est eleve, plus les capitaux investis sont rentables. Un ROE faible durable peut signaler une rentabilite insuffisante.",
              }}
            />
            <RatioGauge
              label="Rentabilite du Capital Employe (ROCE)"
              value={profitability.roce}
              format="percentage"
              thresholds={{ excellent: 15, good: 10, warning: 7, poor: 3 }}
              description="Resultat d'exploitation / Capital employe"
              info={{
                title: 'ROCE (Rentabilite du capital employe)',
                formula: "ROCE = resultat d'exploitation / capital employe",
                definition: "Le ROCE mesure la performance des ressources durables mobilisees.",
                utility: "Il aide a juger si les investissements creent suffisamment de valeur.",
                interpretation: "ROCE eleve: bonne efficacite du capital. ROCE faible: capital sous-performant ou charges trop elevees.",
              }}
            />
            <RatioGauge
              label="Marge Operationnelle"
              value={profitability.operatingMargin}
              format="percentage"
              thresholds={{ excellent: 20, good: 15, warning: 10, poor: 5 }}
              description="Resultat d'exploitation / CA"
              info={{
                title: 'Marge operationnelle',
                formula: "Marge operationnelle = resultat d'exploitation / CA",
                definition: "Elle indique la part du chiffre d'affaires qui reste apres les charges d'exploitation.",
                utility: "Elle sert a mesurer la solidite economique du modele operationnel.",
                interpretation: "Une marge qui progresse traduit une meilleure maitrise des charges. Une marge en baisse appelle une analyse couts/prix.",
              }}
            />
            <RatioGauge
              label="Marge Nette"
              value={profitability.netMargin}
              format="percentage"
              thresholds={{ excellent: 15, good: 10, warning: 5, poor: 2 }}
              description="Resultat net / CA"
              info={{
                title: 'Marge nette',
                formula: 'Marge nette = resultat net / CA',
                definition: "La marge nette represente le benefice final conserve pour 1 euro de vente.",
                utility: "Elle donne une vision globale de la rentabilite apres toutes les charges.",
                interpretation: "Marge nette elevee: activite rentable et bien pilotee. Faible ou negative: rentabilite finale fragile.",
              }}
            />
          </div>

          <div className="mt-4 p-3 bg-blue-500/10 rounded-lg">
            <p className="text-xs text-blue-400">
              <strong>Interpretation:</strong> Les ratios de rentabilite mesurent la capacite de
              l'entreprise a generer des profits a partir de ses ressources. Un ROE eleve indique
              une bonne rentabilite pour les actionnaires.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Liquidite */}
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-gray-100">
            <Droplets className="w-5 h-5 text-blue-400" />
            Liquidite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <RatioGauge
              label="Ratio de Liquidite Generale"
              value={liquidity.currentRatio}
              format="number"
              thresholds={{ excellent: 2.0, good: 1.5, warning: 1.0, poor: 0.75 }}
              description="Actifs circulants / Passifs courants"
              info={{
                title: 'Liquidite generale',
                formula: 'Ratio = actifs circulants / passifs courants',
                definition: "Ce ratio mesure la capacite a payer les dettes a court terme avec les actifs a court terme.",
                utility: "Il alerte sur le risque de tension de tresorerie immediate.",
                interpretation: "Au-dessus de 1, la situation est generalement rassurante. En dessous de 1, le risque de paiement augmente.",
              }}
            />
            <RatioGauge
              label="Ratio de Liquidite Reduite"
              value={liquidity.quickRatio}
              format="number"
              thresholds={{ excellent: 1.5, good: 1.0, warning: 0.75, poor: 0.5 }}
              description="(Actifs circulants - Stocks) / Passifs courants"
              info={{
                title: 'Liquidite reduite',
                formula: 'Ratio = (actifs circulants - stocks) / passifs courants',
                definition: "Il evalue la capacite de paiement court terme sans compter la vente des stocks.",
                utility: "Utile pour les activites ou les stocks sont peu liquides.",
                interpretation: "Proche ou au-dessus de 1: bonne solvabilite court terme. Trop faible: dependance forte aux ventes de stocks.",
              }}
            />
            <RatioGauge
              label="Ratio de Liquidite Immediate"
              value={liquidity.cashRatio}
              format="number"
              thresholds={{ excellent: 0.5, good: 0.3, warning: 0.2, poor: 0.1 }}
              description="Tresorerie / Passifs courants"
              info={{
                title: 'Liquidite immediate',
                formula: 'Ratio = tresorerie disponible / passifs courants',
                definition: "Ce ratio mesure la capacite a payer immediatement les dettes court terme avec la tresorerie disponible.",
                utility: "Il permet d'anticiper les urgences de tresorerie.",
                interpretation: "Un ratio trop bas signale une reserve de cash limitee face aux echeances proches.",
              }}
            />
          </div>

          {/* Summary table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Ratio</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-400">Valeur</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Interpretation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                <tr>
                  <td className="px-3 py-2 text-xs text-gray-300">Liquidite Generale</td>
                  <td className="px-3 py-2 text-center text-xs font-semibold text-gray-200">
                    {liquidity.currentRatio.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">
                    {liquidity.currentRatio >= 1.5
                      ? 'Capacite a honorer les dettes CT'
                      : liquidity.currentRatio >= 1.0
                      ? 'Situation acceptable'
                      : 'Risque de difficultes de paiement'}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-xs text-gray-300">Liquidite Reduite</td>
                  <td className="px-3 py-2 text-center text-xs font-semibold text-gray-200">
                    {liquidity.quickRatio.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">
                    {liquidity.quickRatio >= 1.0
                      ? 'Bonne capacite de paiement rapide'
                      : liquidity.quickRatio >= 0.75
                      ? 'Capacite de paiement correcte'
                      : 'Dependance aux stocks pour payer'}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-xs text-gray-300">Liquidite Immediate</td>
                  <td className="px-3 py-2 text-center text-xs font-semibold text-gray-200">
                    {liquidity.cashRatio.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">
                    {liquidity.cashRatio >= 0.3
                      ? 'Excellente tresorerie disponible'
                      : liquidity.cashRatio >= 0.2
                      ? 'Tresorerie suffisante'
                      : 'Tresorerie limitee'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-blue-500/10 rounded-lg">
            <p className="text-xs text-blue-400">
              <strong>Interpretation:</strong> Les ratios de liquidite evaluent la capacite de
              l'entreprise a faire face a ses obligations a court terme. Un ratio &gt; 1 indique
              generalement une bonne sante financiere.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Endettement / Levier */}
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-gray-100">
            <Scale className="w-5 h-5 text-orange-400" />
            Structure Financiere et Endettement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RatioGauge
              label="Levier Financier (Dette / Capitaux Propres)"
              value={leverage.financialLeverage}
              format="number"
              inverse={true}
              thresholds={{ excellent: 0.5, good: 1.0, warning: 2.0, poor: 3.0 }}
              description="Dettes financieres / Capitaux propres"
              info={{
                title: 'Levier financier',
                formula: 'Levier = dettes financieres / capitaux propres',
                definition: "Le levier mesure le niveau de financement par la dette par rapport aux fonds propres.",
                utility: "Il sert a evaluer le risque financier et la sensibilite de l'entreprise.",
                interpretation: "Plus le levier est eleve, plus le risque de tension de remboursement est important.",
              }}
            />

            {/* Autonomie financiere card */}
            <Card className="bg-gray-900/50 border border-gray-800">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-gray-800 rounded-lg">
                    <Scale className="w-5 h-5 text-purple-400" />
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-1">
                  <span className="flex items-start gap-1 min-w-0">
                    <RatioInfoPopover
                      title="Ratio d'autonomie financiere"
                      formula='Autonomie = capitaux propres / (capitaux propres + dettes)'
                      definition="Ce ratio mesure la part des ressources financee par les fonds propres."
                      utility="Il permet d'apprecier l'independance financiere de l'entreprise."
                      interpretation="Plus il est eleve, plus l'entreprise est autonome et moins elle depend des creanciers."
                    />
                    <span className="min-w-0 break-words leading-5">Ratio d'Autonomie Financiere</span>
                  </span>
                </p>
                <p className="text-2xl font-bold text-gray-100">
                  {leverage.financialLeverage !== 0
                    ? (1 / (1 + leverage.financialLeverage) * 100).toFixed(1)
                    : '100.0'}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Capitaux propres / (Capitaux propres + Dettes)
                </p>

                <div className="mt-3 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-green-500"
                    style={{
                      width: `${leverage.financialLeverage !== 0
                        ? (1 / (1 + leverage.financialLeverage)) * 100
                        : 100}%`
                    }}
                  />
                </div>

                <div className="mt-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      leverage.financialLeverage < 1.0
                        ? 'bg-green-500/20 text-green-400'
                        : leverage.financialLeverage < 2.0
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {leverage.financialLeverage < 1.0
                      ? 'Independance financiere'
                      : leverage.financialLeverage < 2.0
                      ? 'Endettement modere'
                      : 'Endettement eleve'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed analysis */}
          <div className="mt-4 p-4 bg-gray-800 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">
              Analyse de la structure financiere
            </h4>
            <div className="space-y-2 text-xs text-gray-400">
              <p>
                <strong>Levier financier:</strong>{' '}
                {leverage.financialLeverage < 0.5
                  ? 'Tres faible. L\'entreprise est peu endettee et dispose d\'une grande solidite financiere.'
                  : leverage.financialLeverage < 1.0
                  ? 'Faible. Structure financiere saine avec une bonne autonomie.'
                  : leverage.financialLeverage < 2.0
                  ? 'Modere. Endettement acceptable, mais a surveiller.'
                  : 'Eleve. L\'entreprise est fortement endettee par rapport a ses capitaux propres.'}
              </p>

              {leverage.financialLeverage > 2.0 && (
                <div className="mt-2 p-2 bg-orange-500/10 border border-orange-500/30 rounded">
                  <p className="text-orange-400">
                    <strong>Recommandation:</strong> Envisagez de renforcer vos fonds propres ou
                    de reduire votre endettement pour ameliorer votre autonomie financiere.
                  </p>
                </div>
              )}

              {leverage.financialLeverage < 0.5 && (
                <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded">
                  <p className="text-green-400">
                    <strong>Point positif:</strong> Votre faible endettement vous offre une grande
                    capacite d'emprunt si necessaire pour financer la croissance.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-500/10 rounded-lg">
            <p className="text-xs text-blue-400">
              <strong>Interpretation:</strong> Le levier financier mesure le poids des dettes par
              rapport aux capitaux propres. Un ratio inferieur a 1 indique une bonne independance
              financiere.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KeyRatiosSection;
