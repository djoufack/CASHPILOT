import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useCompany } from '@/hooks/useCompany';
import { usePeppol } from '@/hooks/usePeppol';
import { usePeppolSend } from '@/hooks/usePeppolSend';
import { formatDate as formatDateLocale, formatNumber } from '@/utils/dateLocale';
import { usePeppolCheck } from '@/hooks/usePeppolCheck';
import PeppolStatusBadge from '@/components/peppol/PeppolStatusBadge';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';
import GenericKanbanView from '@/components/GenericKanbanView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Send,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Settings,
  Globe,
  Wrench,
  Shield,
  FileCheck,
  Loader2,
  Activity,
  MoreHorizontal,
  Eye,
  Printer,
  Download,
  RotateCcw,
  Copy,
  Ban,
  Trash2,
  Upload,
  FolderOpen,
  HardDrive,
  CalendarDays,
  CalendarClock,
  Kanban,
  List,
  HelpCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import InvoicePreview from '@/components/InvoicePreview';
import { exportUBL } from '@/services/exportUBL';
import PeppolSettings from '@/components/settings/PeppolSettings';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';

const PeppolPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { company, loading: companyLoading } = useCompany();
  const {
    invoices,
    loadingInvoices,
    fetchOutboundInvoices,
    inboundDocuments,
    loadingInbound,
    inboundSupplierInvoices,
    allLogs,
    loadingLogs,
    fetchAllLogs,
    apInfo,
    loadingApInfo,
    fetchApInfo,
    fetchInvoiceItems,
    syncingInbound,
    syncInbound,
    fetchInboundPdf,
    warmInboundDocuments,
    sendInboundToGed,
    listGedXmlDocuments,
    downloadGedXmlDocument,
    importAndSendExternalUbl,
    managingOutbound,
    cancelOutboundNetwork,
    deleteOutboundLocal,
    deleteOutboundInvoiceDb,
    purgeAllPeppolInvoices,
    setOutboundDisputeStatus,
    setInboundDisputeStatus,
    updateOutboundBusinessStatus,
    updateInboundBusinessStatus,
    updateInboundOperationalStatus,
    refreshAll,
  } = usePeppol();
  const { sendViaPeppol, sending, polling: _polling, peppolStatus: _peppolStatus, creditsModalProps } = usePeppolSend();
  const { checkRegistration, checking, result: checkResult, reset: resetCheck } = usePeppolCheck();
  const { openCreditsModal, modalProps: inboundCreditsModalProps } = useCreditsGuard();

  // --- State ---
  const [activeTab, setActiveTab] = useState('outbound');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [peppolIdInput, setPeppolIdInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [outboundActionInvoiceId, setOutboundActionInvoiceId] = useState(null);
  const [inboundActionDocId, setInboundActionDocId] = useState(null);
  const [externalSendDialogOpen, setExternalSendDialogOpen] = useState(false);
  const [externalSource, setExternalSource] = useState('disk');
  const [externalFile, setExternalFile] = useState(null);
  const [gedXmlDocuments, setGedXmlDocuments] = useState([]);
  const [selectedGedVersionId, setSelectedGedVersionId] = useState('');
  const [loadingGedXmlDocs, setLoadingGedXmlDocs] = useState(false);
  const [sendingExternal, setSendingExternal] = useState(false);
  const [purgingPeppol, setPurgingPeppol] = useState(false);
  const [outboundViewMode, setOutboundViewMode] = useState('list');
  const [inboundViewMode, setInboundViewMode] = useState('list');
  const warmedInboundIdsRef = useRef(new Set());

  const isPeppolConfigured = !!company?.peppol_endpoint_id;
  const creditUnit = t('credits.creditsLabel');
  const creditPolicyItems = [
    {
      key: 'configuration',
      icon: Settings,
      badgeClass: 'bg-cyan-500/15 text-cyan-300',
      iconClass: 'text-cyan-300',
      costLabel: `${CREDIT_COSTS.PEPPOL_CONFIGURATION_OK} ${creditUnit}`,
      title: t('peppolPage.creditPolicy.configurationTitle', 'Configuration validee'),
      description: t(
        'peppolPage.creditPolicy.configurationDescription',
        'Le test de connexion Scrada facture uniquement quand une nouvelle configuration est validee avec succes.'
      ),
    },
    {
      key: 'send',
      icon: Send,
      badgeClass: 'bg-orange-500/15 text-orange-300',
      iconClass: 'text-orange-300',
      costLabel: `${CREDIT_COSTS.PEPPOL_SEND_INVOICE} ${creditUnit}`,
      title: t('peppolPage.creditPolicy.sendTitle', "Envoi d'une facture"),
      description: t(
        'peppolPage.creditPolicy.sendDescription',
        "Le debit a lieu au lancement de l'envoi. Si Scrada rejette le document ou si le journal echoue, les credits sont rembourses."
      ),
    },
    {
      key: 'receive',
      icon: ArrowDownLeft,
      badgeClass: 'bg-emerald-500/15 text-emerald-300',
      iconClass: 'text-emerald-300',
      costLabel: `${CREDIT_COSTS.PEPPOL_RECEIVE_INVOICE} ${creditUnit}`,
      title: t('peppolPage.creditPolicy.receiveTitle', "Reception d'une facture"),
      description: t(
        'peppolPage.creditPolicy.receiveDescription',
        "La synchronisation facture uniquement les nouvelles factures importees. Si le solde est insuffisant, l'import est bloque."
      ),
    },
  ];

  // Note: Data fetching for invoices, logs, and AP info is handled by usePeppol hook.

  // --- KPI calculations ---
  const kpis = useMemo(() => {
    const total = invoices.filter((inv) => inv.peppol_status && inv.peppol_status !== 'none').length;
    const delivered = invoices.filter(
      (inv) => inv.peppol_status === 'delivered' || inv.peppol_status === 'accepted'
    ).length;
    const pending = invoices.filter((inv) => inv.peppol_status === 'pending' || inv.peppol_status === 'sent').length;
    const errors = invoices.filter((inv) => inv.peppol_status === 'error' || inv.peppol_status === 'rejected').length;
    return { total, delivered, pending, errors };
  }, [invoices]);

  const inboundSupplierInvoiceById = useMemo(() => {
    const map = new Map();
    (inboundSupplierInvoices || []).forEach((invoice) => {
      if (invoice?.id) {
        map.set(String(invoice.id), invoice);
      }
    });
    return map;
  }, [inboundSupplierInvoices]);

  const inboundSupplierInvoiceByDocumentId = useMemo(() => {
    const map = new Map();
    const docIdFromNotesRegex = /Import Peppol entrant\s+([a-zA-Z0-9-]+)/i;

    (inboundSupplierInvoices || []).forEach((invoice) => {
      const noteText = String(invoice?.notes || '');
      const noteMatch = noteText.match(docIdFromNotesRegex);
      const docId = String(noteMatch?.[1] || '').trim();
      if (docId && !map.has(docId)) {
        map.set(docId, invoice);
      }
    });

    return map;
  }, [inboundSupplierInvoices]);

  // --- Filtered invoices for outbound tab ---
  const filteredInvoices = useMemo(() => {
    let result = invoices;

    if (statusFilter !== 'all') {
      if (statusFilter === 'eligible') {
        result = result.filter((inv) => inv.client?.peppol_endpoint_id);
      } else {
        result = result.filter((inv) => inv.peppol_status === statusFilter);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (inv) =>
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
      const items = await fetchInvoiceItems(invoice.id);
      setSelectedInvoiceItems(items);
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

  // --- Action handlers for invoice rows ---
  const [viewingInvoiceItems, setViewingInvoiceItems] = useState([]);

  const handleViewInvoice = async (invoice) => {
    setViewingInvoice(invoice);
    try {
      const items = await fetchInvoiceItems(invoice.id);
      setViewingInvoiceItems(items);
    } catch {
      setViewingInvoiceItems([]);
    }
  };

  const handlePrintInvoice = async (invoice) => {
    await handleViewInvoice(invoice);
    // Trigger print after render
    setTimeout(() => window.print(), 500);
  };

  const handleExportUBL = async (invoice) => {
    try {
      const items = await fetchInvoiceItems(invoice.id);

      await exportUBL(
        invoice,
        { name: company?.name, peppol_endpoint_id: company?.peppol_endpoint_id },
        invoice.client,
        items
      );

      toast({
        title: t('peppol.exportUBL'),
        description: `${invoice.invoice_number} — UBL XML`,
      });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleCopyDocumentId = (docId) => {
    if (!docId) return;
    navigator.clipboard.writeText(docId);
    toast({ title: t('common.copied') || 'Copié', description: docId });
  };

  const handleCancelOutboundNetwork = async (invoice) => {
    if (!invoice?.id) return;

    const confirmed = window.confirm(
      t(
        'peppol.cancelNetworkConfirm',
        "Annuler l'envoi sur Scrada pour cette facture ? Cette action dépend du statut réseau actuel."
      )
    );
    if (!confirmed) return;

    setOutboundActionInvoiceId(invoice.id);
    try {
      await cancelOutboundNetwork(invoice.id);
      toast({
        title: t('peppol.status.cancelled', 'Envoi annule'),
        description: t('peppol.cancelNetworkSuccess', 'Annulation réseau demandée avec succès.'),
      });
      refreshAll();
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err?.error || err?.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setOutboundActionInvoiceId(null);
    }
  };

  const handleDeleteOutboundLocal = async (invoice) => {
    if (!invoice?.id) return;

    const confirmed = window.confirm(
      t(
        'peppol.deleteLocalConfirm',
        "Supprimer la trace locale de cet envoi et remettre la facture à l'état non envoyé ?"
      )
    );
    if (!confirmed) return;

    setOutboundActionInvoiceId(invoice.id);
    try {
      await deleteOutboundLocal(invoice.id);
      toast({
        title: t('peppol.deleteLocalSuccess', 'Trace locale supprimée'),
        description: t('peppol.deleteLocalSuccessDesc', 'La facture peut être renvoyée si nécessaire.'),
      });
      refreshAll();
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err?.error || err?.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setOutboundActionInvoiceId(null);
    }
  };

  const isPeppolInvoiceRow = useCallback((invoice) => {
    if (!invoice) return false;
    const status = String(invoice.peppol_status || '')
      .trim()
      .toLowerCase();
    const hasDocumentId = String(invoice.peppol_document_id || '').trim().length > 0;
    const notes = String(invoice.notes || '').toLowerCase();
    return (status && status !== 'none') || hasDocumentId || notes.includes('import ubl externe');
  }, []);

  const handleDeleteOutboundFromDb = async (invoice) => {
    if (!invoice?.id) return;
    const confirmed = window.confirm(
      t(
        'peppol.deleteDbConfirm',
        'Supprimer definitivement cette facture Peppol de la base de donnees et de la comptabilite ?'
      )
    );
    if (!confirmed) return;

    setOutboundActionInvoiceId(invoice.id);
    try {
      await deleteOutboundInvoiceDb(invoice.id);
      toast({
        title: t('peppol.deleteDbSuccess', 'Facture supprimee de la base'),
        description: t('peppol.deleteDbSuccessDesc', 'La journalisation comptable a ete remise a jour.'),
      });
      refreshAll();
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err?.error || err?.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setOutboundActionInvoiceId(null);
    }
  };

  const handlePurgeAllPeppolFromDb = useCallback(async () => {
    const confirmed = window.confirm(
      t(
        'peppol.purgeAllConfirm',
        'Supprimer TOUTES les factures Peppol (onglet Envoi) de la base et remettre a jour la comptabilite ?'
      )
    );
    if (!confirmed) return;

    setPurgingPeppol(true);
    try {
      const result = await purgeAllPeppolInvoices();
      toast({
        title: t('peppol.purgeAllSuccess', 'Purge Peppol terminee'),
        description: `${Number(result?.purgedInvoices || 0)} facture(s) supprimee(s).`,
      });
      refreshAll();
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err?.error || err?.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setPurgingPeppol(false);
    }
  }, [purgeAllPeppolInvoices, refreshAll, t, toast]);

  const getInboundActionKey = useCallback((doc) => {
    if (!doc) return '';
    return String(doc.scrada_document_id || doc.id || '');
  }, []);

  const handleSetOutboundBusinessStatus = useCallback(
    async (invoice, nextStatus) => {
      if (!invoice?.id) return;
      setOutboundActionInvoiceId(invoice.id);
      try {
        await updateOutboundBusinessStatus(invoice.id, nextStatus);
        toast({
          title: t('common.success', 'Termine'),
          description: `Statut facture ${invoice.invoice_number || ''} mis a jour.`,
        });
        refreshAll();
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err?.error || err?.message || String(err),
          variant: 'destructive',
        });
      } finally {
        setOutboundActionInvoiceId(null);
      }
    },
    [refreshAll, t, toast, updateOutboundBusinessStatus]
  );

  const handleToggleOutboundDispute = useCallback(
    async (invoice, open) => {
      if (!invoice?.id) return;
      setOutboundActionInvoiceId(invoice.id);
      try {
        await setOutboundDisputeStatus(invoice.id, { open });
        toast({
          title: t('common.success', 'Termine'),
          description: open ? 'Facture marquee en litige.' : 'Statut litige retire pour la facture.',
        });
        refreshAll();
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err?.error || err?.message || String(err),
          variant: 'destructive',
        });
      } finally {
        setOutboundActionInvoiceId(null);
      }
    },
    [refreshAll, setOutboundDisputeStatus, t, toast]
  );

  const handleSetInboundOperationalStatus = useCallback(
    async (doc, nextStatus) => {
      if (!doc?.id) return;
      const actionKey = getInboundActionKey(doc);
      setInboundActionDocId(actionKey);
      try {
        await updateInboundOperationalStatus(doc.id, nextStatus);
        toast({
          title: t('common.success', 'Termine'),
          description: `Statut reception mis a jour (${nextStatus.replace('_', ' ')}).`,
        });
        refreshAll();
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err?.error || err?.message || String(err),
          variant: 'destructive',
        });
      } finally {
        setInboundActionDocId(null);
      }
    },
    [getInboundActionKey, refreshAll, t, toast, updateInboundOperationalStatus]
  );

  const handleSetInboundBusinessStatus = useCallback(
    async (doc, linkedSupplierInvoice, nextStatus) => {
      if (!doc || !linkedSupplierInvoice?.id) return;
      const actionKey = getInboundActionKey(doc);
      setInboundActionDocId(actionKey);
      try {
        await updateInboundBusinessStatus(linkedSupplierInvoice.id, nextStatus);
        toast({
          title: t('common.success', 'Termine'),
          description: `Statut metier facture ${linkedSupplierInvoice.invoice_number || ''} mis a jour.`,
        });
        refreshAll();
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err?.error || err?.message || String(err),
          variant: 'destructive',
        });
      } finally {
        setInboundActionDocId(null);
      }
    },
    [getInboundActionKey, refreshAll, t, toast, updateInboundBusinessStatus]
  );

  const handleToggleInboundDispute = useCallback(
    async (doc, linkedSupplierInvoice, open) => {
      if (!doc || !linkedSupplierInvoice?.id) return;
      const actionKey = getInboundActionKey(doc);
      setInboundActionDocId(actionKey);
      try {
        await setInboundDisputeStatus(linkedSupplierInvoice.id, { open });
        toast({
          title: t('common.success', 'Termine'),
          description: open ? 'Facture recue marquee en litige.' : 'Statut litige retire pour la facture recue.',
        });
        refreshAll();
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err?.error || err?.message || String(err),
          variant: 'destructive',
        });
      } finally {
        setInboundActionDocId(null);
      }
    },
    [getInboundActionKey, refreshAll, setInboundDisputeStatus, t, toast]
  );

  const downloadBlob = useCallback((blob, filename) => {
    if (!blob || Number(blob.size || 0) <= 0) {
      throw new Error('Fichier vide, export impossible.');
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Keep blob URL alive long enough for slower browsers/filesystems.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, []);

  const handleViewInboundPdf = useCallback(
    async (doc) => {
      if (!doc?.scrada_document_id) return;
      setInboundActionDocId(getInboundActionKey(doc));
      const previewTab = window.open('', '_blank');
      try {
        if (previewTab && !previewTab.closed) {
          previewTab.document.write(
            '<html><body style="font-family: Arial, sans-serif; padding: 16px;">Chargement du PDF...</body></html>'
          );
          previewTab.document.close();
        }
        const pdfBlob = await fetchInboundPdf(doc.scrada_document_id);
        const url = URL.createObjectURL(pdfBlob);
        if (previewTab && !previewTab.closed) {
          previewTab.location.href = url;
        } else {
          window.open(url, '_blank');
        }
        setTimeout(() => URL.revokeObjectURL(url), 20_000);
      } catch (err) {
        if (previewTab && !previewTab.closed) {
          previewTab.close();
        }
        toast({
          title: t('common.error'),
          description: err?.message || 'Impossible de visualiser le PDF.',
          variant: 'destructive',
        });
      } finally {
        setInboundActionDocId(null);
      }
    },
    [fetchInboundPdf, getInboundActionKey, t, toast]
  );

  const handleDownloadInboundPdf = useCallback(
    async (doc) => {
      if (!doc?.scrada_document_id) return;
      setInboundActionDocId(getInboundActionKey(doc));
      try {
        let pdfBlob;
        try {
          pdfBlob = await fetchInboundPdf(doc.scrada_document_id);
        } catch {
          pdfBlob = await fetchInboundPdf(doc.scrada_document_id, { forceRefresh: true, timeoutMs: 60_000 });
        }
        const safeRef = String(doc.invoice_number || doc.scrada_document_id).replace(/[^a-zA-Z0-9._-]/g, '_');
        downloadBlob(pdfBlob, `Peppol-Inbound-${safeRef}.pdf`);
        toast({
          title: t('peppol.exportPDF', 'Exporter en PDF'),
          description: t('common.success', 'Termine'),
        });
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err?.message || 'Echec export PDF',
          variant: 'destructive',
        });
      } finally {
        setInboundActionDocId(null);
      }
    },
    [downloadBlob, fetchInboundPdf, getInboundActionKey, t, toast]
  );

  useEffect(() => {
    if (activeTab !== 'inbound') return;
    if (!Array.isArray(inboundDocuments) || inboundDocuments.length === 0) return;

    const docsToWarm = inboundDocuments
      .filter((doc) => doc?.scrada_document_id && !warmedInboundIdsRef.current.has(doc.scrada_document_id))
      .slice(0, 2);

    if (docsToWarm.length === 0) return;

    docsToWarm.forEach((doc) => warmedInboundIdsRef.current.add(doc.scrada_document_id));
    void warmInboundDocuments(docsToWarm, { includePdf: true, limit: 2 });
  }, [activeTab, inboundDocuments, warmInboundDocuments]);

  const handleSendInboundToGed = useCallback(
    async (doc) => {
      if (!doc?.scrada_document_id) return;
      setInboundActionDocId(getInboundActionKey(doc));
      try {
        const result = await sendInboundToGed(doc);
        toast({
          title: t('nav.gedHub', 'GED HUB'),
          description: t(
            'peppol.inboundToGedSuccess',
            `Document envoye vers GED (facture fournisseur ${result?.invoiceNumber || ''}).`
          ),
        });
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err?.message || 'Echec envoi vers GED',
          variant: 'destructive',
        });
      } finally {
        setInboundActionDocId(null);
      }
    },
    [getInboundActionKey, sendInboundToGed, t, toast]
  );

  const openExternalSendDialog = useCallback(async () => {
    setExternalSendDialogOpen(true);
    setExternalSource('disk');
    setExternalFile(null);
    setSelectedGedVersionId('');

    setLoadingGedXmlDocs(true);
    try {
      const versions = await listGedXmlDocuments();
      setGedXmlDocuments(versions);
    } catch {
      setGedXmlDocuments([]);
    } finally {
      setLoadingGedXmlDocs(false);
    }
  }, [listGedXmlDocuments]);

  const handleExternalUblSend = useCallback(async () => {
    setSendingExternal(true);
    try {
      let ublXml = '';
      let sourceLabel = 'external-ubl.xml';

      if (externalSource === 'disk') {
        if (!externalFile) {
          throw new Error('Selectionnez un fichier XML.');
        }
        sourceLabel = externalFile.name || sourceLabel;
        ublXml = await externalFile.text();
      } else {
        const version = gedXmlDocuments.find((item) => item.id === selectedGedVersionId);
        if (!version) {
          throw new Error('Selectionnez un document GED XML.');
        }
        sourceLabel = version.file_name || sourceLabel;
        ublXml = await downloadGedXmlDocument(version);
      }

      const result = await importAndSendExternalUbl({
        ublXml,
        sourceOrigin: externalSource,
        sourceLabel,
      });

      toast({
        title: t('peppol.sentSuccess'),
        description:
          result?.invoice_number && result?.documentId
            ? `${result.invoice_number} -> ${result.documentId}`
            : t('common.success', 'Termine'),
      });

      setExternalSendDialogOpen(false);
      setExternalFile(null);
      setSelectedGedVersionId('');
      refreshAll();
      setActiveTab('outbound');
    } catch (err) {
      toast({
        title: t('peppol.sendError'),
        description: err?.error || err?.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setSendingExternal(false);
    }
  }, [
    downloadGedXmlDocument,
    externalFile,
    externalSource,
    gedXmlDocuments,
    importAndSendExternalUbl,
    refreshAll,
    selectedGedVersionId,
    t,
    toast,
  ]);

  // --- Peppol ID check ---
  const handleCheckPeppolId = async () => {
    if (!peppolIdInput.trim()) return;
    await checkRegistration(peppolIdInput.trim());
  };

  // --- Refresh all data ---
  const _handleRefreshAll = refreshAll;

  const handleSyncInbound = useCallback(async () => {
    if (!user) return;

    try {
      const data = await syncInbound();

      if (data?.insufficientCredits) {
        openCreditsModal(data.requiredCredits, `${data.newDocuments || 0} factures Peppol entrantes`);
        return;
      }

      toast({
        title: t('peppol.syncInbound'),
        description:
          data?.newDocuments > 0
            ? `${data.newDocuments} nouvelles factures importees.`
            : 'Aucune nouvelle facture entrante.',
      });

      refreshAll();
    } catch (err) {
      if (err?.insufficientCredits) {
        openCreditsModal(err.requiredCredits, `${err.newDocuments || 0} factures Peppol entrantes`);
        return;
      }

      toast({
        title: t('common.error'),
        description: err?.error || err?.message || String(err),
        variant: 'destructive',
      });
    }
  }, [openCreditsModal, refreshAll, syncInbound, t, toast, user]);

  const syncInboundButtonLabel = t('peppolPage.creditPolicy.syncButton', {
    credits: CREDIT_COSTS.PEPPOL_RECEIVE_INVOICE,
    unit: creditUnit,
    defaultValue: `Synchroniser (${CREDIT_COSTS.PEPPOL_RECEIVE_INVOICE} ${creditUnit}/facture)`,
  });

  // --- Formatting helpers ---
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return formatDateLocale(dateStr);
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return formatDateLocale(dateStr, {
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

  const formatAmount = useCallback((amount, currency) => {
    const num = Number(amount || 0);
    const formatted = formatNumber(num, { minimumFractionDigits: 2 });
    return `${formatted} ${currency || 'EUR'}`;
  }, []);

  const resolveInboundLinkedSupplierInvoice = useCallback(
    (doc) => {
      if (!doc) return null;
      const metadata = doc?.metadata && typeof doc.metadata === 'object' ? doc.metadata : {};
      const supplierInvoiceId = String(metadata?.supplier_invoice_id || '').trim();
      if (supplierInvoiceId && inboundSupplierInvoiceById.has(supplierInvoiceId)) {
        return inboundSupplierInvoiceById.get(supplierInvoiceId);
      }
      const documentId = String(doc.scrada_document_id || '').trim();
      if (documentId && inboundSupplierInvoiceByDocumentId.has(documentId)) {
        return inboundSupplierInvoiceByDocumentId.get(documentId);
      }
      return null;
    },
    [inboundSupplierInvoiceByDocumentId, inboundSupplierInvoiceById]
  );

  const isBusinessDisputed = useCallback((record) => {
    if (!record) return false;
    const disputeStatus = String(record.dispute_status || '')
      .trim()
      .toLowerCase();
    const paymentStatus = String(record.payment_status || '')
      .trim()
      .toLowerCase();
    const status = String(record.status || '')
      .trim()
      .toLowerCase();

    if (['open', 'disputed', 'in_dispute', 'litige', 'in_litige', 'conflict'].includes(disputeStatus)) return true;
    if (['disputed', 'litige'].includes(paymentStatus)) return true;
    if (['disputed', 'litige'].includes(status)) return true;
    return false;
  }, []);

  const isOverdueBusiness = useCallback((record) => {
    if (!record) return false;
    const paymentStatus = String(record.payment_status || '')
      .trim()
      .toLowerCase();
    const status = String(record.status || '')
      .trim()
      .toLowerCase();
    if (paymentStatus === 'overdue' || status === 'overdue') return true;

    const isPaid = paymentStatus === 'paid' || status === 'paid';
    if (isPaid) return false;

    const dueDateRaw = String(record.due_date || '').trim();
    if (!dueDateRaw) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(dueDateRaw);
    if (Number.isNaN(dueDate.getTime())) return false;
    dueDate.setHours(0, 0, 0, 0);

    return dueDate < today;
  }, []);

  const getBusinessStatusBadge = useCallback(
    (record, { outbound = false, inboundHelp = false } = {}) => {
      if (!record) return null;
      const paymentStatus = String(record.payment_status || '')
        .trim()
        .toLowerCase();
      const status = String(record.status || '')
        .trim()
        .toLowerCase();
      const peppolStatus = String(record.peppol_status || '')
        .trim()
        .toLowerCase();

      if (isBusinessDisputed(record)) {
        return (
          <Badge className="bg-rose-500/20 text-rose-300 border-0 gap-1">
            <AlertTriangle className="w-3 h-3" />
            En litige
          </Badge>
        );
      }

      if (paymentStatus === 'paid' || status === 'paid') {
        const badge = (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-0 gap-1">
            <CheckCircle className="w-3 h-3" />
            Paye
            {inboundHelp ? <HelpCircle className="w-3 h-3 opacity-80" /> : null}
          </Badge>
        );
        if (!inboundHelp) return badge;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">{badge}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs bg-gray-900 border-gray-700 text-gray-100 text-xs">
              {t(
                'peppol.statusHelpPaye',
                'Facture fournisseur reglee: la dette est soldee et visible dans les ecritures de paiement.'
              )}
            </TooltipContent>
          </Tooltip>
        );
      }

      if (isOverdueBusiness(record)) {
        return (
          <Badge className="bg-red-500/20 text-red-300 border-0 gap-1">
            <Clock className="w-3 h-3" />
            Echue
          </Badge>
        );
      }

      if (outbound && peppolStatus && !['none', 'error', 'rejected'].includes(peppolStatus)) {
        return (
          <Badge className="bg-blue-500/20 text-blue-300 border-0 gap-1">
            <Send className="w-3 h-3" />
            Envoye
          </Badge>
        );
      }

      return (
        <Badge className="bg-amber-500/20 text-amber-300 border-0 gap-1">
          <Clock className="w-3 h-3" />
          Non paye
        </Badge>
      );
    },
    [isBusinessDisputed, isOverdueBusiness, t]
  );

  const getInboundOperationalBadge = useCallback(
    (doc, linkedSupplierInvoice) => {
      if (linkedSupplierInvoice?.id) {
        const badge = (
          <Badge className="bg-green-500/20 text-green-300 border-0 gap-1">
            <FileCheck className="w-3 h-3" />
            Integree compta
            <HelpCircle className="w-3 h-3 opacity-80" />
          </Badge>
        );
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">{badge}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs bg-gray-900 border-gray-700 text-gray-100 text-xs">
              {t(
                'peppol.statusHelpIntegrated',
                'Document converti en facture fournisseur et integre dans le flux comptable.'
              )}
            </TooltipContent>
          </Tooltip>
        );
      }

      const operationalStatus = String(doc?.status || 'new').toLowerCase();
      if (operationalStatus === 'archived') {
        return (
          <Badge className="bg-gray-500/20 text-gray-300 border-0 gap-1">
            <FileCheck className="w-3 h-3" />
            Archivee
          </Badge>
        );
      }
      if (operationalStatus === 'processed') {
        return (
          <Badge className="bg-cyan-500/20 text-cyan-300 border-0 gap-1">
            <Activity className="w-3 h-3" />
            En revue
          </Badge>
        );
      }
      const pendingBadge = (
        <Badge className="bg-yellow-500/20 text-yellow-300 border-0 gap-1">
          <Clock className="w-3 h-3" />
          A traiter
          <HelpCircle className="w-3 h-3 opacity-80" />
        </Badge>
      );
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{pendingBadge}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs bg-gray-900 border-gray-700 text-gray-100 text-xs">
            {t(
              'peppol.statusHelpATraiter',
              'Document recu mais pas encore integre. Utilisez "Envoyer vers GED" pour lancer le flux comptable.'
            )}
          </TooltipContent>
        </Tooltip>
      );
    },
    [t]
  );

  const getLogStatusBadge = (status) => {
    const config = {
      received: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: ArrowDownLeft },
      new: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: ArrowDownLeft },
      processed: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
      archived: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: FileCheck },
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
      sent: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Send },
      delivered: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
      accepted: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: CheckCircle },
      rejected: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
      error: { bg: 'bg-red-500/20', text: 'text-red-400', icon: AlertTriangle },
      cancelled: { bg: 'bg-gray-500/20', text: 'text-gray-300', icon: Ban },
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    const statusLabelMap = {
      new: 'Recu',
      processed: 'Traite',
      archived: 'Archive',
      received: 'Recu',
      pending: 'En attente',
      sent: 'Envoye',
      delivered: 'Livre',
      accepted: 'Accepte',
      rejected: 'Rejete',
      error: 'Erreur',
      cancelled: 'Annule',
    };
    return (
      <Badge className={`${c.bg} ${c.text} border-0 gap-1`}>
        <Icon className="w-3 h-3" />
        {t(`peppol.status.${status}`, statusLabelMap[status] || status)}
      </Badge>
    );
  };

  const outboundBusinessMeta = useMemo(
    () => ({
      envoye: { label: 'Envoye', color: 'bg-blue-500/20 text-blue-300', calendar: '#3b82f6', border: '#1d4ed8' },
      non_paye: { label: 'Non paye', color: 'bg-amber-500/20 text-amber-300', calendar: '#f59e0b', border: '#d97706' },
      echue: { label: 'Echue', color: 'bg-red-500/20 text-red-300', calendar: '#ef4444', border: '#b91c1c' },
      litige: { label: 'En litige', color: 'bg-rose-500/20 text-rose-300', calendar: '#f43f5e', border: '#be123c' },
      paye: { label: 'Paye', color: 'bg-emerald-500/20 text-emerald-300', calendar: '#10b981', border: '#047857' },
    }),
    []
  );

  const inboundMeta = useMemo(
    () => ({
      a_traiter: {
        label: 'A traiter',
        color: 'bg-yellow-500/20 text-yellow-300',
        calendar: '#f59e0b',
        border: '#d97706',
      },
      en_revue: { label: 'En revue', color: 'bg-cyan-500/20 text-cyan-300', calendar: '#06b6d4', border: '#0e7490' },
      archivee: { label: 'Archivee', color: 'bg-gray-500/20 text-gray-300', calendar: '#6b7280', border: '#4b5563' },
      non_paye: { label: 'Non paye', color: 'bg-amber-500/20 text-amber-300', calendar: '#f59e0b', border: '#d97706' },
      echue: { label: 'Echue', color: 'bg-red-500/20 text-red-300', calendar: '#ef4444', border: '#b91c1c' },
      litige: { label: 'En litige', color: 'bg-rose-500/20 text-rose-300', calendar: '#f43f5e', border: '#be123c' },
      paye: { label: 'Paye', color: 'bg-emerald-500/20 text-emerald-300', calendar: '#10b981', border: '#047857' },
    }),
    []
  );

  const getOutboundBusinessStatusKey = useCallback(
    (invoice) => {
      if (!invoice) return 'non_paye';

      if (isBusinessDisputed(invoice)) return 'litige';

      const paymentStatus = String(invoice.payment_status || '').toLowerCase();
      const status = String(invoice.status || '').toLowerCase();
      if (paymentStatus === 'paid' || status === 'paid') return 'paye';
      if (isOverdueBusiness(invoice)) return 'echue';

      const peppolStatus = String(invoice.peppol_status || '').toLowerCase();
      if (peppolStatus && !['none', 'error', 'rejected', 'cancelled'].includes(peppolStatus)) return 'envoye';

      return 'non_paye';
    },
    [isBusinessDisputed, isOverdueBusiness]
  );

  const getInboundWorkflowStatusKey = useCallback(
    (doc, linkedSupplierInvoice) => {
      if (linkedSupplierInvoice?.id) {
        if (isBusinessDisputed(linkedSupplierInvoice)) return 'litige';
        const paymentStatus = String(linkedSupplierInvoice.payment_status || '').toLowerCase();
        const status = String(linkedSupplierInvoice.status || '').toLowerCase();
        if (paymentStatus === 'paid' || status === 'paid') return 'paye';
        if (isOverdueBusiness(linkedSupplierInvoice)) return 'echue';
        return 'non_paye';
      }

      const operationalStatus = String(doc?.status || 'new').toLowerCase();
      if (operationalStatus === 'processed') return 'en_revue';
      if (operationalStatus === 'archived') return 'archivee';
      return 'a_traiter';
    },
    [isBusinessDisputed, isOverdueBusiness]
  );

  const outboundViewItems = useMemo(
    () =>
      (filteredInvoices || []).map((invoice) => {
        const status = getOutboundBusinessStatusKey(invoice);
        const meta = outboundBusinessMeta[status] || outboundBusinessMeta.non_paye;
        const date = invoice.due_date || invoice.issue_date || invoice.peppol_sent_at || invoice.created_at;
        return {
          id: invoice.id,
          title: invoice.invoice_number || 'Facture',
          subtitle: invoice.client?.company_name || invoice.client?.contact_name || '-',
          amount: formatAmount(invoice.total_ttc, invoice.currency),
          date,
          status,
          statusLabel: meta.label,
          statusColor: meta.color,
          resource: invoice,
        };
      }),
    [filteredInvoices, formatAmount, getOutboundBusinessStatusKey, outboundBusinessMeta]
  );

  const outboundCalendarEvents = useMemo(
    () =>
      outboundViewItems.map((item) => ({
        id: item.id,
        title: `${item.title} (${item.amount})`,
        date: item.date || new Date().toISOString(),
        status: item.status,
        resource: item.resource,
      })),
    [outboundViewItems]
  );

  const outboundCalendarStatusColors = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(outboundBusinessMeta).map(([key, value]) => [
          key,
          { bg: value.calendar, border: value.border, text: '#fff' },
        ])
      ),
    [outboundBusinessMeta]
  );

  const outboundCalendarLegend = useMemo(
    () =>
      Object.values(outboundBusinessMeta).map((meta) => ({
        label: meta.label,
        color: meta.calendar,
      })),
    [outboundBusinessMeta]
  );

  const outboundKanbanColumns = useMemo(
    () => [
      { id: 'envoye', title: 'Envoye', color: 'text-blue-200 bg-blue-500/10' },
      { id: 'non_paye', title: 'Non paye', color: 'text-amber-200 bg-amber-500/10' },
      { id: 'echue', title: 'Echue', color: 'text-red-200 bg-red-500/10' },
      { id: 'litige', title: 'En litige', color: 'text-rose-200 bg-rose-500/10' },
      { id: 'paye', title: 'Paye', color: 'text-emerald-200 bg-emerald-500/10' },
    ],
    []
  );

  const inboundViewItems = useMemo(
    () =>
      (inboundDocuments || []).map((doc) => {
        const linkedSupplierInvoice = resolveInboundLinkedSupplierInvoice(doc);
        const status = getInboundWorkflowStatusKey(doc, linkedSupplierInvoice);
        const meta = inboundMeta[status] || inboundMeta.a_traiter;
        const invoiceNumber = doc.invoice_number || linkedSupplierInvoice?.invoice_number || '#-';
        return {
          id: doc.id,
          title: invoiceNumber,
          subtitle: doc.sender_name || doc.sender_peppol_id || '-',
          amount: linkedSupplierInvoice
            ? formatAmount(
                linkedSupplierInvoice.total_ttc ||
                  linkedSupplierInvoice.total_amount ||
                  linkedSupplierInvoice.amount ||
                  0,
                linkedSupplierInvoice.currency
              )
            : null,
          date: linkedSupplierInvoice?.due_date || doc.received_at || doc.created_at,
          status,
          statusLabel: meta.label,
          statusColor: meta.color,
          resource: doc,
        };
      }),
    [formatAmount, getInboundWorkflowStatusKey, inboundDocuments, inboundMeta, resolveInboundLinkedSupplierInvoice]
  );

  const inboundCalendarEvents = useMemo(
    () =>
      inboundViewItems.map((item) => ({
        id: item.id,
        title: item.title,
        date: item.date || new Date().toISOString(),
        status: item.status,
        resource: item.resource,
      })),
    [inboundViewItems]
  );

  const inboundCalendarStatusColors = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(inboundMeta).map(([key, value]) => [
          key,
          { bg: value.calendar, border: value.border, text: '#fff' },
        ])
      ),
    [inboundMeta]
  );

  const inboundCalendarLegend = useMemo(
    () =>
      Object.values(inboundMeta).map((meta) => ({
        label: meta.label,
        color: meta.calendar,
      })),
    [inboundMeta]
  );

  const inboundKanbanColumns = useMemo(
    () => [
      { id: 'a_traiter', title: 'A traiter', color: 'text-yellow-200 bg-yellow-500/10' },
      { id: 'en_revue', title: 'En revue', color: 'text-cyan-200 bg-cyan-500/10' },
      { id: 'archivee', title: 'Archivee', color: 'text-gray-200 bg-gray-500/10' },
      { id: 'non_paye', title: 'Non paye', color: 'text-amber-200 bg-amber-500/10' },
      { id: 'echue', title: 'Echue', color: 'text-red-200 bg-red-500/10' },
      { id: 'litige', title: 'En litige', color: 'text-rose-200 bg-rose-500/10' },
      { id: 'paye', title: 'Paye', color: 'text-emerald-200 bg-emerald-500/10' },
    ],
    []
  );

  const handleOutboundKanbanStatusChange = useCallback(
    async (invoiceId, nextStatus) => {
      const invoice =
        (filteredInvoices || []).find((item) => item.id === invoiceId) ||
        (invoices || []).find((item) => item.id === invoiceId);
      if (!invoice) return;

      if (nextStatus === 'litige') {
        await handleToggleOutboundDispute(invoice, true);
        return;
      }

      await handleSetOutboundBusinessStatus(invoice, nextStatus);
    },
    [filteredInvoices, handleSetOutboundBusinessStatus, handleToggleOutboundDispute, invoices]
  );

  const handleInboundKanbanStatusChange = useCallback(
    async (documentId, nextStatus) => {
      const doc = (inboundDocuments || []).find((item) => item.id === documentId);
      if (!doc) return;

      const linkedSupplierInvoice = resolveInboundLinkedSupplierInvoice(doc);
      if (linkedSupplierInvoice?.id) {
        if (!['non_paye', 'paye', 'echue', 'litige'].includes(nextStatus)) {
          toast({
            title: t('common.error'),
            description: 'Ce document est deja integre: utilisez uniquement les statuts metier.',
            variant: 'destructive',
          });
          refreshAll();
          return;
        }

        if (nextStatus === 'litige') {
          await handleToggleInboundDispute(doc, linkedSupplierInvoice, true);
          return;
        }

        await handleSetInboundBusinessStatus(doc, linkedSupplierInvoice, nextStatus);
        return;
      }

      if (!['a_traiter', 'en_revue', 'archivee'].includes(nextStatus)) {
        toast({
          title: t('common.error'),
          description: 'Ce document doit etre integre en comptabilite avant un statut metier.',
          variant: 'destructive',
        });
        refreshAll();
        return;
      }

      await handleSetInboundOperationalStatus(doc, nextStatus);
    },
    [
      handleSetInboundBusinessStatus,
      handleSetInboundOperationalStatus,
      handleToggleInboundDispute,
      inboundDocuments,
      refreshAll,
      resolveInboundLinkedSupplierInvoice,
      t,
      toast,
    ]
  );

  // --- Loading state ---
  if (companyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="min-h-screen bg-[#0a0e1a] p-4 sm:p-6 lg:p-8 space-y-6">
        <Helmet>
          <title>{t('pages.peppol', 'Peppol')} | CashPilot</title>
        </Helmet>
        <CreditsGuardModal {...creditsModalProps} />
        <CreditsGuardModal {...inboundCreditsModalProps} />

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
                : t('peppol.noEndpoint')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800">
              <a href="/peppol-guide#flow-accounting" target="_blank" rel="noopener noreferrer">
                <FileCheck className="w-4 h-4 mr-2" />
                {t('peppol.openGuideHtml', 'Guide opérationnel (HTML)')}
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openExternalSendDialog}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <Upload className="w-4 h-4 mr-2" />
              {t('peppol.externalImportSend', 'Importer UBL (GED / Disque)')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncInbound}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
              disabled={syncingInbound}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncingInbound ? 'animate-spin' : ''}`} />
              {syncInboundButtonLabel}
            </Button>
            <Link to="/app/settings">
              <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800">
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
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 ${isPeppolConfigured ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}
              />
              <div>
                <p className="text-white font-medium">
                  {isPeppolConfigured ? 'Peppol Access Point Connected' : 'Peppol Not Configured'}
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm text-gray-400">
                  {isPeppolConfigured && (
                    <>
                      <span>
                        Endpoint: <span className="text-gray-300 font-mono">{company.peppol_endpoint_id}</span>
                      </span>
                      <span>
                        {t('peppol.schemeId')}:{' '}
                        <span className="text-gray-300 font-mono">{company.peppol_scheme_id || '0208'}</span>
                      </span>
                      <span>
                        {t('peppol.apProvider')}:{' '}
                        <span className="text-gray-300 capitalize">{company.peppol_ap_provider || 'scrada'}</span>
                      </span>
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

        <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl p-5 space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-white font-semibold">
              {t('peppolPage.creditPolicy.title', 'Politique de credits Peppol')}
            </h2>
            <p className="text-sm text-gray-400">
              {t(
                'peppolPage.creditPolicy.subtitle',
                'Peppol est visible pour tous. Chaque action reseau consomme des credits au moment ou elle est executee.'
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {creditPolicyItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="rounded-xl border border-white/10 bg-gray-900/40 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="rounded-lg bg-white/5 p-2">
                        <Icon className={`w-4 h-4 ${item.iconClass}`} />
                      </div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                    </div>
                    <Badge className={`${item.badgeClass} border-0 whitespace-nowrap`}>{item.costLabel}</Badge>
                  </div>
                  <p className="text-sm text-gray-400">{item.description}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500">
            {t('peppolPage.creditPolicy.saveFree', 'Enregistrer les champs seuls ne consomme pas de credits.')}
          </p>
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
            <div key={kpi.label} className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl p-4">
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCheckPeppolId();
              }}
            />
            <Button
              onClick={handleCheckPeppolId}
              disabled={checking || !peppolIdInput.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {checking ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              {t('peppol.checkPeppol')}
            </Button>
          </div>
          {checkResult && (
            <div
              className={`mt-3 flex items-center gap-2 text-sm ${checkResult.registered ? 'text-green-400' : 'text-red-400'}`}
            >
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
                  <SelectItem value="cancelled">{t('peppol.status.cancelled', 'Annule')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handlePurgeAllPeppolFromDb}
                disabled={purgingPeppol || managingOutbound}
                className="w-full sm:w-auto border-red-500/40 text-red-300 hover:bg-red-500/10"
              >
                {purgingPeppol ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                {t('peppol.purgeAllAction', 'Supprimer toutes les factures Peppol (DB)')}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                size="sm"
                variant={outboundViewMode === 'list' ? 'default' : 'outline'}
                onClick={() => setOutboundViewMode('list')}
                className={
                  outboundViewMode === 'list'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }
              >
                <List className="w-4 h-4 mr-2" /> {t('common.list', 'Liste')}
              </Button>
              <Button
                size="sm"
                variant={outboundViewMode === 'calendar' ? 'default' : 'outline'}
                onClick={() => setOutboundViewMode('calendar')}
                className={
                  outboundViewMode === 'calendar'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }
              >
                <CalendarDays className="w-4 h-4 mr-2" /> {t('common.calendar', 'Calendrier')}
              </Button>
              <Button
                size="sm"
                variant={outboundViewMode === 'agenda' ? 'default' : 'outline'}
                onClick={() => setOutboundViewMode('agenda')}
                className={
                  outboundViewMode === 'agenda'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }
              >
                <CalendarClock className="w-4 h-4 mr-2" /> {t('common.agenda', 'Agenda')}
              </Button>
              <Button
                size="sm"
                variant={outboundViewMode === 'kanban' ? 'default' : 'outline'}
                onClick={() => setOutboundViewMode('kanban')}
                className={
                  outboundViewMode === 'kanban'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }
              >
                <Kanban className="w-4 h-4 mr-2" /> {t('common.kanban', 'Kanban')}
              </Button>
            </div>

            {/* Outbound table */}
            {loadingInvoices ? (
              <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl overflow-hidden">
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                </div>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl overflow-hidden">
                <div className="text-center py-16 text-gray-400">
                  <Send className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <p className="text-lg mb-1">Aucune facture a envoyer</p>
                  <p className="text-sm text-gray-500">
                    Les factures finalisees avec un client Peppol apparaitront ici.
                  </p>
                </div>
              </div>
            ) : outboundViewMode !== 'list' ? (
              outboundViewMode === 'calendar' ? (
                <GenericCalendarView
                  events={outboundCalendarEvents}
                  statusColors={outboundCalendarStatusColors}
                  legend={outboundCalendarLegend}
                  onSelectEvent={(invoice) => handleViewInvoice(invoice)}
                />
              ) : outboundViewMode === 'agenda' ? (
                <GenericAgendaView
                  items={outboundViewItems}
                  dateField="date"
                  paidStatuses={['paye']}
                  onView={(item) => {
                    const invoice = (filteredInvoices || []).find((row) => row.id === item.id);
                    if (invoice) handleViewInvoice(invoice);
                  }}
                />
              ) : (
                <GenericKanbanView
                  columns={outboundKanbanColumns}
                  items={outboundViewItems}
                  onStatusChange={handleOutboundKanbanStatusChange}
                  onView={(item) => {
                    const invoice = (filteredInvoices || []).find((row) => row.id === item.id);
                    if (invoice) handleViewInvoice(invoice);
                  }}
                />
              )
            ) : (
              <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl overflow-hidden">
                {
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800 bg-gray-900/50">
                          <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">
                            Facture
                          </th>
                          <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden sm:table-cell">
                            Client
                          </th>
                          <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden md:table-cell">
                            Peppol ID
                          </th>
                          <th className="text-right p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">
                            Montant
                          </th>
                          <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">
                            {t('peppol.peppolStatus')}
                          </th>
                          <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden lg:table-cell">
                            Statut metier
                          </th>
                          <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden lg:table-cell">
                            Envoye le
                          </th>
                          <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden xl:table-cell">
                            Document ID
                          </th>
                          <th className="text-right p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {filteredInvoices.map((invoice) => {
                          const client = invoice.client;
                          const hasEndpoint = !!client?.peppol_endpoint_id;
                          const isPeppolRow = isPeppolInvoiceRow(invoice);
                          const rowBusy = managingOutbound && outboundActionInvoiceId === invoice.id;
                          const inDispute = isBusinessDisputed(invoice);
                          const canSend =
                            hasEndpoint &&
                            (!invoice.peppol_status ||
                              invoice.peppol_status === 'none' ||
                              invoice.peppol_status === 'error' ||
                              invoice.peppol_status === 'cancelled');
                          const sendDisabledReason = !hasEndpoint
                            ? t('peppol.clientNoEndpoint')
                            : t(
                                'peppolPage.sendUnavailableStatus',
                                'Envoi indisponible pour ce statut. Utilisez les actions de suivi.'
                              );

                          return (
                            <tr key={invoice.id} className="hover:bg-gray-800/50 transition-colors">
                              <td className="p-3 font-medium text-white whitespace-nowrap">{invoice.invoice_number}</td>
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
                              <td className="p-3 hidden lg:table-cell">
                                {getBusinessStatusBadge(invoice, { outbound: true })}
                              </td>
                              <td className="p-3 text-gray-400 text-xs hidden lg:table-cell whitespace-nowrap">
                                {formatDate(invoice.peppol_sent_at)}
                              </td>
                              <td className="p-3 hidden xl:table-cell">
                                {invoice.peppol_document_id ? (
                                  <span
                                    className="text-xs font-mono text-gray-500 truncate block max-w-[160px]"
                                    title={invoice.peppol_document_id}
                                  >
                                    {invoice.peppol_document_id}
                                  </span>
                                ) : (
                                  <span className="text-gray-600">-</span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenSendDialog(invoice)}
                                    disabled={sending || rowBusy || !canSend}
                                    title={!canSend ? sendDisabledReason : undefined}
                                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs disabled:bg-gray-700 disabled:text-gray-300"
                                  >
                                    <Send className="w-3 h-3 mr-1" />
                                    {t('peppol.sendViaPeppol', 'Envoyer')}
                                  </Button>
                                  {(invoice.peppol_status === 'pending' || invoice.peppol_status === 'sent') && (
                                    <Badge className="bg-yellow-500/20 text-yellow-400 border-0 gap-1">
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      {t('peppol.pollingStatus')}
                                    </Badge>
                                  )}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700/50"
                                      >
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="bg-gray-900 border-gray-700 text-gray-200"
                                    >
                                      <DropdownMenuItem
                                        onClick={() => handleViewInvoice(invoice)}
                                        className="gap-2 cursor-pointer hover:bg-gray-800"
                                      >
                                        <Eye className="w-4 h-4 text-blue-400" />
                                        {t('common.view') || 'Visualiser'}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handlePrintInvoice(invoice)}
                                        className="gap-2 cursor-pointer hover:bg-gray-800"
                                      >
                                        <Printer className="w-4 h-4 text-gray-400" />
                                        {t('common.print') || 'Imprimer'}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleExportUBL(invoice)}
                                        className="gap-2 cursor-pointer hover:bg-gray-800"
                                      >
                                        <Download className="w-4 h-4 text-emerald-400" />
                                        {t('peppol.exportUBL')}
                                      </DropdownMenuItem>
                                      {invoice.peppol_document_id && (
                                        <DropdownMenuItem
                                          onClick={() => handleCopyDocumentId(invoice.peppol_document_id)}
                                          className="gap-2 cursor-pointer hover:bg-gray-800"
                                        >
                                          <Copy className="w-4 h-4 text-gray-400" />
                                          {t('common.copy') || 'Copier'} Document ID
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator className="bg-gray-700" />
                                      <DropdownMenuItem
                                        onClick={() => handleSetOutboundBusinessStatus(invoice, 'envoye')}
                                        className="gap-2 cursor-pointer hover:bg-gray-800"
                                      >
                                        <Send className="w-4 h-4 text-blue-400" />
                                        Marquer Envoye
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleSetOutboundBusinessStatus(invoice, 'non_paye')}
                                        className="gap-2 cursor-pointer hover:bg-gray-800"
                                      >
                                        <Clock className="w-4 h-4 text-amber-400" />
                                        Marquer Non paye
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleSetOutboundBusinessStatus(invoice, 'echue')}
                                        className="gap-2 cursor-pointer hover:bg-gray-800"
                                      >
                                        <Clock className="w-4 h-4 text-red-400" />
                                        Marquer Echue
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleSetOutboundBusinessStatus(invoice, 'paye')}
                                        className="gap-2 cursor-pointer hover:bg-gray-800"
                                      >
                                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                                        Marquer Paye
                                      </DropdownMenuItem>
                                      {inDispute ? (
                                        <DropdownMenuItem
                                          onClick={() => handleToggleOutboundDispute(invoice, false)}
                                          className="gap-2 cursor-pointer hover:bg-gray-800"
                                        >
                                          <CheckCircle className="w-4 h-4 text-cyan-400" />
                                          Lever litige
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem
                                          onClick={() => handleToggleOutboundDispute(invoice, true)}
                                          className="gap-2 cursor-pointer hover:bg-gray-800"
                                        >
                                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                                          Marquer en litige
                                        </DropdownMenuItem>
                                      )}
                                      {invoice.peppol_document_id &&
                                        (invoice.peppol_status === 'pending' || invoice.peppol_status === 'sent') && (
                                          <DropdownMenuItem
                                            onClick={() => handleCancelOutboundNetwork(invoice)}
                                            disabled={rowBusy}
                                            className="gap-2 cursor-pointer hover:bg-gray-800 text-amber-400"
                                          >
                                            {rowBusy ? (
                                              <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                              <Ban className="w-4 h-4" />
                                            )}
                                            {t('peppol.cancelNetworkAction', 'Annuler cote reseau')}
                                          </DropdownMenuItem>
                                        )}
                                      {invoice.peppol_status && invoice.peppol_status !== 'none' && (
                                        <DropdownMenuItem
                                          onClick={() => handleDeleteOutboundLocal(invoice)}
                                          disabled={rowBusy}
                                          className="gap-2 cursor-pointer hover:bg-gray-800 text-red-400"
                                        >
                                          {rowBusy ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <Trash2 className="w-4 h-4" />
                                          )}
                                          {t('peppol.deleteLocalAction', 'Supprimer localement')}
                                        </DropdownMenuItem>
                                      )}
                                      {isPeppolRow && (
                                        <DropdownMenuItem
                                          onClick={() => handleDeleteOutboundFromDb(invoice)}
                                          disabled={rowBusy}
                                          className="gap-2 cursor-pointer hover:bg-gray-800 text-red-300"
                                        >
                                          {rowBusy ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <Trash2 className="w-4 h-4" />
                                          )}
                                          {t('peppol.deleteDbAction', 'Supprimer de la base (DB + compta)')}
                                        </DropdownMenuItem>
                                      )}
                                      {invoice.peppol_status === 'error' && (
                                        <>
                                          <DropdownMenuSeparator className="bg-gray-700" />
                                          <DropdownMenuItem
                                            onClick={() => handleOpenSendDialog(invoice)}
                                            className="gap-2 cursor-pointer hover:bg-gray-800 text-orange-400"
                                          >
                                            <RotateCcw className="w-4 h-4" />
                                            {t('peppol.retry') || 'Renvoyer'}
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            )}
          </TabsContent>

          {/* -------- TAB: INBOUND -------- */}
          <TabsContent value="inbound" className="mt-4">
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncInbound}
                disabled={syncingInbound}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncingInbound ? 'animate-spin' : ''}`} />
                {t('peppol.receiveAction', 'Réception')}
              </Button>
              <Button
                size="sm"
                variant={inboundViewMode === 'list' ? 'default' : 'outline'}
                onClick={() => setInboundViewMode('list')}
                className={
                  inboundViewMode === 'list'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }
              >
                <List className="w-4 h-4 mr-2" /> {t('common.list', 'Liste')}
              </Button>
              <Button
                size="sm"
                variant={inboundViewMode === 'calendar' ? 'default' : 'outline'}
                onClick={() => setInboundViewMode('calendar')}
                className={
                  inboundViewMode === 'calendar'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }
              >
                <CalendarDays className="w-4 h-4 mr-2" /> {t('common.calendar', 'Calendrier')}
              </Button>
              <Button
                size="sm"
                variant={inboundViewMode === 'agenda' ? 'default' : 'outline'}
                onClick={() => setInboundViewMode('agenda')}
                className={
                  inboundViewMode === 'agenda'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }
              >
                <CalendarClock className="w-4 h-4 mr-2" /> {t('common.agenda', 'Agenda')}
              </Button>
              <Button
                size="sm"
                variant={inboundViewMode === 'kanban' ? 'default' : 'outline'}
                onClick={() => setInboundViewMode('kanban')}
                className={
                  inboundViewMode === 'kanban'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }
              >
                <Kanban className="w-4 h-4 mr-2" /> {t('common.kanban', 'Kanban')}
              </Button>
            </div>

            {loadingInbound ? (
              <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl overflow-hidden">
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                </div>
              </div>
            ) : inboundDocuments.length === 0 ? (
              <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl overflow-hidden">
                <div className="text-center py-16 text-gray-400">
                  <ArrowDownLeft className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <p className="text-lg mb-1">{t('peppol.inboundDocuments')}</p>
                  <p className="text-sm text-gray-500">Aucune facture recue via Peppol pour le moment.</p>
                </div>
              </div>
            ) : inboundViewMode !== 'list' ? (
              inboundViewMode === 'calendar' ? (
                <GenericCalendarView
                  events={inboundCalendarEvents}
                  statusColors={inboundCalendarStatusColors}
                  legend={inboundCalendarLegend}
                  onSelectEvent={(doc) => handleViewInboundPdf(doc)}
                />
              ) : inboundViewMode === 'agenda' ? (
                <GenericAgendaView
                  items={inboundViewItems}
                  dateField="date"
                  paidStatuses={['paye', 'archivee']}
                  onView={(item) => {
                    const doc = (inboundDocuments || []).find((row) => row.id === item.id);
                    if (doc) handleViewInboundPdf(doc);
                  }}
                />
              ) : (
                <GenericKanbanView
                  columns={inboundKanbanColumns}
                  items={inboundViewItems}
                  onStatusChange={handleInboundKanbanStatusChange}
                  onView={(item) => {
                    const doc = (inboundDocuments || []).find((row) => row.id === item.id);
                    if (doc) handleViewInboundPdf(doc);
                  }}
                />
              )
            ) : (
              <div className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl overflow-hidden">
                {
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800 bg-gray-900/50">
                          <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">
                            Date
                          </th>
                          <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">
                            Expediteur
                          </th>
                          <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden sm:table-cell">
                            Document ID
                          </th>
                          <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">
                            Statuts
                          </th>
                          <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">
                            Facture
                          </th>
                          <th className="text-right p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {inboundDocuments.map((doc) => {
                          const linkedSupplierInvoice = resolveInboundLinkedSupplierInvoice(doc);
                          const actionKey = getInboundActionKey(doc);
                          const rowBusy = inboundActionDocId === actionKey;
                          const inDispute = isBusinessDisputed(linkedSupplierInvoice);
                          return (
                            <tr key={doc.id} className="hover:bg-gray-800/50 transition-colors">
                              <td className="p-3 text-gray-300 whitespace-nowrap text-xs">
                                {formatDateTime(doc.received_at || doc.created_at)}
                              </td>
                              <td className="p-3 text-gray-300 whitespace-nowrap">
                                <span className="font-mono text-xs">
                                  {doc.sender_name || doc.sender_peppol_id || '-'}
                                </span>
                              </td>
                              <td className="p-3 hidden sm:table-cell">
                                <span
                                  className="text-xs font-mono text-gray-500 truncate block max-w-[200px]"
                                  title={doc.scrada_document_id}
                                >
                                  {doc.scrada_document_id || '-'}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex flex-col gap-1 items-start">
                                  {getInboundOperationalBadge(doc, linkedSupplierInvoice)}
                                  {linkedSupplierInvoice?.id
                                    ? getBusinessStatusBadge(linkedSupplierInvoice, { inboundHelp: true })
                                    : null}
                                </div>
                              </td>
                              <td className="p-3">
                                {doc.invoice_number ? (
                                  <span className="text-orange-400 text-sm font-medium">{doc.invoice_number}</span>
                                ) : (
                                  <span className="text-gray-600">
                                    {doc.metadata?.internalNumber ? `#${doc.metadata.internalNumber}` : '-'}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700/50"
                                      disabled={rowBusy}
                                    >
                                      {rowBusy ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <MoreHorizontal className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="bg-gray-900 border-gray-700 text-gray-200"
                                  >
                                    <DropdownMenuItem
                                      onClick={() => handleViewInboundPdf(doc)}
                                      className="gap-2 cursor-pointer hover:bg-gray-800"
                                    >
                                      <Eye className="w-4 h-4 text-blue-400" />
                                      {t('common.view', 'Visualiser')} PDF
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDownloadInboundPdf(doc)}
                                      className="gap-2 cursor-pointer hover:bg-gray-800"
                                    >
                                      <Download className="w-4 h-4 text-emerald-400" />
                                      {t('peppol.exportPDF', 'Exporter en PDF')}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-gray-700" />
                                    <DropdownMenuItem
                                      onClick={() => handleSendInboundToGed(doc)}
                                      className="gap-2 cursor-pointer hover:bg-gray-800"
                                    >
                                      <FolderOpen className="w-4 h-4 text-orange-400" />
                                      {t('peppol.sendToGed', 'Envoyer vers GED')}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-gray-700" />
                                    {linkedSupplierInvoice?.id ? (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleSetInboundBusinessStatus(doc, linkedSupplierInvoice, 'non_paye')
                                          }
                                          className="gap-2 cursor-pointer hover:bg-gray-800"
                                        >
                                          <Clock className="w-4 h-4 text-amber-400" />
                                          Marquer Non paye
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleSetInboundBusinessStatus(doc, linkedSupplierInvoice, 'echue')
                                          }
                                          className="gap-2 cursor-pointer hover:bg-gray-800"
                                        >
                                          <Clock className="w-4 h-4 text-red-400" />
                                          Marquer Echue
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleSetInboundBusinessStatus(doc, linkedSupplierInvoice, 'paye')
                                          }
                                          className="gap-2 cursor-pointer hover:bg-gray-800"
                                        >
                                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                                          Marquer Paye
                                        </DropdownMenuItem>
                                        {inDispute ? (
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleToggleInboundDispute(doc, linkedSupplierInvoice, false)
                                            }
                                            className="gap-2 cursor-pointer hover:bg-gray-800"
                                          >
                                            <CheckCircle className="w-4 h-4 text-cyan-400" />
                                            Lever litige
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem
                                            onClick={() => handleToggleInboundDispute(doc, linkedSupplierInvoice, true)}
                                            className="gap-2 cursor-pointer hover:bg-gray-800"
                                          >
                                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                                            Marquer en litige
                                          </DropdownMenuItem>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => handleSetInboundOperationalStatus(doc, 'a_traiter')}
                                          className="gap-2 cursor-pointer hover:bg-gray-800"
                                        >
                                          <Clock className="w-4 h-4 text-yellow-400" />
                                          Mettre A traiter
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleSetInboundOperationalStatus(doc, 'en_revue')}
                                          className="gap-2 cursor-pointer hover:bg-gray-800"
                                        >
                                          <Activity className="w-4 h-4 text-cyan-400" />
                                          Mettre En revue
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleSetInboundOperationalStatus(doc, 'archivee')}
                                          className="gap-2 cursor-pointer hover:bg-gray-800"
                                        >
                                          <FileCheck className="w-4 h-4 text-gray-400" />
                                          Mettre Archivee
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            )}
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
                  <p className="text-sm text-gray-500">Aucune transmission Peppol enregistree.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 bg-gray-900/50">
                        <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">
                          Date
                        </th>
                        <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">
                          Direction
                        </th>
                        <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden sm:table-cell">
                          Facture
                        </th>
                        <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider">
                          Statut
                        </th>
                        <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden md:table-cell">
                          {t('peppol.apProvider')}
                        </th>
                        <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden lg:table-cell">
                          Document ID
                        </th>
                        <th className="text-left p-3 font-medium text-gray-300 uppercase text-xs tracking-wider hidden xl:table-cell">
                          Erreur
                        </th>
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
                              <span className="text-orange-400 font-medium text-sm">{log.invoice.invoice_number}</span>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                          <td className="p-3">{getLogStatusBadge(log.status)}</td>
                          <td className="p-3 text-gray-400 text-xs capitalize hidden md:table-cell">
                            {log.ap_provider || '-'}
                          </td>
                          <td className="p-3 hidden lg:table-cell">
                            <span
                              className="text-xs font-mono text-gray-500 truncate block max-w-[160px]"
                              title={log.ap_document_id}
                            >
                              {log.ap_document_id || '-'}
                            </span>
                          </td>
                          <td className="p-3 hidden xl:table-cell">
                            {log.error_message ? (
                              <span
                                className="text-xs text-red-400 truncate block max-w-[200px]"
                                title={log.error_message}
                              >
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
                  {t('peppolPage.apLiveStatus', "Statut du Point d'Accès")}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchApInfo}
                  disabled={loadingApInfo}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  {loadingApInfo ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {t('common.refresh', 'Actualiser')}
                </Button>
              </div>

              {loadingApInfo ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <span className="ml-3 text-gray-400 text-sm">
                    {t('peppolPage.fetchingApInfo', "Interrogation du point d'accès...")}
                  </span>
                </div>
              ) : !apInfo?.configured ? (
                <div className="text-center py-6 text-gray-500">
                  <XCircle className="w-10 h-10 mx-auto mb-3 text-red-400/50" />
                  <p className="text-sm">
                    {t(
                      'peppolPage.apNotConfigured',
                      'Credentials Scrada non configurés. Remplissez le formulaire ci-dessous.'
                    )}
                  </p>
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
                            <span className="text-green-400 text-sm font-medium">
                              {t('peppolPage.registeredOnNetwork', 'Enregistré sur le réseau Peppol')}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                            <span className="text-red-400 text-sm">
                              {t('peppolPage.notRegisteredOnNetwork', 'Non enregistré sur le réseau Peppol')}
                            </span>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">
                        {t('peppolPage.registrationUnknown', 'Statut inconnu — vérifiez votre Endpoint ID')}
                      </p>
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
                            <Badge
                              className={`text-xs ${apInfo.companyProfile.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'} border-0`}
                            >
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
                              <span className="text-gray-400 font-mono truncate max-w-[200px]">
                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">
                        {t('peppolPage.profileUnavailable', 'Profil non disponible')}
                      </p>
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
                                : profile.name ||
                                  profile.profileId ||
                                  profile.documentTypeId ||
                                  JSON.stringify(profile)}
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
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs border-b border-gray-800/50 pb-1.5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <ArrowUpRight className="w-3 h-3 text-blue-400 flex-shrink-0" />
                              <span className="text-gray-300 truncate">
                                {doc.invoiceNumber || doc.id || doc.guid || `Doc ${idx + 1}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {doc.status && (
                                <Badge
                                  className={`text-[10px] border-0 ${
                                    doc.status === 'Processed' || doc.status === 'delivered'
                                      ? 'bg-green-500/20 text-green-400'
                                      : doc.status === 'Error' || doc.status === 'error'
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-yellow-500/20 text-yellow-400'
                                  }`}
                                >
                                  {doc.status}
                                </Badge>
                              )}
                              {doc.createdAt && <span className="text-gray-500">{formatDate(doc.createdAt)}</span>}
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

        {/* ======== EXTERNAL UBL IMPORT + SEND ======== */}
        <Dialog
          open={externalSendDialogOpen}
          onOpenChange={(open) => {
            setExternalSendDialogOpen(open);
            if (!open) {
              setExternalFile(null);
              setSelectedGedVersionId('');
            }
          }}
        >
          <DialogContent className="w-full sm:max-w-2xl bg-[#0f1528] border-white/10 text-white p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent flex items-center gap-2">
                <Upload className="w-5 h-5 text-orange-400" />
                {t('peppol.externalImportSend', 'Importer UBL externe et envoyer via Peppol')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  {t(
                    'peppol.externalImportHint',
                    'Le document UBL XML sera automatiquement enregistre en facture locale, journalise en comptabilite, puis envoye sur Peppol.'
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={externalSource === 'disk' ? 'default' : 'outline'}
                  onClick={() => setExternalSource('disk')}
                  className={
                    externalSource === 'disk'
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'border-gray-700 text-gray-300'
                  }
                >
                  <HardDrive className="w-4 h-4 mr-2" />
                  {t('peppol.sourceDisk', 'Disque')}
                </Button>
                <Button
                  type="button"
                  variant={externalSource === 'ged' ? 'default' : 'outline'}
                  onClick={() => setExternalSource('ged')}
                  className={
                    externalSource === 'ged'
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'border-gray-700 text-gray-300'
                  }
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  {t('nav.gedHub', 'GED HUB')}
                </Button>
              </div>

              {externalSource === 'disk' ? (
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 space-y-3">
                  <p className="text-sm text-gray-300">{t('peppol.pickUblFile', 'Selectionnez un fichier UBL XML')}</p>
                  <Input
                    type="file"
                    accept=".xml,text/xml,application/xml"
                    onChange={(e) => setExternalFile(e.target.files?.[0] || null)}
                    className="bg-gray-900/50 border-gray-700 text-gray-200"
                  />
                  {externalFile && (
                    <p className="text-xs text-gray-400">
                      {t('common.selected', 'Selectionne')} : <span className="font-mono">{externalFile.name}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 space-y-3">
                  <p className="text-sm text-gray-300">{t('peppol.pickGedXml', 'Selectionnez un XML depuis GED')}</p>
                  {loadingGedXmlDocs ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('common.loading', 'Chargement...')}
                    </div>
                  ) : gedXmlDocuments.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {t('peppol.noGedXmlFound', 'Aucun document XML trouve dans GED.')}
                    </p>
                  ) : (
                    <Select value={selectedGedVersionId} onValueChange={setSelectedGedVersionId}>
                      <SelectTrigger className="w-full bg-gray-900/50 border-gray-700 text-white">
                        <SelectValue placeholder={t('peppol.selectGedXml', 'Choisir un document XML')} />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-80">
                        {gedXmlDocuments.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {doc.file_name || `${doc.source_table} v${doc.version}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-3 text-sm text-orange-100">
                {t('peppol.externalSendCreditNotice', {
                  credits: CREDIT_COSTS.PEPPOL_SEND_INVOICE,
                  unit: creditUnit,
                  defaultValue: `L'envoi consomme ${CREDIT_COSTS.PEPPOL_SEND_INVOICE} ${creditUnit}.`,
                })}
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setExternalSendDialogOpen(false)}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full sm:w-auto"
                disabled={sendingExternal}
              >
                {t('common.cancel', 'Annuler')}
              </Button>
              <Button
                onClick={handleExternalUblSend}
                disabled={
                  sendingExternal ||
                  (externalSource === 'disk' && !externalFile) ||
                  (externalSource === 'ged' && !selectedGedVersionId)
                }
                className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto"
              >
                {sendingExternal ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('peppol.sending')}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {t('peppol.sendViaPeppol')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                    <span className="text-white">
                      {selectedInvoice.client?.company_name || selectedInvoice.client?.contact_name || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Montant</span>
                    <span className="text-white font-medium">{formatAmount(selectedInvoice.total_ttc)}</span>
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
                            {Number(item.quantity || 0)} x{' '}
                            {formatNumber(Number(item.unit_price || 0), { minimumFractionDigits: 2 })}
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

                <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-3 text-sm text-orange-100">
                  {t('peppolPage.creditPolicy.sendDialogNotice', {
                    credits: CREDIT_COSTS.PEPPOL_SEND_INVOICE,
                    unit: creditUnit,
                    defaultValue: `Cet envoi consomme ${CREDIT_COSTS.PEPPOL_SEND_INVOICE} ${creditUnit}. Si le Point d'Acces rejette le document ou si le journal echoue, les credits sont rembourses automatiquement.`,
                  })}
                </div>
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
                    {t('peppolPage.creditPolicy.sendButton', {
                      credits: CREDIT_COSTS.PEPPOL_SEND_INVOICE,
                      unit: creditUnit,
                      defaultValue: `Confirmer l envoi Peppol (${CREDIT_COSTS.PEPPOL_SEND_INVOICE} ${creditUnit})`,
                    })}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- Invoice Preview Dialog --- */}
        {viewingInvoice && (
          <Dialog
            open={!!viewingInvoice}
            onOpenChange={(open) => {
              if (!open) {
                setViewingInvoice(null);
                setViewingInvoiceItems([]);
              }
            }}
          >
            <DialogContent className="w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0f1528] border-white/10 text-white p-0">
              <InvoicePreview invoice={viewingInvoice} client={viewingInvoice.client} items={viewingInvoiceItems} />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </TooltipProvider>
  );
};

export default PeppolPage;
