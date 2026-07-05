import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CallTransport } from "./call-transport";
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
      const { data, error } = await (supabase as any).rpc("join_call", { _channel_id: channelId });
      if (error) throw error;

      const cId = data.call_id;
      setRoomId(cId);

      await transport.connect(cId, user.id);

      setState("connected");
    } catch (err) {
      console.error("Failed to join call:", err);
      setState("error");
    }
  }, [channelId, user, transport]);

  const leaveCall = useCallback(async () => {
    if (!roomId) return;

    try {
      await (supabase as any).rpc("leave_call", { _call_id: roomId });

      await transport.disconnect();
      setRoomId(null);
      setState("idle");
    } catch (err) {
      console.error("Failed to leave call:", err);
    }
  }, [roomId, transport]);

  return { state, participants, joinCall, leaveCall };
}
