
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCredits } from '@/hooks/useCredits';
import { Coins, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Compact credits balance widget for sidebar.
 * Shows available credits count and a quick link to buy more.
 */
const CreditsBalance = ({ isCollapsed }) => {
  const { t } = useTranslation();
  const { availableCredits, loading } = useCredits();

  if (loading) return null;

  const isLow = availableCredits <= 5;
  const isEmpty = availableCredits <= 0;

  if (isCollapsed) {
    return (
      <Link to="/app/settings?tab=credits">
        <div className={cn(
          "h-10 w-10 mx-auto flex items-center justify-center rounded-lg transition-all",
          isEmpty
            ? "bg-red-500/20 text-red-400"
            : isLow
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-orange-500/10 text-orange-400"
        )}>
          <div className="relative">
            <Coins size={18} />
            <span className="absolute -top-1.5 -right-2 text-[9px] font-bold">
              {availableCredits}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to="/app/settings?tab=credits">
      <div className={cn(
        "mx-2 px-3 py-2 rounded-lg transition-all flex items-center justify-between",
        isEmpty
          ? "bg-red-500/15 border border-red-500/30 hover:bg-red-500/20"
          : isLow
            ? "bg-yellow-500/15 border border-yellow-500/30 hover:bg-yellow-500/20"
            : "bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/15"
      )}>
        <div className="flex items-center gap-2">
          <Coins size={16} className={cn(
            isEmpty ? "text-red-400" : isLow ? "text-yellow-400" : "text-orange-400"
          )} />
          <div>
            <p className={cn(
              "text-sm font-semibold",
              isEmpty ? "text-red-400" : isLow ? "text-yellow-400" : "text-orange-400"
            )}>
              {availableCredits}
            </p>
            <p className="text-[10px] text-gray-500">{t('credits.creditsLabel')}</p>
          </div>
        </div>
        <Plus size={14} className="text-gray-500" />
      </div>
    </Link>
  );
};

export default CreditsBalance;
