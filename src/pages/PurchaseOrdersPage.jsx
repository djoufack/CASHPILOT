
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useClients } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, ClipboardList, Trash2, Loader2, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/utils/calculations';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const emptyItem = { description: '', quantity: 1, unit_price: 0, tax_rate: 21 };

const initialFormData = {
  client_id: '',
  date: new Date().toISOString().split('T')[0],
  due_date: '',
  notes: '',
  status: 'draft',
  items: [{ ...emptyItem }],
};

const POCard = ({ po, onDelete }) => {
  const statusColors = {
    draft: 'bg-gray-500/20 text-gray-400 border-gray-700',
    sent: 'bg-blue-500/20 text-blue-400 border-blue-800',
    confirmed: 'bg-green-500/20 text-green-400 border-green-800',
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-800',
    cancelled: 'bg-red-500/20 text-red-400 border-red-800',
  };

  const statusLabels = {
    draft: 'Brouillon',
    sent: 'Envoyé',
    confirmed: 'Confirmé',
    completed: 'Terminé',
    cancelled: 'Annulé',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-gradient">{po.po_number}</h3>
          <p className="text-sm text-gray-400">{po.client?.company_name || 'Aucun client'}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border capitalize ${statusColors[po.status] || statusColors.draft}`}>
          {statusLabels[po.status] || po.status}
        </span>
      </div>
      <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
        <span>{po.date ? new Date(po.date).toLocaleDateString('fr-FR') : '—'}</span>
        <span className="text-gradient font-bold text-lg">{formatCurrency(po.total || 0)}</span>
      </div>
      {po.notes && <p className="text-xs text-gray-500 mb-4 line-clamp-2">{po.notes}</p>}
      <div className="flex justify-end gap-2 border-t border-gray-800 pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(po.id)}
          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};

const PurchaseOrdersPage = () => {
  const { t } = useTranslation();
  const { purchaseOrders, loading, createPurchaseOrder, deletePurchaseOrder } = usePurchaseOrders();
  const { clients } = useClients();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch =
      po.po_number?.toLowerCase().includes(search.toLowerCase()) ||
      po.client?.company_name?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === 'all' || po.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleOpenDialog = () => {
    setFormData({ ...initialFormData, items: [{ ...emptyItem }] });
    setIsDialogOpen(true);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { ...emptyItem }] });
  };

  const removeItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  const calculateTotals = () => {
    let totalHT = 0;
    let totalTax = 0;
    formData.items.forEach(item => {
      const lineHT = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      totalHT += lineHT;
      totalTax += lineHT * ((parseFloat(item.tax_rate) || 0) / 100);
    });
    return { totalHT, totalTax, totalTTC: totalHT + totalTax };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.client_id) return;

    setSubmitting(true);
    const { totalHT, totalTax, totalTTC } = calculateTotals();
    try {
      await createPurchaseOrder({
        client_id: formData.client_id,
        date: formData.date || new Date().toISOString().split('T')[0],
        due_date: formData.due_date || null,
        notes: formData.notes.trim() || null,
        status: formData.status,
        items: formData.items.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          tax_rate: parseFloat(item.tax_rate) || 0,
        })),
        total: totalTTC,
      });
      setIsDialogOpen(false);
      setFormData({ ...initialFormData, items: [{ ...emptyItem }] });
    } catch {
      // Error handled by hook toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deletePurchaseOrder(id);
    } catch {
      // Error handled by hook toast
    }
  };

  const { totalHT, totalTax, totalTTC } = calculateTotals();

  return (
    <>
      <Helmet>
        <title>Bons de commande - {t('app.name')}</title>
      </Helmet>

      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
              Bons de commande
            </h1>
            <p className="text-gray-400 text-sm md:text-base">Gérez vos bons de commande fournisseurs et clients</p>
          </div>
          <Button onClick={handleOpenDialog} className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="mr-2 h-4 w-4" /> Nouveau bon de commande
          </Button>
        </div>

        {purchaseOrders.length > 0 && (
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              <Input
                placeholder="Rechercher un bon de commande..."
                className="pl-9 bg-gray-900 border-gray-800 text-white w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {[
                { value: 'all', label: 'Tous' },
                { value: 'draft', label: 'Brouillon' },
                { value: 'sent', label: 'Envoyé' },
                { value: 'confirmed', label: 'Confirmé' },
                { value: 'completed', label: 'Terminé' },
              ].map(s => (
                <Button
                  key={s.value}
                  variant={filterStatus === s.value ? 'default' : 'outline'}
                  onClick={() => setFilterStatus(s.value)}
                  className={`flex-shrink-0 ${filterStatus === s.value ? 'bg-orange-500' : 'border-gray-800 text-gray-400'}`}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          </div>
        ) : filteredPOs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-full bg-gray-900 border border-gray-800 rounded-xl p-8 md:p-12 text-center"
          >
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gray-800 rounded-full">
                <ClipboardList className="w-12 h-12 text-orange-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gradient mb-2">Aucun bon de commande</h3>
            <p className="text-gray-400 mb-6">Créez votre premier bon de commande.</p>
            <Button onClick={handleOpenDialog} variant="outline" className="border-gray-700 text-gray-300 w-full md:w-auto">
              Créer un bon de commande
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPOs.map(po => (
              <POCard key={po.id} po={po} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Create PO Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl">Nouveau bon de commande</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client & Dates */}
            <div className="space-y-2">
              <Label className="text-gray-300">Client *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id} className="text-white hover:bg-gray-700">
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Date de livraison</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <Label className="text-gray-300">Articles</Label>
              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                      <div>
                        <Label className="text-gray-500 text-xs">Qté</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-500 text-xs">Prix unitaire</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-500 text-xs">TVA %</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.tax_rate}
                          onChange={(e) => handleItemChange(index, 'tax_rate', e.target.value)}
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        disabled={formData.items.length <= 1}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full">
                <Plus className="w-4 h-4 mr-2" /> Ajouter une ligne
              </Button>
            </div>

            {/* Totals */}
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Sous-total HT</span>
                <span>{formatCurrency(totalHT)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>TVA</span>
                <span>{formatCurrency(totalTax)}</span>
              </div>
              <div className="flex justify-between text-gradient font-bold text-base border-t border-gray-700 pt-2">
                <span>Total TTC</span>
                <span>{formatCurrency(totalTTC)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-gray-300">Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes additionnelles..."
                className="bg-gray-800 border-gray-700 text-white min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-gray-700 text-gray-300 hover:bg-gray-800">
                Annuler
              </Button>
              <Button type="submit" disabled={submitting || !formData.client_id} className="bg-orange-500 hover:bg-orange-600 text-white">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PurchaseOrdersPage;
