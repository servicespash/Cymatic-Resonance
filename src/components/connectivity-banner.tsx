import React, { useState, useEffect } from 'react';

export function ConnectivityBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] p-2">
      <div className="glass-strong mx-auto max-w-sm rounded-lg px-4 py-2 text-center text-xs font-bold text-destructive shadow-lg">
        You are currently offline.
      </div>
    </div>
  );
}
