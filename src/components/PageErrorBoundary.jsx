import React from 'react';
import { useTranslation } from 'react-i18next';
import { captureError } from '@/services/errorTracking';

/**
 * Fallback UI displayed when a page-level error is caught.
 * Uses a functional component so we can call useTranslation().
 */
function PageErrorFallback({ error, onRetry }) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4 p-8 max-w-md rounded-2xl bg-[#0f1528]/80 border border-white/10 backdrop-blur-md">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white">
          {t('pageError.title', 'Something went wrong')}
        </h2>
        <p className="text-sm text-gray-400">
          {t('pageError.description', 'An error occurred while loading this page. The rest of the application is still available.')}
        </p>
        {error?.message && (
          <p className="text-xs text-gray-500 font-mono bg-white/5 rounded px-3 py-2 break-all">
            {error.message}
          </p>
        )}
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('pageError.retry', 'Retry')}
        </button>
      </div>
    </div>
  );
}

/**
 * Per-page ErrorBoundary that catches render errors in individual pages
 * without bringing down the entire application.
 */
class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    captureError(error, {
      tags: { boundary: 'page' },
      extra: { componentStack: errorInfo?.componentStack || '' },
    });
    console.error('PageErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <PageErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

export default PageErrorBoundary;
