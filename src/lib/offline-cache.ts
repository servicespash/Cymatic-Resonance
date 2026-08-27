// Lightweight localStorage cache so conversations, chats and tasks survive
// reloads, tab switches and temporary disconnections.

const PREFIX = "cym.cache.v1:";

export function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — cache is best-effort only
  }
}

/**
 * Runs `handler` whenever the app comes back: network restored or the tab
 * becomes visible again. Returns a cleanup function.
 */
export function onReconnect(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  const onVisible = () => {
    if (document.visibilityState === "visible") handler();
  };
  window.addEventListener("online", handler);
  window.addEventListener("focus", handler);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("focus", handler);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
