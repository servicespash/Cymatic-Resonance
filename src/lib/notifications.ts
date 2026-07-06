// Native Web Notifications + soft ringtone via Web Audio.

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied")
    return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function isWindowActive(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible" && document.hasFocus();
}

export function notify(title: string, opts: NotificationOptions & { onClick?: () => void } = {}) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (isWindowActive()) return; // suppress when user is here
  const { onClick, ...rest } = opts;
  try {
    const n = new Notification(title, { icon: "/favicon.ico", badge: "/favicon.ico", ...rest });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch (error) {
    console.error("Failed to show notification:", error);
  }
}

// Soft 2-tone ringtone via WebAudio using the centralized audio pipeline.
// Now uses the ringtone library for multiple style options.
export function createRingtone(style: "default" | "morning" | "gentle" | "modern" | "minimal" | "calm" | "zenith" | "whisper" | "pulse" = "default") {
  let stopFn: (() => void) | null = null;

  const start = () => {
    if (stopFn) return;
    try {
      // Lazy import to avoid circular dependencies
      import("@/audio/ringtone-library").then(({ createRingtonePlayer }) => {
        createRingtonePlayer(style).then((player) => {
          player.start();
          stopFn = () => {
            player.stop();
          };
        }).catch(console.error);
      }).catch(console.error);
    } catch (error) {
      console.error("Failed to start ringtone:", error);
    }
  };

  const stop = () => {
    stopFn?.();
    stopFn = null;
  };

  return { start, stop };
}
