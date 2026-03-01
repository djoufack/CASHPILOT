import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Activity, Target } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

/**
 * Section Analyse des Marges
 * Affiche: CA, Marge brute, EBE/EBITDA, Resultat d'exploitation
 */
const MarginAnalysisSection = ({ data, currency = 'EUR' }) => {
  if (!data) {
    return (
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <TrendingUp className="w-5 h-5" />
            Analyse des Marges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">Aucune donnee disponible</p>
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

  // Composant pour une carte de metrique
  const MetricCard = ({ icon: Icon, label, value, percentage, colorClass }) => (
    <Card className="bg-gray-900/50 border border-gray-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="p-2 bg-gray-800 rounded-lg">
            <Icon className={`w-5 h-5 ${colorClass || 'text-blue-400'}`} />
          </div>
          {percentage !== undefined && (
            <span
              className={`text-sm font-semibold ${
                percentage >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${
          value >= 0 ? 'text-gray-100' : 'text-red-400'
        }`}>
          {formatCurrency(value, currency)}
        </p>
        {percentage !== undefined && (
          <p className="text-xs text-gray-500 mt-1">
            {percentage.toFixed(1)}% du CA
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* En-tete de section */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold text-gray-100">Analyse des Marges</h2>
      </div>

      {/* Grid de metriques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Chiffre d'affaires"
          value={revenue}
          colorClass="text-blue-400"
        />
        <MetricCard
          icon={Target}
          label="Marge brute"
          value={grossMargin}
          percentage={grossMarginPercent}
          colorClass={grossMargin >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <MetricCard
          icon={Activity}
          label="EBE / EBITDA"
          value={ebitda}
          percentage={ebitdaMargin}
          colorClass={ebitda >= 0 ? 'text-purple-400' : 'text-red-400'}
        />
        <MetricCard
          icon={TrendingUp}
          label="Resultat d'exploitation"
          value={operatingResult}
          percentage={operatingMargin}
          colorClass={operatingResult >= 0 ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      {/* Carte d'analyse recapitulative */}
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-gray-100">Analyse de la rentabilite</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Progression des marges */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Marge brute</span>
                <span className="text-sm font-semibold text-gray-200">
                  {grossMarginPercent.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
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
                <span className="text-sm text-gray-400">Marge EBITDA</span>
                <span className="text-sm font-semibold text-gray-200">
                  {ebitdaMargin.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
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
                <span className="text-sm text-gray-400">Marge operationnelle</span>
                <span className="text-sm font-semibold text-gray-200">
                  {operatingMargin.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
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

            {/* Indicateurs cles */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">
                Indicateurs cles
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">CA genere</p>
                  <p className="text-sm font-semibold text-gray-200">{formatCurrency(revenue, currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Benefice d'exploitation</p>
                  <p className={`text-sm font-semibold ${
                    operatingResult >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(operatingResult, currency)}
                  </p>
                </div>
              </div>
            </div>

            {/* Conseils */}
            {ebitdaMargin < 10 && (
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-xs text-yellow-400">
                  <strong>Attention:</strong> Votre marge EBITDA est inferieure a 10%.
                  Envisagez d'optimiser vos charges d'exploitation.
                </p>
              </div>
            )}

            {operatingMargin < 0 && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-xs text-red-400">
                  <strong>Alerte:</strong> Votre resultat d'exploitation est negatif.
                  Une analyse approfondie des couts est recommandee.
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
