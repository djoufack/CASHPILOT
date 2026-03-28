import { Helmet } from 'react-helmet';
import { Badge } from '@/components/ui/badge';
import AdminFeatureFlagsPanel from '@/components/admin/AdminFeatureFlagsPanel';
import AdminOperationalHealthPanel from '@/components/admin/AdminOperationalHealthPanel';
import AdminTraceabilityPanel from '@/components/admin/AdminTraceabilityPanel';

const AdminOperationsPage = () => {
  return (
    <>
      <Helmet>
        <title>Administration technique - CashPilot</title>
      </Helmet>
      <div className="container mx-auto px-4 py-6 md:px-8 space-y-6 min-h-screen text-white">
        <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
          <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">Admin</Badge>
          <h1 className="mt-3 text-3xl font-semibold text-white">Administration technique</h1>
          <p className="mt-2 text-sm text-gray-400">
            Centre de pilotage company-scope pour les activations progressives et la gouvernance operationnelle.
          </p>
        </section>

        <AdminFeatureFlagsPanel />
        <AdminOperationalHealthPanel />
        <AdminTraceabilityPanel />
      </div>
    </>
  );
};

export default AdminOperationsPage;
