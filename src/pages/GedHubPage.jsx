import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  CalendarClock,
  Download,
  FileText,
  FileUp,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Tags,
  PencilLine,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import GedWorkflowDialog from '@/components/ged/GedWorkflowDialog';
import { useGedHub } from '@/hooks/useGedHub';
import { computeRetentionUntilFromDays } from '@/services/gedRetentionPolicies';

const SOURCE_FILTERS = [
  { value: 'all', label: 'Tous les modules' },
  { value: 'invoices', label: 'Factures' },
  { value: 'quotes', label: 'Devis' },
  { value: 'credit_notes', label: 'Avoirs' },
  { value: 'delivery_notes', label: 'Bons de livraison' },
  { value: 'purchase_orders', label: 'Bons de commande' },
  { value: 'supplier_invoices', label: 'Factures fournisseurs' },
];
const CREATE_SOURCE_OPTIONS = SOURCE_FILTERS.filter((entry) => entry.value !== 'all');

const RETENTION_POLICY_SOURCE_OPTIONS = SOURCE_FILTERS.filter((entry) => entry.value !== 'all');
const DEFAULT_RETENTION_POLICY_FORM = {
  sourceTable: 'invoices',
  docCategory: 'all',
  retentionDays: '',
  isActive: true,
};

const CONFIDENTIALITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'internal', label: 'Interne' },
  { value: 'restricted', label: 'Restreint' },
  { value: 'confidential', label: 'Confidentiel' },
];

const formatAmount = (amount, currency = 'EUR') => {
  if (amount == null) return '-';
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
};

const toDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR');
};
const isSupplierDocumentType = (value) => value === 'supplier_invoices';
const isAccountingDocumentType = (value) => value === 'invoices' || value === 'supplier_invoices';
const ACCOUNTING_UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp';
const GENERIC_UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.xml,.txt';
const formatRetentionCategory = (value) => (value === 'all' ? 'Tous' : value || '-');
const WORKFLOW_STATUS_META = {
  pending_review: { label: 'En attente', className: 'border-amber-500/30 text-amber-300 bg-amber-500/20' },
  approved: { label: 'Approuvé', className: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/20' },
  rejected: { label: 'Rejeté', className: 'border-red-500/30 text-red-300 bg-red-500/20' },
  signed: { label: 'Signé', className: 'border-sky-500/30 text-sky-300 bg-sky-500/20' },
  none: { label: 'Aucun', className: 'border-gray-700 text-gray-300 bg-gray-800' },
};
const formatWorkflowStatus = (value) => WORKFLOW_STATUS_META[value] || WORKFLOW_STATUS_META.none;

const GedHubPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    documents,
    loading,
    generatingKey,
    mutating,
    clients,
    suppliers,
    counterpartiesLoading,
    fetchDocuments,
    createDocumentDraft,
    createAndUploadDocument,
    uploadDocumentFile,
    upsertMetadata,
    getDocumentAccessUrl,
    generatePdf,
    sourceConfig,
    retentionPolicies,
    retentionPoliciesLoading,
    workflowRows,
    saveRetentionPolicy,
    requestDocumentWorkflow,
    approveDocumentWorkflow,
    rejectDocumentWorkflow,
    signDocumentWorkflow,
  } = useGedHub();

  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fileFilter, setFileFilter] = useState('all');
  const [editingDocument, setEditingDocument] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRetentionDialog, setShowRetentionDialog] = useState(false);
  const [editingRetentionPolicy, setEditingRetentionPolicy] = useState(null);
  const [editingWorkflowDocument, setEditingWorkflowDocument] = useState(null);
  const [workflowComment, setWorkflowComment] = useState('');
  const [workflowActionLoading, setWorkflowActionLoading] = useState(null);
  const [metadataForm, setMetadataForm] = useState({
    doc_category: 'general',
    confidentiality_level: 'internal',
    tagsText: '',
    retention_until: '',
    notes: '',
  });
  const [retentionPolicyForm, setRetentionPolicyForm] = useState(DEFAULT_RETENTION_POLICY_FORM);
  const [createForm, setCreateForm] = useState({
    mode: 'draft',
    sourceTable: 'invoices',
    clientId: '',
    supplierId: '',
    amount: '',
    notes: '',
    file: null,
  });

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (sourceFilter !== 'all' && doc.sourceTable !== sourceFilter) {
        return false;
      }

      if (statusFilter !== 'all' && (doc.status || 'draft') !== statusFilter) {
        return false;
      }

      if (fileFilter === 'with_file' && !doc.fileUrl) {
        return false;
      }

      if (fileFilter === 'without_file' && doc.fileUrl) {
        return false;
      }

      if (!searchQuery.trim()) {
        return true;
      }

      const needle = searchQuery.trim().toLowerCase();
      const searchable = [doc.number, doc.sourceLabel, doc.status, doc.counterpartyName, ...(doc.tags || []), doc.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(needle);
    });
  }, [documents, fileFilter, searchQuery, sourceFilter, statusFilter]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(documents.map((doc) => doc.status || 'draft'))).sort();
  }, [documents]);

  const stats = useMemo(() => {
    const withFile = documents.filter((doc) => !!doc.fileUrl).length;
    const starred = documents.filter((doc) => !!doc.isStarred).length;
    return {
      total: documents.length,
      withFile,
      starred,
      workflows: workflowRows.length,
    };
  }, [documents, workflowRows]);

  const sortedRetentionPolicies = useMemo(() => {
    return [...(retentionPolicies || [])].sort((left, right) => {
      const leftKey = `${left.source_table || ''}:${left.doc_category || ''}`;
      const rightKey = `${right.source_table || ''}:${right.doc_category || ''}`;
      return leftKey.localeCompare(rightKey);
    });
  }, [retentionPolicies]);

  const retentionPolicyPreview = useMemo(() => {
    const retentionDays = Number(retentionPolicyForm.retentionDays);
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
      return null;
    }

    return computeRetentionUntilFromDays(new Date().toISOString(), retentionDays);
  }, [retentionPolicyForm.retentionDays]);

  const openRetentionPolicyDialog = (policy = null) => {
    setEditingRetentionPolicy(policy);
    setRetentionPolicyForm(
      policy
        ? {
            sourceTable: policy.source_table || 'invoices',
            docCategory: policy.doc_category || 'all',
            retentionDays: String(policy.retention_days || ''),
            isActive: policy.is_active ?? true,
          }
        : DEFAULT_RETENTION_POLICY_FORM
    );
    setShowRetentionDialog(true);
  };

  const closeRetentionPolicyDialog = () => {
    setShowRetentionDialog(false);
    setEditingRetentionPolicy(null);
    setRetentionPolicyForm(DEFAULT_RETENTION_POLICY_FORM);
  };

  const openWorkflowDialog = (document) => {
    setEditingWorkflowDocument(document);
    setWorkflowComment(document?.workflowComment || '');
  };

  const closeWorkflowDialog = () => {
    setEditingWorkflowDocument(null);
    setWorkflowComment('');
    setWorkflowActionLoading(null);
  };

  const handleWorkflowAction = async (action) => {
    if (!editingWorkflowDocument) return;

    const workflowActionMap = {
      request: requestDocumentWorkflow,
      approve: approveDocumentWorkflow,
      reject: rejectDocumentWorkflow,
      sign: signDocumentWorkflow,
    };
    const workflowAction = workflowActionMap[action];
    if (!workflowAction) return;

    setWorkflowActionLoading(action);
    try {
      await workflowAction(editingWorkflowDocument, { comment: workflowComment });
      toast({
        title: 'Workflow GED mis à jour',
        description: 'Le statut du document a été enregistré dans Supabase.',
      });
      closeWorkflowDialog();
    } catch (error) {
      toast({
        title: 'Erreur workflow GED',
        description: error?.message || 'Mise à jour impossible.',
        variant: 'destructive',
      });
    } finally {
      setWorkflowActionLoading(null);
    }
  };

  const handleSaveRetentionPolicy = async () => {
    try {
      await saveRetentionPolicy({
        sourceTable: retentionPolicyForm.sourceTable,
        docCategory: retentionPolicyForm.docCategory || 'all',
        retentionDays: retentionPolicyForm.retentionDays,
        is_active: retentionPolicyForm.isActive,
      });
      toast({
        title: 'Politique de retention enregistree',
        description: 'Les documents sans date explicite utiliseront cette retention automatiquement.',
      });
      closeRetentionPolicyDialog();
    } catch (error) {
      toast({
        title: 'Erreur politique de retention',
        description: error?.message || 'Enregistrement impossible.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenDocument = async (document) => {
    try {
      const url = await getDocumentAccessUrl(document);
      if (!url) {
        toast({
          title: 'Document indisponible',
          description: 'Aucun fichier associe a ce document.',
          variant: 'destructive',
        });
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast({
        title: 'Erreur ouverture',
        description: error?.message || "Impossible d'ouvrir le document.",
        variant: 'destructive',
      });
    }
  };

  const handleToggleStar = async (document) => {
    try {
      await upsertMetadata(document, { is_starred: !document.isStarred });
    } catch (error) {
      toast({
        title: 'Erreur metadata',
        description: error?.message || 'Mise a jour impossible.',
        variant: 'destructive',
      });
    }
  };

  const openMetadataDialog = (document) => {
    setEditingDocument(document);
    setMetadataForm({
      doc_category: document.docCategory || 'general',
      confidentiality_level: document.confidentialityLevel || 'internal',
      tagsText: (document.tags || []).join(', '),
      retention_until: document.retentionUntil || '',
      notes: document.notes || '',
    });
  };

  const handleSaveMetadata = async () => {
    if (!editingDocument) return;

    const tags = metadataForm.tagsText
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      await upsertMetadata(editingDocument, {
        doc_category: metadataForm.doc_category,
        confidentiality_level: metadataForm.confidentiality_level,
        tags,
        retention_until: metadataForm.retention_until || null,
        notes: metadataForm.notes || null,
      });
      setEditingDocument(null);
      toast({
        title: 'Metadata sauvegardee',
        description: 'Les informations GED ont ete mises a jour.',
      });
    } catch (error) {
      toast({
        title: 'Erreur metadata',
        description: error?.message || 'Enregistrement impossible.',
        variant: 'destructive',
      });
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      mode: 'draft',
      sourceTable: 'invoices',
      clientId: '',
      supplierId: '',
      amount: '',
      notes: '',
      file: null,
    });
  };

  const handleUploadForDocument = async (doc) => {
    const accountingDocument = isAccountingDocumentType(doc.sourceTable);
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = accountingDocument ? ACCOUNTING_UPLOAD_ACCEPT : GENERIC_UPLOAD_ACCEPT;
    input.onchange = async () => {
      const [file] = input.files || [];
      if (!file) return;
      try {
        const result = await uploadDocumentFile(doc, file);
        if (result?.duplicated) {
          toast({
            title: 'Fichier identique detecte',
            description: `Aucune nouvelle version n'a ete creee. Version actuelle: v${result.version || doc.currentVersion || 1}.`,
          });
          return;
        }
        toast({
          title: 'Fichier televerse',
          description:
            accountingDocument && result?.accountingExtraction
              ? 'Scan IA termine. Donnees comptables injectees et journalisation declenchee.'
              : 'Le document est maintenant disponible dans le HUB et son module.',
        });
      } catch (error) {
        toast({
          title: 'Erreur televersement',
          description: error?.message || 'Televersement impossible.',
          variant: 'destructive',
        });
      }
    };
    input.click();
  };

  const handleCreateOrUpload = async () => {
    try {
      const payload = {
        sourceTable: createForm.sourceTable,
        clientId: createForm.clientId || null,
        supplierId: createForm.supplierId || null,
        amount: createForm.amount ? Number(createForm.amount) : 0,
        notes: createForm.notes || null,
      };

      if (createForm.mode === 'upload') {
        if (!createForm.file) {
          throw new Error('Veuillez choisir un fichier a televerser.');
        }
        const created = await createAndUploadDocument(payload, createForm.file);
        toast({
          title: 'Document cree et televerse',
          description: isAccountingDocumentType(createForm.sourceTable)
            ? 'Document comptable scanne, donnees injectees, journalisation activee.'
            : `${sourceConfig[createForm.sourceTable]?.label || 'Document'} ${created?.id ? 'enregistre' : ''}.`,
        });
      } else {
        await createDocumentDraft(payload);
        toast({
          title: 'Brouillon cree',
          description: 'Le document est disponible dans le GED HUB et le module cible.',
        });
      }

      setShowCreateDialog(false);
      resetCreateForm();
    } catch (error) {
      toast({
        title: 'Erreur creation',
        description: error?.message || 'Creation impossible.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">GED HUB</h1>
          <p className="text-sm text-gray-400">
            {t('gedHub.subtitle', 'Point central des documents entreprise, federes depuis tous les modules CashPilot.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="upload3d" onClick={() => setShowCreateDialog(true)} className="font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau / Televerser
          </Button>
          <Button
            onClick={() => fetchDocuments()}
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={loading || mutating}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Documents</p>
          <p className="text-2xl font-semibold text-white mt-1">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Avec fichier</p>
          <p className="text-2xl font-semibold text-white mt-1">{stats.withFile}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Favoris</p>
          <p className="text-2xl font-semibold text-white mt-1">{stats.starred}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Politiques</p>
          <p className="text-2xl font-semibold text-white mt-1">{sortedRetentionPolicies.length}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Workflows</p>
          <p className="text-2xl font-semibold text-white mt-1">{stats.workflows}</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-orange-400" />
              Politiques de retention automatiques
            </h2>
            <p className="text-sm text-gray-400">
              Les documents sans valeur explicite de retention heredent de la regle correspondant a leur module et
              categorie GED.
            </p>
          </div>

          <Button
            variant="upload3d"
            onClick={() => openRetentionPolicyDialog()}
            className="font-semibold"
            disabled={retentionPoliciesLoading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle politique
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Regles actives</p>
            <p className="text-2xl font-semibold text-white mt-1">
              {sortedRetentionPolicies.filter((policy) => policy.is_active !== false).length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Types couverts</p>
            <p className="text-2xl font-semibold text-white mt-1">
              {new Set(sortedRetentionPolicies.map((policy) => policy.source_table)).size}
            </p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Apercu</p>
            <p className="text-sm text-gray-200 mt-2">
              {retentionPolicyPreview ? `Nouvelle regle => ${retentionPolicyPreview}` : 'Saisissez une duree en jours.'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-950/60 border-b border-gray-800 text-gray-400">
              <tr>
                <th className="text-left py-3 px-3">Module</th>
                <th className="text-left py-3 px-3">Categorie GED</th>
                <th className="text-left py-3 px-3">Jours</th>
                <th className="text-left py-3 px-3">Etat</th>
                <th className="text-left py-3 px-3">Expiration auto</th>
                <th className="text-right py-3 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRetentionPolicies.map((policy) => (
                <tr key={`${policy.source_table}:${policy.doc_category}`} className="border-b border-gray-800/70">
                  <td className="py-3 px-3 text-gray-100">
                    {SOURCE_FILTERS.find((entry) => entry.value === policy.source_table)?.label || policy.source_table}
                  </td>
                  <td className="py-3 px-3 text-gray-200">{formatRetentionCategory(policy.doc_category)}</td>
                  <td className="py-3 px-3 text-gray-200">{policy.retention_days || '-'}</td>
                  <td className="py-3 px-3">
                    <Badge
                      variant="outline"
                      className={
                        policy.is_active === false
                          ? 'border-gray-700 text-gray-400'
                          : 'border-emerald-500/30 text-emerald-300'
                      }
                    >
                      {policy.is_active === false ? 'Inactif' : 'Actif'}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-gray-300">
                    {computeRetentionUntilFromDays(new Date().toISOString(), policy.retention_days) || '-'}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-orange-400 hover:text-orange-300 h-8 px-2"
                      onClick={() => openRetentionPolicyDialog(policy)}
                    >
                      <PencilLine className="h-4 w-4 mr-2" />
                      Modifier
                    </Button>
                  </td>
                </tr>
              ))}

              {!retentionPoliciesLoading && sortedRetentionPolicies.length === 0 && (
                <tr>
                  <td className="py-8 px-3 text-center text-gray-400" colSpan={6}>
                    Aucune politique de retention automatique n est encore definie.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 space-y-3">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
          <div className="relative xl:col-span-2">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechercher numero, module, statut, tiers, tag..."
              className="pl-9 bg-gray-950/60 border-gray-700 text-white"
            />
          </div>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="bg-gray-950/60 border-gray-700 text-white">
              <SelectValue placeholder="Module" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700 text-white">
              {SOURCE_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-gray-950/60 border-gray-700 text-white">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700 text-white">
              <SelectItem value="all">Tous statuts</SelectItem>
              {uniqueStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={fileFilter === 'all' ? 'default' : 'outline'}
            className={fileFilter === 'all' ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-700 text-gray-300'}
            onClick={() => setFileFilter('all')}
            size="sm"
          >
            Tous
          </Button>
          <Button
            variant={fileFilter === 'with_file' ? 'default' : 'outline'}
            className={
              fileFilter === 'with_file' ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-700 text-gray-300'
            }
            onClick={() => setFileFilter('with_file')}
            size="sm"
          >
            Avec fichier
          </Button>
          <Button
            variant={fileFilter === 'without_file' ? 'default' : 'outline'}
            className={
              fileFilter === 'without_file' ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-700 text-gray-300'
            }
            onClick={() => setFileFilter('without_file')}
            size="sm"
          >
            Sans fichier
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-950/60 border-b border-gray-800 text-gray-400">
              <tr>
                <th className="text-left py-3 px-3">Document</th>
                <th className="text-left py-3 px-3">Module</th>
                <th className="text-left py-3 px-3">Version</th>
                <th className="text-left py-3 px-3">Rétention</th>
                <th className="text-left py-3 px-3">Workflow</th>
                <th className="text-left py-3 px-3">Tiers</th>
                <th className="text-left py-3 px-3">Statut</th>
                <th className="text-right py-3 px-3">Montant</th>
                <th className="text-left py-3 px-3">Tags</th>
                <th className="text-left py-3 px-3">Date</th>
                <th className="text-right py-3 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                filteredDocuments.map((doc) => {
                  const docKey = `${doc.sourceTable}:${doc.sourceId}`;
                  return (
                    <tr key={docKey} className="border-b border-gray-800/70 hover:bg-gray-800/30">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleStar(doc)}
                            className={`transition-colors ${doc.isStarred ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'}`}
                            title="Favori"
                          >
                            <Star className={`h-4 w-4 ${doc.isStarred ? 'fill-yellow-400' : ''}`} />
                          </button>
                          <div>
                            <p className="text-white font-medium">{doc.number}</p>
                            <p className="text-xs text-gray-500">
                              {doc.fileUrl ? 'Fichier disponible' : 'Aucun fichier'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {doc.sourceLabel}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          <Badge className="w-fit bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {doc.currentVersion ? `v${doc.currentVersion}` : '—'}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {doc.versionCount > 1
                              ? `${doc.versionCount} versions`
                              : doc.currentVersion
                                ? 'Version actuelle'
                                : 'Brouillon'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          <Badge
                            className={`w-fit border ${
                              doc.isRetentionAutomatic
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                                : doc.retentionUntil
                                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                                  : 'bg-gray-800 text-gray-300 border-gray-700'
                            }`}
                          >
                            {doc.effectiveRetentionUntil || doc.retentionUntil || '—'}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {doc.isRetentionAutomatic ? 'Automatique' : doc.retentionUntil ? 'Manuel' : 'Aucune regle'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          <Badge className={`w-fit border ${formatWorkflowStatus(doc.workflowStatus).className}`}>
                            {formatWorkflowStatus(doc.workflowStatus).label}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {doc.workflowSignedAt
                              ? `Signé le ${toDate(doc.workflowSignedAt)}`
                              : doc.workflowApprovedAt
                                ? `Validé le ${toDate(doc.workflowApprovedAt)}`
                                : doc.workflowRejectedAt
                                  ? `Rejeté le ${toDate(doc.workflowRejectedAt)}`
                                  : doc.workflowRequestedAt
                                    ? `Demandé le ${toDate(doc.workflowRequestedAt)}`
                                    : 'Aucune action'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-200">{doc.counterpartyName || '-'}</td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="border-gray-700 text-gray-200">
                          {doc.status || 'draft'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right text-gray-100">{formatAmount(doc.amount, doc.currency)}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(doc.tags || []).slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="border-gray-700 text-gray-300">
                              {tag}
                            </Badge>
                          ))}
                          {(doc.tags || []).length === 0 && <span className="text-gray-600">-</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">{toDate(doc.createdAt)}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDocument(doc)}
                            className="text-gray-300 hover:text-white h-8 w-8 p-0"
                            title="Ouvrir document"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(doc.modulePath)}
                            className="text-cyan-400 hover:text-cyan-300 h-8 w-8 p-0"
                            title="Ouvrir module"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generatePdf(doc)}
                            className="text-purple-400 hover:text-purple-300 h-8 w-8 p-0"
                            title="Generer PDF"
                            disabled={generatingKey === docKey}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="upload3d"
                            size="sm"
                            onClick={() => handleUploadForDocument(doc)}
                            className="h-8 w-8 p-0 rounded-md"
                            title="Televerser un fichier"
                            disabled={mutating}
                          >
                            <FileUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openMetadataDialog(doc)}
                            className="text-orange-400 hover:text-orange-300 h-8 w-8 p-0"
                            title="Metadata GED"
                          >
                            <Tags className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openWorkflowDialog(doc)}
                            className="text-emerald-400 hover:text-emerald-300 h-8 px-2"
                            title="Workflow GED"
                          >
                            <Workflow className="h-4 w-4 mr-1" />
                            Workflow
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {!loading && filteredDocuments.length === 0 && (
          <div className="py-10 text-center text-gray-400">
            <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-70" />
            <p>Aucun document ne correspond aux filtres.</p>
          </div>
        )}

        {loading && <div className="py-10 text-center text-gray-400">Chargement GED HUB...</div>}
      </div>

      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            resetCreateForm();
          }
        }}
      >
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
          <DialogTitle>Creer ou televerser un document</DialogTitle>
          <DialogDescription className="text-gray-400">
            Rattachez un document GED au bon module, puis ajoutez son fichier et ses metadonnees.
          </DialogDescription>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select
                value={createForm.mode}
                onValueChange={(value) => setCreateForm((prev) => ({ ...prev, mode: value, file: null }))}
              >
                <SelectTrigger className="bg-gray-950/70 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  <SelectItem value="draft">Creer un brouillon</SelectItem>
                  <SelectItem value="upload">Creer + televerser un fichier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type de document</Label>
              <Select
                value={createForm.sourceTable}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    sourceTable: value,
                    clientId: '',
                    supplierId: '',
                  }))
                }
              >
                <SelectTrigger className="bg-gray-950/70 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  {CREATE_SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isSupplierDocumentType(createForm.sourceTable) ? (
              <div className="space-y-2">
                <Label>Fournisseur</Label>
                <Select
                  value={createForm.supplierId}
                  onValueChange={(value) => setCreateForm((prev) => ({ ...prev, supplierId: value }))}
                >
                  <SelectTrigger className="bg-gray-950/70 border-gray-700 text-white">
                    <SelectValue
                      placeholder={counterpartiesLoading ? 'Chargement fournisseurs...' : 'Selectionner un fournisseur'}
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    {(suppliers || []).map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={createForm.clientId}
                  onValueChange={(value) => setCreateForm((prev) => ({ ...prev, clientId: value }))}
                >
                  <SelectTrigger className="bg-gray-950/70 border-gray-700 text-white">
                    <SelectValue
                      placeholder={counterpartiesLoading ? 'Chargement clients...' : 'Selectionner un client'}
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    {(clients || []).map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Montant (optionnel)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={createForm.amount}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, amount: event.target.value }))}
                className="bg-gray-950/70 border-gray-700 text-white"
              />
            </div>

            {createForm.mode === 'upload' && (
              <div className="space-y-2 md:col-span-2">
                <Label>Fichier</Label>
                <Input
                  type="file"
                  accept={
                    isAccountingDocumentType(createForm.sourceTable) ? ACCOUNTING_UPLOAD_ACCEPT : GENERIC_UPLOAD_ACCEPT
                  }
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      file: event.target.files?.[0] || null,
                    }))
                  }
                  className="bg-gray-950/70 border-gray-700 text-white file:text-gray-300"
                />
                {createForm.file && <p className="text-xs text-gray-400">{createForm.file.name}</p>}
                {isAccountingDocumentType(createForm.sourceTable) && (
                  <p className="text-xs text-amber-300">
                    Document comptable: scan IA immediate + integration comptable (formats PDF/JPG/PNG/WEBP).
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={createForm.notes}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
                className="bg-gray-950/70 border-gray-700 text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              Le document sera visible dans GED HUB et dans le module cible (
              {sourceConfig[createForm.sourceTable]?.label}).
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-gray-700 text-gray-300"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetCreateForm();
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreateOrUpload}
                variant={createForm.mode === 'upload' ? 'upload3d' : 'default'}
                className={
                  createForm.mode === 'upload' ? 'font-semibold' : 'bg-orange-500 hover:bg-orange-600 text-white'
                }
                disabled={mutating || counterpartiesLoading}
              >
                {createForm.mode === 'upload' ? (
                  <>
                    <FileUp className="h-4 w-4 mr-2" />
                    Creer et televerser
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Creer le brouillon
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingDocument} onOpenChange={(open) => !open && setEditingDocument(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
          <DialogTitle>Metadata GED - {editingDocument?.number}</DialogTitle>
          <DialogDescription className="text-gray-400">
            Editez la categorie, la retention, les tags et les notes associes a ce document.
          </DialogDescription>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Input
                value={metadataForm.doc_category}
                onChange={(event) => setMetadataForm((prev) => ({ ...prev, doc_category: event.target.value }))}
                className="bg-gray-950/70 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label>Confidentialité</Label>
              <Select
                value={metadataForm.confidentiality_level}
                onValueChange={(value) => setMetadataForm((prev) => ({ ...prev, confidentiality_level: value }))}
              >
                <SelectTrigger className="bg-gray-950/70 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  {CONFIDENTIALITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Tags (séparés par des virgules)</Label>
              <Input
                value={metadataForm.tagsText}
                onChange={(event) => setMetadataForm((prev) => ({ ...prev, tagsText: event.target.value }))}
                placeholder="finance, legal, urgent"
                className="bg-gray-950/70 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label>Rétention jusqu'au</Label>
              <Input
                type="date"
                value={metadataForm.retention_until}
                onChange={(event) => setMetadataForm((prev) => ({ ...prev, retention_until: event.target.value }))}
                className="bg-gray-950/70 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Notes GED</Label>
              <Textarea
                value={metadataForm.notes}
                onChange={(event) => setMetadataForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={4}
                className="bg-gray-950/70 border-gray-700 text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="border-gray-700 text-gray-300"
              onClick={() => setEditingDocument(null)}
            >
              Annuler
            </Button>
            <Button onClick={handleSaveMetadata} className="bg-orange-500 hover:bg-orange-600 text-white">
              Sauvegarder
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showRetentionDialog}
        onOpenChange={(open) => (!open ? closeRetentionPolicyDialog() : setShowRetentionDialog(true))}
      >
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
          <DialogTitle>
            {editingRetentionPolicy ? 'Modifier une politique de retention' : 'Nouvelle politique de retention'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Configurez la duree appliquee automatiquement aux documents GED sans date de retention explicite.
          </DialogDescription>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Module GED</Label>
              <Select
                value={retentionPolicyForm.sourceTable}
                onValueChange={(value) => setRetentionPolicyForm((prev) => ({ ...prev, sourceTable: value }))}
              >
                <SelectTrigger className="bg-gray-950/70 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  {RETENTION_POLICY_SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categorie GED</Label>
              <Input
                value={retentionPolicyForm.docCategory}
                onChange={(event) =>
                  setRetentionPolicyForm((prev) => ({ ...prev, docCategory: event.target.value.trimStart() }))
                }
                placeholder="all"
                className="bg-gray-950/70 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label>Retention en jours</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={retentionPolicyForm.retentionDays}
                onChange={(event) => setRetentionPolicyForm((prev) => ({ ...prev, retentionDays: event.target.value }))}
                className="bg-gray-950/70 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label>Etat</Label>
              <Select
                value={String(retentionPolicyForm.isActive)}
                onValueChange={(value) => setRetentionPolicyForm((prev) => ({ ...prev, isActive: value === 'true' }))}
              >
                <SelectTrigger className="bg-gray-950/70 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  <SelectItem value="true">Actif</SelectItem>
                  <SelectItem value="false">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <p className="text-xs text-gray-400">
                La categorie <span className="font-semibold text-gray-200">all</span> s applique a tous les documents du
                module. Les documents avec une date de retention explicite gardent leur valeur manuelle.
              </p>
              <p className="text-xs text-gray-400">
                Apercu automatique: {retentionPolicyPreview || 'saisissez une duree valide'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" className="border-gray-700 text-gray-300" onClick={closeRetentionPolicyDialog}>
              Annuler
            </Button>
            <Button onClick={handleSaveRetentionPolicy} className="bg-orange-500 hover:bg-orange-600 text-white">
              <CalendarClock className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <GedWorkflowDialog
        open={!!editingWorkflowDocument}
        document={editingWorkflowDocument}
        comment={workflowComment}
        onCommentChange={setWorkflowComment}
        loadingAction={workflowActionLoading}
        onClose={closeWorkflowDialog}
        onRequest={(value) => handleWorkflowAction('request', value)}
        onApprove={(value) => handleWorkflowAction('approve', value)}
        onReject={(value) => handleWorkflowAction('reject', value)}
        onSign={(value) => handleWorkflowAction('sign', value)}
      />
    </div>
  );
};

export default GedHubPage;
