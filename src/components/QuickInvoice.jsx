
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { calculateInvoiceTotalWithDiscount, formatCurrency } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Tag, Send, Truck, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const QuickInvoice = ({ onSuccess }) => {
  const { t } = useTranslation();
  const { createInvoice } = useInvoices();
  const { clients } = useClients();
  const { toast } = useToast();

  const [clientId, setClientId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [taxRate, setTaxRate] = useState(21);
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');
  const [globalDiscountType, setGlobalDiscountType] = useState('none');
  const [globalDiscountValue, setGlobalDiscountValue] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState([
    { id: '1', description: '', quantity: 1, unitPrice: 0, discount_type: 'none', discount_value: 0, hsn_code: '' }
  ]);

  // Enhanced fields
  const [shippingFee, setShippingFee] = useState(0);
  const [adjustment, setAdjustment] = useState(0);
  const [adjustmentLabel, setAdjustmentLabel] = useState('');
  const [headerNote, setHeaderNote] = useState('');
  const [footerNote, setFooterNote] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [internalRemark, setInternalRemark] = useState('');
  const [customFields, setCustomFields] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const addItem = () => {
    setItems([...items, {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      discount_type: 'none',
      discount_value: 0,
      hsn_code: ''
    }]);
  };

  const removeItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (['quantity', 'unitPrice'].includes(field)) {
        updated.amount = Number(updated.quantity) * Number(updated.unitPrice);
      }
      return updated;
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

  const selectedClient = clients.find(c => c.id === clientId);
  const currency = selectedClient?.preferred_currency || selectedClient?.preferredCurrency || 'EUR';
  const globalDiscount = { type: globalDiscountType, value: globalDiscountValue };
  const totals = calculateInvoiceTotalWithDiscount(items, taxRate / 100, globalDiscount);

  // Grand total = TTC + shipping + adjustment
  const grandTotal = totals.totalTTC + Number(shippingFee || 0) + Number(adjustment || 0);

  const handleSubmit = async () => {
    if (!clientId || items.length === 0 || !items[0].description) {
      toast({ title: t('common.error'), description: 'Please select a client and add at least one item.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const invoiceData = {
        client_id: clientId,
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
        shipping_fee: Number(shippingFee || 0),
        adjustment: Number(adjustment || 0),
        adjustment_label: adjustmentLabel,
        header_note: headerNote,
        footer_note: footerNote,
        terms_and_conditions: termsAndConditions,
        internal_remark: internalRemark,
        custom_fields: customFields.filter(f => f.label)
      };

      await createInvoice(invoiceData, items.map(item => ({
        ...item,
        itemType: 'manual'
      })));

      toast({ title: t('common.success'), description: t('messages.success.invoiceGenerated') });

      // Reset form
      setClientId('');
      setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0, discount_type: 'none', discount_value: 0, hsn_code: '' }]);
      setNotes('');
      setReference('');
      setGlobalDiscountType('none');
      setGlobalDiscountValue(0);
      setShippingFee(0);
      setAdjustment(0);
      setAdjustmentLabel('');
      setHeaderNote('');
      setFooterNote('');
      setTermsAndConditions('');
      setInternalRemark('');
      setCustomFields([]);

      if (onSuccess) onSuccess();
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl p-4 md:p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gradient">{t('quickInvoice.title')}</h2>
        <p className="text-sm text-gray-400 mt-1">{t('quickInvoice.subtitle')}</p>
      </div>

      {/* Top row: Client + Dates + Reference + Tax */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="space-y-1">
          <Label className="text-xs text-gray-400">{t('invoices.selectClient')} *</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
              <SelectValue placeholder={t('invoices.selectClient')} />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600 text-white">
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.company_name || c.companyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-400">{t('invoices.issueDate')}</Label>
          <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="bg-gray-700 border-gray-600 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-400">{t('invoices.dueDate')}</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-gray-700 border-gray-600 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-400">{t('invoiceEnhanced.reference')}</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} className="bg-gray-700 border-gray-600 text-white" placeholder="#REF" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-400">{t('invoices.taxRate')} (%)</Label>
          <Input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="bg-gray-700 border-gray-600 text-white" min="0" max="100" />
        </div>
      </div>

      {/* Header Note */}
      {headerNote || showAdvanced ? (
        <div className="mb-4">
          <Label className="text-xs text-gray-400 mb-1 block">{t('invoiceEnhanced.headerNote')}</Label>
          <Textarea value={headerNote} onChange={(e) => setHeaderNote(e.target.value)} rows={2} className="bg-gray-700 border-gray-600 text-white resize-none" placeholder={t('invoiceEnhanced.headerNotePlaceholder')} />
        </div>
      ) : null}

      {/* Items table */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold text-gray-300">{t('invoices.description')}</Label>
          <Button variant="outline" size="sm" onClick={addItem} className="border-gray-600 text-gray-300 hover:bg-gray-700 h-8">
            <Plus className="w-3 h-3 mr-1" /> {t('invoices.addManualLine')}
          </Button>
        </div>

        <div className="space-y-2">
          {/* Header row */}
          <div className="hidden md:grid md:grid-cols-12 gap-2 text-xs text-gray-500 uppercase px-1">
            <div className="col-span-3">{t('invoices.description')}</div>
            <div className="col-span-1 text-right">{t('invoices.quantity')}</div>
            <div className="col-span-2 text-right">{t('invoices.unitPrice')}</div>
            <div className="col-span-2">{t('discounts.discount')}</div>
            <div className="col-span-1">HSN</div>
            <div className="col-span-2 text-right">{t('invoices.amount')}</div>
            <div className="col-span-1"></div>
          </div>

          {items.map(item => {
            const lineTotal = Number(item.quantity) * Number(item.unitPrice);
            let disc = 0;
            if (item.discount_type === 'percentage' && item.discount_value) disc = lineTotal * Number(item.discount_value) / 100;
            else if (item.discount_type === 'fixed' && item.discount_value) disc = Number(item.discount_value);
            const net = lineTotal - disc;

            return (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-gray-700/30 p-2 rounded-lg items-end">
                <div className="md:col-span-3">
                  <Input value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} className="bg-gray-700 border-gray-600 text-white" placeholder="Service or product" />
                </div>
                <div className="md:col-span-1">
                  <Input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} className="bg-gray-700 border-gray-600 text-white text-right" min="0" step="0.01" />
                </div>
                <div className="md:col-span-2">
                  <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)} className="bg-gray-700 border-gray-600 text-white text-right" min="0" step="0.01" />
                </div>
                <div className="md:col-span-2">
                  <div className="flex gap-1">
                    <Select value={item.discount_type} onValueChange={(v) => updateItem(item.id, 'discount_type', v)}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-16 h-10 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600 text-white">
                        <SelectItem value="none">-</SelectItem>
                        <SelectItem value="percentage">%</SelectItem>
                        <SelectItem value="fixed">Fix</SelectItem>
                      </SelectContent>
                    </Select>
                    {item.discount_type !== 'none' && (
                      <Input type="number" value={item.discount_value || ''} onChange={(e) => updateItem(item.id, 'discount_value', e.target.value)} className="bg-gray-700 border-gray-600 text-white flex-1" min="0" step="0.01" />
                    )}
                  </div>
                </div>
                <div className="md:col-span-1">
                  <Input value={item.hsn_code || ''} onChange={(e) => updateItem(item.id, 'hsn_code', e.target.value)} className="bg-gray-700 border-gray-600 text-white text-xs" placeholder="HSN" />
                </div>
                <div className="md:col-span-2 text-right text-sm text-gray-300 font-medium self-center">
                  {formatCurrency(net, currency)}
                </div>
                <div className="md:col-span-1 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-300 h-8 w-8 p-0" disabled={items.length === 1}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom row: Notes + Discount + Shipping + Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Notes + Global discount + Shipping + Advanced */}
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">{t('timesheets.notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="bg-gray-700 border-gray-600 text-white resize-none" placeholder="Payment terms, notes..." />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-gray-400">{t('invoiceEnhanced.termsAndConditions')}</Label>
            <Textarea value={termsAndConditions} onChange={(e) => setTermsAndConditions(e.target.value)} rows={2} className="bg-gray-700 border-gray-600 text-white resize-none" placeholder={t('invoiceEnhanced.termsPlaceholder')} />
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-sm text-gray-300 whitespace-nowrap flex items-center gap-1">
              <Tag className="w-4 h-4" />
              {t('discounts.global')}
            </Label>
            <Select value={globalDiscountType} onValueChange={setGlobalDiscountType}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-28 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600 text-white">
                <SelectItem value="none">-</SelectItem>
                <SelectItem value="percentage">%</SelectItem>
                <SelectItem value="fixed">{t('discounts.fixed')}</SelectItem>
              </SelectContent>
            </Select>
            {globalDiscountType !== 'none' && (
              <Input type="number" value={globalDiscountValue} onChange={(e) => setGlobalDiscountValue(Number(e.target.value))} className="bg-gray-700 border-gray-600 text-white w-28 h-9" min="0" step="0.01" />
            )}
          </div>

          {/* Shipping + Adjustment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-400 flex items-center gap-1"><Truck className="w-3 h-3" />{t('invoiceEnhanced.shippingFee')}</Label>
              <Input type="number" value={shippingFee} onChange={(e) => setShippingFee(Number(e.target.value))} className="bg-gray-700 border-gray-600 text-white" min="0" step="0.01" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-400 flex items-center gap-1"><Settings2 className="w-3 h-3" />{t('invoiceEnhanced.adjustment')}</Label>
              <div className="flex gap-1">
                <Input type="number" value={adjustment} onChange={(e) => setAdjustment(Number(e.target.value))} className="bg-gray-700 border-gray-600 text-white flex-1" step="0.01" />
                <Input value={adjustmentLabel} onChange={(e) => setAdjustmentLabel(e.target.value)} className="bg-gray-700 border-gray-600 text-white flex-1 text-xs" placeholder={t('invoiceEnhanced.adjustmentLabel')} />
              </div>
            </div>
          </div>

          {/* Advanced section (collapsible) */}
          <div className="border-t border-gray-700 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="text-gray-400 hover:text-gray-200 w-full justify-between h-8 text-xs">
              <span>{t('invoiceEnhanced.advancedOptions')}</span>
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>

            {showAdvanced && (
              <div className="space-y-3 mt-2">
                {!headerNote && (
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">{t('invoiceEnhanced.headerNote')}</Label>
                    <Textarea value={headerNote} onChange={(e) => setHeaderNote(e.target.value)} rows={2} className="bg-gray-700 border-gray-600 text-white resize-none" placeholder={t('invoiceEnhanced.headerNotePlaceholder')} />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">{t('invoiceEnhanced.footerNote')}</Label>
                  <Textarea value={footerNote} onChange={(e) => setFooterNote(e.target.value)} rows={2} className="bg-gray-700 border-gray-600 text-white resize-none" placeholder={t('invoiceEnhanced.footerNotePlaceholder')} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400 flex items-center gap-2">
                    {t('invoiceEnhanced.internalRemark')}
                    <span className="text-[10px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">{t('invoiceEnhanced.notOnPdf')}</span>
                  </Label>
                  <Textarea value={internalRemark} onChange={(e) => setInternalRemark(e.target.value)} rows={2} className="bg-gray-700 border-gray-600 text-white resize-none" placeholder={t('invoiceEnhanced.internalRemarkPlaceholder')} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-400">{t('invoiceEnhanced.customFields')}</Label>
                    <Button variant="outline" size="sm" onClick={addCustomField} className="border-gray-600 text-gray-300 hover:bg-gray-700 h-6 text-[10px]">
                      <Plus className="w-2.5 h-2.5 mr-1" />{t('invoiceEnhanced.addField')}
                    </Button>
                  </div>
                  {customFields.map(field => (
                    <div key={field.id} className="flex gap-1 items-center">
                      <Input value={field.label} onChange={(e) => updateCustomField(field.id, 'label', e.target.value)} className="bg-gray-700 border-gray-600 text-white flex-1 h-8 text-xs" placeholder={t('invoiceEnhanced.fieldLabel')} />
                      <Input value={field.value} onChange={(e) => updateCustomField(field.id, 'value', e.target.value)} className="bg-gray-700 border-gray-600 text-white flex-1 h-8 text-xs" placeholder={t('invoiceEnhanced.fieldValue')} />
                      <Button variant="ghost" size="sm" onClick={() => removeCustomField(field.id)} className="text-red-400 hover:text-red-300 h-7 w-7 p-0">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Totals + Submit */}
        <div className="space-y-3 bg-gray-700/30 p-4 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{t('invoices.totalHT')}</span>
            <span className="text-white">{formatCurrency(totals.subtotal, currency)}</span>
          </div>
          {totals.totalItemDiscounts > 0 && (
            <div className="flex justify-between text-sm text-orange-400">
              <span>{t('discounts.perItem')}</span>
              <span>-{formatCurrency(totals.totalItemDiscounts, currency)}</span>
            </div>
          )}
          {totals.globalDiscountAmount > 0 && (
            <div className="flex justify-between text-sm text-orange-400">
              <span>{t('discounts.global')}</span>
              <span>-{formatCurrency(totals.globalDiscountAmount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{t('invoices.taxAmount')} ({taxRate}%)</span>
            <span className="text-white">{formatCurrency(totals.taxAmount, currency)}</span>
          </div>
          {Number(shippingFee) > 0 && (
            <div className="flex justify-between text-sm text-blue-400">
              <span>{t('invoiceEnhanced.shippingFee')}</span>
              <span>+{formatCurrency(Number(shippingFee), currency)}</span>
            </div>
          )}
          {Number(adjustment) !== 0 && (
            <div className="flex justify-between text-sm text-purple-400">
              <span>{adjustmentLabel || t('invoiceEnhanced.adjustment')}</span>
              <span>{Number(adjustment) > 0 ? '+' : ''}{formatCurrency(Number(adjustment), currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold border-t border-gray-600 pt-3">
            <span className="text-gradient">{t('invoices.totalTTC')}</span>
            <span className="text-gradient">{formatCurrency(grandTotal, currency)}</span>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !clientId || items.length === 0}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white mt-2"
          >
            <Send className="w-4 h-4 mr-2" />
            {submitting ? '...' : t('invoices.generateInvoice')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuickInvoice;
