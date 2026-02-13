import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useRecurringInvoices } from '@/hooks/useRecurringInvoices';
import { usePaymentReminders } from '@/hooks/usePaymentReminders';
import { useClients } from '@/hooks/useClients';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Plus, Edit, Trash2, Play, Pause, RefreshCw, Calendar, Bell, XCircle, Clock, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/calculations';

const emptyForm = {
  title: '',
  description: '',
  client_id: '',
  currency: 'EUR',
  frequency: 'monthly',
  interval_count: 1,
  day_of_month: 1,
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  next_generation_date: new Date().toISOString().split('T')[0],
  tva_rate: 21,
  auto_send: false,
};

const emptyLineItem = {
  description: '',
  quantity: 1,
  unit_price: 0,
  total: 0,
};

const emptyRuleForm = {
  name: '',
  days_before_due: 0,
  days_after_due: 0,
  max_reminders: 3,
  is_active: true,
};

const RecurringInvoicesPage = () => {
  const { t } = useTranslation();
  const {
    recurringInvoices,
    loading,
    createRecurringInvoice,
    updateRecurringInvoice,
    deleteRecurringInvoice,
    toggleStatus,
  } = useRecurringInvoices();
  const {
    rules: reminderRules,
    reminderLogs,
    loading: remindersLoading,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
  } = usePaymentReminders();
  const { clients } = useClients();

  const [activeTab, setActiveTab] = useState('recurring');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [cancelId, setCancelId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [lineItems, setLineItems] = useState([{ ...emptyLineItem }]);
  const [submitting, setSubmitting] = useState(false);

  // Payment reminder rule form state
  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const [ruleSubmitting, setRuleSubmitting] = useState(false);

  const statusColors = {
    active: 'bg-green-500/20 text-green-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-blue-500/20 text-blue-400',
    cancelled: 'bg-gray-500/20 text-gray-400',
  };

  const frequencyLabels = {
    weekly: t('recurringInvoices.frequencies.weekly'),
    monthly: t('recurringInvoices.frequencies.monthly'),
    quarterly: t('recurringInvoices.frequencies.quarterly'),
    yearly: t('recurringInvoices.frequencies.yearly'),
  };

  const recalcTotals = (items, tvaRate) => {
    const totalHt = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const totalTva = totalHt * (Number(tvaRate) / 100);
    const totalTtc = totalHt + totalTva;
    return { total_ht: totalHt, total_tva: totalTva, total_ttc: totalTtc };
  };

  const handleLineItemChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].total = Number(updated[index].quantity || 0) * Number(updated[index].unit_price || 0);
    }
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { ...emptyLineItem }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setLineItems([{ ...emptyLineItem }]);
    setIsFormOpen(true);
  };

  const openEdit = (recurring) => {
    setEditingId(recurring.id);
    setForm({
      title: recurring.title || '',
      description: recurring.description || '',
      client_id: recurring.client_id || '',
      currency: recurring.currency || 'EUR',
      frequency: recurring.frequency || 'monthly',
      interval_count: recurring.interval_count || 1,
      day_of_month: recurring.day_of_month || 1,
      start_date: recurring.start_date || '',
      end_date: recurring.end_date || '',
      next_generation_date: recurring.next_generation_date || '',
      tva_rate: recurring.tva_rate || 21,
      auto_send: recurring.auto_send || false,
    });
    setLineItems(
      recurring.line_items?.length > 0
        ? recurring.line_items.map((li) => ({
            description: li.description || '',
            quantity: li.quantity || 1,
            unit_price: li.unit_price || 0,
            total: li.total || 0,
          }))
        : [{ ...emptyLineItem }]
    );
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const totals = recalcTotals(lineItems, form.tva_rate);
      const invoiceData = {
        ...form,
        client_id: form.client_id || null,
        end_date: form.end_date || null,
        ...totals,
      };

      if (editingId) {
        await updateRecurringInvoice(editingId, invoiceData);
      } else {
        await createRecurringInvoice(invoiceData, lineItems.filter((li) => li.description));
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error('Submit recurring invoice error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      await deleteRecurringInvoice(deleteId);
      setIsDeleteDialogOpen(false);
      setDeleteId(null);
    }
  };

  const handleCancelClick = (id) => {
    setCancelId(id);
    setIsCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (cancelId) {
      await toggleStatus(cancelId, 'cancelled');
      setIsCancelDialogOpen(false);
      setCancelId(null);
    }
  };

  const handleToggleStatus = async (recurring) => {
    const newStatus = recurring.status === 'active' ? 'paused' : 'active';
    await toggleStatus(recurring.id, newStatus);
  };

  // Reminder rule handlers
  const openCreateRule = () => {
    setEditingRuleId(null);
    setRuleForm(emptyRuleForm);
    setIsRuleFormOpen(true);
  };

  const openEditRule = (rule) => {
    setEditingRuleId(rule.id);
    setRuleForm({
      name: rule.name || '',
      days_before_due: rule.days_before_due || 0,
      days_after_due: rule.days_after_due || 0,
      max_reminders: rule.max_reminders || 3,
      is_active: rule.is_active !== false,
    });
    setIsRuleFormOpen(true);
  };

  const handleRuleSubmit = async (e) => {
    e.preventDefault();
    setRuleSubmitting(true);
    try {
      if (editingRuleId) {
        await updateRule(editingRuleId, ruleForm);
      } else {
        await addRule(ruleForm);
      }
      setIsRuleFormOpen(false);
    } catch (err) {
      console.error('Submit reminder rule error:', err);
    } finally {
      setRuleSubmitting(false);
    }
  };

  const handleDeleteRule = async (id) => {
    await deleteRule(id);
  };

  const tabs = [
    { id: 'recurring', label: t('reminders.tabRecurring'), icon: RefreshCw },
    { id: 'reminders', label: t('reminders.tabReminders'), icon: Bell },
  ];

  return (
    <>
      <Helmet>
        <title>{t('recurringInvoices.title')} - {t('app.name')}</title>
        <meta name="description" content="Manage recurring invoices and payment reminders" />
      </Helmet>

      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                {t('recurringInvoices.title')}
              </h1>
              <p className="text-gray-400 text-sm md:text-base">
                {t('recurringInvoices.subtitle')}
              </p>
            </div>
            <div className="flex gap-2">
              {activeTab === 'recurring' && (
                <Button
                  onClick={openCreate}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('recurringInvoices.create')}
                </Button>
              )}
              {activeTab === 'reminders' && (
                <Button
                  onClick={openCreateRule}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('reminders.addRule')}
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:bg-gray-800 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Recurring Invoices Tab */}
        {activeTab === 'recurring' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/50 rounded-lg border border-gray-800 shadow-xl overflow-hidden"
          >
            {loading ? (
              <div className="text-center py-12 text-gray-400">
                {t('recurringInvoices.loading')}
              </div>
            ) : recurringInvoices.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-30" />
                {t('recurringInvoices.noItems')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        {t('recurringInvoices.fields.title')}
                      </th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                        {t('recurringInvoices.fields.client')}
                      </th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell">
                        {t('recurringInvoices.fields.frequency')}
                      </th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                        {t('recurringInvoices.fields.nextGeneration')}
                      </th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        {t('recurringInvoices.fields.amountTTC')}
                      </th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell">
                        {t('recurringInvoices.generated')}
                      </th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        {t('recurringInvoices.fields.status')}
                      </th>
                      <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {recurringInvoices.map((recurring) => {
                      const client = clients.find((c) => c.id === recurring.client_id);
                      const clientName = client?.company_name || client?.name || '-';
                      return (
                        <tr key={recurring.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                            {recurring.title}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden sm:table-cell">
                            {clientName}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden md:table-cell">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-gray-500" />
                              {frequencyLabels[recurring.frequency] || recurring.frequency}
                              {recurring.interval_count > 1 && ` (x${recurring.interval_count})`}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden lg:table-cell">
                            {recurring.next_generation_date
                              ? format(new Date(recurring.next_generation_date), 'MMM dd, yyyy')
                              : '-'}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {formatCurrency(Number(recurring.total_ttc || 0), recurring.currency || 'EUR')}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden md:table-cell">
                            <span className="inline-flex items-center gap-1 text-gray-400">
                              <Clock className="w-3.5 h-3.5" />
                              {recurring.invoices_generated || 0}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[recurring.status] || 'bg-gray-500/20 text-gray-400'}`}
                            >
                              {t(`recurringInvoices.status.${recurring.status}`) || recurring.status}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(recurring)}
                                className={`h-8 w-8 p-0 ${
                                  recurring.status === 'active'
                                    ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20'
                                    : 'text-green-400 hover:text-green-300 hover:bg-green-900/20'
                                }`}
                                title={
                                  recurring.status === 'active'
                                    ? t('recurringInvoices.actions.pause')
                                    : t('recurringInvoices.actions.activate')
                                }
                                disabled={recurring.status === 'completed' || recurring.status === 'cancelled'}
                              >
                                {recurring.status === 'active' ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelClick(recurring.id)}
                                className="text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 h-8 w-8 p-0"
                                title={t('recurringInvoices.actions.cancel')}
                                disabled={recurring.status === 'completed' || recurring.status === 'cancelled'}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(recurring)}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 h-8 w-8 p-0"
                                title={t('common.edit')}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(recurring.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 w-8 p-0"
                                title={t('common.delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* Payment Reminders Tab */}
        {activeTab === 'reminders' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Reminder Rules */}
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 shadow-xl overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-400" />
                  {t('reminders.rulesTitle')}
                </h2>
                <p className="text-sm text-gray-400 mt-1">{t('reminders.rulesSubtitle')}</p>
              </div>

              {remindersLoading ? (
                <div className="text-center py-12 text-gray-400">
                  {t('reminders.loading')}
                </div>
              ) : reminderRules.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>{t('reminders.noRules')}</p>
                  <p className="text-sm mt-2">{t('reminders.noRulesHint')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          {t('reminders.ruleName')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                          {t('reminders.daysBeforeDue')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                          {t('reminders.daysAfterDue')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell">
                          {t('reminders.maxReminders')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          {t('common.status')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                          {t('common.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {reminderRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                            {rule.name}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden sm:table-cell">
                            {rule.days_before_due > 0 ? `${rule.days_before_due} ${t('reminders.days')}` : '-'}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden sm:table-cell">
                            {rule.days_after_due > 0 ? `${rule.days_after_due} ${t('reminders.days')}` : '-'}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden md:table-cell">
                            {rule.max_reminders}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                rule.is_active
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-gray-500/20 text-gray-400'
                              }`}
                            >
                              {rule.is_active ? t('reminders.active') : t('reminders.inactive')}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleRule(rule.id, !rule.is_active)}
                                className={`h-8 w-8 p-0 ${
                                  rule.is_active
                                    ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20'
                                    : 'text-green-400 hover:text-green-300 hover:bg-green-900/20'
                                }`}
                                title={rule.is_active ? t('reminders.deactivate') : t('reminders.activate')}
                              >
                                {rule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditRule(rule)}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 h-8 w-8 p-0"
                                title={t('common.edit')}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteRule(rule.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 w-8 p-0"
                                title={t('common.delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Reminder Logs */}
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 shadow-xl overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-orange-400" />
                  {t('reminders.logsTitle')}
                </h2>
                <p className="text-sm text-gray-400 mt-1">{t('reminders.logsSubtitle')}</p>
              </div>

              {reminderLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>{t('reminders.noLogs')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          {t('reminders.logInvoice')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                          {t('reminders.logRule')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell">
                          {t('reminders.logRecipient')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          {t('reminders.logSentAt')}
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          {t('common.status')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {reminderLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 md:px-6 py-3 whitespace-nowrap text-sm text-white">
                            {log.invoice?.invoice_number || '-'}
                          </td>
                          <td className="px-4 md:px-6 py-3 whitespace-nowrap text-sm text-gray-300 hidden sm:table-cell">
                            {log.rule?.name || t('reminders.defaultRule')}
                          </td>
                          <td className="px-4 md:px-6 py-3 whitespace-nowrap text-sm text-gray-300 hidden md:table-cell">
                            {log.recipient_email || '-'}
                          </td>
                          <td className="px-4 md:px-6 py-3 whitespace-nowrap text-sm text-gray-300">
                            {log.sent_at ? format(new Date(log.sent_at), 'MMM dd, yyyy HH:mm') : '-'}
                          </td>
                          <td className="px-4 md:px-6 py-3 whitespace-nowrap text-sm">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                log.status === 'sent'
                                  ? 'bg-green-500/20 text-green-400'
                                  : log.status === 'failed'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-yellow-500/20 text-yellow-400'
                              }`}
                            >
                              {t(`reminders.logStatus.${log.status}`) || log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Create/Edit Recurring Invoice Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-full sm:max-w-[95%] md:max-w-2xl bg-gray-900 border-gray-700 text-white p-4 md:p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl font-bold text-gradient">
              {editingId
                ? t('recurringInvoices.editTitle')
                : t('recurringInvoices.createTitle')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* Title */}
            <div>
              <Label className="text-gray-300">{t('recurringInvoices.fields.title')}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
                placeholder={t('recurringInvoices.fields.titlePlaceholder')}
                required
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-gray-300">{t('recurringInvoices.fields.description')}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
                placeholder={t('recurringInvoices.fields.descriptionPlaceholder')}
                rows={2}
              />
            </div>

            {/* Client + Currency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">{t('recurringInvoices.fields.client')}</Label>
                <Select
                  value={form.client_id}
                  onValueChange={(value) => setForm({ ...form, client_id: value })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder={t('invoices.selectClient')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name || client.name || client.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">{t('recurringInvoices.fields.currency')}</Label>
                <Select
                  value={form.currency}
                  onValueChange={(value) => setForm({ ...form, currency: value })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="XOF">XOF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Frequency + Interval */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-300">{t('recurringInvoices.fields.frequency')}</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(value) => setForm({ ...form, frequency: value })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="weekly">{t('recurringInvoices.frequencies.weekly')}</SelectItem>
                    <SelectItem value="monthly">{t('recurringInvoices.frequencies.monthly')}</SelectItem>
                    <SelectItem value="quarterly">{t('recurringInvoices.frequencies.quarterly')}</SelectItem>
                    <SelectItem value="yearly">{t('recurringInvoices.frequencies.yearly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">{t('recurringInvoices.fields.interval')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.interval_count}
                  onChange={(e) => setForm({ ...form, interval_count: parseInt(e.target.value) || 1 })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">{t('recurringInvoices.fields.dayOfMonth')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.day_of_month}
                  onChange={(e) => setForm({ ...form, day_of_month: parseInt(e.target.value) || 1 })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-300">{t('recurringInvoices.fields.startDate')}</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      start_date: e.target.value,
                      next_generation_date: form.next_generation_date || e.target.value,
                    })
                  }
                  className="bg-gray-800 border-gray-700 text-white"
                  required
                />
              </div>
              <div>
                <Label className="text-gray-300">{t('recurringInvoices.fields.endDate')}</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">{t('recurringInvoices.fields.nextGeneration')}</Label>
                <Input
                  type="date"
                  value={form.next_generation_date}
                  onChange={(e) => setForm({ ...form, next_generation_date: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                  required
                />
              </div>
            </div>

            {/* TVA Rate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">{t('recurringInvoices.fields.tvaRate')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.tva_rate}
                  onChange={(e) => setForm({ ...form, tva_rate: parseFloat(e.target.value) || 0 })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.auto_send}
                    onChange={(e) => setForm({ ...form, auto_send: e.target.checked })}
                    className="rounded border-gray-600 bg-gray-800 text-orange-500"
                  />
                  {t('recurringInvoices.fields.autoSend')}
                </label>
              </div>
            </div>

            {/* Line Items */}
            {!editingId && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-gray-300">{t('recurringInvoices.fields.lineItems')}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addLineItem}
                    className="text-orange-400 hover:text-orange-300"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t('recurringInvoices.addLine')}
                  </Button>
                </div>
                <div className="space-y-2">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        {idx === 0 && (
                          <Label className="text-xs text-gray-500">{t('invoices.description')}</Label>
                        )}
                        <Input
                          value={item.description}
                          onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                          className="bg-gray-800 border-gray-700 text-white text-sm"
                          placeholder={t('invoices.description')}
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && (
                          <Label className="text-xs text-gray-500">{t('invoices.quantity')}</Label>
                        )}
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.quantity}
                          onChange={(e) =>
                            handleLineItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          className="bg-gray-800 border-gray-700 text-white text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && (
                          <Label className="text-xs text-gray-500">{t('invoices.unitPrice')}</Label>
                        )}
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unit_price}
                          onChange={(e) =>
                            handleLineItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)
                          }
                          className="bg-gray-800 border-gray-700 text-white text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && (
                          <Label className="text-xs text-gray-500">{t('invoices.total')}</Label>
                        )}
                        <Input
                          type="number"
                          value={item.total}
                          readOnly
                          className="bg-gray-800/50 border-gray-700 text-gray-400 text-sm"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(idx)}
                          className="text-red-400 hover:text-red-300 h-8 w-8 p-0"
                          disabled={lineItems.length <= 1}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals preview */}
                <div className="mt-3 p-3 bg-gray-800/50 rounded-lg text-sm">
                  {(() => {
                    const totals = recalcTotals(lineItems, form.tva_rate);
                    return (
                      <div className="flex flex-col gap-1 text-right">
                        <div className="flex justify-between text-gray-400">
                          <span>{t('invoices.totalHT')}</span>
                          <span>{formatCurrency(totals.total_ht, form.currency)}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>{t('invoices.taxAmount')} ({form.tva_rate}%)</span>
                          <span>{formatCurrency(totals.total_tva, form.currency)}</span>
                        </div>
                        <div className="flex justify-between text-white font-medium border-t border-gray-700 pt-1">
                          <span>{t('invoices.totalTTC')}</span>
                          <span>{formatCurrency(totals.total_ttc, form.currency)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                {t('buttons.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {submitting ? '...' : t('buttons.save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Reminder Rule Dialog */}
      <Dialog open={isRuleFormOpen} onOpenChange={setIsRuleFormOpen}>
        <DialogContent className="w-full sm:max-w-[95%] md:max-w-lg bg-gray-900 border-gray-700 text-white p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl font-bold text-gradient">
              {editingRuleId
                ? t('reminders.editRule')
                : t('reminders.addRule')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRuleSubmit} className="space-y-4 mt-4">
            <div>
              <Label className="text-gray-300">{t('reminders.ruleName')}</Label>
              <Input
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
                placeholder={t('reminders.ruleNamePlaceholder')}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">{t('reminders.daysBeforeDue')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={ruleForm.days_before_due}
                  onChange={(e) => setRuleForm({ ...ruleForm, days_before_due: parseInt(e.target.value) || 0 })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">{t('reminders.daysBeforeHint')}</p>
              </div>
              <div>
                <Label className="text-gray-300">{t('reminders.daysAfterDue')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={ruleForm.days_after_due}
                  onChange={(e) => setRuleForm({ ...ruleForm, days_after_due: parseInt(e.target.value) || 0 })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">{t('reminders.daysAfterHint')}</p>
              </div>
            </div>

            <div>
              <Label className="text-gray-300">{t('reminders.maxReminders')}</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={ruleForm.max_reminders}
                onChange={(e) => setRuleForm({ ...ruleForm, max_reminders: parseInt(e.target.value) || 3 })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ruleForm.is_active}
                  onChange={(e) => setRuleForm({ ...ruleForm, is_active: e.target.checked })}
                  className="rounded border-gray-600 bg-gray-800 text-orange-500"
                />
                {t('reminders.ruleActive')}
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRuleFormOpen(false)}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                {t('buttons.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={ruleSubmitting}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {ruleSubmitting ? '...' : t('buttons.save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-full sm:max-w-[90%] md:max-w-lg bg-gray-900 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('recurringInvoices.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {t('recurringInvoices.deleteConfirm')}
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

      {/* Cancel Confirmation */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent className="w-full sm:max-w-[90%] md:max-w-lg bg-gray-900 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('recurringInvoices.cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {t('recurringInvoices.cancelConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto mt-0">
              {t('buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto"
            >
              {t('recurringInvoices.actions.cancel')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RecurringInvoicesPage;
