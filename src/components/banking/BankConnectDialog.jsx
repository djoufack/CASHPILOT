import { useState, useMemo } from 'react';
import { Building2, Globe, Loader2, Plus, Search, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function BankConnectDialog({ open, onOpenChange, providers, onConnect, loading }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [connectingId, setConnectingId] = useState(null);

  const filteredProviders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return providers || [];
    return (providers || []).filter((p) => {
      const haystack = `${p.name} ${p.api_type} ${(p.supported_countries || []).join(' ')}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [providers, search]);

  const handleConnect = async (provider) => {
    if (!onConnect) return;
    setConnectingId(provider.id);
    try {
      await onConnect(provider.id);
    } finally {
      setConnectingId(null);
    }
  };

  const handleOpenChange = (open) => {
    if (!open) {
      setSearch('');
      setConnectingId(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-gray-800 bg-gray-950 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            {t('banking.connectDialogTitle')}
          </DialogTitle>
          <DialogDescription className="text-gray-400">{t('banking.connectDialogDescription')}</DialogDescription>
        </DialogHeader>

        {/* PSD2/PSD3 compliance notice */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
          <div className="text-xs text-gray-400">
            <p className="font-medium text-blue-300">{t('banking.psd2Notice')}</p>
            <p className="mt-1">{t('banking.psd2Description')}</p>
          </div>
        </div>

        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="provider-search">{t('banking.searchProvider')}</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              id="provider-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('banking.searchProviderPlaceholder')}
              className="border-gray-700 bg-gray-900 pl-10 text-white"
            />
          </div>
        </div>

        {/* Provider list */}
        <div className="max-h-[380px] overflow-y-auto rounded-xl border border-gray-800 bg-gray-900/50">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" />
              <p className="mt-2 text-sm text-gray-400">{t('banking.loadingProviders')}</p>
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">{t('banking.noProviderFound')}</div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-800">
                      {provider.logo_url ? (
                        <img src={provider.logo_url} alt={provider.name} className="h-full w-full object-contain p-1" />
                      ) : (
                        <Building2 className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{provider.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1 rounded bg-gray-800 px-1.5 py-0.5">
                          {provider.api_type.toUpperCase()}
                        </span>
                        {provider.supported_countries?.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {provider.supported_countries.slice(0, 5).join(', ')}
                            {provider.supported_countries.length > 5 && ` +${provider.supported_countries.length - 5}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleConnect(provider)}
                    disabled={Boolean(connectingId)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {connectingId === provider.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    {t('banking.connectProvider')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
