// src/hooks/usePushNotifications.ts
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

      // Safely store push subscription via Supabase table or relative backend
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from("push_subscriptions").upsert(
          {
            subscription: JSON.stringify(subscription),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (error) console.log("Stored push subscription locally:", subscription);
      } catch {
        // Fallback or ignore if table isn't present
      }
    } catch (err) {
      console.error("Push notification registration failed:", err);
    }
  }, []);

  return { register };
}
