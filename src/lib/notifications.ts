// Native Web Notifications + soft ringtone via Web Audio.

export * from "@/lib/sound-library";
import { getNotificationPrefs, playSound, findSound } from "@/lib/sound-library";

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

// Ringtone loop using the user's selected sound preference.
export function createRingtone() {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const start = () => {
    if (timer) return;
    const prefs = getNotificationPrefs();
    const sound = findSound(prefs.ringtoneId);
    const cycle = sound.pattern.reduce((a, [, d]) => a + d, 0) * 1000 + 1400;
    const tick = () => {
      playSound(prefs.ringtoneId, { force: true });
      timer = setTimeout(tick, cycle);
    };
    tick();
  };

  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return { start, stop };
}
