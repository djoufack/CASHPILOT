import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Key, Copy, Eye, EyeOff, Trash2, Play, Pause, Clock, Shield } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ApiKeyCard = ({ apiKey, onToggle, onDelete, onCopy, usageLast7Days = [] }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);

  const maskedKey = apiKey.api_key
    ? `${apiKey.api_key.slice(0, 8)}${'*'.repeat(24)}${apiKey.api_key.slice(-4)}`
    : '****';

  const handleCopy = () => {
    if (onCopy) {
      onCopy(apiKey.api_key);
    } else {
      navigator.clipboard.writeText(apiKey.api_key);
    }
    toast({
      title: t('common.success'),
      description: t('openApi.keyCopied'),
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
            <h3 className="text-sm font-semibold text-white truncate">{apiKey.key_name}</h3>
          </div>

          {/* Masked key */}
          <div className="flex items-center gap-2 mt-1">
            <Key className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <code className="text-xs text-gray-400 font-mono">{showKey ? apiKey.api_key : maskedKey}</code>
            <button
              onClick={() => setShowKey((v) => !v)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title={showKey ? t('openApi.hideKey') : t('openApi.showKey')}
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleCopy}
              className="text-gray-500 hover:text-gray-300 transition-colors"
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
              {t('openApi.created')}: {formatDate(apiKey.created_at)}
            </span>
            {apiKey.last_used_at && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t('openApi.lastUsed')}: {formatDate(apiKey.last_used_at)}
              </span>
            )}
            {apiKey.expires_at && (
              <span className="text-amber-400">
                {t('openApi.expires')}: {formatDate(apiKey.expires_at)}
              </span>
            )}
            <span className="text-gray-500">
              {t('openApi.rateLimit')}: {apiKey.rate_limit}/min
            </span>
          </div>
        </div>

        {/* Sparkline + actions */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Mini sparkline */}
          <div className="flex items-end gap-0.5 h-8" title={t('openApi.usageLast7Days')}>
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
              onClick={() => onToggle(apiKey.id, !apiKey.is_active)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
              title={apiKey.is_active ? t('openApi.deactivate') : t('openApi.activate')}
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
