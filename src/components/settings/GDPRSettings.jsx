import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGDPR } from '@/hooks/useGDPR';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, ExternalLink, Database, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

const GDPRSettings = () => {
  const { t } = useTranslation();
  const { requestDataExport, exportStatus, exportUrl } = useGDPR();

  const getStatusIcon = () => {
    switch (exportStatus) {
      case 'pending':
        return <Loader2 className="w-4 h-4 animate-spin text-orange-400" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (exportStatus) {
      case 'pending':
        return t('gdpr.settings.exportPending');
      case 'completed':
        return t('gdpr.settings.exportReady');
      case 'failed':
        return t('gdpr.exportError');
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Export Section */}
      <Card className="bg-gray-900 border-gray-800 text-white shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('gdpr.settings.title')}</CardTitle>
              <CardDescription className="text-gray-400">
                {t('gdpr.exportDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-400 leading-relaxed">
            {t('gdpr.exportInfo')}
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Button
              onClick={requestDataExport}
              disabled={exportStatus === 'pending'}
              variant="outline"
              className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
            >
              {exportStatus === 'pending' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('gdpr.settings.exportPending')}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  {t('gdpr.settings.exportData')}
                </>
              )}
            </Button>

            {/* Status indicator */}
            {exportStatus !== 'idle' && (
              <div className="flex items-center gap-2 text-sm">
                {getStatusIcon()}
                <span className={
                  exportStatus === 'completed' ? 'text-green-400' :
                  exportStatus === 'failed' ? 'text-red-400' :
                  'text-orange-400'
                }>
                  {getStatusText()}
                </span>
              </div>
            )}
          </div>

          {/* Download link when export is ready */}
          {exportStatus === 'completed' && exportUrl && (
            <div className="mt-3 p-3 rounded-lg bg-green-900/20 border border-green-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <p className="text-sm text-green-300 flex-1">
                  {t('gdpr.settings.exportReady')}
                </p>
                <a
                  href={exportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600/20 text-green-400 hover:bg-green-600/30 text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t('gdpr.settings.downloadExport')}
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account deletion link */}
      <Card className="bg-gray-900 border-gray-800 text-white shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-red-400">{t('gdpr.settings.deleteAccount')}</CardTitle>
              <CardDescription className="text-gray-400">
                {t('gdpr.settings.deleteWarning')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 mb-4">
            {t('gdpr.deleteConfirmDescription')}
          </p>
          <a
            href="/app/settings?tab=danger"
            className="inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t('gdpr.settings.deleteAccount')}
          </a>
        </CardContent>
      </Card>
    </div>
  );
};

export default GDPRSettings;
