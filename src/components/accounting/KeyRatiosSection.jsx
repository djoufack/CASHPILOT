import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Droplets, Scale } from 'lucide-react';
import RatioGauge from './RatioGauge';

/**
 * Section Ratios Clés
 * Affiche: Rentabilité (ROE, ROCE), Liquidité (Current, Quick, Cash), Levier financier
 */
const KeyRatiosSection = ({ data }) => {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Ratios Clés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Aucune donnée disponible</p>
        </CardContent>
      </Card>
    );
  }

  const { profitability, liquidity, leverage } = data;

  return (
    <div className="space-y-4">
      {/* En-tête de section */}
      <div className="flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-indigo-600" />
        <h2 className="text-2xl font-bold text-gray-900">Ratios Clés</h2>
      </div>

      {/* Section Rentabilité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Rentabilité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ROE */}
            <RatioGauge
              label="Rentabilité des Capitaux Propres (ROE)"
              value={profitability.roe}
              format="percentage"
              thresholds={{
                excellent: 20,
                good: 15,
                warning: 10,
                poor: 5
              }}
              description="Résultat net / Capitaux propres"
            />

            {/* ROCE */}
            <RatioGauge
              label="Rentabilité du Capital Employé (ROCE)"
              value={profitability.roce}
              format="percentage"
              thresholds={{
                excellent: 15,
                good: 10,
                warning: 7,
                poor: 3
              }}
              description="Résultat d'exploitation / Capital employé"
            />

            {/* Marge opérationnelle */}
            <RatioGauge
              label="Marge Opérationnelle"
              value={profitability.operatingMargin}
              format="percentage"
              thresholds={{
                excellent: 20,
                good: 15,
                warning: 10,
                poor: 5
              }}
              description="Résultat d'exploitation / CA"
            />

            {/* Marge nette */}
            <RatioGauge
              label="Marge Nette"
              value={profitability.netMargin}
              format="percentage"
              thresholds={{
                excellent: 15,
                good: 10,
                warning: 5,
                poor: 2
              }}
              description="Résultat net / CA"
            />
          </div>

          {/* Explication */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Interprétation:</strong> Les ratios de rentabilité mesurent la capacité de
              l'entreprise à générer des profits à partir de ses ressources. Un ROE élevé indique
              une bonne rentabilité pour les actionnaires.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section Liquidité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-600" />
            Liquidité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Ratio de liquidité générale */}
            <RatioGauge
              label="Ratio de Liquidité Générale"
              value={liquidity.currentRatio}
              format="number"
              thresholds={{
                excellent: 2.0,
                good: 1.5,
                warning: 1.0,
                poor: 0.75
              }}
              description="Actifs circulants / Passifs courants"
            />

            {/* Ratio de liquidité réduite */}
            <RatioGauge
              label="Ratio de Liquidité Réduite"
              value={liquidity.quickRatio}
              format="number"
              thresholds={{
                excellent: 1.5,
                good: 1.0,
                warning: 0.75,
                poor: 0.5
              }}
              description="(Actifs circulants - Stocks) / Passifs courants"
            />

            {/* Ratio de liquidité immédiate */}
            <RatioGauge
              label="Ratio de Liquidité Immédiate"
              value={liquidity.cashRatio}
              format="number"
              thresholds={{
                excellent: 0.5,
                good: 0.3,
                warning: 0.2,
                poor: 0.1
              }}
              description="Trésorerie / Passifs courants"
            />
          </div>

          {/* Tableau récapitulatif */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Ratio</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Valeur</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                    Interprétation
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-3 py-2 text-xs">Liquidité Générale</td>
                  <td className="px-3 py-2 text-center text-xs font-semibold">
                    {liquidity.currentRatio.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {liquidity.currentRatio >= 1.5
                      ? 'Capacité à honorer les dettes CT'
                      : liquidity.currentRatio >= 1.0
                      ? 'Situation acceptable'
                      : 'Risque de difficultés de paiement'}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-xs">Liquidité Réduite</td>
                  <td className="px-3 py-2 text-center text-xs font-semibold">
                    {liquidity.quickRatio.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {liquidity.quickRatio >= 1.0
                      ? 'Bonne capacité de paiement rapide'
                      : liquidity.quickRatio >= 0.75
                      ? 'Capacité de paiement correcte'
                      : 'Dépendance aux stocks pour payer'}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-xs">Liquidité Immédiate</td>
                  <td className="px-3 py-2 text-center text-xs font-semibold">
                    {liquidity.cashRatio.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {liquidity.cashRatio >= 0.3
                      ? 'Excellente trésorerie disponible'
                      : liquidity.cashRatio >= 0.2
                      ? 'Trésorerie suffisante'
                      : 'Trésorerie limitée'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Explication */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Interprétation:</strong> Les ratios de liquidité évaluent la capacité de
              l'entreprise à faire face à ses obligations à court terme. Un ratio &#62; 1 indique
              généralement une bonne santé financière.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section Endettement / Levier */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="w-5 h-5 text-orange-600" />
            Structure Financière et Endettement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Levier financier */}
            <RatioGauge
              label="Levier Financier (Dette / Capitaux Propres)"
              value={leverage.financialLeverage}
              format="number"
              inverse={true}
              thresholds={{
                excellent: 0.5,
                good: 1.0,
                warning: 2.0,
                poor: 3.0
              }}
              description="Dettes financières / Capitaux propres"
            />

            {/* Ratio d'autonomie financière */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Scale className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  Ratio d'Autonomie Financière
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {leverage.financialLeverage !== 0
                    ? (1 / (1 + leverage.financialLeverage) * 100).toFixed(1)
                    : '100.0'}%
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Capitaux propres / (Capitaux propres + Dettes)
                </p>

                <div className="mt-3 w-full bg-red-200 rounded-full h-2 overflow-hidden">
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
                        ? 'bg-green-100 text-green-800'
                        : leverage.financialLeverage < 2.0
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {leverage.financialLeverage < 1.0
                      ? 'Indépendance financière'
                      : leverage.financialLeverage < 2.0
                      ? 'Endettement modéré'
                      : 'Endettement élevé'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analyse détaillée */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Analyse de la structure financière
            </h4>
            <div className="space-y-2 text-xs text-gray-600">
              <p>
                <strong>Levier financier:</strong>{' '}
                {leverage.financialLeverage < 0.5
                  ? 'Très faible. L\'entreprise est peu endettée et dispose d\'une grande solidité financière.'
                  : leverage.financialLeverage < 1.0
                  ? 'Faible. Structure financière saine avec une bonne autonomie.'
                  : leverage.financialLeverage < 2.0
                  ? 'Modéré. Endettement acceptable, mais à surveiller.'
                  : 'Élevé. L\'entreprise est fortement endettée par rapport à ses capitaux propres.'}
              </p>

              {leverage.financialLeverage > 2.0 && (
                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
                  <p className="text-orange-800">
                    <strong>Recommandation:</strong> Envisagez de renforcer vos fonds propres ou
                    de réduire votre endettement pour améliorer votre autonomie financière.
                  </p>
                </div>
              )}

              {leverage.financialLeverage < 0.5 && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                  <p className="text-green-800">
                    <strong>Point positif:</strong> Votre faible endettement vous offre une grande
                    capacité d'emprunt si nécessaire pour financer la croissance.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Explication */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Interprétation:</strong> Le levier financier mesure le poids des dettes par
              rapport aux capitaux propres. Un ratio inférieur à 1 indique une bonne indépendance
              financière.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KeyRatiosSection;
