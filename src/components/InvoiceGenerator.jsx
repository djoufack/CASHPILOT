
import React from "react";
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvoices } from '@/hooks/useInvoices';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useClients } from '@/hooks/useClients';
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
import { calculateInvoiceTotal, formatCurrency } from '@/utils/calculations';
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const InvoiceGenerator = ({ onSuccess }) => {
  const { t } = useTranslation();
  const { createInvoice } = useInvoices();
  const { timesheets } = useTimesheets();
  const { clients } = useClients();
  
  const [selectedClientId, setSelectedClientId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedTimesheets, setSelectedTimesheets] = useState([]);
  const [manualItems, setManualItems] = useState([]);
  const [taxRate, setTaxRate] = useState(20);
  const [notes, setNotes] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');

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

  const addManualItem = () => {
    setManualItems([...manualItems, {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0
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

  const getAllInvoiceItems = () => {
    const timesheetItems = selectedTimesheets.map(tsId => {
      const ts = timesheets.find(t => t.id === tsId);
      return {
        description: ts.notes || 'Timesheet entry',
        quantity: ts.durationHours,
        unitPrice: 50, // Default hourly rate
        amount: ts.durationHours * 50,
        itemType: 'timesheet'
      };
    });

    const manualLineItems = manualItems.map(item => ({
      ...item,
      itemType: 'manual'
    }));

    return [...timesheetItems, ...manualLineItems];
  };

  const allItems = getAllInvoiceItems();
  const totals = calculateInvoiceTotal(allItems, taxRate / 100);
  const selectedClient = clients.find(c => c.id === selectedClientId);

  const handleGenerateInvoice = async () => {
    if (!selectedClientId || allItems.length === 0) {
      return;
    }

    const invoiceData = {
      clientId: selectedClientId,
      issueDate,
      dueDate: dueDate || issueDate,
      subtotal: totals.subtotal,
      taxRate: taxRate / 100,
      taxAmount: totals.taxAmount,
      total: totals.total,
      notes
    };

    try {
      await createInvoice(invoiceData, allItems);
      
      // Reset form
      setSelectedClientId('');
      setFromDate('');
      setToDate('');
      setSelectedTimesheets([]);
      setManualItems([]);
      setNotes('');
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error generating invoice:', error);
    }
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
                {client.companyName}
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
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('invoices.toDate')}</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white w-full"
                />
              </div>
            </div>
          </div>

          {filteredTimesheets.length > 0 && (
            <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700 shadow-xl space-y-4">
              <h3 className="text-lg md:text-xl font-bold text-gradient">
                Step 3: {t('invoices.selectTimesheets')}
              </h3>
              <div className="space-y-2">
                {filteredTimesheets.map((ts) => (
                  <div key={ts.id} className="flex items-center space-x-3 p-3 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors">
                    <Checkbox
                      checked={selectedTimesheets.includes(ts.id)}
                      onCheckedChange={() => handleTimesheetToggle(ts.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">{ts.notes || 'No description'}</p>
                      <p className="text-sm text-gray-400">
                        {format(new Date(ts.date), 'MMM dd, yyyy')} • {ts.durationHours.toFixed(2)}h
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h3 className="text-lg md:text-xl font-bold text-gradient">
                Step 4: Manual Items
              </h3>
              <Button
                onClick={addManualItem}
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('invoices.addManualLine')}
              </Button>
            </div>

            {manualItems.map((item) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:items-end bg-gray-700/30 p-3 rounded-lg md:bg-transparent md:p-0">
                <div className="md:col-span-5 space-y-1">
                  <Label className="text-xs">{t('invoices.description')}</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => updateManualItem(item.id, 'description', e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white w-full"
                    placeholder="Service or product"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:col-span-6 md:gap-2">
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs">{t('invoices.quantity')}</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateManualItem(item.id, 'quantity', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white w-full"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs">{t('invoices.unitPrice')}</Label>
                    <Input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateManualItem(item.id, 'unitPrice', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white w-full"
                      min="0"
                      step="0.01"
                    />
                  </div>
                   <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs">{t('invoices.amount')}</Label>
                    <div className="px-3 py-2 bg-gray-900 rounded text-white text-sm h-10 flex items-center">
                      {formatCurrency(item.amount, selectedClient?.preferredCurrency)}
                    </div>
                  </div>
                </div>
                <div className="md:col-span-1 flex justify-end md:justify-center mt-2 md:mt-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeManualItem(item.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700 shadow-xl space-y-4">
            <h3 className="text-lg md:text-xl font-bold text-gradient">
              Invoice Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('invoices.issueDate')}</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('invoices.dueDate')}</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('invoices.taxRate')} (%)</Label>
                <Input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="bg-gray-700 border-gray-600 text-white w-full"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('timesheets.notes')}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="bg-gray-700 border-gray-600 text-white resize-none w-full"
                placeholder="Additional notes or payment terms..."
              />
            </div>

            <div className="border-t border-gray-700 pt-4 space-y-2">
              <div className="flex justify-between text-base md:text-lg">
                <span className="text-gray-300">{t('invoices.totalHT')}:</span>
                <span className="text-gradient font-semibold">
                  {formatCurrency(totals.subtotal, selectedClient?.preferredCurrency)}
                </span>
              </div>
              <div className="flex justify-between text-base md:text-lg">
                <span className="text-gray-300">{t('invoices.taxAmount')} ({taxRate}%):</span>
                <span className="text-gradient">
                  {formatCurrency(totals.taxAmount, selectedClient?.preferredCurrency)}
                </span>
              </div>
              <div className="flex justify-between text-lg md:text-xl font-bold border-t border-gray-700 pt-2">
                <span className="text-gradient">
                  {t('invoices.totalTTC')}:
                </span>
                <span className="text-gradient">
                  {formatCurrency(totals.total, selectedClient?.preferredCurrency)}
                </span>
              </div>
            </div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleGenerateInvoice}
                disabled={allItems.length === 0}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
              >
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
