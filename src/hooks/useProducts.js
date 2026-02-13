
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  const [totalCount, setTotalCount] = useState(0);

  const fetchProducts = async ({ page, pageSize } = {}) => {
    if (!user || !supabase) return;
    setLoading(true);
    setError(null);
    try {
      const usePagination = page != null && pageSize != null;
      let query = supabase
        .from('products')
        .select('*, category:product_categories(id, name), supplier:suppliers(id, company_name)', usePagination ? { count: 'exact' } : undefined)
        .order('product_name', { ascending: true });

      if (usePagination) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      setProducts(data || []);
      if (usePagination && count != null) {
        setTotalCount(count);
      }
    } catch (err) {
      if (err.code === '42P17' || err.code === '42501') {
        console.warn('RLS policy error fetching products:', err.message);
        setProducts([]);
        return;
      }
      setError(err.message);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const createProduct = async (productData) => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{ ...productData, user_id: user.id }])
        .select('*, category:product_categories(id, name), supplier:suppliers(id, company_name)')
        .single();

      if (error) throw error;

      logAction('create', 'product', null, data);

      setProducts(prev => [data, ...prev]);
      toast({ title: "Succès", description: "Produit créé avec succès." });
      return data;
    } catch (err) {
      setError(err.message);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = async (id, productData) => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id)
        .select('*, category:product_categories(id, name), supplier:suppliers(id, company_name)')
        .single();

      if (error) throw error;

      const oldProduct = products.find(p => p.id === id);
      logAction('update', 'product', oldProduct || null, data);

      setProducts(prev => prev.map(p => p.id === id ? data : p));
      toast({ title: "Succès", description: "Produit mis à jour." });
      return data;
    } catch (err) {
      setError(err.message);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id) => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      const deletedProduct = products.find(p => p.id === id);
      logAction('delete', 'product', deletedProduct || { id }, null);

      setProducts(prev => prev.filter(p => p.id !== id));
      toast({ title: "Succès", description: "Produit supprimé." });
    } catch (err) {
      setError(err.message);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const importFromSupplier = async (supplierProduct) => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          user_id: user.id,
          product_name: supplierProduct.product_name,
          sku: supplierProduct.sku || null,
          purchase_price: supplierProduct.unit_price || 0,
          unit_price: 0,
          unit: supplierProduct.unit || 'pièce',
          supplier_id: supplierProduct.supplier_id,
          stock_quantity: 0,
          min_stock_level: supplierProduct.min_stock_level || 5,
          is_active: true
        }])
        .select('*, category:product_categories(id, name), supplier:suppliers(id, company_name)')
        .single();

      if (error) throw error;

      logAction('create', 'product', null, data);

      setProducts(prev => [data, ...prev]);
      toast({ title: "Succès", description: `"${supplierProduct.product_name}" importé dans votre stock.` });
      return data;
    } catch (err) {
      setError(err.message);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [user]);

  return {
    products,
    loading,
    error,
    totalCount,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    importFromSupplier
  };
};

export const useProductCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCategories = async () => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching product categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async (name, description = '') => {
    if (!user || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .insert([{ user_id: user.id, name, description }])
        .select()
        .single();

      if (error) throw error;
      setCategories(prev => [...prev, data]);
      toast({ title: "Succès", description: "Catégorie créée." });
      return data;
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      throw err;
    }
  };

  const updateCategory = async (id, name, description = '') => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .update({ name, description })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setCategories(prev => prev.map(c => c.id === id ? data : c));
      toast({ title: "Succès", description: "Catégorie mise à jour." });
      return data;
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      throw err;
    }
  };

  const deleteCategory = async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [user]);

  return { categories, loading, fetchCategories, createCategory, updateCategory, deleteCategory };
};
