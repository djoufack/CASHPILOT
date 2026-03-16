import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Shield,
  FileCheck,
  FileText,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PlayCircle,
  XCircle,
} from 'lucide-react';

const CERT_ICONS = {
  nf525: Shield,
  pdp: FileCheck,
  facturx: FileText,
  chorus_pro: Building2,
};

const STATUS_CONFIG = {
  not_started: { color: 'bg-gray-500/20 text-gray-300', icon: Clock },
  in_progress: { color: 'bg-blue-500/20 text-blue-300', icon: PlayCircle },
  submitted: { color: 'bg-yellow-500/20 text-yellow-300', icon: Clock },
  certified: { color: 'bg-emerald-500/20 text-emerald-300', icon: CheckCircle2 },
  expired: { color: 'bg-red-500/20 text-red-300', icon: XCircle },
};

const ComplianceProgressCard = ({ certification, onUpdate }) => {
  const { t } = useTranslation();

  const certType = certification?.certification_type || 'nf525';
  const status = certification?.status || 'not_started';
  const progress = certification?.progress_percent || 0;
  const expiryDate = certification?.expiry_date;

  const Icon = CERT_ICONS[certType] || Shield;
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const StatusIcon = statusCfg.icon;

  const isExpiringSoon =
    expiryDate &&
    (() => {
      const expiry = new Date(expiryDate);
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      return expiry <= thirtyDays;
    })();

  const handleStartProgress = () => {
    if (onUpdate) {
      onUpdate(certType, {
        status: 'in_progress',
        progress_percent: Math.max(progress, 10),
      });
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0f1528]/80 backdrop-blur-sm p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15">
            <Icon className="h-5 w-5 text-indigo-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{t(`compliance.certTypes.${certType}`)}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{t(`compliance.certDescriptions.${certType}`)}</p>
          </div>
        </div>
        <Badge className={`${statusCfg.color} border-0 text-xs flex items-center gap-1`}>
          <StatusIcon className="h-3 w-3" />
          {t(`compliance.statuses.${status}`)}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-400">{t('compliance.progress')}</span>
          <span className="text-xs font-medium text-white">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress === 100
                ? 'bg-emerald-500'
                : progress >= 50
                  ? 'bg-blue-500'
                  : progress > 0
                    ? 'bg-yellow-500'
                    : 'bg-gray-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Expiry warning */}
      {expiryDate && (
        <div className={`flex items-center gap-2 text-xs mb-3 ${isExpiringSoon ? 'text-amber-400' : 'text-gray-400'}`}>
          {isExpiringSoon && <AlertTriangle className="h-3.5 w-3.5" />}
          <span>
            {t('compliance.expiresOn')}: {new Date(expiryDate).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Notes */}
      {certification?.notes && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{certification.notes}</p>}

      {/* Action */}
      {status === 'not_started' && onUpdate && (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 text-xs"
          onClick={handleStartProgress}
        >
          {t('compliance.startCertification')}
        </Button>
      )}
    </div>
  );
};

export default ComplianceProgressCard;
