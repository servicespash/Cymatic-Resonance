// Signaling via authenticated Supabase Realtime Broadcast channels.
// Each call gets its own private channel `call-{callId}`.

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
  onSignal: (payload: SignalPayload) => void,
): {
  channel: RealtimeChannel;
  send: (payload: SignalPayload) => Promise<void>;
  leave: () => Promise<void>;
} {
  const channel = supabase.channel(`call-${callId}`, {
    config: {
      private: true,
      broadcast: { self: false, ack: true },
      presence: { key: selfId },
    },
  });

  channel.on("broadcast", { event: "signal" }, ({ payload }) => {
    const signal = payload as SignalPayload;
    if ("to" in signal && signal.to !== selfId) return;
    if (signal.from === selfId) return;
    onSignal(signal);
  });

  channel.subscribe(async (status) => {
    if (status !== "SUBSCRIBED") {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("[WebRTC] Call signaling subscription failed:", status);
      }
      return;
    }

    try {
      await channel.track({
        user_id: selfId,
        online_at: new Date().toISOString(),
      });

      const sendStatus = await channel.send({
        type: "broadcast",
        event: "signal",
        payload: { type: "hello", from: selfId } as SignalPayload,
      });

      if (sendStatus !== "ok") {
        console.error("[WebRTC] Failed to announce call presence:", sendStatus);
      }
    } catch (error) {
      console.error("[WebRTC] Failed to initialize call signaling:", error);
    }
  });

  return {
    channel,
    send: async (payload) => {
      const status = await channel.send({
        type: "broadcast",
        event: "signal",
        payload,
      });
      if (status !== "ok") {
        throw new Error(`Realtime signaling send failed: ${status}`);
      }
    },
    leave: async () => {
      try {
        await channel.send({
          type: "broadcast",
          event: "signal",
          payload: { type: "bye", from: selfId } as SignalPayload,
        });
      } catch (error) {
        console.error("[WebRTC] Failed to send leave signal:", error);
      }
      await supabase.removeChannel(channel);
    },
  };
}
