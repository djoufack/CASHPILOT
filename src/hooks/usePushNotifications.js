
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      registerServiceWorker();
    } else {
      setLoading(false);
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        setIsSubscribed(true);
        setSubscription(sub);
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToPushNotifications = async () => {
    if (!isSupported) return;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
      });

      setSubscription(sub);
      setIsSubscribed(true);

      // Save to Supabase
      if (user) {
        const { keys } = sub.toJSON();
        await supabase.from('push_subscriptions').insert({
          user_id: user.id,
          endpoint: sub.endpoint,
          auth_key: keys.auth,
          p256dh_key: keys.p256dh,
          device_type: navigator.userAgent
        });
        toast({ title: 'Subscribed', description: 'Push notifications enabled.' });
      }
    } catch (error) {
      console.error('Failed to subscribe:', error);
      toast({ title: 'Error', description: 'Could not enable push notifications.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeFromPushNotifications = async () => {
    if (!subscription) return;
    setLoading(true);
    try {
      await subscription.unsubscribe();
      setIsSubscribed(false);
      setSubscription(null);
      
      if (user) {
        await supabase.from('push_subscriptions')
          .update({ is_active: false })
          .eq('endpoint', subscription.endpoint);
      }
      toast({ title: 'Unsubscribed', description: 'Push notifications disabled.' });
    } catch (error) {
      console.error('Error unsubscribing', error);
    } finally {
      setLoading(false);
    }
  };

  return { isSupported, isSubscribed, subscribe: subscribeToPushNotifications, unsubscribe: unsubscribeFromPushNotifications, loading };
};
