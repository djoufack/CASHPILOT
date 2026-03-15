import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, FileText, Plus, TrendingUp, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const BottomNavBar = ({ onOpenMenu, onOpenCreate }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    {
      id: 'home',
      label: t('nav.home', 'Accueil'),
      icon: Home,
      action: () => navigate('/app'),
      isActive: location.pathname === '/app',
    },
    {
      id: 'sales',
      label: t('nav.sales', 'Ventes'),
      icon: FileText,
      action: () => navigate('/app/invoices'),
      isActive: [
        '/app/invoices',
        '/app/clients',
        '/app/quotes',
        '/app/credit-notes',
        '/app/recurring-invoices',
        '/app/delivery-notes',
      ].some((p) => location.pathname.startsWith(p)),
    },
    {
      id: 'create',
      label: t('nav.quickCreate', 'Créer'),
      icon: Plus,
      action: onOpenCreate,
      isCreate: true,
    },
    {
      id: 'finance',
      label: t('nav.financeSection', 'Finance'),
      icon: TrendingUp,
      action: () => navigate('/app/cash-flow'),
      isActive: [
        '/app/cash-flow',
        '/app/debt-manager',
        '/app/bank-connections',
        '/app/financial-instruments',
        '/app/audit-comptable',
        '/app/suppliers/accounting',
        '/app/scenarios',
      ].some((p) => location.pathname.startsWith(p)),
    },
    {
      id: 'more',
      label: t('nav.more', 'Plus'),
      icon: MoreHorizontal,
      action: onOpenMenu,
      isActive: false,
    },
  ];

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-lg border-t border-gray-800/50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.isCreate) {
            return (
              <button
                key={tab.id}
                onClick={tab.action}
                className="flex flex-col items-center justify-center -mt-4"
                aria-label={tab.label}
              >
                <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30 active:scale-95 transition-transform">
                  <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] text-orange-400 mt-0.5 font-medium">{tab.label}</span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={tab.action}
              className={cn(
                'relative flex flex-col items-center justify-center flex-1 py-2 transition-colors',
                tab.isActive ? 'text-orange-400' : 'text-gray-500 active:text-gray-300'
              )}
              aria-label={tab.label}
              aria-current={tab.isActive ? 'page' : undefined}
            >
              {tab.isActive && <div className="absolute top-0 w-8 h-0.5 rounded-full bg-orange-400" />}
              <Icon className="w-5 h-5" />
              <span className={cn('text-[10px] mt-1 font-medium', tab.isActive ? 'text-orange-400' : 'text-gray-500')}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavBar;
