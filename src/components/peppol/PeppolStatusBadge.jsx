import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Send, Check, AlertTriangle, Clock, XCircle, Truck, Ban } from 'lucide-react';

const STATUS_CONFIG = {
  none: { color: 'bg-gray-500/20 text-gray-400', icon: null },
  pending: { color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
  sent: { color: 'bg-blue-500/20 text-blue-400', icon: Send },
  delivered: { color: 'bg-green-500/20 text-green-400', icon: Truck },
  accepted: { color: 'bg-emerald-500/20 text-emerald-400', icon: Check },
  rejected: { color: 'bg-red-500/20 text-red-400', icon: XCircle },
  error: { color: 'bg-red-500/20 text-red-400', icon: AlertTriangle },
  cancelled: { color: 'bg-gray-500/20 text-gray-300', icon: Ban },
};

const PeppolStatusBadge = React.memo(({ status, errorMessage }) => {
  const { t } = useTranslation();

  if (!status || status === 'none') return null;

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.none;
  const Icon = config.icon;

  return (
    <Badge className={`${config.color} border-0 gap-1`} title={errorMessage || ''}>
      {Icon && <Icon className="w-3 h-3" />}
      {t(`peppol.status.${status}`)}
    </Badge>
  );
});

export default PeppolStatusBadge;
