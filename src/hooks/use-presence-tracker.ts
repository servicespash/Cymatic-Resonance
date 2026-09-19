import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePresenceTracker(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const updatePresence = async (isOnline: boolean) => {
      try {
        await supabase
          .from("profiles")
          .update({
            is_online: isOnline,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", userId);
      } catch (error) {
        console.error("[PresenceTracker] Error updating presence:", error);
      }
    };

    // Initial online status
    updatePresence(true);

    const handleVisibilityChange = () => {
      updatePresence(document.visibilityState === "visible");
    };

    const handleOnline = () => updatePresence(true);
    const handleOffline = () => updatePresence(false);

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Update last seen periodically (e.g., every 5 minutes) while active
    const heartbeatInterval = setInterval(
      () => {
        if (document.visibilityState === "visible") {
          updatePresence(true);
        }
      },
      1000 * 60 * 5,
    );

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(heartbeatInterval);

      // Set offline on unmount/close
      updatePresence(false);
    };
  }, [userId]);
}
