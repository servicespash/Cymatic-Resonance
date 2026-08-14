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

// Soft 2-tone ringtone via WebAudio — loops for ~60 seconds.
export function createRingtone() {
  let ctx: AudioContext | null = null;
  let stopFn: (() => void) | null = null;
  let timeoutId: number | null = null;

  const start = () => {
    if (stopFn) return;
    try {
      ctx = new (
        window.AudioContext ||
        (window as unknown as Window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      const gain = ctx.createGain();
      gain.gain.value = 0.2;
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
          const t0 = ctx!.currentTime + i * 0.4;
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(1, t0 + 0.05);
          g.gain.linearRampToValueAtTime(0, t0 + 0.35);
          osc.start(t0);
          osc.stop(t0 + 0.38);
        });
        setTimeout(playPair, 2500);
      };
      playPair();

      // Auto stop after 60 seconds (~1 minute loop limit)
      timeoutId = window.setTimeout(() => {
        stop();
      }, 60000);

      stopFn = () => {
        cancelled = true;
        if (timeoutId) clearTimeout(timeoutId);
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

// Dial tone for outgoing calls
export function playDialTone() {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    const gain = ctx.createGain();
    gain.gain.value = 0.1;
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.value = 350;
    osc2.frequency.value = 440;
    osc1.connect(gain);
    osc2.connect(gain);

    osc1.start();
    osc2.start();

    return () => {
      try {
        osc1.stop();
        osc2.stop();
        ctx.close();
      } catch {
        // ignore
      }
    };
  } catch {
    return () => {};
  }
}

export function playCallConnected() {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  } catch {
    // ignore audio errors
  }
}

export function getNotificationPrefs() {
  return { sound: true, desktop: true, showEncryptionBadges: true };
}
