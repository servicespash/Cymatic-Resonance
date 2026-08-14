// src/hooks/usePushNotifications.ts
import { useCallback } from "react";

export function usePushNotifications() {
  const register = useCallback(async (publicKeyBase64: string) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.error("Push notifications not supported");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      // Convert URL-safe base64 to Uint8Array
      const padding = "=".repeat((4 - (publicKeyBase64.length % 4)) % 4);
      const b64 = (publicKeyBase64 + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = window.atob(b64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray,
      });

      // Absolute local Supabase development URL (graceful fallback if not running)
      try {
        const response = await fetch(
          "http://localhost:54321/functions/v1/store-push-subscription",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription),
          },
        );

        if (!response.ok) {
          console.warn("Failed to store push subscription on server:", response.statusText);
        } else {
          console.log("Push subscription stored");
        }
      } catch (fetchErr) {
        console.warn(
          "Push subscription server unreachable (local edge function not running):",
          fetchErr,
        );
      }
    } catch (err) {
      console.error("Push notification registration failed:", err);
    }
  }, []);

  return { register };
}
