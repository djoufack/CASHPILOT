
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminDashboard from './AdminDashboard';
import UserManagement from './UserManagement';
import { Shield, Users, LayoutDashboard, Key } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const AdminPage = () => {
  const { t } = useTranslation();

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gradient">
          {t('admin.systemHealth')} & Control
        </h1>
        <p className="text-gray-400 mt-2">Manage users, roles, and system settings.</p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="bg-gray-900 border-gray-800">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <LayoutDashboard className="w-4 h-4 mr-2" /> {t('common.dashboard')}
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <Users className="w-4 h-4 mr-2" /> {t('admin.users')}
          </TabsTrigger>
          <TabsTrigger value="roles" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <Key className="w-4 h-4 mr-2" /> {t('admin.roles')}
          </TabsTrigger>
          <TabsTrigger value="audit" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
             <Shield className="w-4 h-4 mr-2" /> {t('admin.audit')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <AdminDashboard />
        </TabsContent>
        
        <TabsContent value="users" className="mt-6">
          <UserManagement />
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <div className="p-8 text-center bg-gray-900/50 border border-gray-800 rounded-lg text-gray-500">
            <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-gradient">Role Management</h3>
            <p>Configure granular permissions for each role.</p>
          </div>
        </TabsContent>
        
        <TabsContent value="audit" className="mt-6">
          <div className="p-8 text-center bg-gray-900/50 border border-gray-800 rounded-lg text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-gradient">Audit Trail</h3>
            <p>View detailed logs of all system activities.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
