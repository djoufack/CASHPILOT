import { Link } from 'react-router-dom';
import { ArrowRight, Users, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Cross-navigation banner between DRH and Ressources Projets modules.
 * @param {'drh' | 'resources'} variant - Which module the current page belongs to.
 */
export default function HrCrossNav({ variant = 'drh' }) {
  const { t } = useTranslation();

  if (variant === 'resources') {
    return (
      <Link
        to="/app/rh/employes"
        className="group flex items-center gap-2 mb-4 px-4 py-2 rounded-lg bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-colors"
      >
        <UserCheck size={16} className="text-orange-400" />
        <span className="text-sm text-gray-400 group-hover:text-gray-200">
          {t('nav.goToDrh', 'Gestion RH complète (DRH) : paie, congés, recrutement, formation...')}
        </span>
        <ArrowRight size={14} className="text-gray-600 group-hover:text-orange-400 ml-auto transition-colors" />
      </Link>
    );
  }

  return (
    <Link
      to="/app/hr-material"
      className="group flex items-center gap-2 mb-4 px-4 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-colors"
    >
      <Users size={16} className="text-blue-400" />
      <span className="text-sm text-gray-400 group-hover:text-gray-200">
        {t('nav.goToResources', 'Allocation des ressources aux projets (Ressources Projets)')}
      </span>
      <ArrowRight size={14} className="text-gray-600 group-hover:text-blue-400 ml-auto transition-colors" />
    </Link>
  );
}
