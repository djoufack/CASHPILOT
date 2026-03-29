import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Loader2, CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatNumber } from '@/utils/dateLocale';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useWhatsApp } from '@/hooks/useWhatsApp';

export default function WhatsAppSendButton({
  invoiceId,
  invoiceNumber,
  clientName,
  clientPhone,
  amount,
  currency = 'XAF',
}) {
  const { t } = useTranslation();
  const { sendInvoice, loading } = useWhatsApp();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(clientPhone ?? '');
  const [sendStatus, setSendStatus] = useState(null); // null | 'sending' | 'sent'
  const [preview, setPreview] = useState('');

  const handleOpen = () => {
    setPhoneNumber(clientPhone ?? '');
    setSendStatus(null);

    const formattedAmount = `${formatNumber(amount) ?? '0'} ${currency}`;
    setPreview(
      `Bonjour ${clientName ?? 'Client'},\n\n` +
        `Veuillez trouver ci-dessous les details de votre facture :\n` +
        `- Numero : ${invoiceNumber}\n` +
        `- Montant : ${formattedAmount}\n\n` +
        `Un lien de paiement Mobile Money sera inclus.\n\n` +
        `Merci de votre confiance.`
    );

    setDialogOpen(true);
  };

  const handleSend = async () => {
    if (!phoneNumber.trim()) return;
    setSendStatus('sending');

    const result = await sendInvoice(invoiceId, phoneNumber);

    if (result) {
      setSendStatus('sent');
    } else {
      setSendStatus(null);
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setSendStatus(null);
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="outline"
        className="border-green-500/30 text-green-400 hover:bg-green-500/10"
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        {t('whatsapp.sendButton', 'Envoyer par WhatsApp')}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#0f1528] border-white/10 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-400" />
              {t('whatsapp.sendInvoice', 'Envoyer la facture par WhatsApp')}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('whatsapp.sendDesc', 'Envoyez la facture avec un lien de paiement Mobile Money.')}
            </DialogDescription>
          </DialogHeader>

          {sendStatus !== 'sent' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="wa-phone" className="text-gray-300">
                  {t('whatsapp.phoneNumber', 'Numero WhatsApp')}
                </Label>
                <Input
                  id="wa-phone"
                  type="tel"
                  placeholder="+237 6XX XXX XXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">{t('whatsapp.preview', 'Apercu du message')}</Label>
                <Textarea
                  value={preview}
                  readOnly
                  rows={8}
                  className="bg-white/5 border-white/10 text-gray-300 text-sm resize-none"
                />
              </div>
            </div>
          )}

          {sendStatus === 'sent' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-400" />
              <p className="text-lg font-semibold text-green-400">{t('whatsapp.sent', 'Message envoye !')}</p>
              <p className="text-sm text-gray-400">
                {t('whatsapp.sentDesc', 'La facture a ete envoyee avec un lien de paiement.')}
              </p>
            </div>
          )}

          <DialogFooter>
            {sendStatus !== 'sent' ? (
              <Button
                onClick={handleSend}
                disabled={!phoneNumber.trim() || loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {t('whatsapp.send', 'Envoyer')}
              </Button>
            ) : (
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
