
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/calculations';
import { Search, Plus, AlertTriangle, Package } from 'lucide-react';

const ProductPicker = ({ products = [], onAddProduct, currency = 'EUR' }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const lower = search.toLowerCase();
    return products.filter(p =>
      (p.product_name || '').toLowerCase().includes(lower) ||
      (p.sku || '').toLowerCase().includes(lower)
    );
  }, [products, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('invoices.pickProduct')}
          className="bg-gray-700 border-gray-600 text-white pl-10 w-full"
        />
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-4 text-gray-400 text-sm">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{t('common.search')} - 0 results</p>
        </div>
      )}

      <div className="max-h-60 overflow-y-auto space-y-1">
        {filteredProducts.map((product) => {
          const lowStock = (product.stock_quantity || 0) < 5;
          return (
            <div
              key={product.id}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30 hover:bg-gray-700/60 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="text-white font-medium truncate">
                    {product.product_name}
                  </span>
                  {product.sku && (
                    <span className="text-xs text-gray-400 bg-gray-600/50 px-1.5 py-0.5 rounded shrink-0">
                      {product.sku}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm">
                  <span className="text-orange-300 font-medium">
                    {formatCurrency(Number(product.unit_price || 0), currency)}
                  </span>
                  <span className={`flex items-center gap-1 ${lowStock ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {lowStock && <AlertTriangle className="w-3 h-3" />}
                    {t('invoices.stockWarning', { defaultValue: 'Stock' })}: {product.stock_quantity || 0}
                    {product.unit && ` ${product.unit}`}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddProduct(product)}
                className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 shrink-0 ml-2 opacity-70 group-hover:opacity-100"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('common.create', { defaultValue: 'Add' })}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductPicker;
