
import React, { useState } from 'react';
import { useSuppliers } from '@/hooks/useSuppliers';
import SupplierStats from '@/components/suppliers/SupplierStats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ResponsiveTable from '@/components/ui/ResponsiveTable';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Eye, Edit, Trash2, Building2, User, Mail, Phone, MapPin, Globe, CreditCard, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

const SuppliersPage = () => {
  const { suppliers, loading, createSupplier, deleteSupplier } = useSuppliers();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const emptySupplier = {
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    supplier_type: 'both',
    status: 'active',
    // Adresse
    address: '',
    city: '',
    postal_code: '',
    country: '',
    // Commercial
    website: '',
    payment_terms: '',
    tax_id: '',
    currency: 'EUR',
    // Bancaire
    bank_name: '',
    iban: '',
    bic_swift: '',
    // Notes
    notes: ''
  };
  const [newSupplier, setNewSupplier] = useState(emptySupplier);

  const filteredSuppliers = suppliers.filter(s => 
    s.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    await createSupplier(newSupplier);
    setIsAddModalOpen(false);
    setNewSupplier(emptySupplier);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-950 text-white space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">
            Supplier Management
          </h1>
          <p className="text-gray-400">Manage your vendor relationships, products, and orders.</p>
        </div>
        
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="mr-2 h-4 w-4" /> Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-xl">Add New Supplier</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <form onSubmit={handleCreate} className="space-y-6">
                {/* --- Section: General Info --- */}
                <div>
                  <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> General Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Company Name *</Label>
                      <Input
                        value={newSupplier.company_name}
                        onChange={(e) => setNewSupplier({...newSupplier, company_name: e.target.value})}
                        required
                        placeholder="Acme Corp"
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Person</Label>
                      <Input
                        value={newSupplier.contact_person}
                        onChange={(e) => setNewSupplier({...newSupplier, contact_person: e.target.value})}
                        placeholder="John Doe"
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newSupplier.email}
                        onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
                        placeholder="contact@acme.com"
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={newSupplier.phone}
                        onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                        placeholder="+33 1 23 45 67 89"
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Website</Label>
                      <Input
                        value={newSupplier.website}
                        onChange={(e) => setNewSupplier({...newSupplier, website: e.target.value})}
                        placeholder="https://www.acme.com"
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={newSupplier.supplier_type}
                        onValueChange={(val) => setNewSupplier({...newSupplier, supplier_type: val})}
                      >
                        <SelectTrigger className="bg-gray-700 border-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 text-white">
                          <SelectItem value="service">Service</SelectItem>
                          <SelectItem value="product">Product</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* --- Section: Address --- */}
                <div>
                  <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Address
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Street Address</Label>
                      <Input
                        value={newSupplier.address}
                        onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})}
                        placeholder="123 Business Street"
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={newSupplier.city}
                        onChange={(e) => setNewSupplier({...newSupplier, city: e.target.value})}
                        placeholder="Paris"
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Postal Code</Label>
                      <Input
                        value={newSupplier.postal_code}
                        onChange={(e) => setNewSupplier({...newSupplier, postal_code: e.target.value})}
                        placeholder="75001"
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Country</Label>
                      <Input
                        value={newSupplier.country}
                        onChange={(e) => setNewSupplier({...newSupplier, country: e.target.value})}
                        placeholder="France"
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                  </div>
                </div>

                {/* --- Section: Business Details --- */}
                <div>
                  <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Business Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tax ID / VAT Number</Label>
                      <Input
                        value={newSupplier.tax_id}
                        onChange={(e) => setNewSupplier({...newSupplier, tax_id: e.target.value})}
                        placeholder="FR 12 345678901"
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Terms</Label>
                      <Select
                        value={newSupplier.payment_terms}
                        onValueChange={(val) => setNewSupplier({...newSupplier, payment_terms: val})}
                      >
                        <SelectTrigger className="bg-gray-700 border-gray-600">
                          <SelectValue placeholder="Select terms" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 text-white">
                          <SelectItem value="immediate">Immediate</SelectItem>
                          <SelectItem value="net_15">Net 15</SelectItem>
                          <SelectItem value="net_30">Net 30</SelectItem>
                          <SelectItem value="net_45">Net 45</SelectItem>
                          <SelectItem value="net_60">Net 60</SelectItem>
                          <SelectItem value="net_90">Net 90</SelectItem>
                          <SelectItem value="end_of_month">End of Month</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select
                        value={newSupplier.currency}
                        onValueChange={(val) => setNewSupplier({...newSupplier, currency: val})}
                      >
                        <SelectTrigger className="bg-gray-700 border-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 text-white">
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                          <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* --- Section: Bank Details --- */}
                <div>
                  <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> Bank Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bank Name</Label>
                      <Input
                        value={newSupplier.bank_name}
                        onChange={(e) => setNewSupplier({...newSupplier, bank_name: e.target.value})}
                        placeholder="BNP Paribas"
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IBAN</Label>
                      <Input
                        value={newSupplier.iban}
                        onChange={(e) => setNewSupplier({...newSupplier, iban: e.target.value})}
                        placeholder="FR76 1234 5678 9012 3456 7890 123"
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>BIC / SWIFT</Label>
                      <Input
                        value={newSupplier.bic_swift}
                        onChange={(e) => setNewSupplier({...newSupplier, bic_swift: e.target.value})}
                        placeholder="BNPAFRPP"
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                  </div>
                </div>

                {/* --- Section: Notes --- */}
                <div>
                  <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Notes
                  </h3>
                  <Textarea
                    value={newSupplier.notes}
                    onChange={(e) => setNewSupplier({...newSupplier, notes: e.target.value})}
                    placeholder="Additional notes about this supplier..."
                    rows={3}
                    className="bg-gray-700 border-gray-600"
                  />
                </div>

                <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-lg py-5">
                  Create Supplier
                </Button>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <SupplierStats />

      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input 
              placeholder="Search suppliers..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
          </div>
        </div>

        <ResponsiveTable
          data={filteredSuppliers}
          columns={[
            { header: 'Company', accessor: (s) => <span className="font-medium text-gradient">{s.company_name}</span> },
            { header: 'Contact', accessor: (s) => (
              <div className="flex flex-col">
                <span className="text-gradient">{s.contact_person}</span>
                <span className="text-xs text-gray-500">{s.email}</span>
              </div>
            )},
            { header: 'Type', accessor: (s) => (
              <Badge variant="outline" className="capitalize border-orange-500/30 text-orange-400">{s.supplier_type}</Badge>
            )},
            { header: 'Status', accessor: (s) => (
              <Badge className={s.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}>{s.status}</Badge>
            )},
            { header: 'Actions', accessor: (s) => (
              <div className="flex justify-end gap-2">
                <Link to={`/suppliers/${s.id}`}>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  onClick={() => { if(confirm('Are you sure you want to delete this supplier?')) deleteSupplier(s.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ), className: 'text-right' }
          ]}
          renderCard={(supplier) => (
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium text-gradient text-lg">{supplier.company_name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{supplier.contact_person}</p>
                    <p className="text-xs text-gray-500">{supplier.email}</p>
                  </div>
                  <Badge className={supplier.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}>
                    {supplier.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                  <Badge variant="outline" className="capitalize border-orange-500/30 text-orange-400">{supplier.supplier_type}</Badge>
                  <div className="flex gap-2">
                    <Link to={`/suppliers/${supplier.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      onClick={() => { if(confirm('Are you sure you want to delete this supplier?')) deleteSupplier(supplier.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          loading={loading}
          emptyMessage="No suppliers found."
        />
      </div>
    </div>
  );
};

export default SuppliersPage;
