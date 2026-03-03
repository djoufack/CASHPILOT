import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('invoice');

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-[#0f1528] border-white/10 text-white">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="h-7 w-7 text-green-400" />
          </div>
          <CardTitle className="text-2xl text-white">Paiement confirmé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-gray-300">
            Votre paiement a bien ete pris en compte.
          </p>
          {invoiceId && (
            <p className="text-sm text-gray-500 font-mono">
              Facture: {invoiceId}
            </p>
          )}
          <p className="text-sm text-gray-500">
            Vous pouvez fermer cette page en toute securite.
          </p>
          <div className="pt-2">
            <Button asChild variant="outline" className="border-white/15 text-white hover:bg-white/5">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour a l'accueil
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
