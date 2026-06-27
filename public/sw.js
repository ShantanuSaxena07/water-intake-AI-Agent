// This background listener handles the incoming web push signal from the cloud
self.addEventListener('push', function (event) {
  if (!event.data) return;

  // Extract the notification text sent by our server
  const data = event.data.json();

  const options = {
    body: data.body,
    icon: '/icon.png', // Fallback display app icon path
    badge: '/badge.png', // Small status bar icon path
    vibrate: [200, 100, 200], // Vibration pattern for Android devices
    data: {
      url: data.url || '/'
    }
  };

  // Wake up the phone screen layout and issue the visual banner alert
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// If the user clicks on the notification banner, open up the tracking app link instantly
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});