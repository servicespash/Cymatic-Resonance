// Notification manager — handles incoming call notifications with ringtone.

import { createRingtone, ensureNotificationPermission, notify } from "@/lib/notifications";
import type { NotificationPayload } from "./types";

export class NotificationManager {
  private ringtone = createRingtone();

  constructor() {
    ensureNotificationPermission().catch(console.error);
  }

  // Show incoming call notification with ringtone
  async showIncomingCall(payload: NotificationPayload): Promise<void> {
    try {
      // Start ringtone immediately
      this.ringtone.start();

      // Get caller name for notification
      const callerName = "caller"; // Will be passed in payload.senderName

      // Show notification (only if window is not active)
      notify(`Incoming ${payload.kind} call`, {
        body: `${callerName} is calling...`,
        onClick: () => {
          this.stopRingtone();
        },
      });

      console.log("[NotificationManager] Incoming call notification shown");
    } catch (error) {
      console.error("[NotificationManager] Error showing notification:", error);
    }
  }

  // Stop ringtone
  stopRingtone(): void {
    this.ringtone.stop();
  }

  // Play notification sound for call ended, declined, etc.
  playNotificationSound(type: "accept" | "decline" | "end"): void {
    // For now, just stop ringtone. In Phase 2, we'll add more sounds.
    this.ringtone.stop();
  }

  // Destroy
  destroy(): void {
    this.stopRingtone();
  }
}
