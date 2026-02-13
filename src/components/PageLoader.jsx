import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * PageLoader - Glassmorphism loading component for React.lazy Suspense fallbacks.
 * Displayed while lazy-loaded pages are being fetched.
 */
const PageLoader = () => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-[60vh] w-full">
      <div className="relative flex flex-col items-center gap-6 p-10 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
        {/* Animated glow ring */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-orange-500/30 to-amber-400/30 blur-xl animate-pulse" />
          <div className="relative w-16 h-16">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
            {/* Spinning gradient ring */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-500 border-r-amber-400 animate-spin" />
            {/* Inner dot */}
            <div className="absolute inset-[22px] rounded-full bg-gradient-to-br from-orange-500 to-amber-400 animate-pulse" />
          </div>
        </div>

        {/* Loading text */}
        <p className="text-sm font-medium text-white/60 tracking-wide">
          {t('loading.page', 'Chargement...')}
        </p>

        {/* Animated bar */}
        <div className="w-48 h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 animate-loading-bar" />
        </div>
      </div>

      {/* CSS for the loading bar animation */}
      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }
        .animate-loading-bar {
          animation: loading-bar 1.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default PageLoader;
