import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

const RatioGauge = ({
  label,
  value,
  thresholds = { excellent: 2.0, good: 1.5, warning: 1.0, poor: 0.5 },
  format = 'number',
  inverse = false,
  unit = '',
  description = ''
}) => {
  const formatValue = (val) => {
    if (!val && val !== 0) return '-';
    switch (format) {
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'currency':
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val);
      case 'number':
      default:
        return val.toFixed(2) + (unit ? ` ${unit}` : '');
    }
  };

  const getQuality = () => {
    if (!value && value !== 0) return null;
    if (inverse) {
      if (value <= thresholds.excellent) return 'excellent';
      if (value <= thresholds.good) return 'good';
      if (value <= thresholds.warning) return 'average';
      if (value <= thresholds.poor) return 'poor';
      return 'critical';
    } else {
      if (value >= thresholds.excellent) return 'excellent';
      if (value >= thresholds.good) return 'good';
      if (value >= thresholds.warning) return 'average';
      if (value >= thresholds.poor) return 'poor';
      return 'critical';
    }
  };

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

  const getTrendIcon = (quality) => {
    if (!quality) return null;
    if (quality === 'excellent' || quality === 'good') {
      return <ArrowUp className="w-4 h-4 text-green-400" />;
    } else if (quality === 'average') {
      return <Minus className="w-4 h-4 text-yellow-400" />;
    } else {
      return <ArrowDown className="w-4 h-4 text-red-400" />;
    }
  };

  const getGaugePercentage = () => {
    if (!value && value !== 0) return 0;
    const maxThreshold = Math.max(
      thresholds.excellent || 0,
      thresholds.good || 0,
      thresholds.warning || 0,
      thresholds.poor || 0,
      value
    ) * 1.2;
    return Math.min((value / maxThreshold) * 100, 100);
  };

  const quality = getQuality();
  const colorClass = getColorClass(quality);
  const qualityText = getQualityText(quality);
  const trendIcon = getTrendIcon(quality);
  const gaugePercentage = getGaugePercentage();

  return (
    <Card className="bg-gray-900/50 border border-gray-800">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-400">{label}</p>
            {description && (
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            )}
          </div>
          {trendIcon}
        </div>

        {/* Main value */}
        <div className="mb-3">
          <p className="text-2xl font-bold text-gray-100">
            {formatValue(value)}
          </p>
        </div>

        {/* Gauge bar */}
        <div className="mb-2">
          <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${colorClass}`}
              style={{ width: `${gaugePercentage}%` }}
            />
          </div>
        </div>

        {/* Quality indicator */}
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              quality === 'excellent' || quality === 'good'
                ? 'bg-green-500/20 text-green-400'
                : quality === 'average'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {qualityText}
          </span>

          {thresholds.good && (
            <span className="text-xs text-gray-500">
              Ref: {inverse ? '< ' : '> '}{thresholds.good.toFixed(1)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RatioGauge;
