import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, FileText, CreditCard, Receipt, Hash } from 'lucide-react';

const ENTITY_TYPE_ICONS = {
  invoice: FileText,
  credit_note: Receipt,
  payment: CreditCard,
};

const ACTION_COLORS = {
  created: 'bg-emerald-500/20 text-emerald-300',
  modified: 'bg-blue-500/20 text-blue-300',
  archived: 'bg-gray-500/20 text-gray-300',
  signed: 'bg-purple-500/20 text-purple-300',
  transmitted: 'bg-orange-500/20 text-orange-300',
};

const AuditTrailTable = ({ entries, loading }) => {
  const { t } = useTranslation();
  const [entityFilter, setEntityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let result = entries || [];

    if (entityFilter !== 'all') {
      result = result.filter((e) => e.entity_type === entityFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.entity_id?.toLowerCase().includes(q) ||
          e.action?.toLowerCase().includes(q) ||
          e.hash?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [entries, entityFilter, searchQuery]);

  const truncateHash = (hash) => {
    if (!hash) return '—';
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder={t('compliance.auditTrail.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0a0e1a] border-gray-800 text-white placeholder:text-gray-500"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-[#0a0e1a] border-gray-800 text-white">
            <SelectValue placeholder={t('compliance.auditTrail.filterByType')} />
          </SelectTrigger>
          <SelectContent className="bg-[#141c33] border-gray-800">
            <SelectItem value="all">{t('compliance.auditTrail.allTypes')}</SelectItem>
            <SelectItem value="invoice">{t('compliance.auditTrail.invoice')}</SelectItem>
            <SelectItem value="credit_note">{t('compliance.auditTrail.creditNote')}</SelectItem>
            <SelectItem value="payment">{t('compliance.auditTrail.payment')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-sm">{t('compliance.auditTrail.noEntries')}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0a0e1a]">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                  {t('compliance.auditTrail.timestamp')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                  {t('compliance.auditTrail.entity')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                  {t('compliance.auditTrail.action')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" />
                    {t('compliance.auditTrail.hash')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const EntityIcon = ENTITY_TYPE_ICONS[entry.entity_type] || FileText;
                const actionColor = ACTION_COLORS[entry.action] || ACTION_COLORS.created;

                return (
                  <tr key={entry.id} className="border-b border-gray-800/50 hover:bg-[#141c33]/50 transition-colors">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <EntityIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-300">{t(`compliance.auditTrail.${entry.entity_type}`)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${actionColor} border-0 text-xs`}>
                        {t(`compliance.auditTrail.actions.${entry.action}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{truncateHash(entry.hash)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditTrailTable;
