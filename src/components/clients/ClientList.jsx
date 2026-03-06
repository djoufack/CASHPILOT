
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArchiveRestore, Download, Edit, FileText, Trash2, LayoutGrid, List } from 'lucide-react';
import { motion } from 'framer-motion';
import PaginationControls from '@/components/PaginationControls';

const ClientList = ({
  viewMode,
  setViewMode,
  showArchived,
  loadingArchived,
  archivedClients,
  loading,
  filteredClients,
  paginatedClients,
  pagination,
  onOpenDialog,
  onDeleteClick,
  onRestore,
  onExportPDF,
  onExportHTML,
  t: tProp,
}) => {
  const { t: tHook } = useTranslation();
  const t = tProp || tHook;

  const renderClientActions = (client) => (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onExportPDF(client)}
        className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/20"
        title="Export PDF"
      >
        <Download className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onExportHTML(client)}
        className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20"
        title="Export HTML"
      >
        <FileText className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onOpenDialog(client)}
        className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20"
        title={t('common.edit')}
      >
        <Edit className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDeleteClick(client)}
        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
        title={t('common.delete')}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );

  if (showArchived) {
    if (loadingArchived) {
      return <div className="text-center py-8 text-gray-400">Loading...</div>;
    }
    if (archivedClients.length === 0) {
      return (
        <div className="text-center py-8 text-gray-400">
          {t('clients.noArchivedClients', 'Aucun client archivé')}
        </div>
      );
    }
    return (
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
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  {t('clients.deletedAt', 'Archivé le')}
                </th>
                <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                  {t('clients.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {archivedClients.map((client) => (
                <motion.tr
                  key={client.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-700/50 transition-colors opacity-60"
                >
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-400">
                    {client.company_name}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                    {client.contact_name}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                    {client.email}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                    {new Date(client.deleted_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRestore(client)}
                      className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                    >
                      <ArchiveRestore className="w-4 h-4 mr-1" />
                      {t('clients.restore', 'Restaurer')}
                    </Button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading...</div>;
  }

  if (filteredClients.length === 0) {
    return <div className="text-center py-8 text-gray-400">{t('clients.noClients')}</div>;
  }

  return (
    <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
      <TabsList className="bg-gray-800 border border-gray-700 mb-4">
        <TabsTrigger value="list" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
          <List className="w-4 h-4 mr-2" /> {t('common.list')}
        </TabsTrigger>
        <TabsTrigger value="gallery" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
          <LayoutGrid className="w-4 h-4 mr-2" /> {t('common.gallery')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="list">
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
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                    {t('clients.preferredCurrency')}
                  </th>
                  <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    {t('clients.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {paginatedClients.map((client) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => onOpenDialog(client)}
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
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden lg:table-cell">
                      {client.preferred_currency}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {renderClientActions(client)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="gallery">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedClients.map((client) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-gradient">{client.company_name}</p>
                  <p className="text-sm text-gray-300 mt-1">{client.contact_name || '-'}</p>
                  <p className="text-xs text-gray-400 mt-1">{client.email || '-'}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">{client.preferred_currency || '-'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mt-4">
                <div className="bg-gray-900/50 rounded p-2">
                  <p className="text-gray-500">TVA</p>
                  <p className="text-gray-300 mt-1">{client.vat_number || '-'}</p>
                </div>
                <div className="bg-gray-900/50 rounded p-2">
                  <p className="text-gray-500">{t('clients.phone', 'Téléphone')}</p>
                  <p className="text-gray-300 mt-1">{client.phone || '-'}</p>
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-gray-700">
                {renderClientActions(client)}
              </div>
            </motion.div>
          ))}
        </div>
      </TabsContent>

      <PaginationControls
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        pageSize={pagination.pageSize}
        pageSizeOptions={pagination.pageSizeOptions}
        hasNextPage={pagination.hasNextPage}
        hasPrevPage={pagination.hasPrevPage}
        onNextPage={pagination.nextPage}
        onPrevPage={pagination.prevPage}
        onGoToPage={pagination.goToPage}
        onChangePageSize={pagination.changePageSize}
      />
    </Tabs>
  );
};

export default ClientList;
