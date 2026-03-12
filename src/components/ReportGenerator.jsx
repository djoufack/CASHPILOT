import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, FileText, Loader2, Save, UploadCloud } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { useCompany } from '@/hooks/useCompany';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';
import DOMPurify from 'dompurify';
import { escapeHTML as escapeHtml } from '@/utils/sanitize';

const REPORT_PRESETS = {
  executive: {
    label: 'Executive',
    sections: {
      overview: true,
      cashflow: true,
      invoices: true,
      suppliers: false,
      taxes: false,
    },
  },
  operations: {
    label: 'Operations',
    sections: {
      overview: true,
      cashflow: true,
      invoices: true,
      suppliers: true,
      taxes: false,
    },
  },
  compliance: {
    label: 'Compliance',
    sections: {
      overview: true,
      cashflow: false,
      invoices: true,
      suppliers: true,
      taxes: true,
    },
  },
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};


const formatCurrency = (amount, currency = 'EUR', locale = 'fr-FR') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(amount));

const formatDate = (value, locale = 'fr-FR') => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(locale);
};

const isInvoicePaid = (invoice) => ['paid', 'overpaid'].includes(invoice?.payment_status);

const isInvoiceOverdue = (invoice) => {
  if (!invoice?.due_date) return false;
  if (isInvoicePaid(invoice)) return false;
  const dueDate = new Date(invoice.due_date);
  if (Number.isNaN(dueDate.getTime())) return false;
  return dueDate < new Date();
};

const buildBarChart = (bars, height = 120) => {
  const maxVal = Math.max(...bars.map((b) => Math.abs(b.value)), 1);
  const barWidth = Math.floor(200 / bars.length);
  const gap = 8;
  const totalWidth = bars.length * (barWidth + gap);
  const rects = bars.map((bar, i) => {
    const barHeight = Math.round((Math.abs(bar.value) / maxVal) * (height - 24));
    const x = i * (barWidth + gap);
    const y = height - barHeight - 20;
    return `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${bar.color}" rx="3"/>
      <text x="${x + barWidth / 2}" y="${height - 4}" text-anchor="middle" font-size="10" fill="#475569">${escapeHtml(bar.label)}</text>
    `;
  }).join('');
  return `<svg width="${totalWidth}" height="${height}" style="display:block;margin:12px auto;">${rects}</svg>`;
};

const buildReportHtml = ({ companyName, currency, preset, period, sections, data, t, locale }) => {
  const intlLocale = locale || 'fr-FR';
  const sectionBlocks = [];

  if (sections.overview) {
    sectionBlocks.push(`
      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:8px;color:#0f172a;">${escapeHtml(t('reportBuilder.sections.overview', 'Overview'))}</h2>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
          <div style="padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;">
            <p style="margin:0;color:#64748b;font-size:12px;">${escapeHtml(t('reportBuilder.html.revenue', 'Revenue'))}</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0f172a;">${formatCurrency(data.metrics.revenue, currency, intlLocale)}</p>
          </div>
          <div style="padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;">
            <p style="margin:0;color:#64748b;font-size:12px;">${escapeHtml(t('reportBuilder.html.expenses', 'Expenses'))}</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0f172a;">${formatCurrency(data.metrics.expenses, currency, intlLocale)}</p>
          </div>
          <div style="padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;">
            <p style="margin:0;color:#64748b;font-size:12px;">${escapeHtml(t('reportBuilder.html.grossProfit', 'Gross profit'))}</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0f172a;">${formatCurrency(data.metrics.grossProfit, currency, intlLocale)} (${data.metrics.grossMarginRate.toFixed(1)}%)</p>
          </div>
          <div style="padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;">
            <p style="margin:0;color:#64748b;font-size:12px;">${escapeHtml(t('reportBuilder.html.overdueInvoices', 'Overdue invoices'))}</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0f172a;">${data.metrics.overdueInvoices}</p>
          </div>
        </div>
        ${buildBarChart([
          { label: t('reportBuilder.html.revenue', 'Revenue').slice(0, 10), value: data.metrics.revenue, color: '#22c55e' },
          { label: t('reportBuilder.html.expenses', 'Expenses').slice(0, 10), value: data.metrics.expenses, color: '#ef4444' },
          { label: t('reportBuilder.html.grossProfit', 'Profit').slice(0, 10), value: data.metrics.grossProfit, color: '#3b82f6' },
        ])}
      </section>
    `);
  }

  if (sections.cashflow) {
    sectionBlocks.push(`
      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:8px;color:#0f172a;">${escapeHtml(t('reportBuilder.sections.cashflow', 'Cashflow'))}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.cashIn', 'Cash in (payments)'))}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(data.metrics.cashIn, currency, intlLocale)}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.cashOut', 'Cash out (expenses)'))}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(data.metrics.expenses, currency, intlLocale)}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;">${escapeHtml(t('reportBuilder.html.netCash', 'Net cash'))}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;font-weight:700;">${formatCurrency(data.metrics.cashIn - data.metrics.expenses, currency, intlLocale)}</td>
            </tr>
          </tbody>
        </table>
        ${buildBarChart([
          { label: t('reportBuilder.html.cashIn', 'In').split('(')[0].trim().slice(0, 10), value: data.metrics.cashIn, color: '#22c55e' },
          { label: t('reportBuilder.html.cashOut', 'Out').split('(')[0].trim().slice(0, 10), value: data.metrics.expenses, color: '#ef4444' },
          { label: t('reportBuilder.html.netCash', 'Net').slice(0, 10), value: data.metrics.cashIn - data.metrics.expenses, color: '#6366f1' },
        ])}
      </section>
    `);
  }

  if (sections.invoices) {
    sectionBlocks.push(`
      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:8px;color:#0f172a;">${escapeHtml(t('reportBuilder.sections.invoices', 'Customer invoices'))}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.number', 'No.'))}</th>
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.client', 'Client'))}</th>
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.date', 'Date'))}</th>
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.status', 'Status'))}</th>
              <th style="text-align:right;padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.amount', 'Amount'))}</th>
            </tr>
          </thead>
          <tbody>
            ${data.invoices.map((invoice) => `
              <tr>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.invoice_number || '-')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.client?.company_name || '-')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;">${formatDate(invoice.date, intlLocale)}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.status || '-')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(invoice.total_ttc || invoice.total || 0, currency, intlLocale)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    `);
  }

  if (sections.suppliers) {
    sectionBlocks.push(`
      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:8px;color:#0f172a;">${escapeHtml(t('reportBuilder.sections.suppliers', 'Supplier invoices'))}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.number', 'No.'))}</th>
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.supplier', 'Supplier'))}</th>
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.paymentStatus', 'Payment status'))}</th>
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.approval', 'Approval'))}</th>
              <th style="text-align:right;padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.amount', 'Amount'))}</th>
            </tr>
          </thead>
          <tbody>
            ${data.supplierInvoices.map((invoice) => `
              <tr>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.invoice_number || '-')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.supplier?.company_name || invoice.supplier_name_extracted || '-')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.payment_status || '-')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.approval_status || 'pending')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(invoice.total_amount || invoice.total_ttc || 0, currency, intlLocale)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    `);
  }

  if (sections.taxes) {
    sectionBlocks.push(`
      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:8px;color:#0f172a;">${escapeHtml(t('reportBuilder.sections.taxes', 'VAT & compliance'))}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.vatCollected', 'VAT collected (sales)'))}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(data.metrics.outputVat, currency, intlLocale)}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(t('reportBuilder.html.vatDeductible', 'VAT deductible (purchases + expenses)'))}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(data.metrics.inputVat, currency, intlLocale)}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;">${escapeHtml(t('reportBuilder.html.vatNet', 'Net VAT'))}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;font-weight:700;">${formatCurrency(data.metrics.outputVat - data.metrics.inputVat, currency, intlLocale)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    `);
  }

  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;padding:20px;max-width:980px;margin:0 auto;">
      <header style="margin-bottom:20px;border-bottom:2px solid #e2e8f0;padding-bottom:12px;">
        <h1 style="margin:0;font-size:24px;color:#0f172a;">CashPilot Report Builder</h1>
        <p style="margin:6px 0 0;color:#475569;">${escapeHtml(t('reportBuilder.html.company', 'Company'))}: ${escapeHtml(companyName)}</p>
        <p style="margin:2px 0 0;color:#475569;">${escapeHtml(t('reportBuilder.html.preset', 'Preset'))}: ${escapeHtml(preset)}</p>
        <p style="margin:2px 0 0;color:#475569;">${escapeHtml(t('reportBuilder.html.period', 'Period'))}: ${escapeHtml(period.startDate)} → ${escapeHtml(period.endDate)}</p>
        <p style="margin:2px 0 0;color:#475569;">${escapeHtml(t('reportBuilder.html.generatedOn', 'Generated on'))} ${new Date().toLocaleString(intlLocale)}</p>
      </header>
      ${sectionBlocks.join('\n')}
    </div>
  `;
};

const ReportGenerator = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { guardedAction, modalProps } = useCreditsGuard();
  const { user } = useAuth();
  const { company } = useCompany();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [preset, setPreset] = useState('executive');
  const [sections, setSections] = useState(REPORT_PRESETS.executive.sections);
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  });

  const [reportData, setReportData] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [generating, setGenerating] = useState(false);

  const mapTemplateRow = useCallback((row) => ({
    id: row.id,
    name: row.name,
    preset: row.preset || 'custom',
    period: {
      startDate: row.period_start,
      endDate: row.period_end,
    },
    sections: row.sections || {},
  }), []);

  const fetchTemplates = useCallback(async () => {
    if (!user?.id) {
      setTemplates([]);
      return;
    }

    setTemplatesLoading(true);
    try {
      let query = supabase
        .from('report_builder_templates')
        .select('id, name, preset, period_start, period_end, sections, updated_at')
        .order('updated_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) throw error;

      setTemplates((data || []).map(mapTemplateRow));
    } catch (error) {
      toast({
        title: t('common.error', 'Error'),
        description: t('reportBuilder.toasts.templatesLoadError', 'Unable to load templates from database.'),
        variant: 'destructive'
      });
    } finally {
      setTemplatesLoading(false);
    }
  }, [applyCompanyScope, mapTemplateRow, t, toast, user?.id]);

  useEffect(() => {
    if (!REPORT_PRESETS[preset]) return;
    setSections(REPORT_PRESETS[preset].sections);
  }, [preset]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const currency = useMemo(
    () => (company?.accounting_currency || company?.currency || 'EUR').toUpperCase(),
    [company]
  );

  const intlLocale = useMemo(() => {
    const lang = i18n.language || 'fr';
    const localeMap = { fr: 'fr-FR', en: 'en-GB', nl: 'nl-BE' };
    return localeMap[lang] || `${lang}-${lang.toUpperCase()}`;
  }, [i18n.language]);

  const fetchReportData = async () => {
    if (!period.startDate || !period.endDate) {
      throw new Error(t('reportBuilder.validation.missingDates', 'Please select a start and end date.'));
    }

    if (period.endDate < period.startDate) {
      throw new Error(t('reportBuilder.validation.invalidRange', 'The end date must be on or after the start date.'));
    }

    let invoicesQuery = supabase
      .from('invoices')
      .select('id, invoice_number, date, due_date, status, payment_status, total_ht, total_ttc, balance_due, client:clients!fk_invoices_client_scope(company_name)')
      .gte('date', period.startDate)
      .lte('date', period.endDate)
      .order('date', { ascending: false });

    let expensesQuery = supabase
      .from('expenses')
      .select('id, expense_date, amount, vat_amount, category, merchant')
      .gte('expense_date', period.startDate)
      .lte('expense_date', period.endDate)
      .order('expense_date', { ascending: false });

    let paymentsQuery = supabase
      .from('payments')
      .select('id, payment_date, amount, payment_method')
      .gte('payment_date', period.startDate)
      .lte('payment_date', period.endDate)
      .order('payment_date', { ascending: false });

    let supplierInvoicesQuery = supabase
      .from('supplier_invoices')
      .select('id, invoice_number, invoice_date, due_date, payment_status, approval_status, total_amount, total_ttc, vat_amount, supplier_name_extracted, supplier:suppliers!supplier_invoices_supplier_id_fkey(company_name)')
      .gte('invoice_date', period.startDate)
      .lte('invoice_date', period.endDate)
      .order('invoice_date', { ascending: false });

    invoicesQuery = applyCompanyScope(invoicesQuery);
    expensesQuery = applyCompanyScope(expensesQuery);
    paymentsQuery = applyCompanyScope(paymentsQuery);
    supplierInvoicesQuery = applyCompanyScope(supplierInvoicesQuery);

    const [invoicesRes, expensesRes, paymentsRes, supplierInvoicesRes] = await Promise.all([
      invoicesQuery,
      expensesQuery,
      paymentsQuery,
      supplierInvoicesQuery,
    ]);

    if (invoicesRes.error) throw invoicesRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    if (supplierInvoicesRes.error) throw supplierInvoicesRes.error;

    const invoices = invoicesRes.data || [];
    const expenses = expensesRes.data || [];
    const payments = paymentsRes.data || [];
    const supplierInvoices = supplierInvoicesRes.data || [];

    const revenue = invoices.reduce((sum, invoice) => sum + toNumber(invoice.total_ttc), 0);
    const expensesTotal = expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
    const cashIn = payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    const outputVat = invoices.reduce((sum, invoice) => {
      const totalHt = toNumber(invoice.total_ht);
      const totalTtc = toNumber(invoice.total_ttc);
      return sum + Math.max(0, totalTtc - totalHt);
    }, 0);
    const inputVat =
      expenses.reduce((sum, expense) => sum + toNumber(expense.vat_amount), 0) +
      supplierInvoices.reduce((sum, invoice) => sum + toNumber(invoice.vat_amount), 0);
    const grossProfit = revenue - expensesTotal;
    const grossMarginRate = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const overdueInvoices = invoices.filter(isInvoiceOverdue).length;

    const data = {
      invoices,
      expenses,
      payments,
      supplierInvoices,
      metrics: {
        revenue,
        expenses: expensesTotal,
        cashIn,
        grossProfit,
        grossMarginRate,
        overdueInvoices,
        outputVat,
        inputVat,
      },
    };

    setReportData(data);
    return data;
  };

  const getHtml = (data) =>
    buildReportHtml({
      companyName: company?.company_name || company?.name || 'CashPilot',
      currency,
      preset,
      period,
      sections,
      data,
      t,
      locale: intlLocale,
    });

  const ensureReportData = async () => reportData || fetchReportData();

  const handlePreview = async () => {
    setGenerating(true);
    try {
      const data = await fetchReportData();
      setPreviewHtml(getHtml(data));
      toast({ title: t('reportBuilder.preview.readyTitle', 'Preview ready') });
    } catch (error) {
      toast({ title: t('common.error', 'Error'), description: error.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    await guardedAction(
      CREDIT_COSTS.PDF_REPORT,
      t('credits.costReport'),
      async () => {
        setGenerating(true);
        let container;
        try {
          const data = await ensureReportData();
          const html = getHtml(data);
          container = document.createElement('div');
          container.innerHTML = DOMPurify.sanitize(html);
          document.body.appendChild(container);

          await saveElementAsPdf(container, {
            filename: `cashpilot-report-builder-${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          });

          toast({ title: 'Success', description: 'PDF report generated.' });
        } catch (error) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
          if (container && container.parentNode) container.parentNode.removeChild(container);
          setGenerating(false);
        }
      }
    );
  };

  const handleDownloadHTML = () => {
    guardedAction(
      CREDIT_COSTS.EXPORT_HTML,
      t('credits.costs.exportHtml'),
      async () => {
        try {
          const data = await ensureReportData();
          const langAttr = i18n.language || 'fr';
          const html = `<!DOCTYPE html><html lang="${langAttr}"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>CashPilot Report Builder</title></head><body>${getHtml(data)}</body></html>`;
          const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `cashpilot-report-builder-${Date.now()}.html`;
          anchor.click();
          URL.revokeObjectURL(url);
          toast({ title: 'Success', description: 'HTML report downloaded.' });
        } catch (error) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
      }
    );
  };

  const handleDownloadJSON = async () => {
    setGenerating(true);
    try {
      const data = await ensureReportData();
      const payload = {
        company: company?.company_name || company?.name || 'CashPilot',
        preset,
        period,
        sections,
        generatedAt: new Date().toISOString(),
        data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cashpilot-report-builder-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Success', description: 'JSON dataset exported.' });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const toggleSection = (key, value) => {
    setSections((prev) => ({ ...prev, [key]: !!value }));
    setPreset('custom');
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      toast({
        title: t('reportBuilder.toasts.templateNameRequired', 'Template name required'),
        variant: 'destructive'
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: t('common.error', 'Error'),
        description: t('reportBuilder.toasts.userRequired', 'You must be signed in to save templates.'),
        variant: 'destructive'
      });
      return;
    }

    setTemplatesLoading(true);
    try {
      const payload = withCompanyScope({
        user_id: user.id,
        name,
        preset,
        period_start: period.startDate,
        period_end: period.endDate,
        sections,
      });

      const { data, error } = await supabase
        .from('report_builder_templates')
        .upsert(payload, { onConflict: 'user_id,company_id,name' })
        .select('id, name, preset, period_start, period_end, sections')
        .single();

      if (error) throw error;

      const saved = mapTemplateRow(data);
      setTemplates((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setSelectedTemplate(saved.id);
      setTemplateName('');
      toast({
        title: t('reportBuilder.toasts.templateSaved', 'Template saved'),
        description: t('reportBuilder.toasts.templateSavedDescription', '{{name}} is now available.', { name }),
      });
    } catch (error) {
      toast({
        title: t('common.error', 'Error'),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleLoadTemplate = (templateId) => {
    setSelectedTemplate(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setPreset(template.preset || 'custom');
    setPeriod(template.period || period);
    setSections(template.sections || sections);
    toast({
      title: t('reportBuilder.toasts.templateLoaded', 'Template loaded'),
      description: template.name,
    });
  };

  return (
    <>
      <CreditsGuardModal {...modalProps} />
      <Card className="bg-gray-900 border-gray-800 text-white max-w-4xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="text-orange-400" /> {t('reportBuilder.title', 'Report Builder')}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('reportBuilder.labels.preset', 'Preset')}</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="executive">{t('reportBuilder.presets.executive', 'Executive')}</SelectItem>
                  <SelectItem value="operations">{t('reportBuilder.presets.operations', 'Operations')}</SelectItem>
                  <SelectItem value="compliance">{t('reportBuilder.presets.compliance', 'Compliance')}</SelectItem>
                  <SelectItem value="custom">{t('reportBuilder.presets.custom', 'Custom')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('reportBuilder.labels.periodStart', 'Period start')}</Label>
              <Input
                type="date"
                value={period.startDate}
                onChange={(event) => setPeriod((prev) => ({ ...prev, startDate: event.target.value }))}
                className="bg-gray-800 border-gray-700"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('reportBuilder.labels.periodEnd', 'Period end')}</Label>
              <Input
                type="date"
                value={period.endDate}
                onChange={(event) => setPeriod((prev) => ({ ...prev, endDate: event.target.value }))}
                className="bg-gray-800 border-gray-700"
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
            <Label>{t('reportBuilder.labels.sections', 'Report sections')}</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: 'overview', label: t('reportBuilder.sections.overview', 'Overview') },
                { key: 'cashflow', label: t('reportBuilder.sections.cashflow', 'Cashflow') },
                { key: 'invoices', label: t('reportBuilder.sections.invoices', 'Customer invoices') },
                { key: 'suppliers', label: t('reportBuilder.sections.suppliers', 'Supplier invoices') },
                { key: 'taxes', label: t('reportBuilder.sections.taxes', 'VAT & compliance') },
              ].map((section) => (
                <label key={section.key} className="flex items-center gap-2 text-sm text-gray-200">
                  <Checkbox
                    checked={!!sections[section.key]}
                    onCheckedChange={(value) => toggleSection(section.key, value)}
                  />
                  {section.label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
            <Label>{t('reportBuilder.labels.templates', 'Templates')}</Label>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
              <Input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder={t('reportBuilder.placeholders.templateName', 'Template name')}
                className="bg-gray-900 border-gray-700"
              />
              <Button onClick={handleSaveTemplate} disabled={templatesLoading} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                {t('reportBuilder.actions.saveTemplate', 'Save')}
              </Button>
              <Select value={selectedTemplate} onValueChange={handleLoadTemplate}>
                <SelectTrigger className="bg-gray-900 border-gray-700 min-w-[180px]">
                  <SelectValue placeholder={t('reportBuilder.placeholders.loadTemplate', 'Load template')} />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  {templates.length === 0 ? (
                    <SelectItem value="__none__" disabled>{t('reportBuilder.placeholders.noTemplate', 'No template')}</SelectItem>
                  ) : (
                    templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handlePreview}
              disabled={generating}
              variant="outline"
              className="border-cyan-600 text-cyan-300 hover:bg-cyan-900/20"
            >
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              {t('reportBuilder.preview.cta', 'Preview report')}
            </Button>
            <Button
              onClick={() => {
                setGenerating(true);
                fetchReportData()
                  .then(() => toast({ title: t('reportBuilder.toasts.refreshed', 'Data refreshed') }))
                  .catch((error) => toast({ title: t('common.error', 'Error'), description: error.message, variant: 'destructive' }))
                  .finally(() => setGenerating(false));
              }}
              disabled={generating}
              variant="outline"
              className="border-gray-600 hover:bg-gray-700"
            >
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
              {t('reportBuilder.refreshData', 'Refresh data')}
            </Button>
            <Button onClick={handleDownloadPDF} disabled={generating} className="bg-orange-500 hover:bg-orange-600">
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {t('reportBuilder.downloadPdf', 'Download PDF')} ({CREDIT_COSTS.PDF_REPORT} {t('credits.creditsLabel')})
            </Button>
            <Button
              onClick={handleDownloadHTML}
              disabled={generating}
              variant="outline"
              className="border-gray-600 hover:bg-gray-700"
            >
              <FileText className="mr-2 h-4 w-4" />
              {t('reportBuilder.downloadHtml', 'Download HTML')} ({CREDIT_COSTS.EXPORT_HTML} {t('credits.creditsLabel')})
            </Button>
            <Button
              onClick={handleDownloadJSON}
              disabled={generating}
              variant="outline"
              className="border-cyan-600 text-cyan-300 hover:bg-cyan-900/20"
            >
              <FileText className="mr-2 h-4 w-4" />
              {t('reportBuilder.downloadJson', 'Download JSON')}
            </Button>
          </div>

          {previewHtml ? (
            <div className="rounded-xl border border-gray-700 bg-white text-black p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {t('reportBuilder.preview.title', 'Report preview')}
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  onClick={() => setPreviewHtml('')}
                >
                  {t('reportBuilder.preview.hide', 'Hide preview')}
                </Button>
              </div>
              <div className="max-h-[520px] overflow-auto rounded-lg border border-gray-200 bg-white p-3">
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }} />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
};

export default ReportGenerator;
