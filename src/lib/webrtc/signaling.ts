// Signaling via Supabase Realtime Broadcast channels.
// Each call gets its own channel `call-{callId}`; peers broadcast targeted
// offers/answers/ICE candidates keyed by the recipient's user_id.

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type SignalPayload =
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: "hello"; from: string }
  | { type: "bye"; from: string };

export function joinCallChannel(
  callId: string,
  selfId: string,
  onSignal: (p: SignalPayload) => void,
): {
  channel: RealtimeChannel;
  send: (payload: SignalPayload) => Promise<void>;
  leave: () => Promise<void>;
} {
  const channel = supabase.channel(`call-${callId}`, {
    config: { broadcast: { self: false, ack: false }, presence: { key: selfId } },
  });

  channel.on("broadcast", { event: "signal" }, ({ payload }) => {
    const p = payload as SignalPayload;
    // Drop messages not addressed to us (except hello/bye which are broadcasts)
    if ("to" in p && p.to !== selfId) return;
    if (p.from === selfId) return;
    onSignal(p);
  });

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ user_id: selfId, online_at: new Date().toISOString() });
      await channel.send({
        type: "broadcast",
        event: "signal",
        payload: { type: "hello", from: selfId } as SignalPayload,
      });
    }
  });

  return {
    channel,
    send: async (payload: SignalPayload) => {
      await channel.send({ type: "broadcast", event: "signal", payload });
    },
    leave: async () => {
      try {
        await channel.send({
          type: "broadcast",
          event: "signal",
          payload: { type: "bye", from: selfId } as SignalPayload,
        });
      } catch (error) {
        console.error("Failed to send leave signal:", error);
      }
      await supabase.removeChannel(channel);
    },
  };
}
