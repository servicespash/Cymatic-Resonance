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

// Soft 2-tone ringtone via WebAudio — no asset required.
export function createRingtone() {
  let ctx: AudioContext | null = null;
  let stopFn: (() => void) | null = null;

  const start = () => {
    if (stopFn) return;
    try {
      ctx = new (
        window.AudioContext ||
        (window as unknown as Window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      const gain = ctx.createGain();
      gain.gain.value = 0.15;
      gain.connect(ctx.destination);

      let cancelled = false;
      const playPair = () => {
        if (cancelled || !ctx) return;
        const tones = [880, 660];
        tones.forEach((freq, i) => {
          const osc = ctx!.createOscillator();
          const g = ctx!.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          osc.connect(g);
          g.connect(gain);
          const t0 = ctx!.currentTime + i * 0.35;
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(1, t0 + 0.03);
          g.gain.linearRampToValueAtTime(0, t0 + 0.3);
          osc.start(t0);
          osc.stop(t0 + 0.32);
        });
        setTimeout(playPair, 2200);
      };
      playPair();
      stopFn = () => {
        cancelled = true;
        ctx?.close();
        ctx = null;
      };
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
