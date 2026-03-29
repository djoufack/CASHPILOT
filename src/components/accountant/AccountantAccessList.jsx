import { useTranslation } from 'react-i18next';
import { UserCheck, Clock, XCircle, ShieldCheck, Trash2, Mail, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/dateLocale';

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'bg-amber-500/20 text-amber-400 border-amber-700',
  },
  accepted: {
    icon: UserCheck,
    color: 'bg-green-500/20 text-green-400 border-green-700',
  },
  rejected: {
    icon: XCircle,
    color: 'bg-red-500/20 text-red-400 border-red-700',
  },
  revoked: {
    icon: XCircle,
    color: 'bg-slate-500/20 text-slate-400 border-slate-600',
  },
};

const permissionLabels = {
  view_invoices: 'invoices',
  view_expenses: 'expenses',
  view_accounting: 'accounting',
  view_reports: 'reports',
  export_fec: 'FEC',
  export_data: 'export',
};

export default function AccountantAccessList({
  invitations = [],
  accessList = [],
  onRevokeAccess,
  onRevokeInvitation,
  loading,
}) {
  const { t } = useTranslation();

  const allItems = [
    ...accessList.map((a) => ({
      type: 'access',
      id: a.id,
      email: a.accountant_email || '-',
      name: a.accountant_name || null,
      status: 'accepted',
      permissions: a.permissions || {},
      date: a.created_at,
    })),
    ...invitations.map((inv) => ({
      type: 'invitation',
      id: inv.id,
      email: inv.accountant_email,
      name: inv.accountant_name || null,
      status: inv.status,
      permissions: inv.permissions || {},
      date: inv.invited_at,
      expiresAt: inv.expires_at,
    })),
  ];

  // Remove duplicates: if an access exists for the same email, skip the accepted invitation
  const seen = new Set();
  const filtered = allItems.filter((item) => {
    if (item.type === 'invitation' && item.status === 'accepted') {
      const hasAccess = accessList.some((a) => a.accountant_email === item.email || a.accountant_user_id);
      if (hasAccess) return false;
    }
    const key = `${item.type}-${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (filtered.length === 0) {
    return (
      <Card className="border-white/10 bg-[#141c33]/80 backdrop-blur">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ShieldCheck className="h-12 w-12 text-slate-500 mb-4" />
          <p className="text-slate-400 text-sm">{t('accountant.noAccess')}</p>
          <p className="text-slate-500 text-xs mt-1">{t('accountant.noAccessHint')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map((item) => {
        const cfg = statusConfig[item.status] || statusConfig.pending;
        const StatusIcon = cfg.icon;
        const isRevocable = item.type === 'access' || (item.type === 'invitation' && item.status === 'pending');

        return (
          <Card
            key={`${item.type}-${item.id}`}
            className="border-white/10 bg-[#141c33]/80 backdrop-blur hover:border-white/20 transition-colors"
          >
            <CardContent className="flex items-center gap-4 p-4">
              {/* Avatar / icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
                <Mail className="h-5 w-5" />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white truncate">{item.name || item.email}</span>
                  <Badge className={`text-xs ${cfg.color}`}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {t(`accountant.status_${item.status}`)}
                  </Badge>
                </div>
                {item.name && <p className="text-xs text-slate-400 truncate">{item.email}</p>}
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {Object.entries(item.permissions)
                    .filter(([, v]) => v)
                    .map(([key]) => (
                      <Badge key={key} variant="outline" className="text-[10px] border-white/10 text-slate-400">
                        {permissionLabels[key] || key}
                      </Badge>
                    ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {item.type === 'invitation'
                    ? `${t('accountant.invitedOn')} ${formatDate(item.date)}`
                    : `${t('accountant.accessSince')} ${formatDate(item.date)}`}
                  {item.expiresAt && item.status === 'pending' && (
                    <>
                      {' '}
                      &middot; {t('accountant.expiresOn')} {formatDate(item.expiresAt)}
                    </>
                  )}
                </p>
              </div>

              {/* Actions */}
              {isRevocable && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={loading}
                  onClick={() => (item.type === 'access' ? onRevokeAccess?.(item.id) : onRevokeInvitation?.(item.id))}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  title={t('accountant.revoke')}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
