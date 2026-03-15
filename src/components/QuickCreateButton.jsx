import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, FileText, FileSignature, Receipt, Users, Truck, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const QuickCreateButton = ({ isOpen: externalOpen, onOpenChange }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);

  // Sync with external control
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = useCallback(
    (val) => {
      if (onOpenChange) onOpenChange(val);
      setInternalOpen(val);
    },
    [onOpenChange]
  );

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, setIsOpen]);

  const actions = [
    {
      label: t('nav.newInvoice', 'Nouvelle facture'),
      icon: FileText,
      path: '/app/invoices',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: t('nav.newQuote', 'Nouveau devis'),
      icon: FileSignature,
      path: '/app/quotes',
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      label: t('nav.newExpense', 'Nouvelle dépense'),
      icon: Receipt,
      path: '/app/expenses',
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: t('nav.newClient', 'Nouveau client'),
      icon: Users,
      path: '/app/clients',
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: t('nav.newSupplier', 'Nouveau fournisseur'),
      icon: Truck,
      path: '/app/suppliers',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: t('nav.newEmployee', 'Nouvel employé'),
      icon: UserCheck,
      path: '/app/rh/employes',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
  ];

  const handleAction = (action) => {
    setIsOpen(false);
    navigate(`${action.path}?action=create`);
  };

  return (
    <>
      {/* Desktop Floating Button - hidden on mobile (BottomNavBar handles it) */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 hidden md:flex',
          'w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600',
          'items-center justify-center shadow-lg shadow-orange-500/30',
          'transition-all duration-200 hover:scale-105 active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-950'
        )}
        aria-label={t('nav.quickCreate', 'Créer')}
      >
        <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
      </button>

      {/* Quick Create Sheet Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setIsOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed z-50 bottom-0 left-0 right-0 md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md md:w-full"
            >
              <div
                className="bg-gray-900 border border-gray-800 rounded-t-2xl md:rounded-2xl p-6 shadow-2xl"
                style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-white">{t('nav.quickCreate', 'Création rapide')}</h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    aria-label={t('common.close', 'Fermer')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {actions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.path}
                        onClick={() => handleAction(action)}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-800 hover:border-gray-700 bg-gray-800/30 hover:bg-gray-800/60 transition-all duration-200 active:scale-95 group"
                      >
                        <div className={cn('p-3 rounded-lg', action.bg)}>
                          <Icon className={cn('w-6 h-6', action.color)} />
                        </div>
                        <span className="text-sm font-medium text-gray-300 group-hover:text-white text-center">
                          {action.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default QuickCreateButton;
