// Notification manager — handles background notifications and ringtone for incoming calls.

import { createRingtone, ensureNotificationPermission, notify } from "@/lib/notifications";
import type { NotificationPayload } from "./types";

export class NotificationManager {
  private ringtone = createRingtone();
  private swRegistration: ServiceWorkerRegistration | null = null;
  private isAppActive = true;

  constructor() {
    ensureNotificationPermission().catch(console.error);
    this.registerServiceWorker().catch(console.error);
    this.setupActivityListeners();
    this.setupMessageListener();
  }

  // Register service worker for background notifications
  private async registerServiceWorker(): Promise<void> {
    if (!("serviceWorker" in navigator)) {
      console.log("[NotificationManager] Service Worker not supported");
      return;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register("/service-worker.js", {
        scope: "/",
      });
      console.log("[NotificationManager] Service Worker registered");
    } catch (error) {
      console.error("[NotificationManager] Service Worker registration failed:", error);
    }
  }

  // Track if app window is active/focused
  private setupActivityListeners(): void {
    window.addEventListener("focus", () => {
      this.isAppActive = true;
    });
    window.addEventListener("blur", () => {
      this.isAppActive = false;
    });
  }

  // Listen for messages from service worker
  private setupMessageListener(): void {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        const { type, payload } = event.data;
        if (type === "PLAY_RINGTONE") {
          this.ringtone.start();
        }
      });
    }
  }

  // Show incoming call notification with ringtone
  async showIncomingCall(payload: NotificationPayload): Promise<void> {
    try {
      // Start ringtone immediately
      this.ringtone.start();

      const title = `Incoming ${payload.kind} call`;
      const options: NotificationOptions = {
        tag: "incoming-call",
        requireInteraction: true,
        vibrate: [200, 100, 200],
        badge: "/badge-72x72.png",
      };

      // Use Web Notifications API for foreground notification
      if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification(title, options);
        notification.addEventListener("click", () => {
          this.stopRingtone();
          window.focus();
        });
      }

      // Also use traditional notify for in-app notification
      notify(title, {
        body: `${payload.kind} call incoming...`,
        onClick: () => {
          this.stopRingtone();
        },
      });

      console.log("[NotificationManager] Incoming call notification shown");
    } catch (error) {
      console.error("[NotificationManager] Error showing notification:", error);
    }
  }

  // Send push notification via service worker (for backgrounded app)
  async sendBackgroundNotification(payload: NotificationPayload): Promise<void> {
    if (!this.swRegistration) {
      console.warn("[NotificationManager] Service Worker not ready for push notifications");
      return;
    }

    try {
      // In a real app, this would come from a server push notification
      // For now, we use the local notification approach
      await this.showIncomingCall(payload);
    } catch (error) {
      console.error("[NotificationManager] Error sending background notification:", error);
    }
  }

  // Stop ringtone
  stopRingtone(): void {
    this.ringtone.stop();
  }

  // Play notification sound for call state changes
  playNotificationSound(type: "accept" | "decline" | "end"): void {
    // Stop the ringtone and optionally play a different sound
    this.ringtone.stop();
  }

  // Check if app is in background
  isAppBackground(): boolean {
    return !this.isAppActive;
  }

  // Cleanup
  destroy(): void {
    this.stopRingtone();
  }
}
