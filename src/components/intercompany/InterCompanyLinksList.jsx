import { useTranslation } from 'react-i18next';
import { Link2, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { formatDate } from '@/utils/dateLocale';

const linkTypeBadge = {
  customer: 'bg-blue-500/20 text-blue-300',
  supplier: 'bg-orange-500/20 text-orange-300',
  both: 'bg-purple-500/20 text-purple-300',
};

const InterCompanyLinksList = ({ links, onToggle, onDelete }) => {
  const { t } = useTranslation();

  if (!links || links.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        {t('intercompany.links.empty', 'Aucun lien inter-societes configure.')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {links.map((link) => {
        const badgeClass = linkTypeBadge[link.link_type] || linkTypeBadge.both;

        return (
          <div
            key={link.id}
            className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
              link.is_active ? 'bg-[#0f1528]/80 border-white/10' : 'bg-[#0a0e1a]/60 border-white/5 opacity-60'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Link2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{link.company_name}</span>
                  <span className="text-gray-500 text-xs">&rarr;</span>
                  <span className="text-sm font-medium text-white truncate">{link.linked_company_name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>
                    {t(`intercompany.linkType.${link.link_type}`, link.link_type)}
                  </span>
                  <span className="text-xs text-gray-500">{formatDate(link.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => onToggle(link.id, !link.is_active)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title={
                  link.is_active
                    ? t('intercompany.links.deactivate', 'Desactiver')
                    : t('intercompany.links.activate', 'Activer')
                }
              >
                {link.is_active ? (
                  <ToggleRight className="w-5 h-5 text-green-400" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-gray-500" />
                )}
              </button>
              <button
                onClick={() => onDelete(link.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                title={t('common.delete', 'Supprimer')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InterCompanyLinksList;
