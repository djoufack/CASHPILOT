
import React from "react";
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvoices } from '@/hooks/useInvoices';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useClients } from '@/hooks/useClients';
import { useProducts } from '@/hooks/useProducts';
import { useServices } from '@/hooks/useServices';
import ProductPicker from './ProductPicker';
import ServicePicker from './ServicePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { motion } from 'framer-motion';
import { calculateInvoiceTotalWithDiscount, formatCurrency } from '@/utils/calculations';
import { Plus, Trash2, Tag, Truck, Settings2, ChevronDown, ChevronUp, Package, Wrench } from 'lucide-react';
import { format } from 'date-fns';

const InvoiceGenerator = ({ onSuccess }) => {
  const { t } = useTranslation();
  const { createInvoice } = useInvoices();
  const { timesheets, markAsInvoiced } = useTimesheets();
  const { clients } = useClients();
  const { products } = useProducts();
  const { services } = useServices();

  const [selectedClientId, setSelectedClientId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedTimesheets, setSelectedTimesheets] = useState([]);
  const [productItems, setProductItems] = useState([]);
  const [serviceItems, setServiceItems] = useState([]);
  const [manualItems, setManualItems] = useState([]);
  const [taxRate, setTaxRate] = useState(20);
  const [notes, setNotes] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [reference, setReference] = useState('');
  const [globalDiscountType, setGlobalDiscountType] = useState('none');
  const [globalDiscountValue, setGlobalDiscountValue] = useState(0);

  // New enhanced fields
  const [shippingFee, setShippingFee] = useState(0);
  const [adjustment, setAdjustment] = useState(0);
  const [adjustmentLabel, setAdjustmentLabel] = useState('');
  const [headerNote, setHeaderNote] = useState('');
  const [footerNote, setFooterNote] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [internalRemark, setInternalRemark] = useState('');
  const [customFields, setCustomFields] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [preSelectedIds, setPreSelectedIds] = useState([]);

  // Read pre-selected timesheet IDs from sessionStorage (e.g. from TimesheetsPage)
  useEffect(() => {
    const stored = sessionStorage.getItem('selectedTimesheetIds');
    if (stored) {
      try {
        const ids = JSON.parse(stored);
        setPreSelectedIds(ids);
        setSelectedTimesheets(ids);
        sessionStorage.removeItem('selectedTimesheetIds');
      } catch (e) {
        // ignore parse errors
      }
    }
  }, []);

  const filteredTimesheets = timesheets.filter(ts => {
    if (!selectedClientId) return false;
    if (ts.clientId !== selectedClientId) return false;
    if (fromDate && ts.date < fromDate) return false;
    if (toDate && ts.date > toDate) return false;
    return true;
  });

  const handleTimesheetToggle = (timesheetId) => {
    setSelectedTimesheets(prev => {
      if (prev.includes(timesheetId)) {
        return prev.filter(id => id !== timesheetId);
      }
      return [...prev, timesheetId];
    });
  };

  // Product handlers
  const handleAddProduct = (product) => {
    setProductItems(prev => [...prev, {
      id: Date.now().toString(),
      description: product.product_name,
      quantity: 1,
      unitPrice: Number(product.unit_price || 0),
      amount: Number(product.unit_price || 0),
      product_id: product.id,
      item_type: 'product',
      discount_type: 'none',
      discount_value: 0,
      hsn_code: ''
    }]);
  };

  const updateProductItem = (id, field, value) => {
    setProductItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.amount = Number(updated.quantity) * Number(updated.unitPrice);
        }
        return updated;
      }
      return item;
    }));
  };

  const removeProductItem = (id) => {
    setProductItems(prev => prev.filter(item => item.id !== id));
  };

  // Service handlers
  const handleAddService = (service) => {
    let unitPrice = 0;
    let quantity = 1;
    let description = service.service_name;

    if (service.pricing_type === 'hourly') {
      unitPrice = Number(service.hourly_rate || 0);
      description = `${service.service_name} (${t('services.hourly')})`;
    } else if (service.pricing_type === 'fixed') {
      unitPrice = Number(service.fixed_price || 0);
    } else if (service.pricing_type === 'per_unit') {
      unitPrice = Number(service.unit_price || 0);
    }

    setServiceItems(prev => [...prev, {
      id: Date.now().toString(),
      description,
      quantity,
      unitPrice,
      amount: quantity * unitPrice,
      service_id: service.id,
      item_type: 'service',
      discount_type: 'none',
      discount_value: 0,
      hsn_code: ''
    }]);
  };

  const updateServiceItem = (id, field, value) => {
    setServiceItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.amount = Number(updated.quantity) * Number(updated.unitPrice);
        }
        return updated;
      }
      return item;
    }));
  };

  const removeServiceItem = (id) => {
    setServiceItems(prev => prev.filter(item => item.id !== id));
  };

  // Manual item handlers
  const addManualItem = () => {
    setManualItems([...manualItems, {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      item_type: 'manual',
      discount_type: 'none',
      discount_value: 0,
      hsn_code: ''
    }]);
  };

  const removeManualItem = (id) => {
    setManualItems(manualItems.filter(item => item.id !== id));
  };

  const updateManualItem = (id, field, value) => {
    setManualItems(manualItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.amount = Number(updated.quantity) * Number(updated.unitPrice);
        }
        return updated;
      }
      return item;
    }));
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { id: Date.now().toString(), label: '', value: '' }]);
  };

  const removeCustomField = (id) => {
    setCustomFields(customFields.filter(f => f.id !== id));
  };

  const updateCustomField = (id, field, value) => {
    setCustomFields(customFields.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const getAllInvoiceItems = () => {
    const timesheetItems = selectedTimesheets.map(tsId => {
      const ts = timesheets.find(t => t.id === tsId);
      const durationHours = (ts.duration_minutes || 0) / 60;
      const unitPrice = ts.hourly_rate || ts.project?.hourly_rate || 50;
      return {
        description: ts.notes || 'Timesheet entry',
        quantity: durationHours,
        unitPrice,
        amount: durationHours * unitPrice,
        item_type: 'timesheet',
        timesheet_id: ts.id
      };
    });

    const productLineItems = productItems.map(item => ({
      ...item,
      item_type: 'product'
    }));

    const serviceLineItems = serviceItems.map(item => ({
      ...item,
      item_type: 'service'
    }));

    const manualLineItems = manualItems.map(item => ({
      ...item,
      item_type: 'manual'
    }));

    return [...timesheetItems, ...productLineItems, ...serviceLineItems, ...manualLineItems];
  };

  const allItems = getAllInvoiceItems();
  const globalDiscount = { type: globalDiscountType, value: globalDiscountValue };
  const totals = calculateInvoiceTotalWithDiscount(allItems, taxRate / 100, globalDiscount);
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const currency = selectedClient?.preferred_currency || selectedClient?.preferredCurrency || 'EUR';

  // Grand total = TTC + shipping + adjustment
  const grandTotal = totals.totalTTC + Number(shippingFee || 0) + Number(adjustment || 0);

  const handleGenerateInvoice = async () => {
    if (!selectedClientId || allItems.length === 0) {
      return;
    }

    // Compute invoice_type
    const hasProducts = productItems.length > 0;
    const hasServices = serviceItems.length > 0 || selectedTimesheets.length > 0;
    const hasManual = manualItems.length > 0;
    let invoice_type = 'mixed';
    if (hasProducts && !hasServices && !hasManual) {
      invoice_type = 'product';
    } else if (!hasProducts && (hasServices || hasManual)) {
      invoice_type = 'service';
    }

    const invoiceData = {
      client_id: selectedClientId,
      date: issueDate,
      due_date: dueDate || issueDate,
      reference,
      total_ht: totals.totalHT,
      tax_rate: taxRate,
      total_ttc: grandTotal,
      discount_type: globalDiscountType,
      discount_value: globalDiscountValue,
      discount_amount: totals.globalDiscountAmount,
      balance_due: grandTotal,
      payment_status: 'unpaid',
      notes,
      invoice_type,
      shipping_fee: Number(shippingFee || 0),
      adjustment: Number(adjustment || 0),
      adjustment_label: adjustmentLabel,
      header_note: headerNote,
      footer_note: footerNote,
      terms_and_conditions: termsAndConditions,
      internal_remark: internalRemark,
      custom_fields: customFields.filter(f => f.label)
    };

    try {
      const newInvoice = await createInvoice(invoiceData, allItems);

      // Mark timesheets as invoiced
      if (selectedTimesheets.length > 0 && newInvoice?.id) {
        await markAsInvoiced(selectedTimesheets, newInvoice.id);
      }

      // Reset form
      setSelectedClientId('');
      setFromDate('');
      setToDate('');
      setSelectedTimesheets([]);
      setProductItems([]);
      setServiceItems([]);
      setManualItems([]);
      setNotes('');
      setShippingFee(0);
      setAdjustment(0);
      setAdjustmentLabel('');
      setHeaderNote('');
      setFooterNote('');
      setTermsAndConditions('');
      setInternalRemark('');
      setCustomFields([]);
      setReference('');

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error generating invoice:', error);
    }
  };

  // Reusable editable item list renderer
  const renderEditableItemList = (items, updateFn, removeFn, emptyLabel) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2 mt-3">
        {items.map((item) => (
          <div key={item.id} className="bg-gray-700/30 p-3 rounded-lg space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:items-end">
              <div className="md:col-span-4 space-y-1">
                <Label className="text-xs">{t('invoices.description')}</Label>
                <Input value={item.description} onChange={(e) => updateFn(item.id, 'description', e.target.value)} className="bg-gray-700 border-gray-600 text-white w-full" placeholder={emptyLabel} />
              </div>
              <div className="md:col-span-1 space-y-1">
                <Label className="text-xs">{t('invoices.quantity')}</Label>
                <Input type="number" value={item.quantity} onChange={(e) => updateFn(item.id, 'quantity', e.target.value)} className="bg-gray-700 border-gray-600 text-white w-full" min="0" step="0.01" />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label className="text-xs">{t('invoices.unitPrice')}</Label>
                <Input type="number" value={item.unitPrice} onChange={(e) => updateFn(item.id, 'unitPrice', e.target.value)} className="bg-gray-700 border-gray-600 text-white w-full" min="0" step="0.01" />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label className="text-xs">{t('discounts.discount')}</Label>
                <div className="flex gap-1">
                  <Select value={item.discount_type || 'none'} onValueChange={(v) => updateFn(item.id, 'discount_type', v)}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-20 h-10 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600 text-white">
                      <SelectItem value="none">-</SelectItem>
                      <SelectItem value="percentage">%</SelectItem>
                      <SelectItem value="fixed">{t('discounts.fixed')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {item.discount_type && item.discount_type !== 'none' && (
                    <Input type="number" value={item.discount_value || ''} onChange={(e) => updateFn(item.id, 'discount_value', e.target.value)} className="bg-gray-700 border-gray-600 text-white flex-1" min="0" step="0.01" placeholder="0" />
                  )}
                </div>
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label className="text-xs">{t('invoiceEnhanced.hsnCode')}</Label>
                <Input value={item.hsn_code || ''} onChange={(e) => updateFn(item.id, 'hsn_code', e.target.value)} className="bg-gray-700 border-gray-600 text-white w-full" placeholder="HSN/SAC" />
              </div>
              <div className="md:col-span-1 flex justify-end md:justify-center mt-2 md:mt-0">
                <Button variant="ghost" size="sm" onClick={() => removeFn(item.id)} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700 shadow-xl space-y-4">
        <h3 className="text-lg md:text-xl font-bold text-gradient">
          Step 1: {t('invoices.selectClient')}
        </h3>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-full">
            <SelectValue placeholder={t('invoices.selectClient')} />
          </SelectTrigger>
          <SelectContent className="bg-gray-700 border-gray-600 text-white">
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.company_name || client.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedClientId && (
        <>
          <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700 shadow-xl space-y-4">
            <h3 className="text-lg md:text-xl font-bold text-gradient">
              Step 2: {t('invoices.selectDateRange')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('invoices.fromDate')}</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-gray-700 border-gray-600 text-white w-full" />
              </div>
              <div className="space-y-2">
                <Label>{t('invoices.toDate')}</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-gray-700 border-gray-600 text-white w-full" />
              </div>
            </div>
          </div>

          {filteredTimesheets.length > 0 && (
            <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700 shadow-xl space-y-4">
              <h3 className="text-lg md:text-xl font-bold text-gradient">
                Step 3a: {t('invoices.selectTimesheets')}
              </h3>
              <div className="space-y-2">
                {filteredTimesheets.map((ts) => (
                  <div key={ts.id} className="flex items-center space-x-3 p-3 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors">
                    <Checkbox checked={selectedTimesheets.includes(ts.id)} onCheckedChange={() => handleTimesheetToggle(ts.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">{ts.notes || 'No description'}</p>
                      <p className="text-sm text-gray-400">{format(new Date(ts.date), 'MMM dd, yyyy')} • {((ts.duration_minutes || 0) / 60).toFixed(2)}h</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3b: Add Products */}
          <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700 shadow-xl space-y-4">
            <h3 className="text-lg md:text-xl font-bold text-gradient flex items-center gap-2">
              <Package className="w-5 h-5" />
              Step 3b: {t('invoices.addProducts')}
            </h3>
            <ProductPicker products={products} onAddProduct={handleAddProduct} currency={currency} />
            {renderEditableItemList(productItems, updateProductItem, removeProductItem, t('invoices.pickProduct'))}
          </div>

          {/* Step 3c: Add Services */}
          <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700 shadow-xl space-y-4">
            <h3 className="text-lg md:text-xl font-bold text-gradient flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Step 3c: {t('invoices.addServices')}
            </h3>
            <ServicePicker services={services} onAddService={handleAddService} currency={currency} />
            {renderEditableItemList(serviceItems, updateServiceItem, removeServiceItem, t('invoices.pickService'))}
          </div>

          <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h3 className="text-lg md:text-xl font-bold text-gradient">Step 4: Manual Items</h3>
              <Button onClick={addManualItem} variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />{t('invoices.addManualLine')}
              </Button>
            </div>

            {manualItems.map((item) => (
              <div key={item.id} className="bg-gray-700/30 p-3 rounded-lg space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:items-end">
                  <div className="md:col-span-4 space-y-1">
                    <Label className="text-xs">{t('invoices.description')}</Label>
                    <Input value={item.description} onChange={(e) => updateManualItem(item.id, 'description', e.target.value)} className="bg-gray-700 border-gray-600 text-white w-full" placeholder="Service or product" />
                  </div>
                  <div className="md:col-span-1 space-y-1">
                    <Label className="text-xs">{t('invoices.quantity')}</Label>
                    <Input type="number" value={item.quantity} onChange={(e) => updateManualItem(item.id, 'quantity', e.target.value)} className="bg-gray-700 border-gray-600 text-white w-full" min="0" step="0.01" />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs">{t('invoices.unitPrice')}</Label>
                    <Input type="number" value={item.unitPrice} onChange={(e) => updateManualItem(item.id, 'unitPrice', e.target.value)} className="bg-gray-700 border-gray-600 text-white w-full" min="0" step="0.01" />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs">{t('discounts.discount')}</Label>
                    <div className="flex gap-1">
                      <Select value={item.discount_type || 'none'} onValueChange={(v) => updateManualItem(item.id, 'discount_type', v)}>
                        <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-20 h-10 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-gray-700 border-gray-600 text-white">
                          <SelectItem value="none">-</SelectItem>
                          <SelectItem value="percentage">%</SelectItem>
                          <SelectItem value="fixed">{t('discounts.fixed')}</SelectItem>
                        </SelectContent>
                      </Select>
                      {item.discount_type && item.discount_type !== 'none' && (
                        <Input type="number" value={item.discount_value || ''} onChange={(e) => updateManualItem(item.id, 'discount_value', e.target.value)} className="bg-gray-700 border-gray-600 text-white flex-1" min="0" step="0.01" placeholder="0" />
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs">{t('invoiceEnhanced.hsnCode')}</Label>
                    <Input value={item.hsn_code || ''} onChange={(e) => updateManualItem(item.id, 'hsn_code', e.target.value)} className="bg-gray-700 border-gray-600 text-white w-full" placeholder="HSN/SAC" />
                  </div>
                  <div className="md:col-span-1 flex justify-end md:justify-center mt-2 md:mt-0">
                    <Button variant="ghost" size="sm" onClick={() => removeManualItem(item.id)} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700 shadow-xl space-y-4">
            <h3 className="text-lg md:text-xl font-bold text-gradient">Invoice Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>{t('invoices.issueDate')}</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="bg-gray-700 border-gray-600 text-white w-full" />
              </div>
              <div className="space-y-2">
                <Label>{t('invoices.dueDate')}</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-gray-700 border-gray-600 text-white w-full" />
              </div>
              <div className="space-y-2">
                <Label>{t('invoiceEnhanced.reference')}</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} className="bg-gray-700 border-gray-600 text-white w-full" placeholder="#" />
              </div>
              <div className="space-y-2">
                <Label>{t('invoices.taxRate')} (%)</Label>
                <Input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="bg-gray-700 border-gray-600 text-white w-full" min="0" max="100" />
              </div>
            </div>

            {/* Header Note */}
            <div className="space-y-2">
              <Label>{t('invoiceEnhanced.headerNote')}</Label>
              <Textarea value={headerNote} onChange={(e) => setHeaderNote(e.target.value)} rows={2} className="bg-gray-700 border-gray-600 text-white resize-none w-full" placeholder={t('invoiceEnhanced.headerNotePlaceholder')} />
            </div>

            {/* Notes (existing) */}
            <div className="space-y-2">
              <Label>{t('timesheets.notes')}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="bg-gray-700 border-gray-600 text-white resize-none w-full" placeholder="Additional notes or payment terms..." />
            </div>

            {/* Terms and Conditions */}
            <div className="space-y-2">
              <Label>{t('invoiceEnhanced.termsAndConditions')}</Label>
              <Textarea value={termsAndConditions} onChange={(e) => setTermsAndConditions(e.target.value)} rows={3} className="bg-gray-700 border-gray-600 text-white resize-none w-full" placeholder={t('invoiceEnhanced.termsPlaceholder')} />
            </div>

            {/* Global Discount */}
            <div className="border-t border-gray-700 pt-4 space-y-3">
              <div className="flex items-center gap-3">
                <Label className="text-sm text-gray-300 whitespace-nowrap flex items-center gap-1"><Tag className="w-4 h-4" />{t('discounts.global')}</Label>
                <Select value={globalDiscountType} onValueChange={setGlobalDiscountType}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-32 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 text-white">
                    <SelectItem value="none">-</SelectItem>
                    <SelectItem value="percentage">{t('discounts.percentage')}</SelectItem>
                    <SelectItem value="fixed">{t('discounts.fixed')}</SelectItem>
                  </SelectContent>
                </Select>
                {globalDiscountType !== 'none' && (
                  <Input type="number" value={globalDiscountValue} onChange={(e) => setGlobalDiscountValue(Number(e.target.value))} className="bg-gray-700 border-gray-600 text-white w-28 h-9" min="0" step="0.01" />
                )}
              </div>
            </div>

            {/* Shipping + Adjustment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Truck className="w-4 h-4" />{t('invoiceEnhanced.shippingFee')}</Label>
                <Input type="number" value={shippingFee} onChange={(e) => setShippingFee(Number(e.target.value))} className="bg-gray-700 border-gray-600 text-white w-full" min="0" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Settings2 className="w-4 h-4" />{t('invoiceEnhanced.adjustment')}</Label>
                <div className="flex gap-2">
                  <Input type="number" value={adjustment} onChange={(e) => setAdjustment(Number(e.target.value))} className="bg-gray-700 border-gray-600 text-white flex-1" step="0.01" />
                  <Input value={adjustmentLabel} onChange={(e) => setAdjustmentLabel(e.target.value)} className="bg-gray-700 border-gray-600 text-white flex-1" placeholder={t('invoiceEnhanced.adjustmentLabel')} />
                </div>
              </div>
            </div>

            {/* Advanced section (collapsible) */}
            <div className="border-t border-gray-700 pt-3">
              <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="text-gray-400 hover:text-gray-200 w-full justify-between">
                <span>{t('invoiceEnhanced.advancedOptions')}</span>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>

              {showAdvanced && (
                <div className="space-y-4 mt-3">
                  {/* Footer Note */}
                  <div className="space-y-2">
                    <Label>{t('invoiceEnhanced.footerNote')}</Label>
                    <Textarea value={footerNote} onChange={(e) => setFooterNote(e.target.value)} rows={2} className="bg-gray-700 border-gray-600 text-white resize-none w-full" placeholder={t('invoiceEnhanced.footerNotePlaceholder')} />
                  </div>

                  {/* Internal Remark (not on PDF) */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {t('invoiceEnhanced.internalRemark')}
                      <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">{t('invoiceEnhanced.notOnPdf')}</span>
                    </Label>
                    <Textarea value={internalRemark} onChange={(e) => setInternalRemark(e.target.value)} rows={2} className="bg-gray-700 border-gray-600 text-white resize-none w-full" placeholder={t('invoiceEnhanced.internalRemarkPlaceholder')} />
                  </div>

                  {/* Custom Fields */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t('invoiceEnhanced.customFields')}</Label>
                      <Button variant="outline" size="sm" onClick={addCustomField} className="border-gray-600 text-gray-300 hover:bg-gray-700 h-7 text-xs">
                        <Plus className="w-3 h-3 mr-1" />{t('invoiceEnhanced.addField')}
                      </Button>
                    </div>
                    {customFields.map(field => (
                      <div key={field.id} className="flex gap-2 items-center">
                        <Input value={field.label} onChange={(e) => updateCustomField(field.id, 'label', e.target.value)} className="bg-gray-700 border-gray-600 text-white flex-1" placeholder={t('invoiceEnhanced.fieldLabel')} />
                        <Input value={field.value} onChange={(e) => updateCustomField(field.id, 'value', e.target.value)} className="bg-gray-700 border-gray-600 text-white flex-1" placeholder={t('invoiceEnhanced.fieldValue')} />
                        <Button variant="ghost" size="sm" onClick={() => removeCustomField(field.id)} className="text-red-400 hover:text-red-300 h-8 w-8 p-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="border-t border-gray-700 pt-4 space-y-2">
              <div className="flex justify-between text-base md:text-lg">
                <span className="text-gray-300">{t('invoices.totalHT')}:</span>
                <span className="text-gradient font-semibold">{formatCurrency(totals.subtotal, currency)}</span>
              </div>
              {totals.totalItemDiscounts > 0 && (
                <div className="flex justify-between text-sm text-orange-400">
                  <span>{t('discounts.perItem')}:</span>
                  <span>-{formatCurrency(totals.totalItemDiscounts, currency)}</span>
                </div>
              )}
              {totals.globalDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-orange-400">
                  <span>{t('discounts.global')}:</span>
                  <span>-{formatCurrency(totals.globalDiscountAmount, currency)}</span>
                </div>
              )}
              {(totals.totalItemDiscounts > 0 || totals.globalDiscountAmount > 0) && (
                <div className="flex justify-between text-base">
                  <span className="text-gray-300">{t('discounts.subtotalAfterDiscounts')}:</span>
                  <span className="text-gradient">{formatCurrency(totals.totalHT, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base md:text-lg">
                <span className="text-gray-300">{t('invoices.taxAmount')} ({taxRate}%):</span>
                <span className="text-gradient">{formatCurrency(totals.taxAmount, currency)}</span>
              </div>
              {Number(shippingFee) > 0 && (
                <div className="flex justify-between text-sm text-blue-400">
                  <span>{t('invoiceEnhanced.shippingFee')}:</span>
                  <span>+{formatCurrency(Number(shippingFee), currency)}</span>
                </div>
              )}
              {Number(adjustment) !== 0 && (
                <div className="flex justify-between text-sm text-purple-400">
                  <span>{adjustmentLabel || t('invoiceEnhanced.adjustment')}:</span>
                  <span>{Number(adjustment) > 0 ? '+' : ''}{formatCurrency(Number(adjustment), currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg md:text-xl font-bold border-t border-gray-700 pt-2">
                <span className="text-gradient">{t('invoices.totalTTC')}:</span>
                <span className="text-gradient">{formatCurrency(grandTotal, currency)}</span>
              </div>
            </div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button onClick={handleGenerateInvoice} disabled={allItems.length === 0} className="w-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg">
                {t('invoices.generateInvoice')}
              </Button>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
};

export default InvoiceGenerator;
