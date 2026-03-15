import { useTranslation } from 'react-i18next';
import { Mail, MessageSquare, Phone, FileText, Play, Power, Eye, Zap, Shield, Flame } from 'lucide-react';

const CHANNEL_ICONS = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
  letter: FileText,
};

const STRATEGY_CONFIG = {
  gentle: {
    icon: Shield,
    color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  },
  standard: {
    icon: Zap,
    color: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  },
  aggressive: {
    icon: Flame,
    color: 'text-red-400 bg-red-500/20 border-red-500/30',
  },
  custom: {
    icon: Eye,
    color: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
  },
};

/**
 * DunningCampaignCard - Shows a dunning campaign with strategy badge,
 * channels, active status, and action buttons.
 *
 * @param {{ campaign: Object, onLaunch: Function, onToggle: Function }} props
 */
const DunningCampaignCard = ({ campaign, onLaunch, onToggle }) => {
  const { t } = useTranslation();

  if (!campaign) return null;

  const strategyCfg = STRATEGY_CONFIG[campaign.strategy] || STRATEGY_CONFIG.standard;
  const StrategyIcon = strategyCfg.icon;
  const channels = campaign.channels || ['email'];

  return (
    <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-5 backdrop-blur-sm hover:border-gray-700/50 transition-all">
      {/* Top row: name + active indicator */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-white truncate">{campaign.name}</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {campaign.max_steps} {t('dunning.campaigns.steps', 'etapes')}
            {campaign.auto_escalate && (
              <span className="ml-2 text-amber-400/80">{t('dunning.campaigns.autoEscalate', 'Auto-escalade')}</span>
            )}
          </p>
        </div>

        {/* Active status dot */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <div className={`w-2 h-2 rounded-full ${campaign.is_active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
          <span className={`text-[10px] font-medium ${campaign.is_active ? 'text-emerald-400' : 'text-gray-500'}`}>
            {campaign.is_active ? t('dunning.campaigns.active', 'Active') : t('dunning.campaigns.inactive', 'Inactive')}
          </span>
        </div>
      </div>

      {/* Strategy badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${strategyCfg.color}`}
        >
          <StrategyIcon className="w-3 h-3" />
          {t(`dunning.campaigns.strategy.${campaign.strategy}`, campaign.strategy)}
        </span>
      </div>

      {/* Channels */}
      <div className="flex items-center gap-1.5 mb-4">
        <span className="text-xs text-gray-500 mr-1">{t('dunning.campaigns.channels', 'Canaux')}:</span>
        {channels.map((ch) => {
          const Icon = CHANNEL_ICONS[ch] || Mail;
          return (
            <div
              key={ch}
              className="w-6 h-6 rounded-md bg-[#0a0e1a]/60 border border-gray-800/30 flex items-center justify-center"
              title={t(`dunning.channels.${ch}`, ch)}
            >
              <Icon className="w-3 h-3 text-gray-400" />
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-gray-800/30 pt-3">
        <button
          onClick={() => onToggle?.(campaign.id, !campaign.is_active)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            campaign.is_active
              ? 'border-gray-700/50 text-gray-400 hover:text-red-400 hover:border-red-500/30'
              : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
          }`}
        >
          <Power className="w-3 h-3" />
          {campaign.is_active
            ? t('dunning.campaigns.deactivate', 'Desactiver')
            : t('dunning.campaigns.activate', 'Activer')}
        </button>

        <button
          onClick={() => onLaunch?.(campaign)}
          disabled={!campaign.is_active}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            campaign.is_active
              ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10'
              : 'border-gray-700/50 text-gray-600 cursor-not-allowed'
          }`}
        >
          <Play className="w-3 h-3" />
          {t('dunning.campaigns.launch', 'Lancer')}
        </button>
      </div>
    </div>
  );
};

export default DunningCampaignCard;
