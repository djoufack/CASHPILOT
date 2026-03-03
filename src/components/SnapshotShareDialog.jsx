import { useMemo, useState } from 'react';
import { Copy, Link2, Loader2, Share2, ShieldOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useSharedSnapshots } from '@/hooks/useSharedSnapshots';

const formatDate = (value) => {
  if (!value) return 'Sans expiration';

  try {
    return new Date(value).toLocaleString('fr-FR');
  } catch {
    return value;
  }
};

const SnapshotShareDialog = ({
  snapshotType,
  title,
  snapshotData,
  triggerClassName = '',
}) => {
  const { toast } = useToast();
  const { snapshots, loading, createSnapshot, revokeSnapshot } = useSharedSnapshots(snapshotType);
  const [open, setOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState('');

  const activeSnapshots = useMemo(
    () => snapshots.filter((snapshot) => snapshot.is_public),
    [snapshots],
  );

  const copyToClipboard = async (url) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    window.setTimeout(() => setCopiedUrl(''), 1800);
    toast({
      title: 'Lien copié',
      description: 'Le lien public est prêt à être partagé.',
    });
  };

  const handleCreateSnapshot = async () => {
    try {
      const snapshot = await createSnapshot({ title, snapshotData });
      if (!snapshot) return;

      const shareUrl = `${window.location.origin}/shared/${snapshot.share_token}`;
      await copyToClipboard(shareUrl);
    } catch {
      // Error toast is handled in the hook.
    }
  };

  const handleRevokeSnapshot = async (snapshotId) => {
    try {
      await revokeSnapshot(snapshotId);
      toast({
        title: 'Partage désactivé',
        description: 'Le lien public a été révoqué.',
      });
    } catch {
      // Error toast is handled in the hook.
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={triggerClassName}>
          <Share2 className="w-4 h-4 mr-2" />
          Partager
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-orange-400" />
            Partage public
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <p className="text-sm text-gray-300">
              Créez un lien public figé pour partager ce tableau de bord sans ouvrir l’accès à l’application.
            </p>
            <Button
              onClick={handleCreateSnapshot}
              disabled={loading}
              className="mt-4 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
              Générer un lien
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Liens actifs</h3>
              <Badge variant="outline" className="border-gray-700 text-gray-300">
                {activeSnapshots.length}
              </Badge>
            </div>

            {activeSnapshots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-5 text-sm text-gray-500">
                Aucun lien partagé pour le moment.
              </div>
            ) : activeSnapshots.map((snapshot) => (
              <div key={snapshot.id} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{snapshot.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Créé le {formatDate(snapshot.created_at)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Expiration: {formatDate(snapshot.expires_at)}
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                    Public
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={snapshot.shareUrl}
                    className="bg-gray-950 border-gray-800 text-gray-200"
                  />
                  <Button
                    variant="outline"
                    className="border-gray-700 text-gray-300"
                    onClick={() => copyToClipboard(snapshot.shareUrl)}
                  >
                    {copiedUrl === snapshot.shareUrl ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-700/30 text-red-300 hover:bg-red-500/10"
                    onClick={() => handleRevokeSnapshot(snapshot.id)}
                  >
                    <ShieldOff className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SnapshotShareDialog;
