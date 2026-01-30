
import React from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';

const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-gray-400 hover:text-white">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-gray-900" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-gray-900 border-gray-800 text-white" align="end">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h4 className="font-semibold">Notifications</h4>
          <span className="text-xs text-gray-500">{unreadCount} unread</span>
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No notifications yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {notifications.slice(0, 5).map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-4 hover:bg-gray-800/50 transition cursor-pointer ${!notification.is_read ? 'bg-blue-900/10' : ''}`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <p className="text-sm font-medium mb-1">{notification.title}</p>
                  <p className="text-xs text-gray-400 line-clamp-2">{notification.message}</p>
                  <p className="text-[10px] text-gray-500 mt-2">
                    {new Date(notification.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t border-gray-800 text-center">
          <Link to="/notifications">
            <Button variant="ghost" size="sm" className="w-full text-xs text-blue-400 hover:text-blue-300">
              View All
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
