
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import '@/styles/light-theme.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import OnboardingTour from '@/components/OnboardingTour';

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <ThemeProvider>
      <App />
      <OnboardingTour />
    </ThemeProvider>
  </AuthProvider>
);

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.error('SW registration failed:', err);
    });
  });
}
