
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Building2, Bell, CreditCard, Users, Fingerprint, Wifi, Palette, Coins, HardDrive, ShieldAlert } from 'lucide-react';
import ProfileSettings from '@/components/settings/ProfileSettings';
import CompanySettings from '@/components/settings/CompanySettings';
import BillingSettings from '@/components/settings/BillingSettings';
import TeamSettings from '@/components/settings/TeamSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import InvoiceCustomization from '@/components/settings/InvoiceCustomization';
import CreditsPurchase from '@/components/CreditsPurchase';
import BackupSettings from '@/components/settings/BackupSettings';
import PushNotificationManager from '@/components/PushNotificationManager';
import BiometricSettings from '@/components/BiometricSettings';
import SyncManager from '@/components/SyncManager';
import DangerZoneSettings from '@/components/settings/DangerZoneSettings';

const TAB_MAP = {
  profil: 'profile',
  societe: 'company',
  facturation: 'billing',
  equipe: 'team',
  notifications: 'notifications',
  securite: 'security',
  sync: 'sync',
  factures: 'invoices',
  credits: 'credits',
  backup: 'backup',
  sauvegarde: 'backup',
  gdpr: 'danger',
  danger: 'danger'
};

const SettingsPage = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const defaultTab = TAB_MAP[tabParam] || tabParam || 'profile';

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gradient">
          Paramètres
        </h1>
        <p className="text-gray-400 mt-2 text-sm">Gérez votre profil, votre société et vos préférences.</p>
      </div>

      <Tabs defaultValue={defaultTab} key={defaultTab} className="w-full">
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
          <TabsTrigger value="invoices" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <Palette className="w-4 h-4 mr-2" /> Factures
          </TabsTrigger>
          <TabsTrigger value="credits" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <Coins className="w-4 h-4 mr-2" /> Credits
          </TabsTrigger>
          <TabsTrigger value="backup" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <HardDrive className="w-4 h-4 mr-2" /> Backup
          </TabsTrigger>
          <TabsTrigger value="sync" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <Wifi className="w-4 h-4 mr-2" /> Sync
          </TabsTrigger>
          <TabsTrigger value="danger" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400">
            <ShieldAlert className="w-4 h-4 mr-2" /> GDPR
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

        <TabsContent value="invoices" className="mt-6">
          <InvoiceCustomization />
        </TabsContent>

        <TabsContent value="credits" className="mt-6">
          <CreditsPurchase />
        </TabsContent>

        <TabsContent value="backup" className="mt-6">
          <BackupSettings />
        </TabsContent>

        <TabsContent value="sync" className="mt-6">
          <SyncManager />
        </TabsContent>

        <TabsContent value="danger" className="mt-6">
          <DangerZoneSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
