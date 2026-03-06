
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSupplierServices } from '@/hooks/useSupplierServices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const SupplierServices = ({ supplierId }) => {
  const { t } = useTranslation();
  const { services, createService, deleteService } = useSupplierServices(supplierId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    service_name: '',
    pricing_type: 'hourly',
    hourly_rate: '',
    fixed_price: '',
    unit: 'hour'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createService(formData);
    setIsModalOpen(false);
    setFormData({ service_name: '', pricing_type: 'hourly', hourly_rate: '', fixed_price: '', unit: 'hour' });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gradient">{t('suppliers.services.catalog')}</h3>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
              <Plus className="mr-2 h-4 w-4" /> {t('suppliers.services.addService')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>{t('suppliers.services.addService')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('suppliers.services.serviceName')}</Label>
                <Input
                  value={formData.service_name}
                  onChange={(e) => setFormData({...formData, service_name: e.target.value})}
                  required
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('suppliers.services.pricingType')}</Label>
                <Select 
                  value={formData.pricing_type} 
                  onValueChange={(val) => setFormData({...formData, pricing_type: val})}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="hourly">{t('suppliers.services.hourlyRate')}</SelectItem>
                    <SelectItem value="fixed">{t('suppliers.services.fixedPrice')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {formData.pricing_type === 'hourly' ? (
                <div className="space-y-2">
                   <Label>{t('suppliers.services.hourlyRate')}</Label>
                   <Input 
                      type="number"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({...formData, hourly_rate: e.target.value})}
                      className="bg-gray-700 border-gray-600"
                   />
                </div>
              ) : (
                <div className="space-y-2">
                   <Label>{t('suppliers.services.fixedPrice')}</Label>
                   <Input 
                      type="number"
                      value={formData.fixed_price}
                      onChange={(e) => setFormData({...formData, fixed_price: e.target.value})}
                      className="bg-gray-700 border-gray-600"
                   />
                </div>
              )}
              
              <div className="space-y-2">
                 <Label>{t('suppliers.services.unit')}</Label>
                 <Input 
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    className="bg-gray-700 border-gray-600"
                 />
              </div>

              <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600">{t('suppliers.services.saveService')}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-gray-800 bg-gray-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800">
              <TableHead className="text-gray-400">{t('suppliers.services.serviceName')}</TableHead>
              <TableHead className="text-gray-400">{t('suppliers.services.pricing')}</TableHead>
              <TableHead className="text-gray-400">{t('suppliers.services.ratePrice')}</TableHead>
              <TableHead className="text-gray-400">{t('suppliers.services.unit')}</TableHead>
              <TableHead className="text-right text-gray-400">{t('suppliers.services.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id} className="border-gray-800">
                <TableCell className="font-medium text-gradient">{service.service_name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-orange-500/30 text-orange-400 capitalize">
                    {service.pricing_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-300">
                  {service.pricing_type === 'hourly' ? `$${service.hourly_rate}/hr` : `$${service.fixed_price}`}
                </TableCell>
                <TableCell className="text-gray-400">{service.unit}</TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => deleteService(service.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {services.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-6">{t('suppliers.services.noServices')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SupplierServices;
