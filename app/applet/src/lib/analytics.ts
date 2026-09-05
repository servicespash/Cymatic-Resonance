// src/lib/analytics.ts
// Simple, consent-aware analytics tracker

export const trackEvent = (eventName: string, properties?: Record<string, unknown>) => {
  if (localStorage.getItem("analytics-consent") !== "true") {
    return;
  }
  console.log(`Tracking event: ${eventName}`, properties);
};

export const setAnalyticsConsent = (granted: boolean) => {
  localStorage.setItem("analytics-consent", String(granted));
};
