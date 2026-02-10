
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClients } from '@/hooks/useClients';
import { useInvoices } from '@/hooks/useInvoices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/calculations';
import { ArrowLeft, Mail, Phone, Globe, MapPin, FileText, CreditCard, Building2, Loader2 } from 'lucide-react';

const ClientProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, loading: clientsLoading } = useClients();
  const { invoices, loading: invoicesLoading } = useInvoices();

  const client = clients.find(c => c.id === id);
  const clientInvoices = invoices.filter(inv => inv.client_id === id);

  const totalRevenue = clientInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const pendingAmount = clientInvoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  if (clientsLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400 mb-4">Client introuvable.</p>
        <Button onClick={() => navigate('/clients')} className="bg-orange-500 hover:bg-orange-600">
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux clients
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/clients')} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient">{client.company_name}</h1>
          <p className="text-gray-400 text-sm">{client.contact_name}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800/50">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Chiffre d'affaires</p>
          <p className="text-2xl font-bold text-gradient">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800/50">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">En attente</p>
          <p className="text-2xl font-bold text-gradient">{formatCurrency(pendingAmount)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800/50">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Factures</p>
          <p className="text-2xl font-bold text-gradient">{clientInvoices.length}</p>
        </div>
      </div>

      {/* Info Cards */}
      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardContent className="space-y-6 pt-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Contact */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                <Mail className="h-3 w-3" /> Contact
              </h4>
              <div className="text-sm">
                <p className="font-medium text-gradient">{client.contact_name || 'N/A'}</p>
                <p className="flex items-center gap-2 text-gray-400 mt-1"><Mail className="h-3 w-3" /> {client.email || 'N/A'}</p>
                {client.phone && <p className="flex items-center gap-2 text-gray-400 mt-1"><Phone className="h-3 w-3" /> {client.phone}</p>}
                {client.website && (
                  <p className="flex items-center gap-2 text-gray-400 mt-1">
                    <Globe className="h-3 w-3" />
                    <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">{client.website}</a>
                  </p>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="h-3 w-3" /> Adresse
              </h4>
              <div className="text-sm text-gray-400">
                {client.address ? (
                  <>
                    <p>{client.address}</p>
                    {(client.postal_code || client.city) && <p>{client.postal_code} {client.city}</p>}
                    {client.country && <p>{client.country}</p>}
                  </>
                ) : (
                  <p>N/A</p>
                )}
              </div>
            </div>

            {/* Business Details */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-3 w-3" /> Détails commerciaux
              </h4>
              <div className="text-sm text-gray-400">
                <p>TVA: <span className="text-white">{client.vat_number || 'N/A'}</span></p>
                {client.tax_id && <p>SIRET: <span className="text-white">{client.tax_id}</span></p>}
                <p>Devise: <span className="text-white">{client.preferred_currency || 'EUR'}</span></p>
                {client.payment_terms && <p>Conditions: <span className="text-white capitalize">{client.payment_terms.replace('_', ' ')}</span></p>}
              </div>
            </div>
          </div>

          {/* Bank Details + Notes */}
          <div className="grid md:grid-cols-3 gap-6 pt-4 border-t border-gray-800">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="h-3 w-3" /> Coordonnées bancaires
              </h4>
              <div className="text-sm text-gray-400">
                {client.bank_name || client.iban ? (
                  <>
                    {client.bank_name && <p>Banque: <span className="text-white">{client.bank_name}</span></p>}
                    {client.iban && <p>IBAN: <span className="text-white font-mono text-xs">{client.iban}</span></p>}
                    {client.bic_swift && <p>BIC: <span className="text-white font-mono text-xs">{client.bic_swift}</span></p>}
                  </>
                ) : (
                  <p>Aucune donnée bancaire</p>
                )}
              </div>
            </div>
            {client.notes && (
              <div className="space-y-2 md:col-span-2">
                <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="h-3 w-3" /> Notes
                </h4>
                <p className="text-sm text-gray-400 whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
          <CardTitle className="text-gradient">Factures récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {clientInvoices.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune facture pour ce client.</p>
          ) : (
            <div className="space-y-3">
              {clientInvoices.slice(0, 10).map(inv => (
                <div key={inv.id} className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                  <div>
                    <p className="text-gradient font-medium text-sm">{inv.invoice_number}</p>
                    <p className="text-xs text-gray-500">
                      {inv.date ? new Date(inv.date).toLocaleDateString('fr-FR') : '—'}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <p className="text-gradient font-semibold text-sm">{formatCurrency(inv.total || 0)}</p>
                    <Badge className={`text-xs ${
                      inv.status === 'paid' ? 'bg-green-500/10 text-green-400' :
                      inv.status === 'sent' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientProfile;
