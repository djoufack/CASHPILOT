import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeResourceOrigin = (value) => (value === 'external_supplier' ? 'external_supplier' : 'internal');

/**
 * Hook responsible for project resource allocations,
 * suppliers, supplier services / products, and
 * creating a supplier from a portfolio company.
 */
export function useHrMaterialAllocations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierServices, setSupplierServices] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [projects, setProjects] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      let suppliersQuery = supabase.from('suppliers').select('*').order('created_at', { ascending: false });

      let supplierServicesQuery = supabase
        .from('supplier_services')
        .select('id, supplier_id, company_id, service_name, pricing_type, hourly_rate, fixed_price, unit, created_at')
        .order('created_at', { ascending: false });

      let supplierProductsQuery = supabase
        .from('supplier_products')
        .select('id, supplier_id, company_id, product_name, sku, unit_price, created_at')
        .order('created_at', { ascending: false });

      let projectsQuery = supabase
        .from('projects')
        .select('id, name, status, client_id, company_id')
        .order('name', { ascending: true });

      let allocationsQuery = supabase
        .from('project_resource_allocations')
        .select('*')
        .order('created_at', { ascending: false });

      suppliersQuery = applyCompanyScope(suppliersQuery);
      supplierServicesQuery = applyCompanyScope(supplierServicesQuery);
      supplierProductsQuery = applyCompanyScope(supplierProductsQuery);
      projectsQuery = applyCompanyScope(projectsQuery);
      allocationsQuery = applyCompanyScope(allocationsQuery);

      const _results = await Promise.allSettled([
        suppliersQuery,
        supplierServicesQuery,
        supplierProductsQuery,
        projectsQuery,
        allocationsQuery,
      ]);

      const _allocLabels = ['suppliers', 'supplierServices', 'supplierProducts', 'projects', 'allocations'];
      _results.forEach((r, i) => {
        if (r.status === 'rejected')
          console.error(`HrMaterialAllocations fetch "${_allocLabels[i]}" failed:`, r.reason);
      });

      const _v = (i) => (_results[i].status === 'fulfilled' ? _results[i].value : null) || { data: null, error: null };
      const suppliersResult = _v(0);
      const supplierServicesResult = _v(1);
      const supplierProductsResult = _v(2);
      const projectsResult = _v(3);
      const allocationsResult = _v(4);

      [suppliersResult, supplierServicesResult, supplierProductsResult, projectsResult, allocationsResult].forEach(
        (res, i) => {
          if (res.error) console.error(`HrMaterialAllocations query "${_allocLabels[i]}" error:`, res.error);
        }
      );

      const suppliersData = suppliersResult.data || [];
      const supplierServicesData = supplierServicesResult.data || [];
      const supplierProductsData = supplierProductsResult.data || [];
      const projectsData = projectsResult.data || [];
      const allocationsData = allocationsResult.data || [];

      const projectById = new Map(projectsData.map((project) => [project.id, project]));
      const supplierServiceById = new Map(supplierServicesData.map((service) => [service.id, service]));
      const supplierProductById = new Map(supplierProductsData.map((product) => [product.id, product]));

      const normalizedAllocations = allocationsData.map((row) => ({
        ...row,
        project: row?.project || projectById.get(row.project_id) || null,
        supplier_service: row?.supplier_service || supplierServiceById.get(row.supplier_service_id) || null,
        supplier_product: row?.supplier_product || supplierProductById.get(row.supplier_product_id) || null,
      }));

      setSuppliers(suppliersData);
      setSupplierServices(supplierServicesData);
      setSupplierProducts(supplierProductsData);
      setProjects(projectsData);
      setAllocations(normalizedAllocations);
    } catch (err) {
      setError(err.message || 'Impossible de charger les allocations');
      toast({
        title: 'Erreur Allocations',
        description: err.message || 'Chargement impossible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, toast, user]);

  const createAllocation = useCallback(
    async (payload) => {
      if (!user || !supabase) return null;

      const normalizedType = payload.resource_type === 'material' ? 'material' : 'human';
      const normalizedOrigin = normalizeResourceOrigin(payload.resource_origin);
      const normalizedSupplierId = normalizedOrigin === 'external_supplier' ? payload.supplier_id || null : null;
      const normalizedExternalServiceId =
        normalizedOrigin === 'external_supplier' && normalizedType === 'human'
          ? payload.supplier_service_id || null
          : null;
      const normalizedExternalProductId =
        normalizedOrigin === 'external_supplier' && normalizedType === 'material'
          ? payload.supplier_product_id || null
          : null;

      const row = withCompanyScope({
        user_id: user.id,
        project_id: payload.project_id,
        resource_type: normalizedType,
        resource_origin: normalizedOrigin,
        supplier_id: normalizedSupplierId,
        supplier_service_id: normalizedExternalServiceId,
        supplier_product_id: normalizedExternalProductId,
        team_member_id:
          normalizedType === 'human' && normalizedOrigin === 'internal' ? payload.team_member_id || null : null,
        resource_name:
          normalizedType === 'material' || normalizedOrigin === 'external_supplier'
            ? String(payload.resource_name || '').trim()
            : null,
        unit: payload.unit || 'hour',
        planned_quantity: toNumber(payload.planned_quantity),
        actual_quantity: toNumber(payload.actual_quantity),
        planned_cost: toNumber(payload.planned_cost),
        actual_cost: toNumber(payload.actual_cost),
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
        status: payload.status || 'planned',
        notes: payload.notes || null,
      });

      const { data, error: insertError } = await supabase
        .from('project_resource_allocations')
        .insert([row])
        .select('*')
        .single();

      if (insertError) throw insertError;
      await fetchData();
      return data;
    },
    [fetchData, user, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const createSupplierFromPortfolioCompany = useCallback(
    async ({ providerCompanyId, providerCompanyName }) => {
      if (!user || !supabase) return null;
      if (!providerCompanyId || !providerCompanyName) {
        throw new Error('Societe fournisseur invalide');
      }

      let existingSupplier = null;

      const existingByNameQuery = applyCompanyScope(
        supabase.from('suppliers').select('*').eq('user_id', user.id).eq('company_name', providerCompanyName).limit(1),
        { includeUnassigned: false }
      );
      const existingByNameResult = await existingByNameQuery.maybeSingle();
      if (existingByNameResult.error) throw existingByNameResult.error;
      if (existingByNameResult.data) {
        existingSupplier = existingByNameResult.data;
      }

      if (!existingSupplier) {
        const existingByLinkedQuery = applyCompanyScope(
          supabase
            .from('suppliers')
            .select('*')
            .eq('user_id', user.id)
            .eq('linked_company_id', providerCompanyId)
            .limit(1),
          { includeUnassigned: false }
        );
        const existingByLinkedResult = await existingByLinkedQuery.maybeSingle();
        if (!existingByLinkedResult.error && existingByLinkedResult.data) {
          existingSupplier = existingByLinkedResult.data;
        }
        if (
          existingByLinkedResult.error &&
          !String(existingByLinkedResult.error.message || '')
            .toLowerCase()
            .includes('linked_company_id')
        ) {
          throw existingByLinkedResult.error;
        }
      }

      if (existingSupplier) {
        return { supplier: existingSupplier, created: false };
      }

      const row = withCompanyScope({
        user_id: user.id,
        company_name: providerCompanyName,
        linked_company_id: providerCompanyId,
      });

      let insertResult = await supabase.from('suppliers').insert([row]).select('*').single();

      if (
        insertResult.error &&
        String(insertResult.error.message || '')
          .toLowerCase()
          .includes('linked_company_id')
      ) {
        const fallbackRow = { ...row };
        delete fallbackRow.linked_company_id;
        insertResult = await supabase.from('suppliers').insert([fallbackRow]).select('*').single();
      }

      if (insertResult.error) throw insertResult.error;
      await fetchData();
      return { supplier: insertResult.data, created: true };
    },
    [applyCompanyScope, fetchData, user, withCompanyScope]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    error,
    allocations,
    suppliers,
    supplierServices,
    supplierProducts,
    projects,
    fetchData,
    createAllocation,
    createSupplierFromPortfolioCompany,
  };
}
