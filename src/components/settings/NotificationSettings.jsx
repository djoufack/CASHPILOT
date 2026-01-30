
import React, { useState, useEffect } from 'react';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BellRing, Mail } from 'lucide-react';

const NotificationSettings = () => {
  const { preferences, loading, updatePreferences, resetToDefault } = useNotificationSettings();
  const [localPrefs, setLocalPrefs] = useState(preferences);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  const handleToggle = (category, setting) => {
    const updated = {
      ...localPrefs,
      [category]: {
        ...localPrefs[category],
        [setting]: !localPrefs[category][setting]
      }
    };
    setLocalPrefs(updated);
  };

  const handleFrequencyChange = (value) => {
     setLocalPrefs({ ...localPrefs, frequency: value });
  };

  const saveChanges = () => {
     updatePreferences(localPrefs);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
         {/* Email Notifications */}
         <Card className="bg-gray-900 border-gray-800 text-white">
            <CardHeader>
               <div className="flex items-center gap-2">
                  <Mail className="text-orange-400" />
                  <CardTitle>Email Notifications</CardTitle>
               </div>
               <CardDescription className="text-gray-400">Choose what you receive via email.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               {[
                  { id: 'newTasks', label: 'New Tasks Assigned' },
                  { id: 'overdueTasks', label: 'Overdue Tasks' },
                  { id: 'projectUpdates', label: 'Project Status Updates' },
                  { id: 'comments', label: 'Comments on Tasks' },
                  { id: 'reminders', label: 'Deadline Reminders' }
               ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                     <Label htmlFor={item.id} className="flex-1 cursor-pointer">{item.label}</Label>
                     <Switch 
                        id={item.id} 
                        checked={localPrefs.email?.[item.id]} 
                        onCheckedChange={() => handleToggle('email', item.id)}
                        className="data-[state=checked]:bg-orange-500"
                     />
                  </div>
               ))}
            </CardContent>
         </Card>

         {/* Push Notifications */}
         <Card className="bg-gray-900 border-gray-800 text-white">
            <CardHeader>
               <div className="flex items-center gap-2">
                  <BellRing className="text-yellow-400" />
                  <CardTitle>Push Notifications</CardTitle>
               </div>
               <CardDescription className="text-gray-400">Real-time alerts in the browser.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
                  <Label className="font-bold">Enable Push Notifications</Label>
                  <Switch 
                     checked={localPrefs.push?.enabled}
                     onCheckedChange={() => handleToggle('push', 'enabled')}
                     className="data-[state=checked]:bg-green-500"
                  />
               </div>
               
               <div className={localPrefs.push?.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
                  <div className="flex items-center justify-between mb-4">
                     <Label>New Task Alerts</Label>
                     <Switch 
                        checked={localPrefs.push?.newTasks}
                        onCheckedChange={() => handleToggle('push', 'newTasks')}
                     />
                  </div>
                  <div className="flex items-center justify-between">
                     <Label>Comment Mentions</Label>
                     <Switch 
                        checked={localPrefs.push?.comments}
                        onCheckedChange={() => handleToggle('push', 'comments')}
                     />
                  </div>
               </div>
            </CardContent>
         </Card>
      </div>

      {/* Frequency */}
      <Card className="bg-gray-900 border-gray-800 text-white">
         <CardHeader>
            <CardTitle>Notification Frequency</CardTitle>
            <CardDescription className="text-gray-400">How often do you want to be notified?</CardDescription>
         </CardHeader>
         <CardContent>
            <RadioGroup value={localPrefs.frequency} onValueChange={handleFrequencyChange} className="space-y-3">
               <div className="flex items-center space-x-2">
                  <RadioGroupItem value="immediate" id="r1" className="border-gray-500 text-orange-500" />
                  <Label htmlFor="r1">Immediate (As they happen)</Label>
               </div>
               <div className="flex items-center space-x-2">
                  <RadioGroupItem value="daily" id="r2" className="border-gray-500 text-orange-500" />
                  <Label htmlFor="r2">Daily Digest (Once a day)</Label>
               </div>
               <div className="flex items-center space-x-2">
                  <RadioGroupItem value="weekly" id="r3" className="border-gray-500 text-orange-500" />
                  <Label htmlFor="r3">Weekly Summary (Every Monday)</Label>
               </div>
            </RadioGroup>
         </CardContent>
      </Card>

      <div className="flex justify-end gap-4 pt-4">
         <Button variant="outline" onClick={resetToDefault} className="border-gray-700 text-gray-300">Reset to Default</Button>
         <Button onClick={saveChanges} disabled={loading} className="bg-orange-500 hover:bg-orange-600 min-w-[120px]">
            {loading ? 'Saving...' : 'Save Changes'}
         </Button>
      </div>
    </div>
  );
};

export default NotificationSettings;
