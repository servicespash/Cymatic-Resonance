import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { LiveKitTransport } from "./livekit-transport";

export type CallState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export function useCallManager(channelId: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<CallState>("idle");
  const [participants, setParticipants] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);

  // High-end: Inject transport
  const transport = useMemo(() => new LiveKitTransport(), []);

  useEffect(() => {
    transport.onParticipantsChange(setParticipants);
  }, [transport]);

  const joinCall = useCallback(async () => {
    if (!channelId || !user) return;
    setState("connecting");

    try {
      // Find an active call on this channel, otherwise start one.
      const { data: existing } = await supabase
        .from("calls")
        .select("id")
        .eq("channel_id", channelId)
        .in("status", ["ringing", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let callId = existing?.id ?? null;

      if (!callId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("id", user.id)
          .maybeSingle();
        if (!profile?.org_id) throw new Error("No workspace found");

        const { data: created, error: createError } = await supabase
          .from("calls")
          .insert({
            channel_id: channelId,
            org_id: profile.org_id,
            initiator_id: user.id,
            kind: "audio",
          })
          .select("id")
          .single();
        if (createError) throw createError;
        callId = created.id;
      }

      const { error } = await supabase.rpc("join_call", { _call_id: callId });
      if (error) throw error;

      setRoomId(callId);
      await transport.connect(callId, user.id);
      setState("connected");
    } catch (err) {
      console.error("Failed to join call:", err);
      setState("error");
    }
  }, [channelId, user, transport]);

  const leaveCall = useCallback(async () => {
    if (!roomId || !user) return;

    try {
      await supabase
        .from("call_participants")
        .update({ state: "left", left_at: new Date().toISOString() })
        .eq("call_id", roomId)
        .eq("user_id", user.id);

      await transport.disconnect();
      setRoomId(null);
      setState("idle");
    } catch (err) {
      console.error("Failed to leave call:", err);
    }
  }, [roomId, user, transport]);

  return { state, participants, joinCall, leaveCall };
}
