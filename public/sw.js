// public/sw.js
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "New Message",
      body: event.data ? event.data.text() : "You have a new message",
      url: "/_authenticated/comms",
    };
  }

  const title = data.title || "Cymatic Notification";
  const options = {
    body: data.body || "New message received",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { url: data.url || "/_authenticated/comms" },
    actions:
      data.type === "call"
        ? [{ action: "join", title: "Join Call" }]
        : [{ action: "open", title: "Open Chat" }],
    requireInteraction: data.type === "call" || data.requireInteraction || false,
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/_authenticated/comms";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
