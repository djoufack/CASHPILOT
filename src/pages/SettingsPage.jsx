
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Shield, Wifi, Fingerprint } from 'lucide-react';
import PushNotificationManager from '@/components/PushNotificationManager';
import BiometricSettings from '@/components/BiometricSettings';
import SyncManager from '@/components/SyncManager';

const SettingsPage = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-200 to-gray-400 bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-gray-400 mt-2 text-sm">Configure your application preferences.</p>
      </div>

      <Tabs defaultValue="notifications" className="w-full">
        <TabsList className="bg-gray-900 border-gray-800 w-full justify-start overflow-x-auto">
          <TabsTrigger value="notifications" className="data-[state=active]:bg-gray-800">
             <Bell className="w-4 h-4 mr-2" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-gray-800">
             <Fingerprint className="w-4 h-4 mr-2" /> Security
          </TabsTrigger>
          <TabsTrigger value="sync" className="data-[state=active]:bg-gray-800">
             <Wifi className="w-4 h-4 mr-2" /> Sync & Offline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-6">
           <PushNotificationManager />
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
