import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import invoiceTemplates, { DEFAULT_INVOICE_TEMPLATE_ID } from '@/config/invoiceTemplates';

const DEFAULT_SETTINGS = {
  template_id: DEFAULT_INVOICE_TEMPLATE_ID,
  color_theme: 'default',
  custom_labels: {},
  show_logo: true,
  show_bank_details: true,
  show_payment_terms: true,
  footer_text: '',
  font_family: 'Inter',
};

const TEMPLATE_IDS = new Set(invoiceTemplates.map((template) => template.id));

const resolveTemplateId = (templateId) => {
  if (templateId && TEMPLATE_IDS.has(templateId)) {
    return templateId;
  }
  return DEFAULT_INVOICE_TEMPLATE_ID;
};

export const useInvoiceSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching invoice settings:', error);
      }
      if (data) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          template_id: resolveTemplateId(data.template_id),
        });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.error('Error fetching invoice settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (newSettings) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      template_id: resolveTemplateId(newSettings.template_id),
      color_theme: newSettings.color_theme,
      custom_labels: newSettings.custom_labels || {},
      show_logo: newSettings.show_logo,
      show_bank_details: newSettings.show_bank_details,
      show_payment_terms: newSettings.show_payment_terms,
      footer_text: newSettings.footer_text || '',
      font_family: newSettings.font_family || 'Inter',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('invoice_settings')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('Error saving invoice settings:', error);
      throw error;
    }

    setSettings({
      ...DEFAULT_SETTINGS,
      ...data,
      template_id: resolveTemplateId(data.template_id),
    });
    return data;
  };

  const getLabel = (key, defaultValue) => {
    return settings.custom_labels?.[key] || defaultValue;
  };

  const updateLabel = (key, value) => {
    setSettings(prev => ({
      ...prev,
      custom_labels: {
        ...prev.custom_labels,
        [key]: value,
      },
    }));
  };

  return {
    settings,
    loading,
    saveSettings,
    getLabel,
    updateLabel,
    fetchSettings,
    DEFAULT_SETTINGS,
  };
};
