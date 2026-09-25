import { useEffect } from "react";
import type { Database } from "@/integrations/supabase/types";

type Call = Database["public"]["Tables"]["calls"]["Row"];

export function useCallNotifications(
  incoming: Call | null,
  ringtoneRef: { start: () => void; stop: () => void },
) {
  useEffect(() => {
    if (incoming) {
      ringtoneRef.start();
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    }
  }, [incoming, ringtoneRef]);
}
