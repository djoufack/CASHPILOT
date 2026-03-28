import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, PenSquare, Send, Workflow, XCircle } from 'lucide-react';

const WORKFLOW_STATUS_META = {
  pending_review: {
    label: 'En attente de validation',
    className: 'border-amber-500/30 text-amber-300 bg-amber-500/20',
  },
  approved: { label: 'Approuvé', className: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/20' },
  rejected: { label: 'Rejeté', className: 'border-red-500/30 text-red-300 bg-red-500/20' },
  signed: { label: 'Signé', className: 'border-sky-500/30 text-sky-300 bg-sky-500/20' },
  none: { label: 'Aucun workflow', className: 'border-gray-700 text-gray-300 bg-gray-800' },
};

const formatActionLabel = (action) => {
  if (action === 'request') return 'Demander validation';
  if (action === 'approve') return 'Approuver';
  if (action === 'reject') return 'Rejeter';
  if (action === 'sign') return 'Signer';
  return action;
};

const formatTimestamp = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR');
};

const GedWorkflowDialog = ({
  open,
  document,
  comment,
  onCommentChange,
  loadingAction,
  onClose,
  onRequest,
  onApprove,
  onReject,
  onSign,
}) => {
  const workflowStatus = document?.workflowStatus || 'none';
  const workflowMeta = WORKFLOW_STATUS_META[workflowStatus] || WORKFLOW_STATUS_META.none;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-3xl">
        <DialogTitle className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-orange-400" />
          Workflow GED - {document?.number || 'Document'}
        </DialogTitle>
        <DialogDescription className="text-gray-400">
          Déclenchez ici les étapes de validation, signature ou rejet. Le statut est conservé au niveau du document,
          indépendamment des versions du fichier.
        </DialogDescription>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Statut courant</p>
            <Badge className={`w-fit border ${workflowMeta.className}`}>{workflowMeta.label}</Badge>
            <p className="text-xs text-gray-400">
              Demande: {formatTimestamp(document?.workflowRequestedAt)} | Validation:{' '}
              {formatTimestamp(document?.workflowApprovedAt)}
            </p>
            <p className="text-xs text-gray-400">
              Rejet: {formatTimestamp(document?.workflowRejectedAt)} | Signature:{' '}
              {formatTimestamp(document?.workflowSignedAt)}
            </p>
            <p className="text-xs text-gray-400 break-words">Commentaire: {document?.workflowComment || '—'}</p>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 space-y-3">
            <div className="space-y-2">
              <Label>Commentaire / motif</Label>
              <Textarea
                value={comment}
                onChange={(event) => onCommentChange(event.target.value)}
                rows={5}
                placeholder="Ajouter un commentaire, une note d'approbation ou le motif du rejet"
                className="bg-gray-950/70 border-gray-700 text-white"
              />
            </div>

            <div className="text-xs text-gray-400">
              Les actions écrivent directement dans Supabase et restent attachées à ce document, même si le fichier est
              versionné à nouveau.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            variant="upload3d"
            className="justify-start font-semibold"
            onClick={() => onRequest(comment)}
            disabled={loadingAction !== null}
          >
            <Send className="h-4 w-4 mr-2" />
            {loadingAction === 'request' ? 'Demande...' : formatActionLabel('request')}
          </Button>
          <Button
            className="justify-start bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => onApprove(comment)}
            disabled={loadingAction !== null}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {loadingAction === 'approve' ? 'Validation...' : formatActionLabel('approve')}
          </Button>
          <Button
            className="justify-start bg-red-600 hover:bg-red-700 text-white"
            onClick={() => onReject(comment)}
            disabled={loadingAction !== null}
          >
            <XCircle className="h-4 w-4 mr-2" />
            {loadingAction === 'reject' ? 'Rejet...' : formatActionLabel('reject')}
          </Button>
          <Button
            className="justify-start bg-sky-600 hover:bg-sky-700 text-white"
            onClick={() => onSign(comment)}
            disabled={loadingAction !== null}
          >
            <PenSquare className="h-4 w-4 mr-2" />
            {loadingAction === 'sign' ? 'Signature...' : formatActionLabel('sign')}
          </Button>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" className="border-gray-700 text-gray-300" onClick={onClose}>
            <PenSquare className="h-4 w-4 mr-2" />
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GedWorkflowDialog;
