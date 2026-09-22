import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { LiveKitTransport } from "./livekit-transport";
import { subscribeToCallSignaling } from "@/lib/call-signaling";

export type CallState = "idle" | "dialing" | "ringing" | "active" | "error";

export function useCallManager(channelId: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<CallState>("idle");
  const [participants, setParticipants] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const signalingRef = useRef<ReturnType<typeof subscribeToCallSignaling> | null>(null);

  // High-end: Inject transport
  const transport = useMemo(() => new LiveKitTransport(), []);

  useEffect(() => {
    transport.onParticipantsChange(setParticipants);
    // Add listener for active call
    transport.onStateChange((newState) => {
        if (newState === 'connected') setState('active');
        else if (newState === 'connecting') setState('dialing');
    });
  }, [transport]);

  const joinCall = useCallback(async () => {
    if (!channelId || !user) return;
    setState("dialing");

    try {
      // Find an active call on this channel, otherwise start one.
      const { data: existing } = await supabase
        .from("calls")
        .select("id, status")
        .eq("channel_id", channelId)
        .in("status", ["ringing", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let callId = existing?.id ?? null;
      
      if (existing?.status === 'ringing') setState('ringing');

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
            status: "ringing"
          })
          .select("id")
          .single();
        if (createError) throw createError;
        callId = created.id;
        setState("ringing");
      }

      const { error } = await supabase.rpc("join_call", { _call_id: callId });
      if (error) throw error;

      setRoomId(callId);
      
      // Initialize signaling for P2P fallback
      signalingRef.current = subscribeToCallSignaling(callId, (signal) => {
          console.log("[Call Manager] Received signal:", signal);
          if (signal.type === 'ringing') setState('ringing');
      });
      await signalingRef.current.sendSignal("ringing", user.id);

      await transport.connect(callId, user.id);
      
    } catch (err) {
      console.error("Failed to join call:", err);
      setState("error");
    }
  }, [channelId, user, transport]);

  const leaveCall = useCallback(async () => {
    if (!roomId || !user) return;

    try {
      if (signalingRef.current) {
          await signalingRef.current.sendSignal("hangup", user.id);
          signalingRef.current.unsubscribe();
          signalingRef.current = null;
      }
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
