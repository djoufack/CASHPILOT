
import React, { useState } from 'react';
import { useSuppliers } from '@/hooks/useSuppliers';
import SupplierStats from '@/components/suppliers/SupplierStats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Eye, Edit, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SuppliersPage = () => {
  const { suppliers, loading, createSupplier, deleteSupplier } = useSuppliers();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    supplier_type: 'both',
    status: 'active'
  });

  const filteredSuppliers = suppliers.filter(s => 
    s.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    await createSupplier(newSupplier);
    setIsAddModalOpen(false);
    setNewSupplier({
        company_name: '',
        contact_person: '',
        email: '',
        phone: '',
        supplier_type: 'both',
        status: 'active'
    });
  };

  return (
    <div className="p-8 min-h-screen bg-gray-950 text-white space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Supplier Management
          </h1>
          <p className="text-gray-400">Manage your vendor relationships, products, and orders.</p>
        </div>
        
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>Add New Supplier</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input 
                    value={newSupplier.company_name}
                    onChange={(e) => setNewSupplier({...newSupplier, company_name: e.target.value})}
                    required 
                    className="bg-gray-700 border-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Person</Label>
                  <Input 
                     value={newSupplier.contact_person}
                     onChange={(e) => setNewSupplier({...newSupplier, contact_person: e.target.value})}
                     className="bg-gray-700 border-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                     type="email"
                     value={newSupplier.email}
                     onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
                     className="bg-gray-700 border-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input 
                     value={newSupplier.phone}
                     onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
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
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Create Supplier</Button>
            </form>
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

        <div className="rounded-md border border-gray-800 bg-gray-900 overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-800">
              <TableRow>
                <TableHead className="text-gray-300">Company</TableHead>
                <TableHead className="text-gray-300">Contact</TableHead>
                <TableHead className="text-gray-300">Type</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                   <TableCell colSpan={5} className="text-center py-8 text-gray-500">Loading...</TableCell>
                </TableRow>
              ) : filteredSuppliers.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={5} className="text-center py-8 text-gray-500">No suppliers found.</TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id} className="border-gray-800 hover:bg-gray-800/50">
                    <TableCell className="font-medium text-white">{supplier.company_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-white">{supplier.contact_person}</span>
                        <span className="text-xs text-gray-500">{supplier.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize border-blue-500/30 text-blue-400">
                        {supplier.supplier_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={supplier.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}>
                        {supplier.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link to={`/suppliers/${supplier.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          onClick={() => {
                            if(confirm('Are you sure you want to delete this supplier?')) deleteSupplier(supplier.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default SuppliersPage;
