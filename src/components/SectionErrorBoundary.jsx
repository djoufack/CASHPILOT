import React from 'react';
import { useTranslation } from 'react-i18next';
import { captureError } from '@/services/errorTracking';

/**
 * Inline fallback UI for a section-level error.
 * Compact card styled with dark glassmorphism, matching the app theme.
 */
function SectionErrorFallback({ error, section, onRetry, fallback }) {
  const { t } = useTranslation();

  if (fallback) return fallback;

  return (
    <div className="flex items-center justify-center py-8 px-4">
      <div className="text-center space-y-3 p-5 max-w-sm rounded-xl bg-[#0f1528]/80 border border-white/10 backdrop-blur-md">
        <div className="mx-auto w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-white">
          {t('sectionError.title', 'Something went wrong in this section')}
        </p>
        {section && (
          <p className="text-xs text-gray-500 font-mono">{section}</p>
        )}
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('sectionError.retry', 'Retry')}
        </button>
      </div>
    </div>
  );
}

/**
 * Lightweight error boundary for use within pages.
 * Catches render errors in a specific section without bringing down the entire page.
 *
 * Props:
 *  - section: string label for error context (e.g. "charts", "kpi-cards")
 *  - fallback: optional custom fallback React element
 *  - children: the section content to protect
 */
class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    captureError(error, {
      tags: { boundary: 'section', section: this.props.section || 'unknown' },
      extra: { componentStack: errorInfo?.componentStack || '' },
    });
    console.error(`SectionErrorBoundary [${this.props.section || 'unknown'}] caught:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SectionErrorFallback
          error={this.state.error}
          section={this.props.section}
          onRetry={this.handleRetry}
          fallback={this.props.fallback}
        />
      );
    }
    return this.props.children;
  }
}

export default SectionErrorBoundary;
