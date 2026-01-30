
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Building2, Bell, CreditCard, Users, Fingerprint, Wifi } from 'lucide-react';
import ProfileSettings from '@/components/settings/ProfileSettings';
import CompanySettings from '@/components/settings/CompanySettings';
import BillingSettings from '@/components/settings/BillingSettings';
import TeamSettings from '@/components/settings/TeamSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import PushNotificationManager from '@/components/PushNotificationManager';
import BiometricSettings from '@/components/BiometricSettings';
import SyncManager from '@/components/SyncManager';

const SettingsPage = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gradient">
          Paramètres
        </h1>
        <p className="text-gray-400 mt-2 text-sm">Gérez votre profil, votre société et vos préférences.</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-gray-900 border-gray-800 w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="profile" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <User className="w-4 h-4 mr-2" /> Profil
          </TabsTrigger>
          <TabsTrigger value="company" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <Building2 className="w-4 h-4 mr-2" /> Société
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <CreditCard className="w-4 h-4 mr-2" /> Facturation
          </TabsTrigger>
          <TabsTrigger value="team" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <Users className="w-4 h-4 mr-2" /> Équipe
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <Bell className="w-4 h-4 mr-2" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <Fingerprint className="w-4 h-4 mr-2" /> Sécurité
          </TabsTrigger>
          <TabsTrigger value="sync" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <Wifi className="w-4 h-4 mr-2" /> Sync
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="company" className="mt-6">
          <CompanySettings />
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <BillingSettings />
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <TeamSettings />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <BiometricSettings />
        </TabsContent>

        <TabsContent value="sync" className="mt-6">
          <SyncManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
