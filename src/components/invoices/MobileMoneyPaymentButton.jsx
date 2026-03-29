import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, ChevronDown, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { formatNumber } from '@/utils/dateLocale';
import { Label } from '@/components/ui/label';
import { useMobileMoney } from '@/hooks/useMobileMoney';

const PROVIDER_LABELS = {
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  mpesa: 'M-Pesa',
  wave: 'Wave',
  moov_money: 'Moov Money',
};

const PROVIDER_COLORS = {
  orange_money: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  mtn_momo: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  mpesa: 'bg-green-500/20 text-green-400 border-green-500/30',
  wave: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  moov_money: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

export default function MobileMoneyPaymentButton({ invoiceId, amount, currency = 'XAF', onPaymentComplete }) {
  const { t } = useTranslation();
  const { initiatePayment, getProviders, loading } = useMobileMoney();

  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null); // null | 'processing' | 'success' | 'failed'

  useEffect(() => {
    getProviders().then(setProviders);
  }, [getProviders]);

  const handleSelectProvider = (providerName) => {
    setSelectedProvider(providerName);
    setPaymentStatus(null);
    setPhoneNumber('');
    setDialogOpen(true);
  };

  const handlePay = async () => {
    if (!phoneNumber.trim() || !selectedProvider) return;

    setPaymentStatus('processing');

    const result = await initiatePayment(invoiceId, selectedProvider, phoneNumber, amount, currency);

    if (result?.status === 'completed') {
      setPaymentStatus('success');
      onPaymentComplete?.(result);
    } else {
      setPaymentStatus('failed');
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setPaymentStatus(null);
    setPhoneNumber('');
    setSelectedProvider(null);
  };

  const availableProviders =
    providers.length > 0 ? providers.map((p) => p.provider_name) : Object.keys(PROVIDER_LABELS);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
            <Smartphone className="h-4 w-4 mr-2" />
            {t('mobileMoney.payButton', 'Payer par Mobile Money')}
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#141c33] border-white/10">
          {availableProviders.map((provider) => (
            <DropdownMenuItem
              key={provider}
              onClick={() => handleSelectProvider(provider)}
              className="cursor-pointer hover:bg-white/5"
            >
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${PROVIDER_COLORS[provider] ?? ''}`}
              >
                {PROVIDER_LABELS[provider] ?? provider}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#0f1528] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {t('mobileMoney.payWith', 'Payer avec')} {PROVIDER_LABELS[selectedProvider] ?? selectedProvider}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('mobileMoney.enterPhone', 'Saisissez le numero de telephone pour effectuer le paiement.')}
            </DialogDescription>
          </DialogHeader>

          {paymentStatus === null && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-lg">
                <span className="text-gray-400">{t('mobileMoney.amount', 'Montant')}</span>
                <span className="text-xl font-bold text-white">
                  {formatNumber(amount)} {currency}
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-gray-300">
                  {t('mobileMoney.phoneNumber', 'Numero de telephone')}
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+237 6XX XXX XXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
              </div>
            </div>
          )}

          {paymentStatus === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 text-emerald-400 animate-spin" />
              <p className="text-gray-300">{t('mobileMoney.processing', 'Traitement en cours...')}</p>
              <p className="text-sm text-gray-500">{t('mobileMoney.waitConfirm', 'Confirmez sur votre telephone')}</p>
            </div>
          )}

          {paymentStatus === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <p className="text-lg font-semibold text-emerald-400">{t('mobileMoney.success', 'Paiement reussi !')}</p>
              <p className="text-sm text-gray-400">
                {t('mobileMoney.successDesc', 'Le paiement a ete traite avec succes.')}
              </p>
            </div>
          )}

          {paymentStatus === 'failed' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <XCircle className="h-12 w-12 text-red-400" />
              <p className="text-lg font-semibold text-red-400">{t('mobileMoney.failed', 'Paiement echoue')}</p>
              <p className="text-sm text-gray-400">
                {t('mobileMoney.failedDesc', "Le paiement n'a pas pu etre traite. Veuillez reessayer.")}
              </p>
            </div>
          )}

          <DialogFooter>
            {paymentStatus === null && (
              <Button
                onClick={handlePay}
                disabled={!phoneNumber.trim() || loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
                {t('mobileMoney.confirmPay', 'Confirmer le paiement')}
              </Button>
            )}
            {(paymentStatus === 'success' || paymentStatus === 'failed') && (
              <Button onClick={handleClose} variant="outline" className="w-full border-white/10 text-gray-300">
                {t('common.close', 'Fermer')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
