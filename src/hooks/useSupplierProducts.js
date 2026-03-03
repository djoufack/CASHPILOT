import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const useSupplierProducts = (supplierId) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const fetchCategories = useCallback(async () => {
     if(!user) return;
     try {
       let query = supabase
         .from('supplier_product_categories')
         .select('*')
         .order('name');

       query = applyCompanyScope(query);

       const { data, error } = await query;

       if(error) throw error;
       setCategories(data || []);
     } catch (err) {
        console.error("Failed to fetch categories", err);
     }
  }, [applyCompanyScope, user]);

  const fetchProducts = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('supplier_products')
        .select(`
          *,
          category:supplier_product_categories(id, name)
        `)
        .eq('supplier_id', supplierId)
        .order('product_name');

      query = applyCompanyScope(query);

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error fetching products",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, supplierId, toast]);

  const createProduct = async (productData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_products')
        .insert([{ ...withCompanyScope(productData), supplier_id: supplierId }])
        .select(`*, category:supplier_product_categories(id, name)`)
        .single();

      if (error) throw error;
      
      setProducts([data, ...products]);
      toast({
        title: "Success",
        description: "Product added successfully"
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error adding product",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = async (id, productData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_products')
        .update(productData)
        .eq('id', id)
        .select(`*, category:supplier_product_categories(id, name)`)
        .single();

      if (error) throw error;

      setProducts(products.map(p => p.id === id ? data : p));
      toast({
        title: "Success",
        description: "Product updated successfully"
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error updating product",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('supplier_products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProducts(products.filter(p => p.id !== id));
      toast({
        title: "Success",
        description: "Product deleted successfully"
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error deleting product",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supplierId) fetchProducts();
    if (user) fetchCategories();
  }, [fetchCategories, fetchProducts, supplierId, user]);

  return {
    products,
    categories,
    loading,
    error,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct
  };
};
