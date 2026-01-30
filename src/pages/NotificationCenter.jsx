
import React from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCheck, Trash2, Bell, AlertTriangle, FileText, Package } from 'lucide-react';

const NotificationCenter = () => {
  const { notifications, markAsRead, deleteNotification, loading } = useNotifications();

  const getIcon = (type) => {
      switch(type) {
          case 'stock_alert': return <AlertTriangle className="h-5 w-5 text-red-500" />;
          case 'invoice_received': return <FileText className="h-5 w-5 text-blue-500" />;
          case 'order_created': return <Package className="h-5 w-5 text-green-500" />;
          default: return <Bell className="h-5 w-5 text-gray-400" />;
      }
  };

  return (
    <div className="p-8 min-h-screen bg-gray-950 text-white max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Notification Center</h1>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-gray-700 text-gray-300">
                Mark all read
            </Button>
            <Button variant="outline" size="sm" className="border-gray-700 text-gray-300">
                Preferences
            </Button>
        </div>
      </div>

      <div className="space-y-4">
          {notifications.map((notification) => (
              <Card key={notification.id} className={`bg-gray-900 border-gray-800 ${!notification.is_read ? 'border-l-4 border-l-blue-500' : ''}`}>
                  <CardContent className="p-4 flex items-start gap-4">
                      <div className="mt-1 bg-gray-800 p-2 rounded-full">
                          {getIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                          <div className="flex justify-between items-start">
                              <h3 className={`font-semibold ${!notification.is_read ? 'text-white' : 'text-gray-400'}`}>
                                  {notification.title}
                              </h3>
                              <span className="text-xs text-gray-500">
                                  {new Date(notification.created_at).toLocaleString()}
                              </span>
                          </div>
                          <p className="text-gray-400 text-sm mt-1">{notification.message}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                          {!notification.is_read && (
                              <Button variant="ghost" size="icon" onClick={() => markAsRead(notification.id)} title="Mark as read">
                                  <CheckCheck className="h-4 w-4 text-blue-400" />
                              </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => deleteNotification(notification.id)} title="Delete">
                              <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-400" />
                          </Button>
                      </div>
                  </CardContent>
              </Card>
          ))}
          
          {notifications.length === 0 && !loading && (
              <div className="text-center py-20 text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No notifications to display.</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default NotificationCenter;
