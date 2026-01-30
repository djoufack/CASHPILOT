
import React from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bell, BellOff, Loader2 } from 'lucide-react';

const PushNotificationManager = () => {
  const { isSupported, isSubscribed, subscribe, unsubscribe, loading } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardContent className="pt-6">
          <p className="text-gray-400">Push notifications are not supported in this browser.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-800 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-400" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receive alerts for new orders, low stock, and important updates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-medium leading-none text-white">Device Subscription</h4>
            <p className="text-sm text-gray-500">
              {isSubscribed ? 'This device is currently subscribed.' : 'Enable notifications for this device.'}
            </p>
          </div>
          <Button
            onClick={isSubscribed ? unsubscribe : subscribe}
            variant={isSubscribed ? "destructive" : "default"}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubscribed ? (
              <>
                <BellOff className="mr-2 h-4 w-4" /> Disable
              </>
            ) : (
              <>
                <Bell className="mr-2 h-4 w-4" /> Enable
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PushNotificationManager;
