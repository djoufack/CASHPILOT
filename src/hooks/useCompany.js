import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { getStoredActiveCompanyId, setStoredActiveCompanyId } from '@/utils/activeCompanyStorage';
import { useActiveCompanyId } from '@/hooks/useActiveCompanyId';

const resolveCompanyAccountingCurrency = (companyData = {}, currentCompany = null) => {
  const rawValue =
    companyData.accounting_currency || companyData.currency || currentCompany?.accounting_currency || 'EUR';

  return String(rawValue).trim().toUpperCase() || 'EUR';
};

const sanitizeCompanyRecord = (companyRecord = {}) => {
  const { scrada_api_key, _scrada_password, scrada_api_key_encrypted, _scrada_password_encrypted, ...rest } =
    companyRecord;

  return {
    ...rest,
    has_scrada_credentials: Boolean(rest.scrada_company_id && (scrada_api_key_encrypted || scrada_api_key)),
    scrada_api_key: '',
    scrada_password: '',
  };
};

const normalizeCompanyId = (value) => {
  if (value == null) return null;
  return String(value).trim().toLowerCase();
};

const withTimeout = async (factory, timeoutMs = 20000, message = null) => {
  let timeoutId = null;
  try {
    return await Promise.race([
      factory(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(message || `La requete a expire apres ${Math.round(timeoutMs / 1000)}s.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const useCompany = () => {
  const { user } = useAuth();
  const storedActiveCompanyId = useActiveCompanyId();
  const latestFetchRequestIdRef = useRef(0);
  // Multi-company state
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const fetchCompanies = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }
    const requestId = ++latestFetchRequestIdRef.current;

    try {
      setLoading(true);

      // Fetch ALL companies for this user
      const { data: companiesData, error: companiesError } = await supabase
        .from('company')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (requestId !== latestFetchRequestIdRef.current) return;

      if (companiesError) {
        // Handle RLS errors gracefully
        if (companiesError.code === '42P17' || companiesError.code === '42501') {
          console.warn('RLS policy error fetching companies:', companiesError.message);
          setCompanies([]);
          setActiveCompany(null);
          return;
        }
        throw companiesError;
      }

      const allCompanies = (companiesData || []).map(sanitizeCompanyRecord);
      setCompanies(allCompanies);

      if (allCompanies.length === 0) {
        setActiveCompany(null);
        setStoredActiveCompanyId(null);
        return;
      }

      // Fetch preference for active company
      const { data: prefData, error: prefError } = await supabase
        .from('user_company_preferences')
        .select('active_company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (requestId !== latestFetchRequestIdRef.current) return;

      if (prefError && prefError.code !== '42P01') {
        // If table doesn't exist (42P01), fall back to first company silently
        console.warn('Could not fetch company preference:', prefError.message);
      }

      const preferredId = normalizeCompanyId(prefData?.active_company_id);
      const preferred = allCompanies.find((company) => normalizeCompanyId(company.id) === preferredId);
      // Read the latest value directly from storage to avoid stale closure races.
      const latestStoredCompanyId = getStoredActiveCompanyId();
      const effectiveStoredCompanyId = normalizeCompanyId(latestStoredCompanyId);
      const storedPreferred = effectiveStoredCompanyId
        ? allCompanies.find((company) => normalizeCompanyId(company.id) === effectiveStoredCompanyId)
        : null;
      // Prioritize local active-company storage to stay in sync with scoped data.
      const resolvedCompany = storedPreferred || preferred || allCompanies[0];
      const shouldSyncPreference = resolvedCompany?.id && normalizeCompanyId(resolvedCompany.id) !== preferredId;

      // Keep DB preference aligned with the resolved active company.
      // Without this, RLS company_scope_guard can still target an old company
      // while the UI shows another one from local storage.
      if (shouldSyncPreference) {
        try {
          await supabase.from('user_company_preferences').upsert(
            {
              user_id: user.id,
              active_company_id: resolvedCompany.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
        } catch (syncError) {
          console.warn(
            'Could not sync active company preference with resolved company:',
            syncError?.message || syncError
          );
        }
      }

      setActiveCompany(resolvedCompany);
      setStoredActiveCompanyId(resolvedCompany?.id || null);
    } catch (err) {
      if (requestId !== latestFetchRequestIdRef.current) return;
      console.error('Error fetching companies:', err);
      setError(err.message);
    } finally {
      if (requestId === latestFetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  // Keep legacy name for backward compat
  const fetchCompany = fetchCompanies;

  useEffect(() => {
    if (user) {
      fetchCompanies();
    } else {
      setLoading(false);
      setActiveCompany(null);
      setCompanies([]);
      setStoredActiveCompanyId(null);
    }
  }, [fetchCompanies, user]);

  useEffect(() => {
    if (!storedActiveCompanyId || !companies.length) return;
    if (normalizeCompanyId(activeCompany?.id) === normalizeCompanyId(storedActiveCompanyId)) return;

    const normalizedStoredCompanyId = normalizeCompanyId(storedActiveCompanyId);
    const storedCompany = companies.find((company) => normalizeCompanyId(company.id) === normalizedStoredCompanyId);
    if (storedCompany) {
      setActiveCompany(storedCompany);
    }
  }, [activeCompany?.id, companies, storedActiveCompanyId]);

  /**
   * Switch the active company and persist the preference.
   */
  const switchCompany = async (companyId) => {
    if (!user || !supabase) return;

    const normalizedRequestedCompanyId = normalizeCompanyId(companyId);
    const target = companies.find((company) => normalizeCompanyId(company.id) === normalizedRequestedCompanyId);
    if (!target) return;

    setActiveCompany(target);
    setStoredActiveCompanyId(target.id);

    try {
      await supabase
        .from('user_company_preferences')
        .upsert(
          { user_id: user.id, active_company_id: target.id, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
    } catch (err) {
      console.warn('Could not persist company preference:', err.message);
    }
  };

  const saveCompany = async (companyData, options = {}) => {
    if (!user || !supabase) return false;
    const { silent = false, forceCreate = false } = options;

    try {
      setSaving(true);
      setError(null);

      const accountingCurrency = resolveCompanyAccountingCurrency(companyData, activeCompany);

      // Explicit field whitelist — only send columns that exist in the DB
      const companyFields = {
        company_name: companyData.company_name || '',
        company_type: companyData.company_type || 'freelance',
        registration_number: companyData.registration_number || '',
        tax_id: companyData.tax_id || '',
        address: companyData.address || '',
        city: companyData.city || '',
        postal_code: companyData.postal_code || '',
        country: companyData.country || '',
        currency: accountingCurrency,
        phone: companyData.phone || '',
        email: companyData.email || '',
        website: companyData.website || '',
        bank_name: companyData.bank_name || '',
        bank_account: companyData.bank_account || '',
        iban: companyData.iban || '',
        swift: companyData.swift || '',
        peppol_endpoint_id: companyData.peppol_endpoint_id || null,
        peppol_scheme_id: companyData.peppol_scheme_id || '0208',
        peppol_ap_provider: companyData.peppol_ap_provider || 'scrada',
        scrada_company_id: companyData.scrada_company_id || null,
        updated_at: new Date().toISOString(),
      };
      const companyFieldsWithAccountingCurrency = {
        ...companyFields,
        accounting_currency: accountingCurrency,
      };

      // Ensure company_type is always a valid value
      if (!['freelance', 'company'].includes(companyFields.company_type)) {
        companyFields.company_type = 'freelance';
      }

      let result;

      if (activeCompany?.id && !forceCreate) {
        // Update existing
        const response = await withTimeout(
          () =>
            supabase
              .from('company')
              .update(companyFieldsWithAccountingCurrency)
              .eq('id', activeCompany.id)
              .select()
              .single(),
          20000,
          "L'enregistrement de la societe a expire (update)."
        );

        if (response.error) throw response.error;
        result = response.data;
      } else {
        // Create new
        const baseInsertFields = {
          ...companyFields,
          user_id: user.id,
          created_at: new Date().toISOString(),
        };
        const response = await withTimeout(
          () =>
            supabase
              .from('company')
              .insert([{ ...baseInsertFields, accounting_currency: accountingCurrency }])
              .select()
              .single(),
          20000,
          'La creation de la societe a expire (insert).'
        );

        if (response.error) throw response.error;
        result = response.data;
      }

      const sanitizedResult = sanitizeCompanyRecord(result);

      // Update companies list and active company
      setCompanies((prev) => {
        const exists = prev.find((c) => c.id === sanitizedResult.id);
        if (exists) {
          return prev.map((c) => (c.id === sanitizedResult.id ? sanitizedResult : c));
        }
        return [...prev, sanitizedResult];
      });
      setActiveCompany(sanitizedResult);
      setStoredActiveCompanyId(sanitizedResult.id);

      if (!silent) {
        toast({
          title: 'Succès',
          description: 'Informations de la société enregistrées.',
          className: 'bg-green-600 border-none text-white',
        });
      }
      return true;
    } catch (err) {
      console.error('Error saving company:', err);
      setError(err.message);
      if (!silent) {
        toast({
          title: 'Erreur',
          description: err.message,
          variant: 'destructive',
        });
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file) => {
    if (!file || !user || !supabase) return null;

    setUploading(true);
    try {
      // Validate file
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) throw new Error('Fichier trop volumineux (max 5MB)');

      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!validTypes.includes(file.type)) throw new Error('Format non supporté. Utilisez JPG, PNG, GIF, WebP ou SVG.');

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(filePath);

      if (!urlData?.publicUrl) throw new Error("Impossible de générer l'URL du logo");

      const logoUrl = urlData.publicUrl;

      // Update company record
      if (activeCompany?.id) {
        const { error: dbError } = await supabase
          .from('company')
          .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
          .eq('id', activeCompany.id);

        if (dbError) throw dbError;
        setActiveCompany((prev) => ({ ...prev, logo_url: logoUrl }));
        setCompanies((prev) => prev.map((c) => (c.id === activeCompany.id ? { ...c, logo_url: logoUrl } : c)));
      }

      toast({
        title: 'Succès',
        description: 'Logo mis à jour.',
        className: 'bg-green-600 border-none text-white',
      });

      return logoUrl;
    } catch (err) {
      console.error('Error uploading logo:', err);
      toast({
        title: 'Erreur upload',
        description: err.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteLogo = async () => {
    if (!activeCompany?.id || !supabase) return;

    setUploading(true);
    try {
      const { error } = await supabase
        .from('company')
        .update({ logo_url: null, updated_at: new Date().toISOString() })
        .eq('id', activeCompany.id);

      if (error) throw error;

      setActiveCompany((prev) => ({ ...prev, logo_url: null }));
      setCompanies((prev) => prev.map((c) => (c.id === activeCompany.id ? { ...c, logo_url: null } : c)));
      toast({ title: 'Logo supprimé', description: 'Le logo a été retiré.' });
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return {
    // Multi-company API
    companies,
    activeCompany,
    switchCompany,
    // Backward-compat alias: existing code uses `company` (singular)
    company: activeCompany,
    loading,
    saving,
    uploading,
    error,
    fetchCompany,
    saveCompany,
    uploadLogo,
    deleteLogo,
  };
};
