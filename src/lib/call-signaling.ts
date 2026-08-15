import { supabase } from "@/integrations/supabase/client";

export interface CallSignalPayload {
  callId: string;
  senderId: string;
  type: "offer" | "answer" | "candidate" | "hangup" | "ringing";
  payload?: Record<string, unknown>;
}

export function subscribeToCallSignaling(
  callId: string,
  onSignal: (signal: CallSignalPayload) => void
) {
  const channel = supabase.channel(`call-signal:${callId}`, {
    config: {
      broadcast: { self: false },
    },
  });

  channel
    .on("broadcast", { event: "signal" }, (response) => {
      if (response && response.payload) {
        onSignal(response.payload as CallSignalPayload);
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`[Cymatic Resonance] Signaling active for room: ${callId}`);
      }
    });

  return {
    sendSignal: async (
      type: CallSignalPayload["type"],
      senderId: string,
      payload?: Record<string, unknown>
    ) => {
      await channel.send({
        type: "broadcast",
        event: "signal",
        payload: { callId, senderId, type, payload },
      });
    },
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}
