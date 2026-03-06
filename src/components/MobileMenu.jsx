
import React, { useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import CompanySwitcher from '@/components/CompanySwitcher';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const MobileMenu = ({ isOpen, onClose, menuItems }) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { companies, activeCompany, switchCompany } = useCompany();
  const menuPanelRef = useRef(null);
  const closeButtonRef = useRef(null);

  const handleLogout = () => {
    logout();
    onClose();
  };

  const handleEscape = useCallback(() => {
    onClose();
  }, [onClose]);

  useFocusTrap({
    active: isOpen,
    containerRef: menuPanelRef,
    onEscape: handleEscape,
    initialFocusRef: closeButtonRef,
    restoreFocus: true,
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            ref={menuPanelRef}
            className="fixed inset-y-0 left-0 w-[85%] max-w-[320px] bg-gray-900 border-r border-gray-800 z-50 flex flex-col h-full shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={t('common.primaryNavigation', 'Primary navigation')}
          >
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
               <span className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-blue-500 bg-clip-text text-transparent">
                  CashPilot
               </span>
               <Button
                 ref={closeButtonRef}
                 variant="ghost"
                 size="icon"
                 onClick={onClose}
                 className="text-gray-400"
                 aria-label={t('common.close', 'Close')}
               >
                  <X className="w-6 h-6" />
               </Button>
            </div>

            <nav
              className="flex-1 overflow-y-auto py-4 px-3 space-y-1"
              role="navigation"
              aria-label={t('common.primaryNavigation', 'Primary navigation')}
            >
               {companies.length > 0 && (
                 <div className="px-3 pb-4 mb-3 border-b border-gray-800">
                   <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                     {t('company.activeCompany')}
                   </div>
                   <CompanySwitcher
                     companies={companies}
                     activeCompany={activeCompany}
                     onSwitch={(companyId) => {
                       switchCompany(companyId);
                       onClose();
                     }}
                     onCreateNew={() => {
                       onClose();
                       navigate('/app/settings?tab=societe');
                     }}
                   />
                 </div>
               )}
               <div className="px-3 pb-4 mb-3 border-b border-gray-800">
                 <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                   {t('topNav.language')}
                 </div>
                 <LanguageSwitcher variant="segmented" fullWidth />
               </div>
               {menuItems.map((item, idx) => {
                 if (item.type === 'separator') {
                   return (
                     <div key={idx} className="px-3 py-2 mt-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                       {item.label}
                     </div>
                   );
                 }

                 const isActive = location.pathname === item.path;
                 
                 return (
                   <Link 
                     key={item.path} 
                     to={item.path} 
                     onClick={onClose}
                     className={`flex items-center justify-between px-3 py-3 rounded-lg transition-colors ${
                       isActive ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'text-gray-300 hover:bg-gray-800'
                     }`}
                   >
                      <div className="flex items-center gap-3">
                         <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
                         <span className="font-medium">{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4" />}
                   </Link>
                 );
               })}
            </nav>

            <div className="p-4 border-t border-gray-800 bg-gray-900">
               <Button 
                 variant="outline" 
                 className="w-full justify-center border-red-900/30 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                 onClick={handleLogout}
                 aria-label={t('common.logout')}
               >
                 {t('common.logout')}
               </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileMenu;
