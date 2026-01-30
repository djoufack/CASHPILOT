
import React from "react";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClients } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { validateEmail } from '@/utils/validation';
import { Currency } from '@/types';

const ClientManager = () => {
  const { t } = useTranslation();
  const { clients, loading, addClient, updateClient, deleteClient } = useClients();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    address: '',
    vatNumber: '',
    email: '',
    preferredCurrency: 'EUR'
  });

  const handleOpenDialog = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        companyName: client.companyName,
        contactName: client.contactName,
        address: client.address,
        vatNumber: client.vatNumber,
        email: client.email,
        preferredCurrency: client.preferredCurrency
      });
    } else {
      setEditingClient(null);
      setFormData({
        companyName: '',
        contactName: '',
        address: '',
        vatNumber: '',
        email: '',
        preferredCurrency: 'EUR'
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateEmail(formData.email)) {
      return;
    }

    try {
      if (editingClient) {
        await updateClient(editingClient.id, formData);
      } else {
        await addClient(formData);
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleDeleteClick = (client) => {
    setClientToDelete(client);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (clientToDelete) {
      await deleteClient(clientToDelete.id);
      setIsDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const filteredClients = clients.filter(client =>
    client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.contactName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder={t('clients.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white w-full"
          />
        </div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full md:w-auto">
          <Button
            onClick={() => handleOpenDialog()}
            className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('clients.addClient')}
          </Button>
        </motion.div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-8 text-gray-400">{t('clients.noClients')}</div>
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
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                    {t('clients.preferredCurrency')}
                  </th>
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
                    className="hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => handleOpenDialog(client)}
                  >
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gradient">
                      {client.companyName}
                      {/* Mobile Only Details */}
                      <div className="md:hidden text-xs text-gray-400 mt-1">
                         {client.contactName}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden md:table-cell">
                      {client.contactName}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden lg:table-cell">
                      {client.email}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden lg:table-cell">
                      {client.preferredCurrency}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(client)}
                          className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(client)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full sm:max-w-[90%] md:max-w-lg bg-gray-800 border-gray-700 text-white p-4 md:p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gradient">
              {editingClient ? t('clients.editClient') : t('clients.addClient')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">{t('clients.companyName')}</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                required
                className="bg-gray-700 border-gray-600 text-white w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">{t('clients.contactName')}</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                required
                className="bg-gray-700 border-gray-600 text-white w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('clients.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="bg-gray-700 border-gray-600 text-white w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t('clients.address')}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
                className="bg-gray-700 border-gray-600 text-white w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vatNumber">{t('clients.vatNumber')}</Label>
              <Input
                id="vatNumber"
                value={formData.vatNumber}
                onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                className="bg-gray-700 border-gray-600 text-white w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">{t('clients.preferredCurrency')}</Label>
              <Select
                value={formData.preferredCurrency}
                onValueChange={(value) => setFormData({ ...formData, preferredCurrency: value })}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600 text-white">
                  <SelectItem value={Currency.EUR}>{t('currency.EUR')}</SelectItem>
                  <SelectItem value={Currency.USD}>{t('currency.USD')}</SelectItem>
                  <SelectItem value={Currency.GBP}>{t('currency.GBP')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto"
              >
                {t('buttons.cancel')}
              </Button>
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto"
              >
                {t('buttons.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-full sm:max-w-[90%] md:max-w-lg bg-gray-800 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('clients.deleteClient')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {t('clients.confirmDelete')} {t('clients.deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto mt-0">
              {t('buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
            >
              {t('buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientManager;
