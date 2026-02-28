import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useCompany } from '@/hooks/useCompany';
import { usePeppolSend } from '@/hooks/usePeppolSend';
import { usePeppolCheck } from '@/hooks/usePeppolCheck';
import PeppolStatusBadge from '@/components/peppol/PeppolStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, Search, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, ArrowUpRight, ArrowDownLeft, Settings, ExternalLink, Zap, Globe, Wrench, Shield, FileCheck, Loader2, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import PeppolSettings from '@/components/settings/PeppolSettings';

const PeppolPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { company, loading: companyLoading } = useCompany();
  const { sendViaPeppol, sending, polling, peppolStatus } = usePeppolSend();
  const { checkRegistration, checking, result: checkResult, reset: resetCheck } = usePeppolCheck();

  // --- State ---
  const [activeTab, setActiveTab] = useState('outbound');
  const [invoices, setInvoices] = useState([]);
  const [inboundLogs, setInboundLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [loadingInbound, setLoadingInbound] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [peppolIdInput, setPeppolIdInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [apInfo, setApInfo] = useState(null);
  const [loadingApInfo, setLoadingApInfo] = useState(false);

  const isPeppolConfigured = !!(company?.peppol_endpoint_id);

  // --- Fetch AP account info from Scrada ---
  const fetchApInfo = async () => {
    if (!user) return;
    setLoadingApInfo(true);
    try {
      const { data, error } = await supabase.functions.invoke('peppol-account-info');
      if (error) throw error;
      setApInfo(data);
    } catch (err) {
      console.error('Error fetching AP info:', err);
      setApInfo(null);
    } finally {
      setLoadingApInfo(false);
    }
  };

  // --- Data fetching ---
  const fetchOutboundInvoices = async () => {
    if (!user) return;
    setLoadingInvoices(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id, invoice_number, total_ht, total_ttc, tax_rate, status,
          peppol_status, peppol_sent_at, peppol_document_id, peppol_error_message,
          client:clients(id, company_name, contact_name, peppol_endpoint_id, peppol_scheme_id, electronic_invoicing_enabled)
        `)
        .eq('status', 'sent')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error('Error fetching outbound invoices:', err);
      toast({
        title: t('common.error'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchInboundLogs = async () => {
    if (!user) return;
    setLoadingInbound(true);
    try {
      const { data, error } = await supabase
        .from('peppol_transmission_log')
        .select(`*, invoice:invoices(id, invoice_number)`)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInboundLogs(data || []);
    } catch (err) {
      console.error('Error fetching inbound logs:', err);
    } finally {
      setLoadingInbound(false);
    }
  };

  const fetchAllLogs = async () => {
    if (!user) return;
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('peppol_transmission_log')
        .select(`*, invoice:invoices(id, invoice_number)`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAllLogs(data || []);
    } catch (err) {
      console.error('Error fetching all logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchOutboundInvoices();
      fetchInboundLogs();
      fetchAllLogs();
      fetchApInfo();
    }
  }, [user]);

  // --- KPI calculations ---
  const kpis = useMemo(() => {
    const total = invoices.filter(inv => inv.peppol_status && inv.peppol_status !== 'none').length;
    const delivered = invoices.filter(inv => inv.peppol_status === 'delivered' || inv.peppol_status === 'accepted').length;
    const pending = invoices.filter(inv => inv.peppol_status === 'pending' || inv.peppol_status === 'sent').length;
    const errors = invoices.filter(inv => inv.peppol_status === 'error' || inv.peppol_status === 'rejected').length;
    return { total, delivered, pending, errors };
  }, [invoices]);

  // --- Filtered invoices for outbound tab ---
  const filteredInvoices = useMemo(() => {
    let result = invoices;

    if (statusFilter !== 'all') {
      if (statusFilter === 'eligible') {
        result = result.filter(inv => inv.client?.peppol_endpoint_id);
      } else {
        result = result.filter(inv => inv.peppol_status === statusFilter);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(inv =>
        (inv.invoice_number || '').toLowerCase().includes(q) ||
        (inv.client?.company_name || inv.client?.contact_name || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [invoices, statusFilter, searchQuery]);

  // --- Send dialog ---
  const handleOpenSendDialog = async (invoice) => {
    if (!user) return;
    setSelectedInvoice(invoice);
    setLoadingItems(true);
    setSendDialogOpen(true);

    try {
      const { data: items, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id);

      if (error) throw error;
      setSelectedInvoiceItems(items || []);
    } catch (err) {
      console.error('Error fetching invoice items:', err);
      setSelectedInvoiceItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleConfirmSend = async () => {
    if (!selectedInvoice || !selectedInvoice.client) return;

    const result = await sendViaPeppol(selectedInvoice, selectedInvoice.client, selectedInvoiceItems);

    if (result?.success) {
      setSendDialogOpen(false);
      setSelectedInvoice(null);
      setSelectedInvoiceItems([]);
      // Refresh data after a short delay to let the DB update
      setTimeout(() => {
        fetchOutboundInvoices();
        fetchAllLogs();
      }, 1500);
    }
  };

  const handleCloseSendDialog = () => {
    setSendDialogOpen(false);
    setSelectedInvoice(null);
    setSelectedInvoiceItems([]);
  };

  // --- Peppol ID check ---
  const handleCheckPeppolId = async () => {
    if (!peppolIdInput.trim()) return;
    await checkRegistration(peppolIdInput.trim());
  };

  // --- Refresh all data ---
  const handleRefreshAll = () => {
    fetchOutboundInvoices();
    fetchInboundLogs();
    fetchAllLogs();
  };

  // --- Formatting helpers ---
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR');
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (amount, currency) => {
    const num = Number(amount || 0);
    const formatted = num.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
    return `${formatted} ${currency || 'EUR'}`;
  };

  const getLogStatusBadge = (status) => {
    const config = {
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
      sent: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Send },
      delivered: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
      accepted: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: CheckCircle },
      rejected: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
      error: { bg: 'bg-red-500/20', text: 'text-red-400', icon: AlertTriangle },
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
      <Badge className={`${c.bg} ${c.text} border-0 gap-1`}>
        <Icon className="w-3 h-3" />
        {t(`peppol.status.${status}`)}
      </Badge>
    );
  };

  // --- Loading state ---
  if (companyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-4 sm:p-6 lg:p-8 space-y-6">

      {/* ======== HEADER ======== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent flex items-center gap-3">
            <Globe className="w-8 h-8 text-orange-400" />
            Peppol e-Invoicing
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {isPeppolConfigured
              ? `${t('peppol.companyEndpoint')}: ${company.peppol_endpoint_id}`
              : t('peppol.noEndpoint')
            }
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('peppol.syncInbound')}
          </Button>
          <Link to="/app/settings">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <Settings className="w-4 h-4 mr-2" />
              {t('peppol.settings')}
            </Button>
          </Link>
        </div>
      </div>

      {/* ======== CONNECTION STATUS CARD ======== */}
      <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isPeppolConfigured ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <div>
              <p className="text-white font-medium">
                {isPeppolConfigured ? 'Peppol Access Point Connected' : 'Peppol Not Configured'}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm text-gray-400">
                {isPeppolConfigured && (
                  <>
                    <span>Endpoint: <span className="text-gray-300 font-mono">{company.peppol_endpoint_id}</span></span>
                    <span>{t('peppol.schemeId')}: <span className="text-gray-300 font-mono">{company.peppol_scheme_id || '0208'}</span></span>
                    <span>{t('peppol.apProvider')}: <span className="text-gray-300 capitalize">{company.peppol_ap_provider || 'scrada'}</span></span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPeppolConfigured ? (
              <Badge className="bg-green-500/20 text-green-400 border-0">
                <CheckCircle className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Link to="/app/settings">
                <Badge className="bg-red-500/20 text-red-400 border-0 cursor-pointer hover:bg-red-500/30">
                  <XCircle className="w-3 h-3 mr-1" />
                  Configure
                </Badge>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ======== KPI CARDS ======== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total envoyees',
            value: kpis.total,
            icon: Send,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
          },
          {
            label: 'Livrees',
            value: kpis.delivered,
            icon: CheckCircle,
            color: 'text-green-400',
            bg: 'bg-green-500/10',
          },
          {
            label: 'En attente',
            value: kpis.pending,
            icon: Clock,
            color: 'text-yellow-400',
            bg: 'bg-yellow-500/10',
          },
          {
            label: 'Erreurs',
            value: kpis.errors,
            icon: AlertTriangle,
            color: 'text-red-400',
            bg: 'bg-red-500/10',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">{kpi.label}</span>
              <div className={`${kpi.bg} p-2 rounded-lg`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ======== PEPPOL ID CHECK ======== */}
      <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl p-5">
        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-orange-400" />
          {t('peppol.checkPeppol')} Peppol ID
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            value={peppolIdInput}
            onChange={(e) => {
              setPeppolIdInput(e.target.value);
              if (checkResult) resetCheck();
            }}
            placeholder="0208:0123456789 (BE) / 0009:12345678901234 (FR)"
            className="bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-500 flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCheckPeppolId(); }}
          />
          <Button
            onClick={handleCheckPeppolId}
            disabled={checking || !peppolIdInput.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {checking ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            {t('peppol.checkPeppol')}
          </Button>
        </div>
        {checkResult && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${checkResult.registered ? 'text-green-400' : 'text-red-400'}`}>
            {checkResult.registered ? (
              <>
                <CheckCircle className="w-4 h-4" />
                {t('peppol.checkRegistered')} — {peppolIdInput}
                {checkResult.name && <span className="text-gray-400 ml-2">({checkResult.name})</span>}
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                {t('peppol.checkNotRegistered')} — {peppolIdInput}
              </>
            )}
          </div>
        )}
      </div>

      {/* ======== TABS ======== */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-gray-900/50 border border-gray-800">
          <TabsTrigger
            value="outbound"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
          >
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Envoi
          </TabsTrigger>
          <TabsTrigger
            value="inbound"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
          >
            <ArrowDownLeft className="w-4 h-4 mr-2" />
            Reception
          </TabsTrigger>
          <TabsTrigger
            value="journal"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
          >
            <Clock className="w-4 h-4 mr-2" />
            Journal
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
          >
            <Wrench className="w-4 h-4 mr-2" />
            Configuration
          </TabsTrigger>
        </TabsList>

        {/* -------- TAB: OUTBOUND -------- */}
        <TabsContent value="outbound" className="mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par numero ou client..."
                className="pl-10 bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-gray-900/50 border-gray-700 text-white">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="eligible">Eligible Peppol</SelectItem>
                <SelectItem value="none">{t('peppol.status.none')}</SelectItem>
                <SelectItem value="pending">{t('peppol.status.pending')}</SelectItem>
                <SelectItem value="sent">{t('peppol.status.sent')}</SelectItem>
                <SelectItem value="delivered">{t('peppol.status.delivered')}</SelectItem>
                <SelectItem value="accepted">{t('peppol.status.accepted')}</SelectItem>
                <SelectItem value="error">{t('peppol.status.error')}</SelectItem>
                <SelectItem value="rejected">{t('peppol.status.rejected')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Outbound table */}
          <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl overflow-hidden">
            {loadingInvoices ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Send className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p className="text-lg mb-1">Aucune facture a envoyer</p>
                <p className="text-sm text-gray-500">
                  Les factures finalisees avec un client Peppol apparaitront ici.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/50">
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">Facture</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden sm:table-cell">Client</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden md:table-cell">Peppol ID</th>
                      <th className="text-right p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">Montant</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">{t('peppol.peppolStatus')}</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden lg:table-cell">Envoye le</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden xl:table-cell">Document ID</th>
                      <th className="text-right p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {filteredInvoices.map((invoice) => {
                      const client = invoice.client;
                      const hasEndpoint = !!client?.peppol_endpoint_id;
                      const canSend = hasEndpoint && (!invoice.peppol_status || invoice.peppol_status === 'none' || invoice.peppol_status === 'error');

                      return (
                        <tr key={invoice.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="p-3 font-medium text-white whitespace-nowrap">
                            {invoice.invoice_number}
                          </td>
                          <td className="p-3 text-gray-300 hidden sm:table-cell whitespace-nowrap">
                            {client?.company_name || client?.contact_name || '-'}
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            {hasEndpoint ? (
                              <span className="text-xs font-mono text-gray-400">{client.peppol_endpoint_id}</span>
                            ) : (
                              <span className="text-xs text-red-400">{t('peppol.clientNoEndpoint')}</span>
                            )}
                          </td>
                          <td className="p-3 text-right text-gray-300 whitespace-nowrap">
                            {formatAmount(invoice.total_ttc)}
                          </td>
                          <td className="p-3">
                            {invoice.peppol_status && invoice.peppol_status !== 'none' ? (
                              <PeppolStatusBadge
                                status={invoice.peppol_status}
                                errorMessage={invoice.peppol_error_message}
                              />
                            ) : (
                              <Badge className="bg-gray-500/20 text-gray-400 border-0">
                                {t('peppol.status.none')}
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-gray-400 text-xs hidden lg:table-cell whitespace-nowrap">
                            {formatDate(invoice.peppol_sent_at)}
                          </td>
                          <td className="p-3 hidden xl:table-cell">
                            {invoice.peppol_document_id ? (
                              <span className="text-xs font-mono text-gray-500 truncate block max-w-[160px]" title={invoice.peppol_document_id}>
                                {invoice.peppol_document_id}
                              </span>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {canSend ? (
                              <Button
                                size="sm"
                                onClick={() => handleOpenSendDialog(invoice)}
                                disabled={sending}
                                className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
                              >
                                <Send className="w-3 h-3 mr-1" />
                                {t('peppol.sendViaPeppol')}
                              </Button>
                            ) : invoice.peppol_status === 'pending' || invoice.peppol_status === 'sent' ? (
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-0 gap-1">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                {t('peppol.pollingStatus')}
                              </Badge>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* -------- TAB: INBOUND -------- */}
        <TabsContent value="inbound" className="mt-4">
          <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl overflow-hidden">
            {loadingInbound ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
              </div>
            ) : inboundLogs.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <ArrowDownLeft className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p className="text-lg mb-1">{t('peppol.inboundDocuments')}</p>
                <p className="text-sm text-gray-500">
                  Aucune facture recue via Peppol pour le moment.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/50">
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">Date</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">Expediteur</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden sm:table-cell">Document ID</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">Statut</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">Facture</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {inboundLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="p-3 text-gray-300 whitespace-nowrap text-xs">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="p-3 text-gray-300 whitespace-nowrap">
                          <span className="font-mono text-xs">{log.sender_endpoint || '-'}</span>
                        </td>
                        <td className="p-3 hidden sm:table-cell">
                          <span className="text-xs font-mono text-gray-500 truncate block max-w-[200px]" title={log.ap_document_id}>
                            {log.ap_document_id || '-'}
                          </span>
                        </td>
                        <td className="p-3">
                          {getLogStatusBadge(log.status)}
                        </td>
                        <td className="p-3">
                          {log.invoice?.invoice_number ? (
                            <span className="text-orange-400 text-sm font-medium">
                              {log.invoice.invoice_number}
                            </span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* -------- TAB: JOURNAL -------- */}
        <TabsContent value="journal" className="mt-4">
          <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl overflow-hidden">
            {loadingLogs ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
              </div>
            ) : allLogs.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p className="text-lg mb-1">{t('peppol.transmissionLog')}</p>
                <p className="text-sm text-gray-500">
                  Aucune transmission Peppol enregistree.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/50">
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">Date</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">Direction</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden sm:table-cell">Facture</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">Statut</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden md:table-cell">{t('peppol.apProvider')}</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden lg:table-cell">Document ID</th>
                      <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden xl:table-cell">Erreur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {allLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="p-3 text-gray-300 whitespace-nowrap text-xs">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="p-3">
                          {log.direction === 'outbound' ? (
                            <Badge className="bg-blue-500/20 text-blue-400 border-0 gap-1">
                              <ArrowUpRight className="w-3 h-3" />
                              Envoi
                            </Badge>
                          ) : (
                            <Badge className="bg-green-500/20 text-green-400 border-0 gap-1">
                              <ArrowDownLeft className="w-3 h-3" />
                              Reception
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 hidden sm:table-cell">
                          {log.invoice?.invoice_number ? (
                            <span className="text-orange-400 font-medium text-sm">
                              {log.invoice.invoice_number}
                            </span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {getLogStatusBadge(log.status)}
                        </td>
                        <td className="p-3 text-gray-400 text-xs capitalize hidden md:table-cell">
                          {log.ap_provider || '-'}
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          <span className="text-xs font-mono text-gray-500 truncate block max-w-[160px]" title={log.ap_document_id}>
                            {log.ap_document_id || '-'}
                          </span>
                        </td>
                        <td className="p-3 hidden xl:table-cell">
                          {log.error_message ? (
                            <span className="text-xs text-red-400 truncate block max-w-[200px]" title={log.error_message}>
                              {log.error_message}
                            </span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* -------- TAB: CONFIGURATION -------- */}
        <TabsContent value="config" className="mt-4 space-y-6">

          {/* --- AP Live Status --- */}
          <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                {t('peppolPage.apLiveStatus', 'Statut du Point d\'Accès')}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchApInfo}
                disabled={loadingApInfo}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                {loadingApInfo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {t('common.refresh', 'Actualiser')}
              </Button>
            </div>

            {loadingApInfo ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                <span className="ml-3 text-gray-400 text-sm">{t('peppolPage.fetchingApInfo', 'Interrogation du point d\'accès...')}</span>
              </div>
            ) : !apInfo?.configured ? (
              <div className="text-center py-6 text-gray-500">
                <XCircle className="w-10 h-10 mx-auto mb-3 text-red-400/50" />
                <p className="text-sm">{t('peppolPage.apNotConfigured', 'Credentials Scrada non configurés. Remplissez le formulaire ci-dessous.')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Registration Status */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    {t('peppolPage.registrationStatus', 'Enregistrement Peppol')}
                  </h4>
                  {apInfo.registrationStatus ? (
                    <div className="flex items-center gap-2">
                      {apInfo.registrationStatus.registered ? (
                        <>
                          <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-green-400 text-sm font-medium">{t('peppolPage.registeredOnNetwork', 'Enregistré sur le réseau Peppol')}</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                          <span className="text-red-400 text-sm">{t('peppolPage.notRegisteredOnNetwork', 'Non enregistré sur le réseau Peppol')}</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">{t('peppolPage.registrationUnknown', 'Statut inconnu — vérifiez votre Endpoint ID')}</p>
                  )}
                  {apInfo.registrationStatus?.details && (
                    <div className="text-xs text-gray-500 space-y-1 mt-2 border-t border-gray-800 pt-2">
                      {Object.entries(apInfo.registrationStatus.details).map(([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-500">{key}</span>
                          <span className="text-gray-400 font-mono truncate max-w-[200px]">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Company Profile from AP */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    {t('peppolPage.apCompanyProfile', 'Profil Access Point')}
                  </h4>
                  {apInfo.companyProfile ? (
                    <div className="text-xs space-y-1.5">
                      {apInfo.companyProfile.name && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t('peppolPage.companyName', 'Nom')}</span>
                          <span className="text-white font-medium">{apInfo.companyProfile.name}</span>
                        </div>
                      )}
                      {apInfo.companyProfile.vatNumber && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t('peppolPage.vatNumber', 'N° TVA')}</span>
                          <span className="text-gray-300 font-mono">{apInfo.companyProfile.vatNumber}</span>
                        </div>
                      )}
                      {apInfo.companyProfile.country && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t('peppolPage.country', 'Pays')}</span>
                          <span className="text-gray-300">{apInfo.companyProfile.country}</span>
                        </div>
                      )}
                      {apInfo.companyProfile.status && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t('peppolPage.accountStatus', 'Statut compte')}</span>
                          <Badge className={`text-xs ${apInfo.companyProfile.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'} border-0`}>
                            {apInfo.companyProfile.status}
                          </Badge>
                        </div>
                      )}
                      {/* Render any other fields generically */}
                      {Object.entries(apInfo.companyProfile)
                        .filter(([k]) => !['name', 'vatNumber', 'country', 'status', 'id'].includes(k))
                        .slice(0, 6)
                        .map(([key, val]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-500">{key}</span>
                            <span className="text-gray-400 font-mono truncate max-w-[200px]">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                          </div>
                        ))
                      }
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">{t('peppolPage.profileUnavailable', 'Profil non disponible')}</p>
                  )}
                </div>

                {/* Supported Document Profiles */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-orange-400" />
                    {t('peppolPage.supportedProfiles', 'Profils UBL supportés')}
                  </h4>
                  {apInfo.supportedProfiles?.length > 0 ? (
                    <div className="space-y-1.5">
                      {apInfo.supportedProfiles.map((profile, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-300">
                            {typeof profile === 'string'
                              ? profile
                              : profile.name || profile.profileId || profile.documentTypeId || JSON.stringify(profile)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">{t('peppolPage.noProfiles', 'Aucun profil trouvé')}</p>
                  )}
                </div>

                {/* Recent AP Events / Documents */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    {t('peppolPage.recentApDocuments', 'Documents récents (AP)')}
                  </h4>
                  {apInfo.recentDocuments?.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {apInfo.recentDocuments.slice(0, 10).map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs border-b border-gray-800/50 pb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <ArrowUpRight className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="text-gray-300 truncate">
                              {doc.invoiceNumber || doc.id || doc.guid || `Doc ${idx + 1}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {doc.status && (
                              <Badge className={`text-[10px] border-0 ${
                                doc.status === 'Processed' || doc.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                                doc.status === 'Error' || doc.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {doc.status}
                              </Badge>
                            )}
                            {doc.createdAt && (
                              <span className="text-gray-500">{formatDate(doc.createdAt)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">{t('peppolPage.noRecentDocs', 'Aucun document récent')}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* --- Peppol Settings Form --- */}
          <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl p-6">
            <PeppolSettings />
          </div>
        </TabsContent>
      </Tabs>

      {/* ======== SEND CONFIRMATION DIALOG ======== */}
      <Dialog open={sendDialogOpen} onOpenChange={handleCloseSendDialog}>
        <DialogContent className="w-full sm:max-w-[90%] md:max-w-lg bg-[#0f1528] border-white/10 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent flex items-center gap-2">
              <Send className="w-5 h-5 text-orange-400" />
              {t('peppol.sendViaPeppol')}
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4 mt-2">
              {/* Invoice summary */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Facture</span>
                  <span className="text-white font-medium">{selectedInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Client</span>
                  <span className="text-white">{selectedInvoice.client?.company_name || selectedInvoice.client?.contact_name || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Montant</span>
                  <span className="text-white font-medium">
                    {formatAmount(selectedInvoice.total_ttc)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Peppol ID destinataire</span>
                  <span className="text-orange-400 font-mono text-sm">
                    {selectedInvoice.client?.peppol_endpoint_id || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{t('peppol.schemeId')}</span>
                  <span className="text-gray-300 font-mono text-sm">
                    {selectedInvoice.client?.peppol_scheme_id || '0208'}
                  </span>
                </div>
              </div>

              {/* Items preview */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                <p className="text-gray-400 text-sm mb-2">
                  Lignes de facture ({loadingItems ? '...' : selectedInvoiceItems.length})
                </p>
                {loadingItems ? (
                  <div className="flex items-center justify-center py-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500" />
                  </div>
                ) : selectedInvoiceItems.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucune ligne trouvee</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedInvoiceItems.map((item, idx) => (
                      <div key={item.id || idx} className="flex justify-between text-xs text-gray-300">
                        <span className="truncate mr-2">{item.description || item.name || `Ligne ${idx + 1}`}</span>
                        <span className="whitespace-nowrap text-gray-400">
                          {Number(item.quantity || 0)} x {Number(item.unit_price || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Warning if no items */}
              {!loadingItems && selectedInvoiceItems.length === 0 && (
                <div className="flex items-center gap-2 text-yellow-400 text-sm bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  La facture ne contient aucune ligne. L envoi pourrait echouer.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              onClick={handleCloseSendDialog}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirmSend}
              disabled={sending || loadingItems || selectedInvoiceItems.length === 0}
              className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto"
            >
              {sending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {t('peppol.sending')}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Confirmer l envoi Peppol
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PeppolPage;
