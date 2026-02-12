import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useInvoices } from '@/hooks/useInvoices';
import { useProducts } from '@/hooks/useProducts';
import { useServices } from '@/hooks/useServices';
import ProductPicker from './ProductPicker';
import ServicePicker from './ServicePicker';
import { formatCurrency } from '@/utils/calculations';
import { format } from 'date-fns';
import { FileText, Clock, Package, Wrench, Loader2 } from 'lucide-react';

const ProjectBillingDialog = ({ open, onOpenChange, projectId, project, onSuccess }) => {
  const { t } = useTranslation();
  const { fetchBillableTimesheetsForProject, markAsInvoiced } = useTimesheets();
  const { createInvoice } = useInvoices();
  const { products } = useProducts();
  const { services } = useServices();

  const [billableTimesheets, setBillableTimesheets] = useState([]);
  const [selectedTimesheetIds, setSelectedTimesheetIds] = useState([]);
  const [productItems, setProductItems] = useState([]);
  const [serviceItems, setServiceItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open && projectId) {
      loadTimesheets();
    }
  }, [open, projectId]);

  const loadTimesheets = async () => {
    setLoading(true);
    const data = await fetchBillableTimesheetsForProject(projectId);
    setBillableTimesheets(data);
    setSelectedTimesheetIds(data.map(ts => ts.id)); // select all by default
    setLoading(false);
  };

  // Toggle timesheet selection
  const toggleTimesheet = (id) => {
    setSelectedTimesheetIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Add product from picker
  const handleAddProduct = (product) => {
    setProductItems(prev => [...prev, {
      id: Date.now().toString(),
      description: product.product_name,
      quantity: 1,
      unitPrice: product.unit_price || 0,
      product_id: product.id,
      item_type: 'product'
    }]);
  };

  // Add service from picker
  const handleAddService = (service) => {
    const unitPrice = service.pricing_type === 'hourly' ? service.hourly_rate :
                      service.pricing_type === 'fixed' ? service.fixed_price :
                      service.unit_price || 0;
    setServiceItems(prev => [...prev, {
      id: Date.now().toString(),
      description: service.service_name,
      quantity: 1,
      unitPrice,
      service_id: service.id,
      item_type: 'service'
    }]);
  };

  // Calculate totals
  const selectedTimesheets = billableTimesheets.filter(ts => selectedTimesheetIds.includes(ts.id));
  const timesheetTotal = selectedTimesheets.reduce((sum, ts) => {
    const hours = (ts.duration_minutes || 0) / 60;
    const rate = ts.hourly_rate || ts.project?.hourly_rate || 0;
    return sum + (hours * rate);
  }, 0);
  const productTotal = productItems.reduce((sum, p) => sum + (p.quantity * p.unitPrice), 0);
  const serviceTotal = serviceItems.reduce((sum, s) => sum + (s.quantity * s.unitPrice), 0);
  const grandTotal = timesheetTotal + productTotal + serviceTotal;

  const clientId = project?.client_id;
  const currency = project?.client?.preferred_currency || 'EUR';

  // Determine invoice_type
  const hasProducts = productItems.length > 0;
  const hasServices = serviceItems.length > 0 || selectedTimesheetIds.length > 0;
  const invoiceType = hasProducts && hasServices ? 'mixed' : hasProducts ? 'product' : 'service';

  const handleGenerate = async () => {
    if (!clientId || grandTotal <= 0) return;
    setGenerating(true);
    try {
      // Build all items
      const allItems = [
        ...selectedTimesheets.map(ts => ({
          description: ts.notes || ts.task?.name || 'Timesheet',
          quantity: (ts.duration_minutes || 0) / 60,
          unitPrice: ts.hourly_rate || ts.project?.hourly_rate || 0,
          amount: ((ts.duration_minutes || 0) / 60) * (ts.hourly_rate || ts.project?.hourly_rate || 0),
          itemType: 'timesheet',
          timesheet_id: ts.id
        })),
        ...productItems.map(p => ({
          ...p,
          amount: p.quantity * p.unitPrice,
          itemType: 'product'
        })),
        ...serviceItems.map(s => ({
          ...s,
          amount: s.quantity * s.unitPrice,
          itemType: 'service'
        }))
      ];

      const invoiceData = {
        client_id: clientId,
        date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        total_ht: grandTotal,
        tax_rate: 20,
        total_ttc: grandTotal * 1.2,
        balance_due: grandTotal * 1.2,
        payment_status: 'unpaid',
        invoice_type: invoiceType,
        notes: `Project: ${project?.name || ''}`
      };

      const newInvoice = await createInvoice(invoiceData, allItems);

      // Mark timesheets as invoiced
      if (selectedTimesheetIds.length > 0 && newInvoice?.id) {
        await markAsInvoiced(selectedTimesheetIds, newInvoice.id);
      }

      // Reset and close
      setProductItems([]);
      setServiceItems([]);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error generating project invoice:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white w-full sm:max-w-[90%] md:max-w-[800px] overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-gradient flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t('projects.billProject')} - {project?.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Timesheets section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-orange-400" />
                {t('timesheets.title')} ({selectedTimesheetIds.length}/{billableTimesheets.length})
              </h3>
              {billableTimesheets.length === 0 ? (
                <p className="text-gray-500 text-sm py-2">{t('projects.noTimesheets')}</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {billableTimesheets.map(ts => (
                    <div key={ts.id} className="flex items-center gap-3 p-2 rounded bg-gray-800/50 hover:bg-gray-800 transition-colors">
                      <Checkbox
                        checked={selectedTimesheetIds.includes(ts.id)}
                        onCheckedChange={() => toggleTimesheet(ts.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{ts.task?.name || ts.notes || 'Entry'}</p>
                        <p className="text-xs text-gray-500">{format(new Date(ts.date), 'MMM dd')} - {((ts.duration_minutes || 0) / 60).toFixed(1)}h</p>
                      </div>
                      <span className="text-sm text-orange-400 font-mono">
                        {formatCurrency(((ts.duration_minutes || 0) / 60) * (ts.hourly_rate || ts.project?.hourly_rate || 0), currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Products section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-blue-400" />
                {t('invoices.addProducts', { defaultValue: 'Add Products' })} ({productItems.length})
              </h3>
              <ProductPicker products={products} onAddProduct={handleAddProduct} currency={currency} />
              {productItems.length > 0 && (
                <div className="mt-2 space-y-1">
                  {productItems.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 bg-gray-800/50 rounded text-sm">
                      <span className="text-white">{p.description}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">x{p.quantity}</span>
                        <span className="text-orange-400">{formatCurrency(p.quantity * p.unitPrice, currency)}</span>
                        <Button variant="ghost" size="sm" onClick={() => setProductItems(prev => prev.filter(x => x.id !== p.id))} className="text-red-400 h-6 w-6 p-0">&times;</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Services section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-3">
                <Wrench className="w-4 h-4 text-emerald-400" />
                {t('invoices.addServices', { defaultValue: 'Add Services' })} ({serviceItems.length})
              </h3>
              <ServicePicker services={services} onAddService={handleAddService} currency={currency} />
              {serviceItems.length > 0 && (
                <div className="mt-2 space-y-1">
                  {serviceItems.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2 bg-gray-800/50 rounded text-sm">
                      <span className="text-white">{s.description}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">x{s.quantity}</span>
                        <span className="text-orange-400">{formatCurrency(s.quantity * s.unitPrice, currency)}</span>
                        <Button variant="ghost" size="sm" onClick={() => setServiceItems(prev => prev.filter(x => x.id !== s.id))} className="text-red-400 h-6 w-6 p-0">&times;</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="border-t border-gray-700 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-400">{t('timesheets.title')}</span><span className="text-white">{formatCurrency(timesheetTotal, currency)}</span></div>
              {productTotal > 0 && <div className="flex justify-between text-sm"><span className="text-gray-400">{t('invoices.productItems', { defaultValue: 'Products' })}</span><span className="text-white">{formatCurrency(productTotal, currency)}</span></div>}
              {serviceTotal > 0 && <div className="flex justify-between text-sm"><span className="text-gray-400">{t('invoices.serviceItems', { defaultValue: 'Services' })}</span><span className="text-white">{formatCurrency(serviceTotal, currency)}</span></div>}
              <div className="flex justify-between text-lg font-bold border-t border-gray-700 pt-2">
                <span className="text-gradient">{t('invoices.totalHT')}</span>
                <span className="text-gradient">{formatCurrency(grandTotal, currency)}</span>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating || grandTotal <= 0}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
              {t('invoices.generateInvoice')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProjectBillingDialog;
