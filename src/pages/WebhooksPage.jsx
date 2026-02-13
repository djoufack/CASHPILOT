import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useWebhooks, WEBHOOK_EVENTS } from '@/hooks/useWebhooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  Key,
  RefreshCw,
  Webhook,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';

const emptyForm = {
  url: '',
  events: [],
  secret: '',
};

const WebhooksPage = () => {
  const { t } = useTranslation();
  const {
    webhooks,
    webhookLogs,
    loading,
    addWebhook,
    updateWebhook,
    deleteWebhook,
    toggleWebhook,
    testWebhook,
    refresh,
  } = useWebhooks();
  const { toast } = useToast();

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteId, setDeleteId] = useState(null);
  const [testing, setTesting] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});
  const [activeTab, setActiveTab] = useState('endpoints');

  const handleOpenNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, secret: generateSecret() });
    setShowDialog(true);
  };

  const handleEdit = (webhook) => {
    setEditingId(webhook.id);
    setForm({
      url: webhook.url,
      events: webhook.events || [],
      secret: webhook.secret,
    });
    setShowDialog(true);
  };

  const generateSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'whsec_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleToggleEvent = (event) => {
    setForm(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleSubmit = async () => {
    if (!form.url || !form.events.length) {
      toast({
        title: t('common.error'),
        description: t('webhooks.urlAndEventsRequired'),
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingId) {
        await updateWebhook(editingId, {
          url: form.url,
          events: form.events,
          secret: form.secret,
        });
        toast({ title: t('common.success'), description: t('webhooks.updated') });
      } else {
        await addWebhook({
          url: form.url,
          events: form.events,
          secret: form.secret,
        });
        toast({ title: t('common.success'), description: t('webhooks.created') });
      }
      setShowDialog(false);
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteWebhook(deleteId);
      toast({ title: t('common.success'), description: t('webhooks.deleted') });
      setDeleteId(null);
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleTest = async (id) => {
    setTesting(id);
    try {
      await testWebhook(id);
      toast({ title: t('common.success'), description: t('webhooks.testSent') });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setTesting(null);
    }
  };

  const handleCopySecret = (secret) => {
    navigator.clipboard.writeText(secret);
    toast({ title: t('common.success'), description: t('webhooks.secretCopied') });
  };

  const toggleSecretVisibility = (id) => {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (delivered) => {
    if (delivered) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20">
          <CheckCircle2 className="w-3 h-3" />
          {t('webhooks.delivered')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20">
        <XCircle className="w-3 h-3" />
        {t('webhooks.failed')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <Helmet>
        <title>{t('webhooks.title')} - CashPilot</title>
      </Helmet>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient flex items-center gap-3">
            <Webhook className="w-8 h-8 text-orange-400" />
            {t('webhooks.title')}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">{t('webhooks.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('common.refresh') || 'Refresh'}
          </Button>
          <Button
            onClick={handleOpenNew}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('webhooks.add')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900/50 p-1 rounded-lg border border-gray-800 w-fit">
        <button
          onClick={() => setActiveTab('endpoints')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'endpoints'
              ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Globe className="w-4 h-4 inline mr-2" />
          {t('webhooks.endpoints')}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          {t('webhooks.logs')}
        </button>
      </div>

      {/* Endpoints Tab */}
      {activeTab === 'endpoints' && (
        <AnimatePresence mode="wait">
          <motion.div
            key="endpoints"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {webhooks.length === 0 ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900/30 backdrop-blur-sm p-12 text-center">
                <Webhook className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">{t('webhooks.noWebhooks')}</p>
                <p className="text-gray-500 text-sm mb-6">{t('webhooks.noWebhooksHint')}</p>
                <Button
                  onClick={handleOpenNew}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('webhooks.add')}
                </Button>
              </div>
            ) : (
              webhooks.map((webhook) => (
                <motion.div
                  key={webhook.id}
                  layout
                  className="rounded-xl border border-gray-800 bg-gray-900/30 backdrop-blur-sm p-5"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* URL and status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          webhook.is_active ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                        }`} />
                        <code className="text-sm font-mono text-gray-200 truncate block">
                          {webhook.url}
                        </code>
                      </div>

                      {/* Events */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(webhook.events || []).map(event => (
                          <span
                            key={event}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20"
                          >
                            {event}
                          </span>
                        ))}
                      </div>

                      {/* Secret */}
                      <div className="flex items-center gap-2 mt-3">
                        <Key className="w-3.5 h-3.5 text-gray-500" />
                        <code className="text-xs text-gray-500 font-mono">
                          {showSecrets[webhook.id] ? webhook.secret : `${webhook.secret?.slice(0, 10)}${'*'.repeat(20)}`}
                        </code>
                        <button
                          onClick={() => toggleSecretVisibility(webhook.id)}
                          className="text-gray-500 hover:text-gray-300"
                        >
                          {showSecrets[webhook.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleCopySecret(webhook.secret)}
                          className="text-gray-500 hover:text-gray-300"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {webhook.last_triggered_at && (
                          <span>{t('webhooks.lastTriggered')}: {formatDate(webhook.last_triggered_at)}</span>
                        )}
                        {webhook.failure_count > 0 && (
                          <span className="text-red-400">
                            {webhook.failure_count} {t('webhooks.consecutiveFailures')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(webhook.id)}
                        disabled={testing === webhook.id || !webhook.is_active}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800"
                      >
                        {testing === webhook.id ? (
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-1" />
                        )}
                        {t('webhooks.test')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleWebhook(webhook.id, !webhook.is_active)}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800"
                      >
                        {webhook.is_active ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(webhook)}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteId(webhook.id)}
                        className="border-red-700/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <AnimatePresence mode="wait">
          <motion.div
            key="logs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="rounded-xl border border-gray-800 bg-gray-900/30 backdrop-blur-sm overflow-hidden">
              {webhookLogs.length === 0 ? (
                <div className="p-12 text-center">
                  <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">{t('webhooks.noLogs')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400">
                        <th className="text-left p-3 font-medium">{t('webhooks.status')}</th>
                        <th className="text-left p-3 font-medium">{t('webhooks.event')}</th>
                        <th className="text-left p-3 font-medium">{t('webhooks.url')}</th>
                        <th className="text-left p-3 font-medium">{t('webhooks.statusCode')}</th>
                        <th className="text-left p-3 font-medium">{t('webhooks.attempts')}</th>
                        <th className="text-left p-3 font-medium">{t('webhooks.timestamp')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {webhookLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors"
                        >
                          <td className="p-3">{getStatusBadge(log.delivered)}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20">
                              {log.event}
                            </span>
                          </td>
                          <td className="p-3">
                            <code className="text-xs text-gray-400 font-mono truncate block max-w-[200px]">
                              {log.endpoint?.url || '-'}
                            </code>
                          </td>
                          <td className="p-3">
                            <span className={`text-xs font-mono ${
                              log.status_code && log.status_code < 300 ? 'text-green-400' :
                              log.status_code && log.status_code < 500 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {log.status_code || '-'}
                            </span>
                          </td>
                          <td className="p-3 text-gray-400">{log.attempts || 1}</td>
                          <td className="p-3 text-gray-400 text-xs">{formatDate(log.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingId ? t('webhooks.edit') : t('webhooks.add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-4">
            {/* URL */}
            <div className="space-y-2">
              <Label className="text-gray-300">{t('webhooks.url')}</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com/webhooks"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>

            {/* Events */}
            <div className="space-y-2">
              <Label className="text-gray-300">{t('webhooks.events')}</Label>
              <div className="grid grid-cols-1 gap-2">
                {WEBHOOK_EVENTS.map(event => (
                  <label
                    key={event}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.events.includes(event)
                        ? 'border-orange-500/40 bg-orange-500/5'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.events.includes(event)}
                      onChange={() => handleToggleEvent(event)}
                      className="w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-500/20 bg-gray-700"
                    />
                    <span className="text-sm text-gray-200 font-mono">{event}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Secret */}
            <div className="space-y-2">
              <Label className="text-gray-300">{t('webhooks.secret')}</Label>
              <div className="flex gap-2">
                <Input
                  value={form.secret}
                  onChange={(e) => setForm(prev => ({ ...prev, secret: e.target.value }))}
                  placeholder="whsec_..."
                  className="bg-gray-800 border-gray-700 text-white font-mono text-xs placeholder:text-gray-500"
                />
                <Button
                  variant="outline"
                  onClick={() => setForm(prev => ({ ...prev, secret: generateSecret() }))}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 flex-shrink-0"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">{t('webhooks.secretHint')}</p>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
                className="border-gray-700 text-gray-300"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
              >
                {editingId ? t('common.save') : t('webhooks.add')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('webhooks.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {t('webhooks.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-gray-300 hover:bg-gray-800">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WebhooksPage;
