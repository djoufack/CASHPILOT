
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import '@/styles/light-theme.css';
import { AuthProvider } from '@/context/AuthContext';
import { ReferenceDataProvider } from '@/contexts/ReferenceDataContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import OnboardingTour from '@/components/OnboardingTour';
import { initializeErrorTracking } from '@/services/errorTracking';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

initializeErrorTracking();

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ReferenceDataProvider>
        <ThemeProvider>
          <App />
          <OnboardingTour />
        </ThemeProvider>
      </ReferenceDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

// Register Service Worker only in production
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.MODE === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('SW registration failed:', err);
      });
    } else {
      // Unregister in development to prevent caching issues
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
  });
}
