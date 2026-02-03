import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

/**
 * Composant jauge pour afficher un ratio financier
 * Avec indicateurs visuels (couleur) et texte de qualité
 */
const RatioGauge = ({
  label,
  value,
  thresholds = { excellent: 2.0, good: 1.5, warning: 1.0, poor: 0.5 },
  format = 'number', // 'number', 'percentage', 'currency'
  inverse = false, // true si une valeur plus basse est meilleure (ex: levier financier)
  unit = '',
  description = ''
}) => {
  // Formater la valeur selon le type
  const formatValue = (val) => {
    if (!val && val !== 0) return '-';

    switch (format) {
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'currency':
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(val);
      case 'number':
      default:
        return val.toFixed(2) + (unit ? ` ${unit}` : '');
    }
  };

  // Déterminer la qualité du ratio
  const getQuality = () => {
    if (!value && value !== 0) return null;

    const val = value;

    if (inverse) {
      // Pour les ratios où plus bas = mieux (ex: levier financier)
      if (val <= thresholds.excellent) return 'excellent';
      if (val <= thresholds.good) return 'good';
      if (val <= thresholds.warning) return 'average';
      if (val <= thresholds.poor) return 'poor';
      return 'critical';
    } else {
      // Pour les ratios où plus haut = mieux
      if (val >= thresholds.excellent) return 'excellent';
      if (val >= thresholds.good) return 'good';
      if (val >= thresholds.warning) return 'average';
      if (val >= thresholds.poor) return 'poor';
      return 'critical';
    }
  };

  // Obtenir la couleur selon la qualité
  const getColorClass = (quality) => {
    const colors = {
      excellent: 'bg-green-500',
      good: 'bg-green-400',
      average: 'bg-yellow-400',
      poor: 'bg-orange-400',
      critical: 'bg-red-500'
    };
    return colors[quality] || 'bg-gray-400';
  };

  // Obtenir le texte de qualité
  const getQualityText = (quality) => {
    const texts = {
      excellent: 'Excellent',
      good: 'Bon',
      average: 'Moyen',
      poor: 'Faible',
      critical: 'Critique'
    };
    return texts[quality] || '-';
  };

  // Obtenir l'icône de tendance
  const getTrendIcon = (quality) => {
    if (!quality) return null;

    if (quality === 'excellent' || quality === 'good') {
      return <ArrowUp className="w-4 h-4 text-green-600" />;
    } else if (quality === 'average') {
      return <Minus className="w-4 h-4 text-yellow-600" />;
    } else {
      return <ArrowDown className="w-4 h-4 text-red-600" />;
    }
  };

  // Calculer le pourcentage de remplissage de la jauge
  const getGaugePercentage = () => {
    if (!value && value !== 0) return 0;

    // Normaliser entre 0 et 100
    const maxThreshold = Math.max(
      thresholds.excellent || 0,
      thresholds.good || 0,
      thresholds.warning || 0,
      thresholds.poor || 0,
      value
    ) * 1.2; // Ajouter 20% de marge

    return Math.min((value / maxThreshold) * 100, 100);
  };

  const quality = getQuality();
  const colorClass = getColorClass(quality);
  const qualityText = getQualityText(quality);
  const trendIcon = getTrendIcon(quality);
  const gaugePercentage = getGaugePercentage();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">{label}</p>
            {description && (
              <p className="text-xs text-gray-400 mt-1">{description}</p>
            )}
          </div>
          {trendIcon}
        </div>

        {/* Valeur principale */}
        <div className="mb-3">
          <p className="text-2xl font-bold text-gray-900">
            {formatValue(value)}
          </p>
        </div>

        {/* Barre de progression / Jauge */}
        <div className="mb-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${colorClass}`}
              style={{ width: `${gaugePercentage}%` }}
            />
          </div>
        </div>

        {/* Indicateur de qualité */}
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              quality === 'excellent' || quality === 'good'
                ? 'bg-green-100 text-green-800'
                : quality === 'average'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {qualityText}
          </span>

          {/* Afficher le seuil de référence */}
          {thresholds.good && (
            <span className="text-xs text-gray-400">
              Référence: {inverse ? '< ' : '> '}{thresholds.good.toFixed(1)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RatioGauge;
