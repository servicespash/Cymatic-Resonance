import { useState, useEffect, useCallback } from "react";

export function useVersionCheck(checkIntervalMs = 5 * 60 * 1000) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [initialVersion, setInitialVersion] = useState<string | null>(null);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;

      const data = await res.json();
      const currentVer = `${data.version}_${data.buildTime}`;

      if (!initialVersion) {
        setInitialVersion(currentVer);
      } else if (currentVer !== initialVersion) {
        setHasUpdate(true);
      }
    } catch {
      // Offline or network error; ignore quietly
    }
  }, [initialVersion]);

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, checkIntervalMs);

    const onFocus = () => checkVersion();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkVersion, checkIntervalMs]);

  const reloadApp = () => {
    window.location.reload();
  };

  return { hasUpdate, reloadApp };
}
