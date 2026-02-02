
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Coins, CreditCard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Modal displayed when user has insufficient credits for an action.
 * Shows current balance and redirects to purchase page.
 */
const CreditsGuardModal = ({ isOpen, onClose, requiredCredits, availableCredits, actionLabel }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleBuyCredits = () => {
    onClose();
    navigate('/settings?tab=credits');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X size={20} />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center">
            <Coins className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white text-center mb-2">
          {t('creditsGuard.insufficientCredits')}
        </h2>

        {/* Description */}
        <p className="text-gray-400 text-center text-sm mb-6">
          {t('creditsGuard.description', {
            action: actionLabel || t('creditsGuard.thisAction'),
            required: requiredCredits,
            available: availableCredits
          })}
        </p>

        {/* Credits comparison */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{t('creditsGuard.required')}</p>
            <p className="text-2xl font-bold text-orange-400">{requiredCredits}</p>
          </div>
          <div className="text-gray-600 text-2xl">/</div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{t('creditsGuard.available')}</p>
            <p className="text-2xl font-bold text-red-400">{availableCredits}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleBuyCredits}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {t('creditsGuard.buyCredits')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreditsGuardModal;
