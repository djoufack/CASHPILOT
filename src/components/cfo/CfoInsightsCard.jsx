import {} from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { useCfoChat } from '@/hooks/useCfoChat';

const ScoreGauge = ({ score }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';
  const bgColor =
    score >= 70
      ? 'from-green-500/10 to-green-600/5'
      : score >= 40
        ? 'from-yellow-500/10 to-yellow-600/5'
        : 'from-red-500/10 to-red-600/5';

  return (
    <div className={`relative flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br ${bgColor}`}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="text-center z-10">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-sm text-gray-400 block">/100</span>
      </div>
    </div>
  );
};

const FactorRow = ({ factor }) => {
  const isPositive = factor.impact >= 0;

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {isPositive ? (
          <TrendingUp className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-red-400" />
        )}
        <span className="text-sm text-gray-300">{factor.label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-white font-medium">
          {typeof factor.value === 'number' && factor.label.includes('%') ? `${factor.value}%` : factor.value}
        </span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded ${
            isPositive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}
        >
          {isPositive ? '+' : ''}
          {factor.impact}
        </span>
      </div>
    </div>
  );
};

const CfoInsightsCard = () => {
  const { t } = useTranslation();
  const { healthScore } = useCfoChat();

  const score = healthScore?.score ?? null;
  const factors = healthScore?.factors ?? {};
  const factorsList = Object.values(factors);

  const getStatusLabel = (s) => {
    if (s >= 70) return t('cfo.insights.excellent', 'Excellente');
    if (s >= 40) return t('cfo.insights.moderate', 'A surveiller');
    return t('cfo.insights.critical', 'Critique');
  };

  const getStatusIcon = (s) => {
    if (s >= 70) return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (s >= 40) return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    return <AlertTriangle className="w-4 h-4 text-red-400" />;
  };

  if (score === null) {
    return (
      <div className="bg-[#0f1528]/80 backdrop-blur-xl rounded-xl border border-white/10 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">{t('cfo.insights.title', 'Sante financiere')}</h3>
        </div>
        <p className="text-sm text-gray-400 text-center py-4">
          {t('cfo.insights.noData', 'Envoyez un message au CFO pour calculer votre score.')}
        </p>
      </div>
    );
  }

  const topFactors = factorsList.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 3);

  return (
    <div className="bg-[#0f1528]/80 backdrop-blur-xl rounded-xl border border-white/10 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-semibold text-white">{t('cfo.insights.title', 'Sante financiere')}</h3>
      </div>

      {/* Score gauge */}
      <div className="flex flex-col items-center mb-6">
        <ScoreGauge score={score} />
        <div className="flex items-center gap-1.5 mt-3">
          {getStatusIcon(score)}
          <span className="text-sm font-medium text-white">{getStatusLabel(score)}</span>
        </div>
      </div>

      {/* Top factors */}
      {topFactors.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            {t('cfo.insights.factors', 'Facteurs cles')}
          </h4>
          <div className="divide-y divide-white/5">
            {topFactors.map((factor, i) => (
              <FactorRow key={i} factor={factor} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CfoInsightsCard;
