import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Star, Package, Users, Tag } from 'lucide-react';

const CATEGORY_COLORS = {
  communication: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  productivity: 'bg-green-500/10 text-green-300 border-green-500/20',
  payments: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  compliance: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  automation: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  crm: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
  utility: 'bg-gray-500/10 text-gray-300 border-gray-500/20',
};

const AppCard = ({ app, isInstalled, onInstall, onUninstall }) => {
  const { t } = useTranslation();
  const [actionLoading, setActionLoading] = useState(false);

  const categoryClass = CATEGORY_COLORS[app.category] || CATEGORY_COLORS.utility;

  const handleAction = async () => {
    setActionLoading(true);
    try {
      if (isInstalled) {
        await onUninstall(app.id);
      } else {
        await onInstall(app.id);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const formatInstallCount = (count) => {
    if (!count) return '0';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/30 backdrop-blur-sm p-5 hover:border-gray-700 transition-all hover:shadow-lg hover:shadow-orange-500/5 flex flex-col h-full">
      {/* Header: icon + name */}
      <div className="flex items-start gap-4 mb-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {app.icon_url ? (
            <img
              src={app.icon_url}
              alt={app.name}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <Package className="w-6 h-6 text-gray-500" style={{ display: app.icon_url ? 'none' : 'block' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{app.name}</h3>
          <p className="text-xs text-gray-500 truncate">{app.developer_name}</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed mb-4 flex-1 line-clamp-3">{app.description}</p>

      {/* Meta: category, version, installs, rating */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${categoryClass}`}>
          <Tag className="w-3 h-3" />
          {app.category}
        </span>
        <span className="text-xs text-gray-500">v{app.version}</span>
        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
          <Users className="w-3 h-3" />
          {formatInstallCount(app.install_count)}
        </span>
        {app.rating > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-400">
            <Star className="w-3 h-3 fill-current" />
            {Number(app.rating).toFixed(1)}
          </span>
        )}
      </div>

      {/* Install / Uninstall */}
      <Button
        size="sm"
        onClick={handleAction}
        disabled={actionLoading}
        className={
          isInstalled
            ? 'w-full border-red-700/30 text-red-400 hover:bg-red-500/10 bg-transparent border'
            : 'w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
        }
        variant={isInstalled ? 'outline' : 'default'}
      >
        {actionLoading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
        ) : isInstalled ? (
          <>
            <Trash2 className="w-4 h-4 mr-2" />
            {t('marketplace.uninstall')}
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            {t('marketplace.install')}
          </>
        )}
      </Button>
    </div>
  );
};

export default AppCard;
