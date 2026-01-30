
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCheck, Trash2, Bell, AlertTriangle, FileText, Package, Settings, CreditCard, Users, Clock } from 'lucide-react';

const NotificationCenter = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, loading } = useNotifications();
  const navigate = useNavigate();

  const getIcon = (type) => {
    switch (type) {
      case 'stock_alert': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'invoice_received':
      case 'invoice': return <FileText className="h-5 w-5 text-blue-500" />;
      case 'order_created':
      case 'order': return <Package className="h-5 w-5 text-green-500" />;
      case 'payment': return <CreditCard className="h-5 w-5 text-emerald-500" />;
      case 'client': return <Users className="h-5 w-5 text-purple-500" />;
      case 'reminder': return <Clock className="h-5 w-5 text-amber-500" />;
      default: return <Bell className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    if (diffD < 7) return `Il y a ${diffD}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="p-8 min-h-screen bg-gray-950 text-white max-w-4xl mx-auto flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400">Chargement des notifications...</p>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen bg-gray-950 text-white max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gradient">Centre de notifications</h1>
          {unreadCount > 0 && (
            <Badge className="bg-orange-500 text-white text-sm px-2 py-0.5">
              {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300 hover:text-white hover:border-orange-500"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Tout marquer comme lu
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="border-gray-700 text-gray-300 hover:text-white hover:border-orange-500"
            onClick={() => navigate('/settings?tab=notifications')}
          >
            <Settings className="h-4 w-4 mr-2" />
            Préférences
          </Button>
        </div>
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            className={`bg-gray-900 border-gray-800 transition-all duration-200 hover:border-gray-700 ${
              !notification.is_read ? 'border-l-4 border-l-orange-500 bg-gray-900/80' : 'opacity-75'
            }`}
          >
            <CardContent className="p-4 flex items-start gap-4">
              <div className="mt-1 bg-gray-800 p-2.5 rounded-full shrink-0">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <h3 className={`font-semibold truncate ${!notification.is_read ? 'text-white' : 'text-gray-400'}`}>
                    {notification.title || 'Notification'}
                  </h3>
                  <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                    {formatDate(notification.created_at)}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-1">{notification.message}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!notification.is_read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => markAsRead(notification.id)}
                    title="Marquer comme lu"
                    className="hover:bg-gray-800"
                  >
                    <CheckCheck className="h-4 w-4 text-orange-400" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteNotification(notification.id)}
                  title="Supprimer"
                  className="hover:bg-gray-800"
                >
                  <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-400" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Empty state */}
        {notifications.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <div className="bg-gray-900 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <Bell className="h-10 w-10 opacity-30" />
            </div>
            <p className="text-lg font-medium text-gray-400 mb-2">Aucune notification</p>
            <p className="text-sm text-gray-600">
              Vous recevrez des notifications pour les factures, paiements et alertes importantes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
