import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getLocale } from '@/utils/dateLocale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  ArrowLeft,
  CreditCard,
  FileText,
  Wrench,
  Package,
  Receipt,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import SupplierServices from '@/components/suppliers/SupplierServices';
import SupplierProducts from '@/components/suppliers/SupplierProducts';
import SupplierInvoices from '@/components/suppliers/SupplierInvoices';

const EMPTY_OVERVIEW = {
  servicesCount: 0,
  productsCount: 0,
  invoicesCount: 0,
  pendingInvoices: 0,
  overdueInvoices: 0,
  totalSpend: 0,
  lowStockProducts: 0,
  outOfStockProducts: 0,
};

const SupplierProfile = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { getSupplierById } = useSuppliers();
  const { applyCompanyScope } = useCompanyScope();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [tabInitialized, setTabInitialized] = useState(false);
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [overviewLoading, setOverviewLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      const data = await getSupplierById(id);
      if (cancelled) return;
      setSupplier(data);
      setLoading(false);
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, [getSupplierById, id]);

  useEffect(() => {
    setActiveTab('overview');
    setTabInitialized(false);
  }, [id]);

  useEffect(() => {
    const fetchOverview = async () => {
      if (!id) return;
      setOverviewLoading(true);
      try {
        let servicesQuery = supabase.from('supplier_services').select('id, created_at').eq('supplier_id', id);
        servicesQuery = applyCompanyScope(servicesQuery);

        let productsQuery = supabase
          .from('supplier_products')
          .select('id, stock_quantity, min_stock_level, created_at')
          .eq('supplier_id', id);
        productsQuery = applyCompanyScope(productsQuery);

        let invoicesQuery = supabase
          .from('supplier_invoices')
          .select('id, total_amount, due_date, payment_status, created_at')
          .eq('supplier_id', id);
        invoicesQuery = applyCompanyScope(invoicesQuery);

        const [
          { data: servicesData, error: servicesError },
          { data: productsData, error: productsError },
          { data: invoicesData, error: invoicesError },
        ] = await Promise.all([servicesQuery, productsQuery, invoicesQuery]);

        if (servicesError) throw servicesError;
        if (productsError) throw productsError;
        if (invoicesError) throw invoicesError;

        const safeServices = servicesData || [];
        const safeProducts = productsData || [];
        const safeInvoices = invoicesData || [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const overdueInvoices = safeInvoices.filter((invoice) => {
          if (!invoice.due_date || invoice.payment_status === 'paid') return false;
          const due = new Date(invoice.due_date);
          due.setHours(0, 0, 0, 0);
          return due < today;
        }).length;

        const lowStockProducts = safeProducts.filter((product) => {
          const stock = Number(product.stock_quantity || 0);
          const min = Number(product.min_stock_level || 0);
          return stock > 0 && stock <= min;
        }).length;

        const outOfStockProducts = safeProducts.filter((product) => Number(product.stock_quantity || 0) <= 0).length;

        setOverview({
          servicesCount: safeServices.length,
          productsCount: safeProducts.length,
          invoicesCount: safeInvoices.length,
          pendingInvoices: safeInvoices.filter((invoice) => (invoice.payment_status || 'pending') === 'pending').length,
          overdueInvoices,
          totalSpend: safeInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0),
          lowStockProducts,
          outOfStockProducts,
        });
      } catch (error) {
        console.error('Failed to fetch supplier overview:', error);
        setOverview(EMPTY_OVERVIEW);
      } finally {
        setOverviewLoading(false);
      }
    };

    fetchOverview();
  }, [applyCompanyScope, id]);

  useEffect(() => {
    if (!supplier || tabInitialized) return;
    if (supplier.supplier_type === 'service') setActiveTab('services');
    if (supplier.supplier_type === 'product') setActiveTab('products');
    if (supplier.supplier_type === 'both') setActiveTab('overview');
    setTabInitialized(true);
  }, [supplier, tabInitialized]);

  const hasAnyData = useMemo(
    () => overview.servicesCount + overview.productsCount + overview.invoicesCount > 0,
    [overview]
  );

  if (loading) return <div className="p-8 text-white">{t('loading.page', 'Loading...')}</div>;
  if (!supplier) return <div className="p-8 text-white">{t('supplierProfile.notFound', 'Supplier not found')}</div>;

  return (
    <div className="p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <Helmet>
        <title>{supplier.company_name || t('supplierProfile.title', 'Supplier Profile')} | CashPilot</title>
      </Helmet>
      <Link to="/app/suppliers">
        <Button variant="ghost" className="mb-4 pl-0 text-gray-400 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('supplierProfile.backToSuppliers', 'Back to Suppliers')}
        </Button>
      </Link>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl text-gradient mb-2">{supplier.company_name}</CardTitle>
              <CardDescription className="text-gray-400 flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {supplier.city}, {supplier.country}
                </span>
                {supplier.website && (
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" /> {supplier.website}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">Status</div>
              <span
                className={`px-2 py-1 rounded text-xs uppercase font-bold ${supplier.status === 'active' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}
              >
                {supplier.status}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                <Mail className="h-3 w-3" /> {t('supplierProfile.contact', 'Contact')}
              </h4>
              <div className="text-sm">
                <p className="font-medium text-gradient">{supplier.contact_person || 'N/A'}</p>
                <p className="flex items-center gap-2 text-gray-400 mt-1">
                  <Mail className="h-3 w-3" /> {supplier.email || 'N/A'}
                </p>
                <p className="flex items-center gap-2 text-gray-400 mt-1">
                  <Phone className="h-3 w-3" /> {supplier.phone || 'N/A'}
                </p>
                {supplier.website && (
                  <p className="flex items-center gap-2 text-gray-400 mt-1">
                    <Globe className="h-3 w-3" />
                    <a
                      href={supplier.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 hover:underline"
                    >
                      {supplier.website}
                    </a>
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="h-3 w-3" /> {t('supplierProfile.address', 'Address')}
              </h4>
              <div className="text-sm text-gray-400">
                {supplier.address ? (
                  <>
                    <p>{supplier.address}</p>
                    <p>
                      {supplier.postal_code} {supplier.city}
                    </p>
                    <p>{supplier.country}</p>
                  </>
                ) : (
                  <p>N/A</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-3 w-3" /> {t('supplierProfile.businessDetails', 'Business Details')}
              </h4>
              <div className="text-sm text-gray-400">
                <p>
                  Type: <span className="text-gradient capitalize">{supplier.supplier_type}</span>
                </p>
                <p>
                  Payment Terms: <span className="text-white">{supplier.payment_terms || 'N/A'}</span>
                </p>
                <p>
                  Tax ID / VAT: <span className="text-white">{supplier.tax_id || 'N/A'}</span>
                </p>
                <p>
                  Currency: <span className="text-white">{supplier.currency || 'EUR'}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 pt-4 border-t border-gray-800">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="h-3 w-3" /> {t('supplierProfile.bankDetails', 'Bank Details')}
              </h4>
              <div className="text-sm text-gray-400">
                {supplier.bank_name || supplier.iban ? (
                  <>
                    <p>
                      Bank: <span className="text-white">{supplier.bank_name || 'N/A'}</span>
                    </p>
                    <p>
                      IBAN: <span className="text-white font-mono text-xs">{supplier.iban || 'N/A'}</span>
                    </p>
                    <p>
                      BIC/SWIFT: <span className="text-white font-mono text-xs">{supplier.bic_swift || 'N/A'}</span>
                    </p>
                  </>
                ) : (
                  <p>{t('supplierProfile.noBankDetails', 'No bank details provided')}</p>
                )}
              </div>
            </div>
            {supplier.notes && (
              <div className="space-y-2 md:col-span-2">
                <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="h-3 w-3" /> Notes
                </h4>
                <p className="text-sm text-gray-400 whitespace-pre-wrap">{supplier.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-gray-900 border-gray-800 flex flex-wrap h-auto">
          <TabsTrigger value="overview">{t('supplierProfile.overview', "Vue d'ensemble")}</TabsTrigger>
          {(supplier.supplier_type === 'service' || supplier.supplier_type === 'both') && (
            <TabsTrigger value="services">
              {t('supplierProfile.vendorServices', 'Services fournisseur')} ({overview.servicesCount})
            </TabsTrigger>
          )}
          {(supplier.supplier_type === 'product' || supplier.supplier_type === 'both') && (
            <TabsTrigger value="products">
              {t('supplierProfile.products', 'Products')} ({overview.productsCount})
            </TabsTrigger>
          )}
          <TabsTrigger value="invoices">
            {t('common.invoices', 'Invoices')} ({overview.invoicesCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-gradient">
                {t('supplierProfile.overview', "Vue d'ensemble")} fournisseur
              </CardTitle>
              <CardDescription>
                Vue rapide des donnees disponibles pour ce fournisseur. Si cette zone etait vide avant, c'etait un
                placeholder non encore implemente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overviewLoading ? (
                <div className="text-gray-400">{t('loading.data', 'Loading data...')}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
                    <p className="text-xs text-gray-400 uppercase flex items-center gap-2">
                      <Wrench className="w-3 h-3" /> Services fournisseur
                    </p>
                    <p className="text-2xl font-bold text-orange-300 mt-1">{overview.servicesCount}</p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
                    <p className="text-xs text-gray-400 uppercase flex items-center gap-2">
                      <Package className="w-3 h-3" /> Produits fournisseur
                    </p>
                    <p className="text-2xl font-bold text-blue-300 mt-1">{overview.productsCount}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Stock bas: {overview.lowStockProducts} • Rupture: {overview.outOfStockProducts}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
                    <p className="text-xs text-gray-400 uppercase flex items-center gap-2">
                      <Receipt className="w-3 h-3" /> Factures fournisseur
                    </p>
                    <p className="text-2xl font-bold text-green-300 mt-1">{overview.invoicesCount}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      En attente: {overview.pendingInvoices} • En retard: {overview.overdueInvoices}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
                    <p className="text-xs text-gray-400 uppercase flex items-center gap-2">
                      <Wallet className="w-3 h-3" /> Depenses totalisees
                    </p>
                    <p className="text-2xl font-bold text-purple-300 mt-1">
                      {new Intl.NumberFormat(getLocale(), {
                        style: 'currency',
                        currency: supplier.currency || 'EUR',
                      }).format(overview.totalSpend || 0)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {!overviewLoading && !hasAnyData && (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-6 text-center text-gray-400">
                <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-yellow-400" />
                Aucune donnee transactionnelle pour ce fournisseur pour le moment. Ajoutez des services, produits ou
                factures pour alimenter la vue.
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            {(supplier.supplier_type === 'service' || supplier.supplier_type === 'both') && (
              <Button variant="outline" className="border-gray-700" onClick={() => setActiveTab('services')}>
                Ouvrir services fournisseur
              </Button>
            )}
            {(supplier.supplier_type === 'product' || supplier.supplier_type === 'both') && (
              <Button variant="outline" className="border-gray-700" onClick={() => setActiveTab('products')}>
                Ouvrir produits
              </Button>
            )}
            <Button variant="outline" className="border-gray-700" onClick={() => setActiveTab('invoices')}>
              Ouvrir factures
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="services" className="mt-6">
          <SupplierServices supplierId={id} supplier={supplier} />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <SupplierProducts supplierId={id} supplier={supplier} />
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <SupplierInvoices supplierId={id} supplier={supplier} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupplierProfile;
