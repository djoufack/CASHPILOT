import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Smartphone, Loader2, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatNumber } from '@/utils/dateLocale';

const PROVIDER_LABELS = {
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  mpesa: 'M-Pesa',
  wave: 'Wave',
  moov_money: 'Moov Money',
};

const PROVIDER_COLORS = {
  orange_money: { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', ring: 'ring-orange-400' },
  mtn_momo: { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', ring: 'ring-yellow-400' },
  mpesa: { bg: 'bg-green-600', hover: 'hover:bg-green-700', ring: 'ring-green-400' },
  wave: { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', ring: 'ring-blue-400' },
  moov_money: { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', ring: 'ring-purple-400' },
};

export default function MobileMoneyPayPage() {
  const { token } = useParams();

  const [paymentLink, setPaymentLink] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const [selectedProvider, setSelectedProvider] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState(null); // null | 'processing' | 'success' | 'failed'
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadPaymentLink() {
      if (!token) {
        setPageError('Lien de paiement invalide.');
        setPageLoading(false);
        return;
      }

      const { data, error } = await supabase.from('mobile_payment_links').select('*').eq('token', token).single();

      if (error || !data) {
        setPageError('Lien de paiement introuvable ou expire.');
        setPageLoading(false);
        return;
      }

      if (data.is_used) {
        setPageError('Ce lien de paiement a deja ete utilise.');
        setPageLoading(false);
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setPageError('Ce lien de paiement a expire.');
        setPageLoading(false);
        return;
      }

      setPaymentLink(data);
      setPageLoading(false);
    }

    loadPaymentLink();
  }, [token]);

  const handlePay = async () => {
    if (!selectedProvider || !phoneNumber.trim() || !paymentLink) return;

    setSubmitting(true);
    setPaymentStatus('processing');

    try {
      // Call a public-facing edge function or simulate payment
      // For simulation, we create a transaction via the service role
      const res = await supabase.functions.invoke('mobile-money-payment', {
        body: {
          invoice_id: paymentLink.invoice_id,
          provider: selectedProvider,
          phone_number: phoneNumber,
          amount: paymentLink.amount,
          currency: paymentLink.currency,
          company_id: paymentLink.company_id,
          payment_link_token: token,
        },
      });

      if (res.error) {
        setPaymentStatus('failed');
      } else if (res.data?.status === 'completed') {
        setPaymentStatus('success');
        // Mark payment link as used
        await supabase.from('mobile_payment_links').update({ is_used: true }).eq('token', token);
      } else {
        setPaymentStatus('failed');
      }
    } catch {
      setPaymentStatus('failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1528] to-[#141c33] flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────
  if (pageError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1528] to-[#141c33] flex items-center justify-center px-4">
        <div className="bg-[#141c33]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <XCircle className="h-16 w-16 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-white">Lien invalide</h1>
          <p className="text-gray-400">{pageError}</p>
        </div>
      </div>
    );
  }

  const providers = paymentLink.providers_available ?? Object.keys(PROVIDER_LABELS);
  const formattedAmount = `${formatNumber(paymentLink.amount) ?? '0'} ${paymentLink.currency ?? 'XAF'}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1528] to-[#141c33] flex items-center justify-center px-4 py-8">
      <div className="bg-[#141c33]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-500/10 mb-2">
            <Smartphone className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Paiement Mobile Money</h1>
          <p className="text-gray-400 text-sm">Paiement securise via Mobile Money</p>
        </div>

        {/* Amount */}
        <div className="bg-white/5 rounded-xl p-6 text-center border border-white/5">
          <p className="text-gray-400 text-sm mb-1">Montant a payer</p>
          <p className="text-4xl font-bold text-white">{formattedAmount}</p>
        </div>

        {paymentStatus === null && (
          <>
            {/* Provider selection */}
            <div className="space-y-3">
              <p className="text-sm text-gray-300 font-medium">Choisissez votre moyen de paiement</p>
              <div className="grid gap-2">
                {providers.map((provider) => {
                  const colors = PROVIDER_COLORS[provider] ?? {
                    bg: 'bg-gray-500',
                    hover: 'hover:bg-gray-600',
                    ring: 'ring-gray-400',
                  };
                  const isSelected = selectedProvider === provider;
                  return (
                    <button
                      key={provider}
                      onClick={() => setSelectedProvider(provider)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                        isSelected
                          ? `border-emerald-400/50 bg-emerald-500/10 ring-2 ${colors.ring}/30`
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${colors.bg}`} />
                      <span className="text-white font-medium">{PROVIDER_LABELS[provider] ?? provider}</span>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-emerald-400 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Phone number */}
            {selectedProvider && (
              <div className="space-y-2">
                <label htmlFor="pay-phone" className="text-sm text-gray-300 font-medium">
                  Numero de telephone
                </label>
                <input
                  id="pay-phone"
                  type="tel"
                  placeholder="+237 6XX XXX XXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50"
                />
              </div>
            )}

            {/* Pay button */}
            <button
              onClick={handlePay}
              disabled={!selectedProvider || !phoneNumber.trim() || submitting}
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-lg transition-colors flex items-center justify-center gap-2"
            >
              <Smartphone className="h-5 w-5" />
              Payer {formattedAmount}
            </button>
          </>
        )}

        {paymentStatus === 'processing' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-16 w-16 text-emerald-400 animate-spin" />
            <p className="text-white text-lg font-semibold">Traitement en cours...</p>
            <p className="text-gray-400 text-sm text-center">Veuillez confirmer le paiement sur votre telephone.</p>
          </div>
        )}

        {paymentStatus === 'success' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-400" />
            <p className="text-white text-lg font-semibold">Paiement reussi !</p>
            <p className="text-gray-400 text-sm text-center">
              Votre paiement de {formattedAmount} a ete traite avec succes. Merci !
            </p>
          </div>
        )}

        {paymentStatus === 'failed' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <XCircle className="h-16 w-16 text-red-400" />
            <p className="text-white text-lg font-semibold">Paiement echoue</p>
            <p className="text-gray-400 text-sm text-center">Le paiement n'a pas pu etre traite. Veuillez reessayer.</p>
            <button
              onClick={() => setPaymentStatus(null)}
              className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              Reessayer
            </button>
          </div>
        )}

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-gray-500 text-xs pt-2">
          <ShieldCheck className="h-4 w-4" />
          <span>Paiement securise par CashPilot</span>
        </div>
      </div>
    </div>
  );
}
