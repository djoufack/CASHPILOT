import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { LogOut, FileText, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { formatCurrency } from '@/utils/calculations';

const ClientPortal = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { applyCompanyScope } = useCompanyScope();

  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [invoiceError, setInvoiceError] = useState(null);

  // ENF-1: fetch invoices from DB — no hardcoded data
  // ENF-2: applyCompanyScope ensures isolation by company_id → user_id
  useEffect(() => {
    if (!user || !supabase) {
      setLoadingInvoices(false);
      return;
    }

    const fetchPortalInvoices = async () => {
      setLoadingInvoices(true);
      setInvoiceError(null);
      try {
        let query = supabase
          .from('invoices')
          .select('id, invoice_number, issue_date, total_ttc, payment_status, status')
          .order('issue_date', { ascending: false })
          .limit(10);

        query = applyCompanyScope(query);

        const { data, error } = await query;
        if (error) throw error;
        setInvoices(data || []);
      } catch (err) {
        console.error('ClientPortal: failed to fetch invoices', err);
        setInvoiceError(err.message);
      } finally {
        setLoadingInvoices(false);
      }
    };

    fetchPortalInvoices();
  }, [user, applyCompanyScope]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusBadge = (invoice) => {
    const isPaid = invoice.payment_status === 'paid' || invoice.status === 'paid';
    const isOverdue = invoice.payment_status === 'overdue' || invoice.status === 'overdue';
    if (isPaid) {
      return (
        <span className="px-2 py-1 bg-green-900/50 text-green-400 rounded text-xs">
          {t('clientPortal.paid', 'Paid')}
        </span>
      );
    }
    if (isOverdue) {
      return (
        <span className="px-2 py-1 bg-red-900/50 text-red-400 rounded text-xs">
          {t('clientPortal.overdue', 'Overdue')}
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-yellow-900/50 text-yellow-400 rounded text-xs">{t('clientPortal.due', 'Due')}</span>
    );
  };

  return (
    <>
      <Helmet>
        <title>{t('clientPortal.pageTitle', 'Client Portal')}</title>
      </Helmet>
      <div className="min-h-screen bg-gray-950">
        <nav
          className="bg-gray-900 border-b border-gray-800 p-4"
          role="navigation"
          aria-label={t('clientPortal.navigation', 'Client portal navigation')}
        >
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold text-gradient">{t('clientPortal.title', 'Client Portal')}</h1>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-gray-400 hover:text-white"
              aria-label={t('common.logout', 'Log out')}
            >
              <LogOut className="w-4 h-4 mr-2" /> {t('common.logout', 'Log out')}
            </Button>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
              <h2 className="text-xl font-bold text-gradient mb-4 flex items-center">
                <FileText className="mr-2 text-orange-400" /> {t('clientPortal.recentInvoices', 'Recent Invoices')}
              </h2>
              {loadingInvoices ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                </div>
              ) : invoiceError ? (
                <p className="text-red-400 text-sm text-center py-8">{invoiceError}</p>
              ) : invoices.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">
                  {t('clientPortal.noInvoices', 'No invoices found.')}
                </p>
              ) : (
                <div className="space-y-4">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="p-4 bg-gray-800 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="text-gradient font-medium">{invoice.invoice_number}</p>
                        <p className="text-gray-400 text-sm">
                          {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white text-sm font-semibold">
                          {formatCurrency(invoice.total_ttc || 0)}
                        </span>
                        {getStatusBadge(invoice)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
              <h2 className="text-xl font-bold text-gradient mb-4 flex items-center">
                <CheckCircle className="mr-2 text-orange-400" />{' '}
                {t('clientPortal.pendingApprovals', 'Pending Approvals')}
              </h2>
              <div className="text-gray-400 text-center py-8">
                {t('clientPortal.noPendingTimesheets', 'No timesheets pending approval.')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ClientPortal;
