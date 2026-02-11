
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useCompany = () => {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchCompany();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchCompany = async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        // Handle RLS errors gracefully
        if (error.code === '42P17' || error.code === '42501') {
          console.warn('RLS policy error fetching company:', error.message);
          setCompany(null);
          return;
        }
        throw error;
      }

      setCompany(data);
    } catch (err) {
      console.error('Error fetching company:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveCompany = async (companyData) => {
    if (!user || !supabase) return false;

    try {
      setSaving(true);
      setError(null);

      console.log('🔍 saveCompany received data:', companyData);
      console.log('🔍 Currency from companyData:', companyData.currency);

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
        currency: companyData.currency || 'EUR',
        phone: companyData.phone || '',
        email: companyData.email || '',
        website: companyData.website || '',
        bank_name: companyData.bank_name || '',
        bank_account: companyData.bank_account || '',
        iban: companyData.iban || '',
        swift: companyData.swift || '',
        updated_at: new Date().toISOString()
      };

      // Ensure company_type is always a valid value
      if (!['freelance', 'company'].includes(companyFields.company_type)) {
        companyFields.company_type = 'freelance';
      }

      console.log('📤 Prepared companyFields for DB:', companyFields);
      console.log('📤 Currency being sent to DB:', companyFields.currency);

      let result;

      if (company?.id) {
        // Update existing
        const { data, error } = await supabase
          .from('company')
          .update(companyFields)
          .eq('id', company.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
        console.log('✅ DB Update result:', result);
        console.log('✅ Currency in result:', result?.currency);
      } else {
        // Create new
        const { data, error } = await supabase
          .from('company')
          .insert([{ ...companyFields, user_id: user.id, created_at: new Date().toISOString() }])
          .select()
          .single();

        if (error) throw error;
        result = data;
        console.log('✅ DB Insert result:', result);
        console.log('✅ Currency in result:', result?.currency);
      }

      setCompany(result);
      toast({
        title: "Succès",
        description: "Informations de la société enregistrées.",
        className: "bg-green-600 border-none text-white"
      });
      return true;
    } catch (err) {
      console.error('Error saving company:', err);
      setError(err.message);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
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
      if (file.size > maxSize) throw new Error("Fichier trop volumineux (max 5MB)");

      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!validTypes.includes(file.type)) throw new Error("Format non supporté. Utilisez JPG, PNG, GIF, WebP ou SVG.");

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) throw new Error("Impossible de générer l'URL du logo");

      const logoUrl = urlData.publicUrl;

      // Update company record
      if (company?.id) {
        const { error: dbError } = await supabase
          .from('company')
          .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
          .eq('id', company.id);

        if (dbError) throw dbError;
        setCompany(prev => ({ ...prev, logo_url: logoUrl }));
      }

      toast({
        title: "Succès",
        description: "Logo mis à jour.",
        className: "bg-green-600 border-none text-white"
      });

      return logoUrl;
    } catch (err) {
      console.error('Error uploading logo:', err);
      toast({
        title: "Erreur upload",
        description: err.message,
        variant: "destructive"
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteLogo = async () => {
    if (!company?.id || !supabase) return;

    setUploading(true);
    try {
      const { error } = await supabase
        .from('company')
        .update({ logo_url: null, updated_at: new Date().toISOString() })
        .eq('id', company.id);

      if (error) throw error;

      setCompany(prev => ({ ...prev, logo_url: null }));
      toast({ title: "Logo supprimé", description: "Le logo a été retiré." });
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return {
    company,
    loading,
    saving,
    uploading,
    error,
    fetchCompany,
    saveCompany,
    uploadLogo,
    deleteLogo
  };
};
