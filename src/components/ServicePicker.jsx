import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/calculations';
import { Search, Plus, Wrench } from 'lucide-react';

const ServicePicker = ({ services = [], onAddService, currency = 'EUR' }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filteredServices = useMemo(() => {
    if (!search.trim()) return services;
    const lower = search.toLowerCase();
    return services.filter(s =>
      (s.service_name || '').toLowerCase().includes(lower) ||
      (s.description || '').toLowerCase().includes(lower)
    );
  }, [services, search]);

  const getPrice = (service) => {
    if (service.pricing_type === 'hourly') return service.hourly_rate || 0;
    if (service.pricing_type === 'fixed') return service.fixed_price || 0;
    return service.unit_price || 0;
  };

  const getPricingLabel = (service) => {
    if (service.pricing_type === 'hourly') return t('services.hourly');
    if (service.pricing_type === 'fixed') return t('services.fixed');
    return t('services.perUnit');
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('invoices.pickService', { defaultValue: 'Search services...' })}
          className="bg-gray-700 border-gray-600 text-white pl-10 w-full"
        />
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-4 text-gray-400 text-sm">
          <Wrench className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{t('common.search')} - 0 results</p>
        </div>
      )}

      <div className="max-h-60 overflow-y-auto space-y-1">
        {filteredServices.map((service) => (
          <div
            key={service.id}
            className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30 hover:bg-gray-700/60 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-white font-medium truncate">
                  {service.service_name}
                </span>
                <span className="text-xs text-gray-400 bg-gray-600/50 px-1.5 py-0.5 rounded shrink-0">
                  {getPricingLabel(service)}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm">
                <span className="text-emerald-300 font-medium">
                  {formatCurrency(Number(getPrice(service)), currency)}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddService(service)}
              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 shrink-0 ml-2 opacity-70 group-hover:opacity-100"
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('common.create', { defaultValue: 'Add' })}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServicePicker;
