// Signaling via Supabase `call_signals` table with `postgres_changes`.

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
  const channel = supabase.channel(`call-signals-${callId}`);

  channel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "call_signals",
        filter: `call_id=eq.${callId}`,
      },
      (payload) => {
        const p = payload.new as { payload: SignalPayload };
        const signal = p.payload;
        // Drop messages not addressed to us (except hello/bye which are broadcasts)
        if ("to" in signal && signal.to !== selfId) return;
        if (signal.from === selfId) return;
        onSignal(signal);
      },
    )
    .subscribe();

  // Send "hello" to announce presence
  supabase.from("call_signals").insert({
    call_id: callId,
    from_uid: selfId,
    type: "hello",
    payload: { type: "hello", from: selfId },
  });

  return {
    channel,
    send: async (payload: SignalPayload) => {
      await supabase.from("call_signals").insert({
        call_id: callId,
        from_uid: selfId,
        to_uid: "to" in payload ? payload.to : null,
        type: payload.type,
        payload,
      });
    },
    leave: async () => {
      await supabase.from("call_signals").insert({
        call_id: callId,
        from_uid: selfId,
        type: "bye",
        payload: { type: "bye", from: selfId },
      });
      supabase.removeChannel(channel);
    },
  };
}
