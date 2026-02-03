import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Activity, Target } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

/**
 * Section Analyse des Marges
 * Affiche: CA, Marge brute, EBE/EBITDA, Résultat d'exploitation
 */
const MarginAnalysisSection = ({ data }) => {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Analyse des Marges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Aucune donnée disponible</p>
        </CardContent>
      </Card>
    );
  }

  const {
    revenue,
    grossMargin,
    grossMarginPercent,
    ebitda,
    ebitdaMargin,
    operatingResult,
    operatingMargin
  } = data;

  // Composant pour une carte de métrique
  const MetricCard = ({ icon: Icon, label, value, percentage, colorClass }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Icon className={`w-5 h-5 ${colorClass || 'text-blue-600'}`} />
          </div>
          {percentage !== undefined && (
            <span
              className={`text-sm font-semibold ${
                percentage >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${
          value >= 0 ? 'text-gray-900' : 'text-red-600'
        }`}>
          {formatCurrency(value)}
        </p>
        {percentage !== undefined && (
          <p className="text-xs text-gray-400 mt-1">
            {percentage.toFixed(1)}% du CA
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* En-tête de section */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">Analyse des Marges</h2>
      </div>

      {/* Grid de métriques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Chiffre d'affaires */}
        <MetricCard
          icon={DollarSign}
          label="Chiffre d'affaires"
          value={revenue}
          colorClass="text-blue-600"
        />

        {/* Marge Brute */}
        <MetricCard
          icon={Target}
          label="Marge brute"
          value={grossMargin}
          percentage={grossMarginPercent}
          colorClass={grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}
        />

        {/* EBE / EBITDA */}
        <MetricCard
          icon={Activity}
          label="EBE / EBITDA"
          value={ebitda}
          percentage={ebitdaMargin}
          colorClass={ebitda >= 0 ? 'text-purple-600' : 'text-red-600'}
        />

        {/* Résultat d'exploitation */}
        <MetricCard
          icon={TrendingUp}
          label="Résultat d'exploitation"
          value={operatingResult}
          percentage={operatingMargin}
          colorClass={operatingResult >= 0 ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* Carte d'analyse récapitulative */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Analyse de la rentabilité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Progression des marges */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Marge brute</span>
                <span className="text-sm font-semibold">
                  {grossMarginPercent.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    grossMarginPercent >= 30
                      ? 'bg-green-500'
                      : grossMarginPercent >= 15
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(Math.max(grossMarginPercent, 0), 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Marge EBITDA</span>
                <span className="text-sm font-semibold">
                  {ebitdaMargin.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    ebitdaMargin >= 20
                      ? 'bg-green-500'
                      : ebitdaMargin >= 10
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(Math.max(ebitdaMargin, 0), 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Marge opérationnelle</span>
                <span className="text-sm font-semibold">
                  {operatingMargin.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    operatingMargin >= 15
                      ? 'bg-green-500'
                      : operatingMargin >= 5
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(Math.max(operatingMargin, 0), 100)}%` }}
                />
              </div>
            </div>

            {/* Indicateurs clés */}
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Indicateurs clés
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">CA généré</p>
                  <p className="text-sm font-semibold">{formatCurrency(revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Bénéfice d'exploitation</p>
                  <p className={`text-sm font-semibold ${
                    operatingResult >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(operatingResult)}
                  </p>
                </div>
              </div>
            </div>

            {/* Conseils */}
            {ebitdaMargin < 10 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  <strong>Attention:</strong> Votre marge EBITDA est inférieure à 10%.
                  Envisagez d'optimiser vos charges d'exploitation.
                </p>
              </div>
            )}

            {operatingMargin < 0 && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-800">
                  <strong>Alerte:</strong> Votre résultat d'exploitation est négatif.
                  Une analyse approfondie des coûts est recommandée.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarginAnalysisSection;
