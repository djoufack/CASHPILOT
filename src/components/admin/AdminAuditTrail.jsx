import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminAuditTrail } from '@/hooks/useAdminAuditTrail';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, Search, Shield } from 'lucide-react';

const formatSummary = (details) => {
  if (!details || typeof details !== 'object') {
    return 'No details';
  }

  if (details.message) {
    return details.message;
  }

  if (details.new_data?.role) {
    return `role => ${details.new_data.role}`;
  }

  if (details.new_data?.subject) {
    return `email => ${details.new_data.subject}`;
  }

  if (details.resource) {
    return `resource => ${details.resource}`;
  }

  return JSON.stringify(details);
};

const AdminAuditTrail = () => {
  const { t } = useTranslation();
  const { logs, loading, error, fetchAuditTrail } = useAdminAuditTrail();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAuditTrail();
  }, [fetchAuditTrail]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return logs;
    }

    return logs.filter((entry) =>
      [
        entry.action,
        entry.actor_name,
        entry.user_id,
        entry.details?.resource,
        formatSummary(entry.details),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    );
  }, [logs, searchTerm]);

  const auditStats = useMemo(() => ({
    total: logs.length,
    actors: new Set(logs.map((entry) => entry.user_id).filter(Boolean)).size,
    actions: new Set(logs.map((entry) => entry.action).filter(Boolean)).size,
  }), [logs]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Audit events</div>
          <div className="text-2xl font-bold text-white mt-1">{auditStats.total}</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Actors</div>
          <div className="text-2xl font-bold text-white mt-1">{auditStats.actors}</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Action types</div>
          <div className="text-2xl font-bold text-white mt-1">{auditStats.actions}</div>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-400" />
              Audit trail
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Live events from <code>public.audit_log</code>.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('admin.auditSearchPlaceholder')}
                className="pl-10 bg-gray-950 border-gray-800 text-white"
              />
            </div>
            <Button
              variant="outline"
              onClick={fetchAuditTrail}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-950">
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-400">Timestamp</TableHead>
                <TableHead className="text-gray-400">Actor</TableHead>
                <TableHead className="text-gray-400">Action</TableHead>
                <TableHead className="text-gray-400 hidden lg:table-cell">Resource</TableHead>
                <TableHead className="text-gray-400">Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-gray-900/30">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                    Loading audit trail...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-red-400">
                    {error}
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-gray-500">
                    No audit events recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((entry) => (
                  <TableRow key={entry.id} className="border-gray-800">
                    <TableCell className="text-gray-300">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="text-white">{entry.actor_name || 'Unknown user'}</div>
                      <div className="text-xs text-gray-500 mt-1">{entry.user_id || 'system'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-gray-700 text-gray-300">
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-gray-400">
                      {entry.details?.resource || '-'}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      <div className="max-w-[420px] truncate" title={formatSummary(entry.details)}>
                        {formatSummary(entry.details)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditTrail;
