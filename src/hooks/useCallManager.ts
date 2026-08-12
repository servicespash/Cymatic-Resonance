import { useReducer, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LiveKitTransport } from "./livekit-transport";
import { audioEngine } from "@/lib/audio-engine";

export type CallStatus = "idle" | "dialing" | "ringing" | "connecting" | "connected" | "error";

type CallState = {
  status: CallStatus;
  error: string | null;
};

type CallAction =
  | { type: "START_DIALING" }
  | { type: "START_RINGING" }
  | { type: "CONNECTING" }
  | { type: "CONNECT_SUCCESS" }
  | { type: "CONNECT_FAILURE"; error: string }
  | { type: "LEAVE" };

const callReducer = (state: CallState, action: CallAction): CallState => {
  switch (action.type) {
    case "START_DIALING":
      return { status: "dialing", error: null };
    case "START_RINGING":
      return { status: "ringing", error: null };
    case "CONNECTING":
      return { status: "connecting", error: null };
    case "CONNECT_SUCCESS":
      return { status: "connected", error: null };
    case "CONNECT_FAILURE":
      return { status: "error", error: action.error };
    case "LEAVE":
      return { status: "idle", error: null };
    default:
      return state;
  }
};

export function useCallManager(channelId: string | null) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(callReducer, { status: "idle", error: null });
  const [participants, setParticipants] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);

  const transport = useMemo(() => new LiveKitTransport(), []);

  useEffect(() => {
    transport.onParticipantsChange(setParticipants);
  }, [transport]);

  // Audio lifecycle managed deterministically by call state transitions
  useEffect(() => {
    const status = state.status;
    if (status === "dialing") {
      // Professional continuous dialtone cadence: 350Hz pure tone
      audioEngine.startLoop("dialtone", [[350, 1.5]], "sine", 2000, 0.3);
    } else if (status === "ringing") {
      // Premium double-pulse ringtone loop: Executive cadence
      audioEngine.startLoop(
        "ringtone",
        [
          [440, 0.4],
          [0, 0.2],
          [440, 0.4],
        ],
        "sine",
        3000,
        0.4,
      );
    } else if (status === "connected") {
      audioEngine.stopAllLoops();
      // Premium ascending connection sweep
      audioEngine.playTone(520, 0.02, 0.05, 0.8, 0.05, 0.12, "sine", 0.5);
      setTimeout(() => {
        audioEngine.playTone(780, 0.02, 0.05, 0.8, 0.05, 0.2, "sine", 0.5);
      }, 100);
    } else {
      audioEngine.stopAllLoops();
    }

    return () => {
      audioEngine.stopAllLoops();
    };
  }, [state.status]);

  const joinCall = useCallback(async () => {
    if (!channelId || !user) return;
    dispatch({ type: "START_DIALING" });

    try {
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
        dispatch({ type: "START_RINGING" });
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

      dispatch({ type: "CONNECTING" });
      const { error } = await supabase.rpc("join_call", { _call_id: callId });
      if (error) throw error;

      setRoomId(callId);
      await transport.connect(callId, user.id);
      dispatch({ type: "CONNECT_SUCCESS" });
    } catch (err) {
      console.error("Failed to join call:", err);
      dispatch({
        type: "CONNECT_FAILURE",
        error: err instanceof Error ? err.message : "Unknown error",
      });
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
      dispatch({ type: "LEAVE" });
    } catch (err) {
      console.error("Failed to leave call:", err);
    }
  }, [roomId, user, transport]);

  return { state, participants, joinCall, leaveCall };
}
