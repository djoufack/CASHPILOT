import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { useCompany } from '@/hooks/useCompany';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useDefaultTaxRate } from '@/hooks/useDefaultTaxRate';
import { supabase } from '@/lib/supabase';
import invoiceTemplates, { DEFAULT_INVOICE_TEMPLATE_ID } from '@/config/invoiceTemplates';
import { themeList, getTheme } from '@/config/invoiceThemes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Save, Eye } from 'lucide-react';

// Lazy load templates for live preview
import ClassicTemplate from '@/components/invoice-templates/ClassicTemplate';
import ModernTemplate from '@/components/invoice-templates/ModernTemplate';
import MinimalTemplate from '@/components/invoice-templates/MinimalTemplate';
import BoldTemplate from '@/components/invoice-templates/BoldTemplate';
import ProfessionalTemplate from '@/components/invoice-templates/ProfessionalTemplate';
import DMGDefaultTemplate from '@/components/invoice-templates/DMGDefaultTemplate';

const templateComponents = {
  dmg_default: DMGDefaultTemplate,
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  bold: BoldTemplate,
  professional: ProfessionalTemplate,
};

const FONT_OPTIONS = [
  'Inter',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
];

const LABEL_KEYS = [
  { key: 'invoiceTitle', default: 'Invoice' },
  { key: 'billTo', default: 'Bill To' },
  { key: 'issueDate', default: 'Issue Date' },
  { key: 'dueDate', default: 'Due Date' },
  { key: 'description', default: 'Description' },
  { key: 'quantity', default: 'Quantity' },
  { key: 'unitPrice', default: 'Unit Price' },
  { key: 'amount', default: 'Amount' },
  { key: 'totalHT', default: 'Subtotal' },
  { key: 'taxAmount', default: 'Tax' },
  { key: 'totalTTC', default: 'Total' },
  { key: 'bankDetails', default: 'Bank Details' },
  { key: 'notes', default: 'Notes' },
];

const InvoiceCustomization = () => {
  const { t } = useTranslation();
  const { settings, loading, saveSettings } = useInvoiceSettings();
  const { company } = useCompany();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();
  const { toast } = useToast();
  const { defaultRate } = useDefaultTaxRate();
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [previewClient, setPreviewClient] = useState(null);
  const [previewItems, setPreviewItems] = useState([]);

  const dynamicPreviewInvoice = useMemo(
    () => ({
      invoice_number: '',
      date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'draft',
      payment_status: 'pending',
      total_ht: 0,
      total_ttc: 0,
      discount_type: 'none',
      discount_value: 0,
      discount_amount: 0,
      amount_paid: 0,
      balance_due: 0,
      notes: '',
      ...(previewInvoice || {}),
      tax_rate: previewInvoice?.tax_rate ?? defaultRate,
    }),
    [defaultRate, previewInvoice]
  );

  const [localSettings, setLocalSettings] = useState(settings);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLocalSettings(settings);
    }
  }, [settings, loading]);

  useEffect(() => {
    let cancelled = false;

    const loadPreviewData = async () => {
      if (!supabase || !activeCompanyId) {
        if (!cancelled) {
          setPreviewInvoice(null);
          setPreviewClient(null);
          setPreviewItems([]);
        }
        return;
      }

      try {
        let invoiceQuery = supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(1);
        invoiceQuery = applyCompanyScope(invoiceQuery);
        const { data: invoiceRows, error: invoiceError } = await invoiceQuery;
        if (invoiceError) throw invoiceError;

        const invoice = invoiceRows?.[0] || null;
        if (!invoice) {
          if (!cancelled) {
            setPreviewInvoice(null);
            setPreviewClient(null);
            setPreviewItems([]);
          }
          return;
        }

        let client = null;
        if (invoice.client_id) {
          let clientQuery = supabase.from('clients').select('*').eq('id', invoice.client_id).limit(1);
          clientQuery = applyCompanyScope(clientQuery);
          const { data: clientRows } = await clientQuery;
          client = clientRows?.[0] || null;
        }

        const { data: itemsRows } = await supabase
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', invoice.id)
          .order('created_at', { ascending: true });

        if (!cancelled) {
          setPreviewInvoice(invoice);
          setPreviewClient(client);
          setPreviewItems(itemsRows || []);
        }
      } catch (_error) {
        if (!cancelled) {
          setPreviewInvoice(null);
          setPreviewClient(null);
          setPreviewItems([]);
        }
      }
    };

    loadPreviewData();
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, applyCompanyScope]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(localSettings);
      toast({ title: t('common.success'), description: t('invoiceSettings.saved') });
    } catch (err) {
      toast({ title: t('common.error'), description: t('invoiceSettings.saveError'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }));
  };

  const updateLabel = (key, value) => {
    setLocalSettings((prev) => ({
      ...prev,
      custom_labels: { ...prev.custom_labels, [key]: value },
    }));
  };

  const currentTheme = getTheme(localSettings.color_theme);
  const TemplateComponent =
    templateComponents[localSettings.template_id] || templateComponents[DEFAULT_INVOICE_TEMPLATE_ID];

  if (loading) {
    return <div className="text-gray-400 p-4">{t('invoiceSettings.loading')}</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gradient">{t('invoiceSettings.title')}</h2>
          <p className="text-sm text-gray-400 mt-1">{t('invoiceSettings.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <Eye className="w-4 h-4 mr-2" />
            {showPreview ? t('invoiceSettings.hidePreview') : t('invoiceSettings.showPreview')}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Save className="w-4 h-4 mr-2" />
            {t('common.save')}
          </Button>
        </div>
      </div>

      <div className={`grid gap-8 ${showPreview ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Settings panel */}
        <div className="space-y-6">
          {/* Template Selection */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">{t('invoiceSettings.template')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {invoiceTemplates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => updateField('template_id', tmpl.id)}
                  className={`p-3 rounded-lg border-2 transition-all text-center ${
                    localSettings.template_id === tmpl.id
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                  }`}
                >
                  <div
                    className="w-full h-16 rounded mb-2 flex items-center justify-center text-2xl"
                    style={{ backgroundColor: getTheme(localSettings.color_theme).secondary }}
                  >
                    {tmpl.id === 'dmg_default' && '🧾'}
                    {tmpl.id === 'classic' && '📄'}
                    {tmpl.id === 'modern' && '🎨'}
                    {tmpl.id === 'minimal' && '✨'}
                    {tmpl.id === 'bold' && '💪'}
                    {tmpl.id === 'professional' && '👔'}
                  </div>
                  <p className="text-sm font-medium">{tmpl.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{tmpl.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Color Theme */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">{t('invoiceSettings.colorTheme')}</h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-2">
              {themeList.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => updateField('color_theme', theme.id)}
                  className={`relative group rounded-lg p-1 transition-all ${
                    localSettings.color_theme === theme.id
                      ? 'ring-2 ring-orange-500'
                      : 'hover:ring-1 hover:ring-gray-500'
                  }`}
                  title={theme.name}
                >
                  <div className="flex flex-col rounded overflow-hidden">
                    <div className="h-6" style={{ backgroundColor: theme.primary }} />
                    <div className="h-3" style={{ backgroundColor: theme.accent }} />
                    <div className="h-3" style={{ backgroundColor: theme.secondary }} />
                  </div>
                  <p className="text-[10px] text-center mt-1 text-gray-400 truncate">{theme.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Font & Display */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">{t('invoiceSettings.display')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-gray-300">{t('invoiceSettings.font')}</Label>
                <Select value={localSettings.font_family} onValueChange={(v) => updateField('font_family', v)}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 text-white">
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f} style={{ fontFamily: f }}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-300">{t('invoiceSettings.showLogo')}</Label>
                  <Switch checked={localSettings.show_logo} onCheckedChange={(v) => updateField('show_logo', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-300">{t('invoiceSettings.showBankDetails')}</Label>
                  <Switch
                    checked={localSettings.show_bank_details}
                    onCheckedChange={(v) => updateField('show_bank_details', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-300">{t('invoiceSettings.showPaymentTerms')}</Label>
                  <Switch
                    checked={localSettings.show_payment_terms}
                    onCheckedChange={(v) => updateField('show_payment_terms', v)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer text */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">{t('invoiceSettings.footerText')}</h3>
            <Textarea
              value={localSettings.footer_text || ''}
              onChange={(e) => updateField('footer_text', e.target.value)}
              className="bg-gray-700 border-gray-600 text-white resize-none"
              rows={2}
              placeholder={t('invoiceSettings.footerPlaceholder')}
            />
          </div>

          {/* Custom Labels */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">{t('invoiceSettings.customLabels')}</h3>
            <p className="text-sm text-gray-400 mb-4">{t('invoiceSettings.customLabelsDesc')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LABEL_KEYS.map(({ key, default: def }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-gray-400">{def}</Label>
                  <Input
                    value={localSettings.custom_labels?.[key] || ''}
                    onChange={(e) => updateLabel(key, e.target.value)}
                    placeholder={def}
                    className="bg-gray-700 border-gray-600 text-white h-9"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('invoiceSettings.preview')}</h3>
            <div
              className="rounded-lg overflow-hidden border border-gray-700 shadow-xl"
              style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '117.6%' }}
            >
              <TemplateComponent
                invoice={dynamicPreviewInvoice}
                client={previewClient || {}}
                items={previewItems}
                company={company || {}}
                theme={currentTheme}
                settings={localSettings}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceCustomization;
