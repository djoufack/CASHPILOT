
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSuppliers } from '@/hooks/useSuppliers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Mail, Globe, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import SupplierServices from '@/components/suppliers/SupplierServices';
import SupplierProducts from '@/components/suppliers/SupplierProducts';
import SupplierInvoices from '@/components/suppliers/SupplierInvoices';

const SupplierProfile = () => {
  const { id } = useParams();
  const { getSupplierById } = useSuppliers();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const data = await getSupplierById(id);
      setSupplier(data);
      setLoading(false);
    };
    fetch();
  }, [id]);

  if (loading) return <div className="p-8 text-white">Loading...</div>;
  if (!supplier) return <div className="p-8 text-white">Supplier not found</div>;

  return (
    <div className="p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <Link to="/suppliers">
        <Button variant="ghost" className="mb-4 pl-0 text-gray-400 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Suppliers
        </Button>
      </Link>

      {/* Header Info */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl text-white mb-2">{supplier.company_name}</CardTitle>
              <CardDescription className="text-gray-400 flex items-center gap-4">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {supplier.city}, {supplier.country}</span>
                {supplier.website && <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {supplier.website}</span>}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">Status</div>
              <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${supplier.status === 'active' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                {supplier.status}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Contact</h4>
            <div className="text-sm">
              <p className="font-medium text-white">{supplier.contact_person}</p>
              <p className="flex items-center gap-2 text-gray-400 mt-1"><Mail className="h-3 w-3" /> {supplier.email}</p>
              <p className="flex items-center gap-2 text-gray-400 mt-1"><Phone className="h-3 w-3" /> {supplier.phone}</p>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Business Details</h4>
            <div className="text-sm text-gray-400">
              <p>Type: <span className="text-white capitalize">{supplier.supplier_type}</span></p>
              <p>Payment Terms: <span className="text-white">{supplier.payment_terms || 'N/A'}</span></p>
            </div>
          </div>
          <div className="space-y-2">
             <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Address</h4>
             <p className="text-sm text-gray-400">
               {supplier.address}<br />
               {supplier.postal_code} {supplier.city}<br />
               {supplier.country}
             </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Details */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-gray-900 border-gray-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {(supplier.supplier_type === 'service' || supplier.supplier_type === 'both') && (
            <TabsTrigger value="services">Services</TabsTrigger>
          )}
          {(supplier.supplier_type === 'product' || supplier.supplier_type === 'both') && (
            <TabsTrigger value="products">Products</TabsTrigger>
          )}
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6">
          <div className="p-8 border border-gray-800 rounded-lg bg-gray-900/30 text-center text-gray-400">
            Supplier dashboard overview coming soon...
          </div>
        </TabsContent>
        
        <TabsContent value="services" className="mt-6">
          <SupplierServices supplierId={id} />
        </TabsContent>
        
        <TabsContent value="products" className="mt-6">
          <SupplierProducts supplierId={id} />
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
           <div className="p-4 border border-gray-800 rounded-lg bg-gray-900/30">
               <h3 className="text-lg font-bold mb-4">Supplier Invoices</h3>
               {/* Simplified Invoice View - Full Implementation would use SupplierInvoices component */}
               <div className="text-gray-400">Invoice management module loaded.</div>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupplierProfile;
