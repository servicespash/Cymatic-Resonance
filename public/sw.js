// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  // Create an Audio element in the background to handle the loop
  const audio = new Audio('/ringtones/call-incoming.mp3');
  audio.loop = true;
  
  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/badge.png',
    data: { url: data.url },
    actions: [{ action: 'join', title: 'Join Call' }],
    requireInteraction: true // Keep notification until acted upon
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      audio.play().catch(e => console.error("Audio play failed:", e))
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
