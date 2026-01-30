
import React, { useState } from 'react';
import { useSupplierProducts } from '@/hooks/useSupplierProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SupplierProducts = ({ supplierId }) => {
  const { products, categories, createProduct, deleteProduct } = useSupplierProducts(supplierId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    product_name: '',
    category_id: '',
    sku: '',
    unit_price: '',
    stock_quantity: 0,
    min_stock_level: 5
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createProduct(formData);
    setIsModalOpen(false);
    setFormData({ product_name: '', category_id: '', sku: '', unit_price: '', stock_quantity: 0, min_stock_level: 5 });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gradient">Products Catalog</h3>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-green-600 hover:bg-green-700">
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>Add Product</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input 
                  value={formData.product_name}
                  onChange={(e) => setFormData({...formData, product_name: e.target.value})}
                  required 
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label>Category</Label>
                   <Select 
                      value={formData.category_id} 
                      onValueChange={(val) => setFormData({...formData, category_id: val})}
                   >
                     <SelectTrigger className="bg-gray-700 border-gray-600">
                       <SelectValue placeholder="Select..." />
                     </SelectTrigger>
                     <SelectContent className="bg-gray-800 border-gray-700 text-white">
                       {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                     </SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <Label>SKU</Label>
                   <Input 
                      value={formData.sku}
                      onChange={(e) => setFormData({...formData, sku: e.target.value})}
                      className="bg-gray-700 border-gray-600"
                   />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                 <div className="space-y-2">
                   <Label>Unit Price</Label>
                   <Input 
                      type="number"
                      value={formData.unit_price}
                      onChange={(e) => setFormData({...formData, unit_price: e.target.value})}
                      className="bg-gray-700 border-gray-600"
                   />
                </div>
                 <div className="space-y-2">
                   <Label>Stock</Label>
                   <Input 
                      type="number"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                      className="bg-gray-700 border-gray-600"
                   />
                </div>
                 <div className="space-y-2">
                   <Label>Min Stock</Label>
                   <Input 
                      type="number"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({...formData, min_stock_level: e.target.value})}
                      className="bg-gray-700 border-gray-600"
                   />
                </div>
              </div>

              <Button type="submit" className="w-full bg-green-600">Save Product</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-gray-800 bg-gray-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800">
              <TableHead className="text-gray-400">Product</TableHead>
              <TableHead className="text-gray-400">SKU</TableHead>
              <TableHead className="text-gray-400">Category</TableHead>
              <TableHead className="text-gray-400">Price</TableHead>
              <TableHead className="text-gray-400">Stock</TableHead>
              <TableHead className="text-right text-gray-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const isLowStock = product.stock_quantity <= product.min_stock_level;
              return (
                <TableRow key={product.id} className="border-gray-800">
                  <TableCell className="font-medium text-gradient">{product.product_name}</TableCell>
                  <TableCell className="text-gray-400 text-xs">{product.sku}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-gray-800 text-gray-300">
                      {product.category?.name || 'Uncategorized'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-300">${product.unit_price}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={isLowStock ? 'text-red-400 font-bold' : 'text-green-400'}>
                        {product.stock_quantity}
                      </span>
                      {isLowStock && <AlertTriangle className="h-3 w-3 text-red-500 animate-pulse" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => deleteProduct(product.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-6">No products added yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SupplierProducts;
