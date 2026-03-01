
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminClients } from '@/hooks/useAdminClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Trash2, ArchiveRestore, Archive, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

const AdminClientManager = () => {
  const { t } = useTranslation();
  const { clients, archivedClients, loading, archiveClient, restoreClient } = useAdminClients();

  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [clientToArchive, setClientToArchive] = useState(null);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  const getOwnerDisplay = (client) => {
    if (client.profiles) {
      return client.profiles.full_name || client.profiles.company_name || 'Unknown';
    }
    return client.user_id?.substring(0, 8) + '...' || 'N/A';
  };

  const currentList = showArchived ? archivedClients : clients;

  const filteredClients = useMemo(() =>
    currentList.filter((client) => {
      const term = searchTerm.toLowerCase();
      return (
        (client.company_name || '').toLowerCase().includes(term) ||
        (client.contact_name || '').toLowerCase().includes(term) ||
        (client.email || '').toLowerCase().includes(term) ||
        getOwnerDisplay(client).toLowerCase().includes(term)
      );
    }),
    [currentList, searchTerm]
  );

  const handleArchiveClick = (client) => {
    setClientToArchive(client);
    setIsArchiveDialogOpen(true);
  };

  const handleConfirmArchive = async () => {
    if (clientToArchive) {
      await archiveClient(clientToArchive.id);
      setIsArchiveDialogOpen(false);
      setClientToArchive(null);
    }
  };

  const handleRestore = async (client) => {
    await restoreClient(client.id);
  };

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">{t('admin.totalActiveClients', 'Clients actifs')}</div>
          <div className="text-2xl font-bold text-white mt-1">{clients.length}</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">{t('admin.totalArchivedClients', 'Clients archivés')}</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{archivedClients.length}</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">{t('admin.totalClients', 'Total clients')}</div>
          <div className="text-2xl font-bold text-gradient mt-1">{clients.length + archivedClients.length}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder={t('admin.searchAllClients', 'Rechercher parmi tous les clients...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white w-full"
          />
        </div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant={showArchived ? 'default' : 'outline'}
            onClick={() => setShowArchived(!showArchived)}
            className={
              showArchived
                ? 'bg-orange-600 hover:bg-orange-500 text-white'
                : 'border-gray-600 text-gray-300 hover:bg-gray-700'
            }
          >
            <Archive className="w-4 h-4 mr-2" />
            {showArchived
              ? t('admin.showActiveClients', 'Clients actifs')
              : t('admin.showArchivedClients', `Archivés (${archivedClients.length})`)}
          </Button>
        </motion.div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          {showArchived
            ? t('admin.noArchivedClients', 'Aucun client archivé')
            : t('admin.noClients', 'Aucun client trouvé')}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    {t('clients.companyName')}
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell">
                    {t('clients.contactName')}
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                    {t('clients.email')}
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {t('admin.owner', 'Propriétaire')}
                    </div>
                  </th>
                  {showArchived && (
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                      {t('admin.archivedDate', 'Archivé le')}
                    </th>
                  )}
                  <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    {t('clients.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredClients.map((client) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`hover:bg-gray-700/50 transition-colors ${showArchived ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gradient">
                      {client.company_name}
                      <div className="md:hidden text-xs text-gray-400 mt-1">
                        {client.contact_name}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden md:table-cell">
                      {client.contact_name}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden lg:table-cell">
                      {client.email}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                      <Badge variant="outline" className="border-gray-600 text-gray-300 text-xs">
                        {getOwnerDisplay(client)}
                      </Badge>
                    </td>
                    {showArchived && (
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                        {new Date(client.deleted_at).toLocaleDateString()}
                      </td>
                    )}
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {showArchived ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(client)}
                          className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                        >
                          <ArchiveRestore className="w-4 h-4 mr-1" />
                          {t('clients.restore', 'Restaurer')}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchiveClick(client)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {t('buttons.archive', 'Archiver')}
                        </Button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Archive confirmation dialog */}
      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent className="w-full sm:max-w-[90%] md:max-w-lg bg-gray-800 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.archiveClientTitle', 'Archiver ce client (admin)')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {clientToArchive && (
                <>
                  <span className="font-medium text-white">{clientToArchive.company_name}</span>
                  {' — '}
                  {t('admin.archiveClientDescription', 'Ce client sera archivé pour son propriétaire. Il pourra être restauré à tout moment. Les factures et documents associés seront conservés.')}
                  <br />
                  <span className="text-orange-400 text-xs mt-2 block">
                    {t('admin.ownerInfo', 'Propriétaire')} : {getOwnerDisplay(clientToArchive)}
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto mt-0">
              {t('buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmArchive}
              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
            >
              {t('buttons.archive', 'Archiver')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminClientManager;
