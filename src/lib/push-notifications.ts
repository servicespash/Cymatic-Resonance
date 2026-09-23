/**
 * Browser-based Push API & Notification manager for background and closed app alerts.
 */

export async function requestPushPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const res = await Notification.requestPermission();
    return res === "granted";
  }
  return false;
}

export function showPushNotification(title: string, options?: NotificationOptions) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(title, {
              icon: "/favicon.ico",
              badge: "/favicon.ico",
              ...options,
            });
          })
          .catch(() => {
            new Notification(title, options);
          });
      } else {
        new Notification(title, options);
      }
    } catch (err) {
      console.warn("[PushNotification] Failed to show notification:", err);
    }
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        showPushNotification(title, options);
      }
    });
  }
}
