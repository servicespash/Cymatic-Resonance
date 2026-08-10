// Native Web Notifications + soft ringtone & message chime via Web Audio.

export type NotificationPreferences = {
  messageSound: boolean;
  callRingtone: boolean;
  browserPush: boolean;
  callBanner: boolean;
  encryptedChatMode: boolean;
  showEncryptionBadges: boolean;
};

const DEFAULT_PREFS: NotificationPreferences = {
  messageSound: true,
  callRingtone: true,
  browserPush: true,
  callBanner: true,
  encryptedChatMode: true,
  showEncryptionBadges: true,
};

export function getNotificationPrefs(): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem("cy_notification_prefs");
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveNotificationPrefs(
  prefs: Partial<NotificationPreferences>,
): NotificationPreferences {
  const current = getNotificationPrefs();
  const updated = { ...current, ...prefs };
  if (typeof window !== "undefined") {
    localStorage.setItem("cy_notification_prefs", JSON.stringify(updated));
  }
  return updated;
}

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
  const prefs = getNotificationPrefs();
  if (!prefs.browserPush) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (isWindowActive()) return; // suppress when user is actively focused
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

// Play a pleasant double-chime when a new message arrives
export function playMessageChime() {
  const prefs = getNotificationPrefs();
  if (!prefs.messageSound) return;
  if (typeof window === "undefined") return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5 triad chime

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(noteGain);
      noteGain.connect(gain);

      const t0 = now + idx * 0.08;
      noteGain.gain.setValueAtTime(0, t0);
      noteGain.gain.linearRampToValueAtTime(1, t0 + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);

      osc.start(t0);
      osc.stop(t0 + 0.36);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch (e) {
    console.error("Failed to play message chime:", e);
  }
}

// Soft 2-tone ringtone via WebAudio — no asset required.
export function createRingtone() {
  let ctx: AudioContext | null = null;
  let stopFn: (() => void) | null = null;

  const start = () => {
    const prefs = getNotificationPrefs();
    if (!prefs.callRingtone) return;
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

// Pleasant chime for call connection
export function playCallConnected() {
  const prefs = getNotificationPrefs();
  if (!prefs.callRingtone) return;
  if (typeof window === "undefined") return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = 0.2;
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const freqs = [659.25, 783.99]; // E5, G5

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(noteGain);
      noteGain.connect(gain);

      const t0 = now + idx * 0.1;
      noteGain.gain.setValueAtTime(0, t0);
      noteGain.gain.linearRampToValueAtTime(1, t0 + 0.05);
      noteGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);

      osc.start(t0);
      osc.stop(t0 + 0.41);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch (e) {
    console.error("Failed to play connection chime:", e);
  }
}
