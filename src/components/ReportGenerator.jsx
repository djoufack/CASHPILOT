import { useEffect, useMemo, useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';

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

const TEMPLATE_STORAGE_KEY = 'cashpilot.report-builder.templates.v1';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatCurrency = (amount, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(amount));

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR');
};

const isInvoicePaid = (invoice) => ['paid', 'overpaid'].includes(invoice?.payment_status);

const isInvoiceOverdue = (invoice) => {
  if (!invoice?.due_date) return false;
  if (isInvoicePaid(invoice)) return false;
  const dueDate = new Date(invoice.due_date);
  if (Number.isNaN(dueDate.getTime())) return false;
  return dueDate < new Date();
};

const loadTemplates = () => {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveTemplates = (templates) => {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
};

const buildReportHtml = ({ companyName, currency, preset, period, sections, data }) => {
  const sectionBlocks = [];

  if (sections.overview) {
    sectionBlocks.push(`
      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:8px;color:#0f172a;">Vue d'ensemble</h2>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
          <div style="padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;">
            <p style="margin:0;color:#64748b;font-size:12px;">Chiffre d'affaires</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0f172a;">${formatCurrency(data.metrics.revenue, currency)}</p>
          </div>
          <div style="padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;">
            <p style="margin:0;color:#64748b;font-size:12px;">Dépenses</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0f172a;">${formatCurrency(data.metrics.expenses, currency)}</p>
          </div>
          <div style="padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;">
            <p style="margin:0;color:#64748b;font-size:12px;">Marge brute</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0f172a;">${formatCurrency(data.metrics.grossProfit, currency)} (${data.metrics.grossMarginRate.toFixed(1)}%)</p>
          </div>
          <div style="padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;">
            <p style="margin:0;color:#64748b;font-size:12px;">Factures en retard</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0f172a;">${data.metrics.overdueInvoices}</p>
          </div>
        </div>
      </section>
    `);
  }

  if (sections.cashflow) {
    sectionBlocks.push(`
      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:8px;color:#0f172a;">Cashflow</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">Encaissements (paiements)</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(data.metrics.cashIn, currency)}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">Décaissements (dépenses)</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(data.metrics.expenses, currency)}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;">Net de trésorerie</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;font-weight:700;">${formatCurrency(data.metrics.cashIn - data.metrics.expenses, currency)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    `);
  }

  if (sections.invoices) {
    sectionBlocks.push(`
      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:8px;color:#0f172a;">Factures clients</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">N°</th>
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">Client</th>
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">Date</th>
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">Statut</th>
              <th style="text-align:right;padding:8px;border:1px solid #cbd5e1;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${data.invoices.slice(0, 12).map((invoice) => `
              <tr>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.invoice_number || '-')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.client?.company_name || '-')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;">${formatDate(invoice.date)}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.status || '-')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(invoice.total_ttc || invoice.total || 0, currency)}</td>
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
        <h2 style="font-size:18px;margin-bottom:8px;color:#0f172a;">Factures fournisseurs</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">N°</th>
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">Fournisseur</th>
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">Statut paiement</th>
              <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">Approbation</th>
              <th style="text-align:right;padding:8px;border:1px solid #cbd5e1;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${data.supplierInvoices.slice(0, 12).map((invoice) => `
              <tr>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.invoice_number || '-')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.supplier?.company_name || invoice.supplier_name_extracted || '-')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.payment_status || '-')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoice.approval_status || 'pending')}</td>
                <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(invoice.total_amount || invoice.total_ttc || 0, currency)}</td>
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
        <h2 style="font-size:18px;margin-bottom:8px;color:#0f172a;">Synthèse TVA</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">TVA collectée (ventes)</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(data.metrics.outputVat, currency)}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">TVA déductible (achats + dépenses)</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(data.metrics.inputVat, currency)}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;">TVA nette</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;font-weight:700;">${formatCurrency(data.metrics.outputVat - data.metrics.inputVat, currency)}</td>
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
        <p style="margin:6px 0 0;color:#475569;">Entreprise: ${escapeHtml(companyName)}</p>
        <p style="margin:2px 0 0;color:#475569;">Preset: ${escapeHtml(preset)}</p>
        <p style="margin:2px 0 0;color:#475569;">Période: ${escapeHtml(period.startDate)} → ${escapeHtml(period.endDate)}</p>
        <p style="margin:2px 0 0;color:#475569;">Généré le ${new Date().toLocaleString('fr-FR')}</p>
      </header>
      ${sectionBlocks.join('\n')}
    </div>
  `;
};

const ReportGenerator = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { guardedAction, modalProps } = useCreditsGuard();
  const { company } = useCompany();
  const { applyCompanyScope } = useCompanyScope();

  const [preset, setPreset] = useState('executive');
  const [sections, setSections] = useState(REPORT_PRESETS.executive.sections);
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState(() => loadTemplates());
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
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!REPORT_PRESETS[preset]) return;
    setSections(REPORT_PRESETS[preset].sections);
  }, [preset]);

  const currency = useMemo(
    () => (company?.accounting_currency || company?.currency || 'EUR').toUpperCase(),
    [company]
  );

  const fetchReportData = async () => {
    let invoicesQuery = supabase
      .from('invoices')
      .select('id, invoice_number, date, due_date, status, payment_status, total_ttc, total_tva, total, balance_due, client:clients(company_name)')
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
      .select('id, invoice_number, invoice_date, due_date, payment_status, approval_status, total_amount, total_ttc, vat_amount, supplier_name_extracted, supplier:suppliers(company_name)')
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

    const revenue = invoices.reduce((sum, invoice) => sum + toNumber(invoice.total_ttc || invoice.total), 0);
    const expensesTotal = expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
    const cashIn = payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    const outputVat = invoices.reduce((sum, invoice) => sum + toNumber(invoice.total_tva), 0);
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
    });

  const ensureReportData = async () => reportData || fetchReportData();

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
          container.innerHTML = html;
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
          const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>CashPilot Report Builder</title></head><body>${getHtml(data)}</body></html>`;
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

  const handleSaveTemplate = () => {
    const name = templateName.trim();
    if (!name) {
      toast({ title: 'Template name required', variant: 'destructive' });
      return;
    }

    const nextTemplate = {
      id: `tpl_${Date.now()}`,
      name,
      preset,
      period,
      sections,
    };
    const nextTemplates = [nextTemplate, ...templates.filter((item) => item.name !== name)];
    setTemplates(nextTemplates);
    saveTemplates(nextTemplates);
    setSelectedTemplate(nextTemplate.id);
    toast({ title: 'Template saved', description: `${name} is now available.` });
  };

  const handleLoadTemplate = (templateId) => {
    setSelectedTemplate(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setPreset(template.preset || 'custom');
    setPeriod(template.period || period);
    setSections(template.sections || sections);
    toast({ title: 'Template loaded', description: template.name });
  };

  return (
    <>
      <CreditsGuardModal {...modalProps} />
      <Card className="bg-gray-900 border-gray-800 text-white max-w-4xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="text-orange-400" /> Report Builder
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Preset</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="executive">Executive</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Période début</Label>
              <Input
                type="date"
                value={period.startDate}
                onChange={(event) => setPeriod((prev) => ({ ...prev, startDate: event.target.value }))}
                className="bg-gray-800 border-gray-700"
              />
            </div>

            <div className="space-y-2">
              <Label>Période fin</Label>
              <Input
                type="date"
                value={period.endDate}
                onChange={(event) => setPeriod((prev) => ({ ...prev, endDate: event.target.value }))}
                className="bg-gray-800 border-gray-700"
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
            <Label>Sections du rapport</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: 'overview', label: 'Vue d’ensemble' },
                { key: 'cashflow', label: 'Cashflow' },
                { key: 'invoices', label: 'Factures clients' },
                { key: 'suppliers', label: 'Factures fournisseurs' },
                { key: 'taxes', label: 'TVA & conformité' },
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
            <Label>Templates</Label>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
              <Input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Nom du template"
                className="bg-gray-900 border-gray-700"
              />
              <Button onClick={handleSaveTemplate} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Select value={selectedTemplate} onValueChange={handleLoadTemplate}>
                <SelectTrigger className="bg-gray-900 border-gray-700 min-w-[180px]">
                  <SelectValue placeholder="Charger template" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  {templates.length === 0 ? (
                    <SelectItem value="__none__" disabled>No template</SelectItem>
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
              onClick={() => {
                setGenerating(true);
                fetchReportData()
                  .then(() => toast({ title: 'Data refreshed' }))
                  .catch((error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }))
                  .finally(() => setGenerating(false));
              }}
              disabled={generating}
              variant="outline"
              className="border-gray-600 hover:bg-gray-700"
            >
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
              Refresh data
            </Button>
            <Button onClick={handleDownloadPDF} disabled={generating} className="bg-orange-500 hover:bg-orange-600">
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download PDF ({CREDIT_COSTS.PDF_REPORT} {t('credits.creditsLabel')})
            </Button>
            <Button
              onClick={handleDownloadHTML}
              disabled={generating}
              variant="outline"
              className="border-gray-600 hover:bg-gray-700"
            >
              <FileText className="mr-2 h-4 w-4" />
              Download HTML ({CREDIT_COSTS.EXPORT_HTML} {t('credits.creditsLabel')})
            </Button>
            <Button
              onClick={handleDownloadJSON}
              disabled={generating}
              variant="outline"
              className="border-cyan-600 text-cyan-300 hover:bg-cyan-900/20"
            >
              <FileText className="mr-2 h-4 w-4" />
              Download JSON
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default ReportGenerator;
