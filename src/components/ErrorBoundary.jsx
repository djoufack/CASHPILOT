import React from 'react';
import { useTranslation } from 'react-i18next';
import { captureError } from '@/services/errorTracking';

const ErrorFallback = ({ error }) => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="text-center space-y-4 p-8">
        <h1 className="text-2xl font-bold">{t('common.somethingWentWrong')}</h1>
        <p className="text-gray-400">{error?.message || t('common.unexpectedError')}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t('common.reloadPage')}
        </button>
      </div>
    </div>
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    captureError(error, {
      tags: { boundary: 'root' },
      extra: { componentStack: errorInfo?.componentStack || '' },
    });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
