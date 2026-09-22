import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Call = Database["public"]["Tables"]["calls"]["Row"];
type ParticipantState = Database["public"]["Enums"]["participant_state"];

export interface CallManager {
  activeCall: Call | null;
  participants: any[];
  isHost: boolean;
  isJoining: boolean;
  startCall: (channelId: string, recipientIds: string[], kind: "audio" | "video") => Promise<void>;
  joinCall: (callId: string) => Promise<void>;
  leaveCall: () => Promise<void>;
  declineCall: (callId: string) => Promise<void>;
}

export function useCallManager() {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const activeCallRef = useRef<Call | null>(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const isHost = activeCall?.initiator_id === user?.id;

  // Cleanup/Termination logic
  const terminateCall = useCallback(async (callId: string) => {
    await supabase
      .from("calls")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", callId);
    setActiveCall(null);
  }, []);

  const leaveCall = useCallback(async () => {
    if (!activeCall || !user) return;
    const callId = activeCall.id;
    const initiatorId = activeCall.initiator_id;

    try {
      await supabase
        .from("call_participants")
        .update({ state: "left", left_at: new Date().toISOString() })
        .eq("call_id", callId)
        .eq("user_id", user.id);

      const { data: allParticipants } = await supabase
        .from("call_participants")
        .select("user_id, state")
        .eq("call_id", callId);

      const joinedCount = allParticipants?.filter((p) => p.state === "joined").length ?? 0;
      const totalParticipants = allParticipants?.length ?? 0;

      // Forced Exit: If host leaves, end for everyone
      if (user.id === initiatorId) {
        await terminateCall(callId);
        return;
      }

      // If it's a 1-on-1 and I leave, end it
      if (totalParticipants <= 2) {
        await terminateCall(callId);
        return;
      }

      // If I'm the last one, end it
      if (joinedCount === 0) {
        await terminateCall(callId);
      }
    } catch (err) {
      console.error("Error leaving call:", err);
    } finally {
      setActiveCall(null);
    }
  }, [activeCall, user, terminateCall]);

  // Listen for external terminations (e.g. host left)
  useEffect(() => {
    if (!activeCall?.id) return;

    const channel = supabase
      .channel(`call-manager-${activeCall.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `id=eq.${activeCall.id}`,
        },
        (payload) => {
          const updatedCall = payload.new as Call;
          if (updatedCall.status === "ended") {
            setActiveCall(null);
            toast.info("Call ended");
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_participants",
          filter: `call_id=eq.${activeCall.id}`,
        },
        async () => {
          const { data } = await supabase
            .from("call_participants")
            .select("*")
            .eq("call_id", activeCall.id);
          if (data) setParticipants(data);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCall?.id]);

  const startCall = useCallback(
    async (channelId: string, recipientIds: string[], kind: "audio" | "video") => {
      if (!user) return;
      setIsJoining(true);
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("id", user.id)
          .single();

        if (!profile?.org_id) throw new Error("No organization found");

        const { data: call, error: callError } = await supabase
          .from("calls")
          .insert({
            channel_id: channelId,
            org_id: profile.org_id,
            initiator_id: user.id,
            kind,
            status: "ringing",
          })
          .select()
          .single();

        if (callError || !call) throw callError;

        const rows = [
          {
            call_id: call.id,
            user_id: user.id,
            state: "joined",
            joined_at: new Date().toISOString(),
          },
          ...recipientIds.map((id) => ({
            call_id: call.id,
            user_id: id,
            state: "invited",
          })),
        ];

        await supabase.from("call_participants").insert(rows);
        setActiveCall(call);
      } catch (err) {
        console.error("Failed to start call:", err);
        toast.error("Failed to initiate call");
      } finally {
        setIsJoining(false);
      }
    },
    [user],
  );

  const joinCall = useCallback(
    async (callId: string) => {
      if (!user) return;
      setIsJoining(true);
      try {
        await supabase.from("call_participants").upsert(
          {
            call_id: callId,
            user_id: user.id,
            state: "joined",
            joined_at: new Date().toISOString(),
          },
          { onConflict: "call_id,user_id" },
        );

        const { data: call } = await supabase.from("calls").select("*").eq("id", callId).single();

        if (call) {
          if (call.status === "ringing") {
            await supabase.from("calls").update({ status: "active" }).eq("id", callId);
          }
          setActiveCall(call);
        }
      } catch (err) {
        console.error("Failed to join call:", err);
        toast.error("Failed to join call");
      } finally {
        setIsJoining(false);
      }
    },
    [user],
  );

  const declineCall = useCallback(
    async (callId: string) => {
      if (!user) return;
      await supabase
        .from("call_participants")
        .update({ state: "declined" })
        .eq("call_id", callId)
        .eq("user_id", user.id);
    },
    [user],
  );

  return {
    activeCall,
    participants,
    isHost,
    isJoining,
    startCall,
    joinCall,
    leaveCall,
    declineCall,
    setActiveCall,
  };
}
