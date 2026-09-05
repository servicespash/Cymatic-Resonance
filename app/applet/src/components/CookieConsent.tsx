import React, { useState, useEffect } from "react";
import { setAnalyticsConsent } from "@/lib/analytics";

export const CookieConsent = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("analytics-consent");
    if (consent === null) {
      setShow(true);
    }
  }, []);

  const handleConsent = (granted: boolean) => {
    setAnalyticsConsent(granted);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-lg bg-background/90 p-4 shadow-lg backdrop-blur-sm md:left-auto md:w-96">
      <p className="mb-4 text-sm text-foreground">
        We use analytics to improve your experience. Do you consent to tracking?
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => handleConsent(true)}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Accept
        </button>
        <button
          onClick={() => handleConsent(false)}
          className="rounded bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/90"
        >
          Decline
        </button>
      </div>
    </div>
  );
};
