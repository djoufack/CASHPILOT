import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import SignaturePad from '@/components/SignaturePad';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function QuoteSignPage() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [signatureData, setSignatureData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // 'signed' | 'rejected'

  useEffect(() => {
    if (!token) return;
    fetchQuote();
  }, [token]);

  const fetchQuote = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('quotes')
        .select('*, clients(company_name, contact_name, email)')
        .eq('signature_token', token)
        .eq('signature_status', 'pending')
        .gt('signature_token_expires_at', new Date().toISOString())
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) setError('Ce lien de signature est invalide ou a expiré.');
      else setQuote(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!signatureData || !signerName.trim()) return;
    setSubmitting(true);
    try {
      const { error: submitError } = await supabase.functions.invoke('quote-sign-submit', {
        body: {
          token,
          signerName: signerName.trim(),
          signatureDataUrl: signatureData,
          action: 'sign',
        },
      });

      if (submitError) throw submitError;
      setDone('signed');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      const { error: submitError } = await supabase.functions.invoke('quote-sign-submit', {
        body: {
          token,
          action: 'reject',
        },
      });

      if (submitError) throw submitError;
      setDone('rejected');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center text-white">
        Chargement...
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <Card className="bg-[#0f1528] border-white/10 text-white max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-red-400">{error || 'Lien invalide ou expiré.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done === 'signed') {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <Card className="bg-[#0f1528] border-white/10 text-white max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-2xl">✅</p>
            <p className="text-green-400 font-semibold">Devis signé avec succès !</p>
            <p className="text-gray-400 text-sm">Merci, {signerName}. Votre signature a été enregistrée.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done === 'rejected') {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <Card className="bg-[#0f1528] border-white/10 text-white max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-2xl">❌</p>
            <p className="text-red-400 font-semibold">Devis refusé</p>
            <p className="text-gray-400 text-sm">Vous avez refusé ce devis.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Signature du devis</h1>
          <p className="text-gray-400 mt-1">Devis N° {quote.quote_number}</p>
        </div>

        <Card className="bg-[#0f1528] border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-lg">Récapitulatif</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Client</span>
              <span>{quote.clients?.company_name || quote.clients?.contact_name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Montant HT</span>
              <span>{(quote.total_ht || 0).toLocaleString('fr-FR')} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">TVA</span>
              <span>{(quote.tax_amount || 0).toLocaleString('fr-FR')} €</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-gray-300">Total TTC</span>
              <span className="text-white">{(quote.total_ttc || 0).toLocaleString('fr-FR')} €</span>
            </div>
            {quote.notes && (
              <div className="pt-2 border-t border-white/10">
                <p className="text-gray-400 text-xs">Notes : {quote.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#0f1528] border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-lg">Votre signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signerName">Votre nom complet *</Label>
              <Input
                id="signerName"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Prénom Nom"
                className="bg-white/5 border-white/20 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label>Signature *</Label>
              <SignaturePad
                onSave={(data) => setSignatureData(data)}
                onClear={() => setSignatureData(null)}
              />
              {signatureData && (
                <p className="text-green-400 text-xs">✓ Signature capturée</p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                onClick={handleReject}
                disabled={submitting}
              >
                Refuser le devis
              </Button>
              <Button
                className="flex-1"
                onClick={handleSign}
                disabled={submitting || !signatureData || !signerName.trim()}
              >
                {submitting ? 'Envoi...' : 'Signer et accepter'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
