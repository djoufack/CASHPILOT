
// Simple Service Worker for Push Notifications

// Ensure this runs in a Service Worker context
if (typeof self !== 'undefined' && self.registration) {
  self.addEventListener('push', function(event) {
    if (event.data) {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: '/favicon.ico',
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: 1
        },
        actions: [
          {action: 'explore', title: 'View Details'}
        ]
      };
      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    }
  });

  self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
      self.clients.matchAll({type: 'window'}).then(function(clientList) {
        // Check if there's already a window/tab open with the target URL
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window/tab with the target URL
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
    );
  });
}
