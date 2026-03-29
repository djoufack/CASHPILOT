import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  FileText,
  Receipt,
  BookOpen,
  Download,
  ChevronDown,
  Loader2,
  ShieldCheck,
  PanelRightOpen,
  PanelRightClose,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountantView } from '@/hooks/useAccountantView';
import AccountantNotes from '@/components/accountant/AccountantNotes';
import { getLocale, formatDate as formatDateLocale } from '@/utils/dateLocale';

const formatMoney = (amount, currency = 'EUR') =>
  new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  return formatDateLocale(d);
};

export default function AccountantDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [notesOpen, setNotesOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);

  // Accountant view state
  const {
    companies,
    companiesLoading,
    selectedCompanyId,
    selectedAccess,
    selectCompany,
    permissions,
    notes,
    notesLoading,
    addNote,
    deleteNote,
    acceptInvitation,
    actionLoading,
  } = useAccountantView();

  // Accept invitation from URL token
  const urlToken = searchParams.get('token');
  const [tokenProcessed, setTokenProcessed] = useState(false);

  useEffect(() => {
    if (urlToken && user && !tokenProcessed) {
      setTokenProcessed(true);
      acceptInvitation(urlToken).catch(() => {});
    }
  }, [urlToken, user, tokenProcessed, acceptInvitation]);

  // Auto-select first company
  useEffect(() => {
    if (!selectedCompanyId && companies.length > 0) {
      selectCompany(companies[0].company_id);
    }
  }, [companies, selectedCompanyId, selectCompany]);

  // Company data for the dashboard
  const [companyData, setCompanyData] = useState({
    recentInvoices: [],
    recentExpenses: [],
    recentEntries: [],
    invoiceStats: { total: 0, paid: 0, pending: 0, overdue: 0 },
    loading: true,
  });

  // Fetch company data when a company is selected
  useEffect(() => {
    if (!selectedCompanyId || !supabase || !user) return;

    let cancelled = false;

    const fetchData = async () => {
      setCompanyData((prev) => ({ ...prev, loading: true }));

      try {
        const results = {};

        // Recent invoices
        if (permissions.view_invoices) {
          const { data: invoices } = await supabase
            .from('invoices')
            .select('id, invoice_number, client_name, total_amount, currency, status, issue_date, due_date')
            .eq('company_id', selectedCompanyId)
            .order('issue_date', { ascending: false })
            .limit(10);
          results.recentInvoices = invoices || [];

          // Invoice stats
          const all = invoices || [];
          results.invoiceStats = {
            total: all.length,
            paid: all.filter((i) => i.status === 'paid').length,
            pending: all.filter((i) => ['sent', 'pending', 'draft'].includes(i.status)).length,
            overdue: all.filter((i) => i.status === 'overdue').length,
          };
        }

        // Recent expenses
        if (permissions.view_expenses) {
          const { data: expenses } = await supabase
            .from('expenses')
            .select('id, description, amount, currency, category, expense_date, status')
            .eq('company_id', selectedCompanyId)
            .order('expense_date', { ascending: false })
            .limit(10);
          results.recentExpenses = expenses || [];
        }

        // Recent accounting entries
        if (permissions.view_accounting) {
          const { data: entries } = await supabase
            .from('accounting_entries')
            .select('id, label, debit, credit, account_code, entry_date, journal')
            .eq('company_id', selectedCompanyId)
            .order('entry_date', { ascending: false })
            .limit(10);
          results.recentEntries = entries || [];
        }

        if (!cancelled) {
          setCompanyData({
            recentInvoices: results.recentInvoices || [],
            recentExpenses: results.recentExpenses || [],
            recentEntries: results.recentEntries || [],
            invoiceStats: results.invoiceStats || { total: 0, paid: 0, pending: 0, overdue: 0 },
            loading: false,
          });
        }
      } catch (err) {
        console.error('Error fetching accountant dashboard data:', err);
        if (!cancelled) {
          setCompanyData((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, user, permissions]);

  // FEC export handler
  const handleExportFec = async () => {
    if (!permissions.export_fec || !selectedCompanyId) return;
    try {
      const { data, error } = await supabase.functions.invoke('audit-comptable', {
        body: { company_id: selectedCompanyId, format: 'fec' },
      });
      if (error) throw error;
      // Download the FEC data
      if (data?.fec_content) {
        const blob = new Blob([data.fec_content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FEC_${selectedCompanyId}_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('FEC export error:', err);
    }
  };

  const selectedCompany = selectedAccess?.company;

  // Loading state
  if (companiesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0e1a]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-400" />
          <p className="mt-3 text-slate-400">{t('loading.data')}</p>
        </div>
      </div>
    );
  }

  // No companies
  if (companies.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0e1a]">
        <Card className="max-w-md border-white/10 bg-[#141c33]/80 backdrop-blur">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <ShieldCheck className="h-16 w-16 text-slate-500 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">{t('accountant.dashboardTitle')}</h2>
            <p className="text-slate-400 text-sm">{t('accountant.noCompanies')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a0e1a]">
      {/* Main content */}
      <div className="flex-1 p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{t('accountant.dashboardTitle')}</h1>
                <p className="text-sm text-slate-400">{t('accountant.dashboardDescription')}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Company selector */}
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Building2 className="mr-2 h-4 w-4 text-indigo-400" />
                {selectedCompany?.name || t('accountant.selectCompany')}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
              {companyDropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-white/10 bg-[#141c33] p-1 shadow-xl">
                  {companies.map((c) => (
                    <button
                      key={c.company_id}
                      onClick={() => {
                        selectCompany(c.company_id);
                        setCompanyDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        c.company_id === selectedCompanyId
                          ? 'bg-indigo-500/20 text-indigo-300'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="truncate">{c.companyName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Toggle notes panel */}
            <Button
              variant="ghost"
              onClick={() => setNotesOpen(!notesOpen)}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              {notesOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>

            {/* Export FEC */}
            {permissions.export_fec && (
              <Button
                variant="outline"
                onClick={handleExportFec}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Download className="mr-2 h-4 w-4" />
                {t('accountant.exportFec')}
              </Button>
            )}
          </div>
        </div>

        {/* Stats overview */}
        {permissions.view_invoices && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="border-white/10 bg-[#141c33]/80 backdrop-blur">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-white">{companyData.invoiceStats.total}</p>
                <p className="text-xs text-slate-400">{t('accountant.totalInvoicesCount')}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-[#141c33]/80 backdrop-blur">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-400">{companyData.invoiceStats.paid}</p>
                <p className="text-xs text-slate-400">{t('accountant.paidInvoices')}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-[#141c33]/80 backdrop-blur">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">{companyData.invoiceStats.pending}</p>
                <p className="text-xs text-slate-400">{t('accountant.pendingInvoices')}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-[#141c33]/80 backdrop-blur">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{companyData.invoiceStats.overdue}</p>
                <p className="text-xs text-slate-400">{t('accountant.overdueInvoices')}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Data loading */}
        {companyData.loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recent Invoices */}
            {permissions.view_invoices && (
              <Card className="border-white/10 bg-[#141c33]/80 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <FileText className="h-5 w-5 text-indigo-400" />
                    {t('accountant.recentInvoices')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {companyData.recentInvoices.length === 0 ? (
                    <p className="text-sm text-slate-500">{t('accountant.noInvoices')}</p>
                  ) : (
                    <div className="space-y-2">
                      {companyData.recentInvoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {inv.invoice_number || inv.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {inv.client_name} &middot; {formatDate(inv.issue_date)}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="text-sm font-semibold text-white">
                              {formatMoney(inv.total_amount, inv.currency)}
                            </p>
                            <Badge
                              className={`text-[10px] ${
                                inv.status === 'paid'
                                  ? 'bg-green-500/20 text-green-400 border-green-700'
                                  : inv.status === 'overdue'
                                    ? 'bg-red-500/20 text-red-400 border-red-700'
                                    : 'bg-amber-500/20 text-amber-400 border-amber-700'
                              }`}
                            >
                              {inv.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Recent Expenses */}
            {permissions.view_expenses && (
              <Card className="border-white/10 bg-[#141c33]/80 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Receipt className="h-5 w-5 text-amber-400" />
                    {t('accountant.recentExpenses')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {companyData.recentExpenses.length === 0 ? (
                    <p className="text-sm text-slate-500">{t('accountant.noExpenses')}</p>
                  ) : (
                    <div className="space-y-2">
                      {companyData.recentExpenses.map((exp) => (
                        <div
                          key={exp.id}
                          className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{exp.description || '-'}</p>
                            <p className="text-xs text-slate-400">
                              {exp.category || '-'} &middot; {formatDate(exp.expense_date)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-white shrink-0 ml-2">
                            {formatMoney(exp.amount, exp.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Recent Accounting Entries */}
            {permissions.view_accounting && (
              <Card className="border-white/10 bg-[#141c33]/80 backdrop-blur lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <BookOpen className="h-5 w-5 text-green-400" />
                    {t('accountant.recentEntries')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {companyData.recentEntries.length === 0 ? (
                    <p className="text-sm text-slate-500">{t('accountant.noEntries')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-left">
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-400">
                              {t('accountant.entryDate')}
                            </th>
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-400">{t('accountant.journal')}</th>
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-400">{t('accountant.account')}</th>
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-400">{t('accountant.label')}</th>
                            <th className="pb-2 pr-4 text-right text-xs font-medium text-slate-400">
                              {t('accountant.debit')}
                            </th>
                            <th className="pb-2 text-right text-xs font-medium text-slate-400">
                              {t('accountant.credit')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {companyData.recentEntries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-white/5">
                              <td className="py-2 pr-4 text-slate-300">{formatDate(entry.entry_date)}</td>
                              <td className="py-2 pr-4">
                                <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">
                                  {entry.journal || '-'}
                                </Badge>
                              </td>
                              <td className="py-2 pr-4 font-mono text-xs text-slate-300">
                                {entry.account_code || '-'}
                              </td>
                              <td className="py-2 pr-4 text-slate-300 max-w-[200px] truncate">{entry.label || '-'}</td>
                              <td className="py-2 pr-4 text-right font-mono text-slate-300">
                                {Number(entry.debit) > 0 ? formatMoney(entry.debit) : ''}
                              </td>
                              <td className="py-2 text-right font-mono text-slate-300">
                                {Number(entry.credit) > 0 ? formatMoney(entry.credit) : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Notes sidebar */}
      {notesOpen && (
        <div className="w-80 shrink-0 border-l border-white/10 bg-[#0f1528]/95 backdrop-blur-xl">
          <AccountantNotes
            notes={notes}
            onAddNote={addNote}
            onDeleteNote={deleteNote}
            loading={actionLoading || notesLoading}
          />
        </div>
      )}
    </div>
  );
}
