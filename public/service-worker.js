// Service Worker for background notifications
// Handles incoming call notifications even when app is closed/backgrounded

const NOTIFICATION_TAG = "incoming-call";
const NOTIFICATION_OPTIONS = {
  icon: "/icon-192x192.png",
  badge: "/badge-72x72.png",
  vibrate: [200, 100, 200],
  tag: NOTIFICATION_TAG,
  requireInteraction: true,
  actions: [
    { action: "accept", title: "Accept", icon: "/icons/accept.svg" },
    { action: "decline", title: "Decline", icon: "/icons/decline.svg" },
  ],
};

// Listen for push notifications from server
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.log("[SW] Push received without data");
    return;
  }

  try {
    const data = event.data.json();
    const { type, callId, senderId, senderName, kind } = data;

    if (type === "incoming-call") {
      const title = `${senderName || "Someone"} is calling`;
      const options = {
        ...NOTIFICATION_OPTIONS,
        body: `${kind === "video" ? "Video" : "Audio"} call from ${senderName || "Unknown"}`,
        data: {
          callId,
          senderId,
          kind,
          type: "incoming-call",
        },
      };

      event.waitUntil(self.registration.showNotification(title, options));
      
      // Play ringtone in service worker context
      playRingtone();
    } else if (type === "call-update") {
      const { status, message } = data;
      const options = {
        ...NOTIFICATION_OPTIONS,
        body: message || `Call status: ${status}`,
        data: { callId, type: "call-update", status },
        requireInteraction: status === "ended",
      };

      event.waitUntil(self.registration.showNotification("Call Update", options));
    }
  } catch (error) {
    console.error("[SW] Error processing push:", error);
  }
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const { callId, senderId, kind, type } = event.notification.data;
  const action = event.action;

  if (action === "accept") {
    // Open app and accept call
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientList) => {
        for (let client of clientList) {
          if (client.url === "/" && "focus" in client) {
            client.focus();
            client.postMessage({
              type: "ACCEPT_CALL",
              payload: { callId, senderId, kind },
            });
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(`/?callId=${callId}`).then((client) => {
            if (client) {
              client.postMessage({
                type: "ACCEPT_CALL",
                payload: { callId, senderId, kind },
              });
            }
          });
        }
      })
    );
  } else if (action === "decline") {
    // Decline call via API
    event.waitUntil(
      fetch("/api/calls/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      }).catch(console.error)
    );
  } else {
    // Default: open the app focused on the call
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientList) => {
        for (let client of clientList) {
          if ("focus" in client) {
            client.focus();
            client.postMessage({
              type: "FOCUS_CALL",
              payload: { callId },
            });
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(`/?callId=${callId}`);
        }
      })
    );
  }
});

// Helper to play ringtone in service worker
function playRingtone() {
  // Service Worker can't directly play audio, but we can request the client to play it
  self.clients
    .matchAll()
    .then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: "PLAY_RINGTONE",
          payload: {},
        });
      });
    })
    .catch(console.error);
}

// Handle service worker activation
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Clean up old caches if needed
          return caches.delete(cacheName);
        })
      );
    })
  );
});
