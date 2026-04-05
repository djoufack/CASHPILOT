import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminDashboard from './AdminDashboard';
import UserManagement from './UserManagement';
import {
  Shield,
  Users,
  LayoutDashboard,
  Key,
  Building2,
  Wallet,
  SlidersHorizontal,
  Activity,
  Fingerprint,
  Database,
} from 'lucide-react';
import AdminClientManager from '@/components/admin/AdminClientManager';
import AdminRoleManager from '@/components/admin/AdminRoleManager';
import AdminAuditTrail from '@/components/admin/AdminAuditTrail';
import AdminBillingManager from '@/components/admin/AdminBillingManager';
import AdminFeatureFlagsPanel from '@/components/admin/AdminFeatureFlagsPanel';
import AdminOperationalHealthPanel from '@/components/admin/AdminOperationalHealthPanel';
import AdminTraceabilityPanel from '@/components/admin/AdminTraceabilityPanel';
import AdminMcpToolsManager from '@/components/admin/AdminMcpToolsManager';
import { useTranslation } from 'react-i18next';

const AdminPage = () => {
  const { t } = useTranslation();

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gradient">{t('admin.systemHealth')} & Control</h1>
        <p className="text-gray-400 mt-2">Manage users, roles, and system settings.</p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="bg-gray-900 border-gray-800">
          <TabsTrigger
            value="dashboard"
            className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400"
          >
            <LayoutDashboard className="w-4 h-4 mr-2" /> {t('common.dashboard')}
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400"
          >
            <Users className="w-4 h-4 mr-2" /> {t('admin.users')}
          </TabsTrigger>
          <TabsTrigger
            value="clients"
            className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400"
          >
            <Building2 className="w-4 h-4 mr-2" /> Clients
          </TabsTrigger>
          <TabsTrigger
            value="roles"
            className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400"
          >
            <Key className="w-4 h-4 mr-2" /> {t('admin.roles')}
          </TabsTrigger>
          <TabsTrigger
            value="billing"
            className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400"
          >
            <Wallet className="w-4 h-4 mr-2" /> Abonnements & Credits
          </TabsTrigger>
          <TabsTrigger
            value="feature-flags"
            className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" /> Feature flags
          </TabsTrigger>
          <TabsTrigger
            value="ops-health"
            className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400"
          >
            <Activity className="w-4 h-4 mr-2" /> Ops health
          </TabsTrigger>
          <TabsTrigger
            value="traceability"
            className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400"
          >
            <Fingerprint className="w-4 h-4 mr-2" /> Traceability
          </TabsTrigger>
          <TabsTrigger
            value="mcp-tools"
            className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400"
          >
            <Database className="w-4 h-4 mr-2" /> MCP Tools
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400"
          >
            <Shield className="w-4 h-4 mr-2" /> {t('admin.audit')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <AdminDashboard />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UserManagement />
        </TabsContent>

        <TabsContent value="clients" className="mt-6">
          <AdminClientManager />
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <AdminRoleManager />
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <AdminBillingManager />
        </TabsContent>

        <TabsContent value="feature-flags" className="mt-6">
          <AdminFeatureFlagsPanel />
        </TabsContent>

        <TabsContent value="ops-health" className="mt-6">
          <AdminOperationalHealthPanel />
        </TabsContent>

        <TabsContent value="traceability" className="mt-6">
          <AdminTraceabilityPanel />
        </TabsContent>

        <TabsContent value="mcp-tools" className="mt-6">
          <AdminMcpToolsManager />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AdminAuditTrail />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
