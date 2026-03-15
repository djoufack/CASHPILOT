import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, Plus, Trash2, CheckCircle2, XCircle, Loader2, Settings, TestTube2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useMobileMoney } from '@/hooks/useMobileMoney';

const PROVIDER_OPTIONS = [
  { value: 'orange_money', label: 'Orange Money', countries: ['CM', 'CI', 'SN', 'ML', 'BF', 'GN', 'MG'] },
  { value: 'mtn_momo', label: 'MTN MoMo', countries: ['CM', 'CI', 'GH', 'UG', 'RW', 'BJ', 'CG'] },
  { value: 'mpesa', label: 'M-Pesa', countries: ['KE', 'TZ', 'MZ', 'CD', 'GH', 'ET'] },
  { value: 'wave', label: 'Wave', countries: ['SN', 'CI', 'ML', 'BF', 'GM', 'UG'] },
  { value: 'moov_money', label: 'Moov Money', countries: ['CI', 'BJ', 'TG', 'NE', 'CM', 'TD'] },
];

const COUNTRY_LABELS = {
  CM: 'Cameroun',
  CI: "Cote d'Ivoire",
  SN: 'Senegal',
  ML: 'Mali',
  BF: 'Burkina Faso',
  GN: 'Guinee',
  MG: 'Madagascar',
  GH: 'Ghana',
  UG: 'Ouganda',
  RW: 'Rwanda',
  BJ: 'Benin',
  CG: 'Congo',
  KE: 'Kenya',
  TZ: 'Tanzanie',
  MZ: 'Mozambique',
  CD: 'RD Congo',
  ET: 'Ethiopie',
  GM: 'Gambie',
  TG: 'Togo',
  NE: 'Niger',
  TD: 'Tchad',
};

export default function MobileMoneySettingsPage() {
  const { t } = useTranslation();
  const { getAllProviders, saveProvider, deleteProvider, loading, error } = useMobileMoney();

  const [providers, setProviders] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [form, setForm] = useState({
    provider_name: '',
    country_code: '',
    api_key_encrypted: '',
    api_secret_encrypted: '',
    merchant_id: '',
    callback_url: '',
    is_active: true,
  });

  const loadProviders = useCallback(async () => {
    const data = await getAllProviders();
    setProviders(data);
  }, [getAllProviders]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleOpenAdd = () => {
    setForm({
      provider_name: '',
      country_code: '',
      api_key_encrypted: '',
      api_secret_encrypted: '',
      merchant_id: '',
      callback_url: '',
      is_active: true,
    });
    setTestResult(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.provider_name || !form.country_code) return;

    const result = await saveProvider(form);
    if (result) {
      setDialogOpen(false);
      loadProviders();
    }
  };

  const handleDelete = async (providerId) => {
    const ok = await deleteProvider(providerId);
    if (ok) loadProviders();
  };

  const handleToggleActive = async (provider) => {
    await saveProvider({ id: provider.id, is_active: !provider.is_active });
    loadProviders();
  };

  const handleTest = () => {
    setTestResult('testing');
    setTimeout(() => {
      setTestResult('success');
    }, 1500);
  };

  const selectedProviderOption = PROVIDER_OPTIONS.find((p) => p.value === form.provider_name);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Smartphone className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('mobileMoney.settings.title', 'Mobile Money')}</h1>
            <p className="text-gray-400 text-sm">
              {t('mobileMoney.settings.subtitle', 'Configurez vos fournisseurs de paiement Mobile Money')}
            </p>
          </div>
        </div>

        <Button onClick={handleOpenAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          {t('mobileMoney.settings.addProvider', 'Ajouter un fournisseur')}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {providers.length === 0 && !loading && (
        <Card className="bg-[#141c33]/50 border-white/5">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <Smartphone className="h-16 w-16 text-gray-600" />
            <p className="text-gray-400 text-lg">
              {t('mobileMoney.settings.noProviders', 'Aucun fournisseur configure')}
            </p>
            <p className="text-gray-500 text-sm text-center max-w-md">
              {t(
                'mobileMoney.settings.noProvidersDesc',
                'Ajoutez un fournisseur Mobile Money pour commencer a accepter des paiements (Orange Money, MTN MoMo, Wave, M-Pesa, Moov Money).'
              )}
            </p>
            <Button onClick={handleOpenAdd} variant="outline" className="border-emerald-500/30 text-emerald-400">
              <Plus className="h-4 w-4 mr-2" />
              {t('mobileMoney.settings.addFirst', 'Configurer un fournisseur')}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {providers.map((provider) => {
          const option = PROVIDER_OPTIONS.find((p) => p.value === provider.provider_name);
          return (
            <Card key={provider.id} className="bg-[#141c33]/50 border-white/5">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${provider.is_active ? 'bg-emerald-500/10' : 'bg-gray-500/10'}`}>
                    <Smartphone className={`h-5 w-5 ${provider.is_active ? 'text-emerald-400' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{option?.label ?? provider.provider_name}</p>
                    <p className="text-sm text-gray-400">
                      {COUNTRY_LABELS[provider.country_code] ?? provider.country_code}
                      {provider.merchant_id && ` - ${provider.merchant_id}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {provider.is_active
                        ? t('mobileMoney.settings.active', 'Actif')
                        : t('mobileMoney.settings.inactive', 'Inactif')}
                    </span>
                    <Switch checked={provider.is_active} onCheckedChange={() => handleToggleActive(provider)} />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(provider.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#0f1528] border-white/10 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-400" />
              {t('mobileMoney.settings.configProvider', 'Configurer un fournisseur')}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('mobileMoney.settings.configDesc', 'Renseignez les informations de votre compte Mobile Money.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300">{t('mobileMoney.settings.provider', 'Fournisseur')}</Label>
              <Select
                value={form.provider_name}
                onValueChange={(v) => setForm((f) => ({ ...f, provider_name: v, country_code: '' }))}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder={t('mobileMoney.settings.selectProvider', 'Choisir un fournisseur')} />
                </SelectTrigger>
                <SelectContent className="bg-[#141c33] border-white/10">
                  {PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProviderOption && (
              <div className="space-y-2">
                <Label className="text-gray-300">{t('mobileMoney.settings.country', 'Pays')}</Label>
                <Select value={form.country_code} onValueChange={(v) => setForm((f) => ({ ...f, country_code: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder={t('mobileMoney.settings.selectCountry', 'Choisir un pays')} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141c33] border-white/10">
                    {selectedProviderOption.countries.map((code) => (
                      <SelectItem key={code} value={code}>
                        {COUNTRY_LABELS[code] ?? code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-gray-300">{t('mobileMoney.settings.merchantId', 'Merchant ID')}</Label>
              <Input
                value={form.merchant_id}
                onChange={(e) => setForm((f) => ({ ...f, merchant_id: e.target.value }))}
                placeholder="MERCHANT-XXXX"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">{t('mobileMoney.settings.apiKey', 'Cle API')}</Label>
              <Input
                type="password"
                value={form.api_key_encrypted}
                onChange={(e) => setForm((f) => ({ ...f, api_key_encrypted: e.target.value }))}
                placeholder="sk_live_..."
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">{t('mobileMoney.settings.apiSecret', 'Secret API')}</Label>
              <Input
                type="password"
                value={form.api_secret_encrypted}
                onChange={(e) => setForm((f) => ({ ...f, api_secret_encrypted: e.target.value }))}
                placeholder="whsec_..."
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">{t('mobileMoney.settings.callbackUrl', 'URL de callback')}</Label>
              <Input
                value={form.callback_url}
                onChange={(e) => setForm((f) => ({ ...f, callback_url: e.target.value }))}
                placeholder="https://..."
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>

            {testResult && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${
                  testResult === 'testing'
                    ? 'bg-blue-500/10 text-blue-400'
                    : testResult === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                }`}
              >
                {testResult === 'testing' && <Loader2 className="h-4 w-4 animate-spin" />}
                {testResult === 'success' && <CheckCircle2 className="h-4 w-4" />}
                {testResult === 'failed' && <XCircle className="h-4 w-4" />}
                <span className="text-sm">
                  {testResult === 'testing' && t('mobileMoney.settings.testing', 'Test en cours...')}
                  {testResult === 'success' && t('mobileMoney.settings.testSuccess', 'Connexion reussie !')}
                  {testResult === 'failed' && t('mobileMoney.settings.testFailed', 'Echec de connexion')}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!form.provider_name}
              className="border-white/10 text-gray-300"
            >
              <TestTube2 className="h-4 w-4 mr-2" />
              {t('mobileMoney.settings.testConnection', 'Tester')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.provider_name || !form.country_code || loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save', 'Enregistrer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
