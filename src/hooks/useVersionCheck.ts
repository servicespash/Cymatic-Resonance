import { useState, useEffect, useCallback } from "react";

export function useVersionCheck(checkIntervalMs = 60 * 1000) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [initialVersion, setInitialVersion] = useState<string | null>(null);
  const [userDismissed, setUserDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
      // Offline or network error
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

  const dismissUpdate = () => {
    setUserDismissed(true);
    setShowModal(false);
  };

  const openUpdateModal = () => {
    setShowModal(true);
  };

  const reloadApp = () => {
    window.location.reload();
  };

  return {
    hasUpdate,
    userDismissed,
    showModal,
    dismissUpdate,
    openUpdateModal,
    reloadApp,
  };
}
