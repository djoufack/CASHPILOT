
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBillingSettings } from '@/hooks/useBillingSettings';
import { useSubscription } from '@/hooks/useSubscription';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ResponsiveTable from '@/components/ui/ResponsiveTable';
import { CreditCard, Download, Trash2, Check, Plus, ExternalLink, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';

const BillingSettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { billingInfo, paymentMethods, invoices, loading, updateBilling, addPaymentMethod, deletePaymentMethod, setDefaultPaymentMethod } = useBillingSettings();
  const { currentPlan, subscriptionStatus, subscriptionCredits, currentPeriodEnd, daysRemaining } = useSubscription();
  const { trialActive, trialEndsAt, fullAccessOverride, accessLabel } = useEntitlements();
  const [formData, setFormData] = useState({});

  useEffect(() => {
    setFormData(billingInfo);
  }, [billingInfo]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveBilling = (e) => {
    e.preventDefault();
    updateBilling(formData);
  };

  const formatPlanPrice = (priceCents) => {
    if (!priceCents) return '0 €';
    return `${(priceCents / 100).toFixed(2)} €`;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Subscription Info */}
        <Card className="bg-gray-900 border-gray-800 text-white">
          <CardHeader>
            <CardTitle>{t('billing.currentPlan')}</CardTitle>
            <CardDescription className="text-gray-400">{t('billing.managePlan')}</CardDescription>
          </CardHeader>
          <CardContent>
            {fullAccessOverride ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-cyan-300" />
                    <h3 className="text-xl font-bold text-cyan-200">{accessLabel || 'Acces illimite'}</h3>
                  </div>
                  <p className="mt-2 text-sm text-cyan-100/80">
                    Tous les services CashPilot sont actifs sans limitation de temps, de duree ou de credits.
                  </p>
                </div>
              </div>
            ) : currentPlan && subscriptionStatus === 'active' ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                   <div>
                      <div className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-orange-400" />
                        <h3 className="text-2xl font-bold text-gradient">{currentPlan.name}</h3>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">
                        {t('billing.renewsOn')}: {currentPeriodEnd ? format(new Date(currentPeriodEnd), 'dd/MM/yyyy') : '-'}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {daysRemaining} {t('billing.daysRemaining')}
                      </p>
                   </div>
                   <div className="text-right">
                      <div className="text-2xl font-bold text-gradient">
                        {formatPlanPrice(currentPlan.price_cents)}
                        <span className="text-sm text-gray-400 font-normal">/{t('pricing.month')}</span>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border-none mt-1">
                        {t('billing.active')}
                      </Badge>
                   </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-sm text-gray-400">{t('subscription.subCredits')}</p>
                  <p className="text-xl font-bold text-orange-400">{subscriptionCredits} / {currentPlan.credits_per_month}</p>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => navigate('/pricing')} className="flex-1 bg-orange-500 hover:bg-orange-600">
                    {t('billing.changePlan')}
                  </Button>
                </div>
              </div>
            ) : trialActive ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-xl font-bold text-emerald-300">Essai complet</h3>
                  </div>
                  <p className="mt-2 text-sm text-emerald-100/80">
                    Tous les services sont actifs jusqu’au {trialEndsAt ? format(new Date(trialEndsAt), 'dd/MM/yyyy') : '-'}.
                  </p>
                  <p className="mt-1 text-xs text-emerald-200/70">
                    À la fin de l’essai, le compte repassera sur le plan gratuit si aucun abonnement payant n’est actif.
                  </p>
                </div>
                <Button onClick={() => navigate('/pricing')} className="w-full bg-orange-500 hover:bg-orange-600">
                  Choisir un abonnement
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-400 mb-4">{t('billing.noPlan')}</p>
                <Button onClick={() => navigate('/pricing')} className="bg-orange-500 hover:bg-orange-600">
                  {t('billing.viewPlans')}
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="bg-gray-900 border-gray-800 text-white">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                 <CardTitle>{t('billing.paymentMethods')}</CardTitle>
                 <CardDescription className="text-gray-400">{t('billing.manageCards')}</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="border-gray-700"><Plus size={16} className="mr-2"/> {t('billing.addCard')}</Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-900 border-gray-800 text-white">
                  <DialogHeader><DialogTitle>{t('billing.addNewCard')}</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                     <div className="space-y-2">
                        <Label>{t('billing.cardNumber')}</Label>
                        <Input placeholder="0000 0000 0000 0000" className="bg-gray-800 border-gray-700"/>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <Label>{t('billing.expiry')}</Label>
                           <Input placeholder="MM/YY" className="bg-gray-800 border-gray-700"/>
                        </div>
                        <div className="space-y-2">
                           <Label>CVC</Label>
                           <Input placeholder="123" className="bg-gray-800 border-gray-700"/>
                        </div>
                     </div>
                     <Button onClick={() => addPaymentMethod({ number: '4242' })} className="w-full bg-blue-600">{t('billing.saveCard')}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
             <div className="space-y-3">
                {paymentMethods.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">{t('billing.noPaymentMethods')}</p>
                )}
                {paymentMethods.map(method => (
                  <div key={method.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-800 bg-gray-900/50">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-800 rounded">
                           <CreditCard size={20} className="text-gray-400"/>
                        </div>
                        <div>
                           <p className="font-medium text-sm text-gradient">{method.brand} ending in {method.last4}</p>
                           <p className="text-xs text-gray-500">Expires {method.exp_month}/{method.exp_year}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        {method.is_default && <Badge variant="secondary" className="bg-orange-900/30 text-orange-400 text-[10px]">Default</Badge>}
                        {!method.is_default && (
                           <Button size="icon" variant="ghost" onClick={() => setDefaultPaymentMethod(method.id)} title="Set Default">
                              <Check size={16} className="text-gray-500 hover:text-green-500"/>
                           </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => deletePaymentMethod(method.id)}>
                           <Trash2 size={16} className="text-gray-500 hover:text-red-500"/>
                        </Button>
                     </div>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Billing Details Form */}
      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
           <CardTitle>{t('billing.billingInfo')}</CardTitle>
           <CardDescription className="text-gray-400">{t('billing.billingInfoDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
           <form onSubmit={handleSaveBilling} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <Label>{t('billing.companyName')}</Label>
                 <Input name="company_name" value={formData.company_name || ''} onChange={handleChange} className="bg-gray-800 border-gray-700 text-white" required />
              </div>
              <div className="space-y-2">
                 <Label>{t('billing.vatNumber')}</Label>
                 <Input name="vat_number" value={formData.vat_number || ''} onChange={handleChange} className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-2 md:col-span-2">
                 <Label>{t('billing.address')}</Label>
                 <Input name="address" value={formData.address || ''} onChange={handleChange} className="bg-gray-800 border-gray-700 text-white" required />
              </div>
              <div className="space-y-2">
                 <Label>{t('billing.city')}</Label>
                 <Input name="city" value={formData.city || ''} onChange={handleChange} className="bg-gray-800 border-gray-700 text-white" required />
              </div>
              <div className="space-y-2">
                 <Label>{t('billing.postalCode')}</Label>
                 <Input name="postal_code" value={formData.postal_code || ''} onChange={handleChange} className="bg-gray-800 border-gray-700 text-white" required />
              </div>
              <div className="md:col-span-2 flex justify-end">
                 <Button type="submit" className="bg-orange-500 hover:bg-orange-600">{t('billing.saveBilling')}</Button>
              </div>
           </form>
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
           <CardTitle>{t('billing.invoiceHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
           <ResponsiveTable
             data={invoices}
             columns={[
               { header: 'Date', accessor: 'date' },
               { header: 'Amount', accessor: (inv) => <span className="text-gradient font-medium">{Number(inv.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span> },
               { header: 'Status', accessor: (inv) => (
                 <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 capitalize">{inv.status}</Badge>
               )},
               { header: 'Action', accessor: () => (
                 <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                   <Download size={16} className="text-gray-400 hover:text-white" />
                 </Button>
               ), className: 'text-right' }
             ]}
             renderCard={(inv) => (
               <Card className="bg-gray-800 border-gray-700">
                 <CardContent className="p-4">
                   <div className="flex justify-between items-center">
                     <div>
                       <p className="text-gray-400 text-sm">{inv.date}</p>
                       <p className="text-gradient font-bold text-lg mt-1">{Number(inv.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
                     </div>
                     <div className="flex items-center gap-2">
                       <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 capitalize">{inv.status}</Badge>
                       <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                         <Download size={16} className="text-gray-400" />
                       </Button>
                     </div>
                   </div>
                 </CardContent>
               </Card>
             )}
             loading={loading}
             emptyMessage={t('billing.noInvoices')}
           />
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingSettings;
