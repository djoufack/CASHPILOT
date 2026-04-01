import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Key, Copy, Eye, EyeOff, Trash2, Play, Pause, Clock, Shield } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ApiKeyCard = ({ apiKey, plainKey = null, onToggle, onDelete, onCopy, usageLast7Days = [] }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);
  const tf = (key, fallback, options = {}) => t(key, { defaultValue: fallback, ...options });

  const canReveal = typeof plainKey === 'string' && plainKey.length > 0;
  const maskedKey = apiKey.key_prefix ? `${apiKey.key_prefix}${'*'.repeat(24)}` : '****';
  const displayKey = showKey && canReveal ? plainKey : maskedKey;
  const displayName = apiKey.name || apiKey.key_name || 'API Key';

  const handleCopy = () => {
    if (!canReveal) {
      toast({
        title: t('common.error'),
        description: t('openApi.copyUnavailable', 'La clé complète n’est plus disponible. Regénérez une nouvelle clé.'),
      });
      return;
    }

    if (onCopy) {
      onCopy(plainKey);
    } else {
      navigator.clipboard.writeText(plainKey);
    }
    toast({
      title: t('common.success'),
      description: tf('openApi.keyCopied', 'Clé copiée'),
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // Mini sparkline from usage data (7 values, one per day)
  const sparklineData = (() => {
    const days = Array(7).fill(0);
    usageLast7Days.forEach((log) => {
      const dayIndex = 6 - Math.floor((Date.now() - new Date(log.created_at).getTime()) / 86400000);
      if (dayIndex >= 0 && dayIndex < 7) {
        days[dayIndex]++;
      }
    });
    return days;
  })();

  const maxVal = Math.max(...sparklineData, 1);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/30 backdrop-blur-sm p-5 hover:border-gray-700 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Key info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                apiKey.is_active ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
              }`}
            />
            <h3 className="text-sm font-semibold text-white truncate">{displayName}</h3>
          </div>

          {/* Masked key */}
          <div className="flex items-center gap-2 mt-1">
            <Key className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <code className="text-xs text-gray-400 font-mono">{displayKey}</code>
            <button
              onClick={() => canReveal && setShowKey((v) => !v)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              disabled={!canReveal}
              title={showKey ? tf('openApi.hideKey', 'Masquer la clé') : tf('openApi.showKey', 'Afficher la clé')}
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleCopy}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              disabled={!canReveal}
              title={t('common.copy')}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scopes */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(apiKey.scopes || []).map((scope) => (
              <span
                key={scope}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20"
              >
                <Shield className="w-3 h-3" />
                {scope}
              </span>
            ))}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>
              {tf('openApi.created', 'Créée')}: {formatDate(apiKey.created_at)}
            </span>
            {apiKey.last_used_at && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {tf('openApi.lastUsed', 'Dernière utilisation')}: {formatDate(apiKey.last_used_at)}
              </span>
            )}
            {apiKey.expires_at && (
              <span className="text-amber-400">
                {tf('openApi.expires', 'Expire le')}: {formatDate(apiKey.expires_at)}
              </span>
            )}
            <span className="text-gray-500">
              {tf('openApi.rateLimit', 'Limite')}: {apiKey.rate_limit}/min
            </span>
          </div>
        </div>

        {/* Sparkline + actions */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Mini sparkline */}
          <div className="flex items-end gap-0.5 h-8" title={tf('openApi.usageLast7Days', 'Utilisation sur 7 jours')}>
            {sparklineData.map((val, i) => (
              <div
                key={i}
                className="w-1.5 rounded-sm bg-orange-500/60"
                style={{ height: `${Math.max((val / maxVal) * 100, 8)}%` }}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggle(!apiKey.is_active)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
              title={apiKey.is_active ? tf('openApi.deactivate', 'Désactiver') : tf('openApi.activate', 'Activer')}
            >
              {apiKey.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(apiKey.id)}
              className="border-red-700/30 text-red-400 hover:bg-red-500/10"
              title={t('common.delete')}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyCard;
