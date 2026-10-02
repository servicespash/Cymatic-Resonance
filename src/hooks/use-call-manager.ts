import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { LiveKitTransport } from "./livekit-transport";
import { joinCallChannel } from "@/lib/webrtc/signaling";
import { createPeer, getLocalMedia } from "@/lib/webrtc/peer";
import { playDialTone } from "@/lib/notifications";
import { Database } from "@/integrations/supabase/types";

export type CallState = "idle" | "dialing" | "ringing" | "active" | "error";

export type CallSessionMemberInsert =
  Database["public"]["Tables"]["call_participants"]["Insert"] & {
    joined_at?: string | null;
  };

export type CallSessionMemberUpdate =
  Database["public"]["Tables"]["call_participants"]["Update"] & {
    joined_at?: string | null;
  };

export type CallSessionMemberOperation = CallSessionMemberInsert | CallSessionMemberUpdate;

type SignalConnection = ReturnType<typeof joinCallChannel>;

export function useCallManager(channelId: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<CallState>("idle");
  const [participants, setParticipants] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const signaling = useRef<SignalConnection | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const stopDialTone = useRef<() => void>(() => {});
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const makingOffer = useRef(false);
  const remotePeerId = useRef<string | null>(null);
  const pendingLocalIce = useRef<RTCIceCandidateInit[]>([]);

  const transport = useMemo(() => new LiveKitTransport(), []);

  useEffect(() => {
    transport.onParticipantsChange(setParticipants);
  }, [transport]);

  useEffect(() => {
    return () => {
      void signaling.current?.leave();
      localStream.current?.getTracks().forEach((track) => track.stop());
      peer.current?.close();
      void transport.disconnect();
      stopDialTone.current();
    };
  }, [transport]);

  const flushPendingIce = useCallback(async () => {
    const connection = peer.current;
    if (!connection?.remoteDescription) return;

    const candidates = pendingIce.current.splice(0);
    for (const candidate of candidates) {
      await connection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const negotiate = useCallback(
    async (remoteUserId: string) => {
      const connection = peer.current;
      if (!connection || !signaling.current || connection.signalingState !== "stable") {
        return;
      }

      try {
        makingOffer.current = true;
        await connection.setLocalDescription();
        const description = connection.localDescription;
        if (!description) throw new Error("WebRTC did not produce a local description");

        await signaling.current.send({
          type: "offer",
          from: user!.id,
          to: remoteUserId,
          sdp: description,
        });
      } finally {
        makingOffer.current = false;
      }
    },
    [user],
  );

  const joinCall = useCallback(async () => {
    if (!channelId || !user) return;

    setState("dialing");
    stopDialTone.current = playDialTone();

    try {
      const { data: existing, error: existingError } = await supabase
        .from("calls")
        .select("id, status")
        .eq("channel_id", channelId)
        .in("status", ["ringing", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      let callId = existing?.id ?? null;
      if (!callId) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile?.org_id) throw new Error("No workspace found");

        const { data: created, error: createError } = await supabase
          .from("calls")
          .insert({
            channel_id: channelId,
            org_id: profile.org_id,
            initiator_id: user.id,
            kind: "audio",
            status: "ringing",
          })
          .select("id")
          .single();

        if (createError) throw createError;
        callId = created.id;
      }

      setRoomId(callId);
      setState(existing ? "ringing" : "dialing");

      const { error: admissionError } = await supabase.rpc("admit_call_room_participant", {
        _call_id: callId,
        _user_id: user.id,
      });
      if (admissionError) {
        const isMissingRpc =
          admissionError.code === "PGRST202" ||
          admissionError.message?.includes("Could not find the function") ||
          admissionError.message?.includes("schema cache") ||
          admissionError.message?.includes("admit_call_room_participant");

        if (isMissingRpc) {
          console.warn(
            "[CallManager] admit_call_room_participant RPC unavailable, using fallback participant registration",
          );
          try {
            await supabase.from("call_participants").upsert(
              {
                call_id: callId,
                user_id: user.id,
                state: "joined",
                joined_at: new Date().toISOString(),
              } as CallSessionMemberInsert,
              { onConflict: "call_id,user_id" },
            );
          } catch (err) {
            console.warn("[CallManager] participant registration warning:", err);
          }
          try {
            await supabase.rpc("join_call", { _call_id: callId, _device_info: "web" });
          } catch {
            // ignore
          }
        } else {
          throw admissionError;
        }
      }

      localStream.current = await getLocalMedia(false);
      const connection = createPeer({
        onIceCandidate: (candidate) => {
          const target = remotePeerId.current;
          if (!target) {
            pendingLocalIce.current.push(candidate);
            return;
          }
          void signaling.current?.send({
            type: "ice",
            from: user.id,
            to: target,
            candidate,
          });
        },
        onRemoteStream: (stream) => setRemoteStream(stream),
        onConnectionStateChange: (connectionState) => {
          if (connectionState === "connected") {
            stopDialTone.current();
            setState("active");
          } else if (connectionState === "failed" || connectionState === "closed") {
            stopDialTone.current();
            setState("error");
          } else if (connectionState === "disconnected" && state !== "idle" && state !== "error") {
            setState("ringing");
          }
        },
      });

      peer.current = connection;
      localStream.current.getTracks().forEach((track) => {
        connection.addTrack(track, localStream.current!);
      });

      signaling.current = joinCallChannel(callId, user.id, async (signal) => {
        if (!peer.current) return;

        try {
          if (signal.type === "hello") {
            remotePeerId.current = signal.from;
            for (const candidate of pendingLocalIce.current.splice(0)) {
              await signaling.current?.send({
                type: "ice",
                from: user.id,
                to: signal.from,
                candidate,
              });
            }
            await negotiate(signal.from);
            return;
          }

          if (signal.type === "bye") {
            setState("idle");
            return;
          }

          if (signal.type === "offer") {
            remotePeerId.current = signal.from;
            const polite = user.id < signal.from;
            const offerCollision = makingOffer.current || peer.current.signalingState !== "stable";

            if (!polite && offerCollision) return;

            if (offerCollision) {
              await peer.current.setLocalDescription({ type: "rollback" });
            }

            await peer.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            await flushPendingIce();

            const answer = await peer.current.createAnswer();
            await peer.current.setLocalDescription(answer);
            const description = peer.current.localDescription;
            if (!description) throw new Error("WebRTC did not produce an answer");

            await signaling.current?.send({
              type: "answer",
              from: user.id,
              to: signal.from,
              sdp: description,
            });
            return;
          }

          if (signal.type === "answer") {
            remotePeerId.current = signal.from;
            await peer.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            await flushPendingIce();
            return;
          }

          if (signal.type === "ice") {
            if (peer.current.remoteDescription) {
              await peer.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } else {
              pendingIce.current.push(signal.candidate);
            }
          }
        } catch (error) {
          console.error("[WebRTC] Signaling failure:", error);
          setState("error");
        }
      });

      await transport.connect(callId, user.id);
    } catch (error) {
      console.error("Failed to join call:", error);
      stopDialTone.current();
      localStream.current?.getTracks().forEach((track) => track.stop());
      localStream.current = null;
      peer.current?.close();
      peer.current = null;
      if (roomId && user) {
        try {
          const { error } = await supabase.rpc("leave_call_room", { _call_id: roomId });
          if (error) {
            await supabase
              .from("call_participants")
              .update({ state: "left", left_at: new Date().toISOString() })
              .eq("call_id", roomId)
              .eq("user_id", user.id);
          }
        } catch {
          try {
            await supabase
              .from("call_participants")
              .update({ state: "left", left_at: new Date().toISOString() })
              .eq("call_id", roomId)
              .eq("user_id", user.id);
          } catch {
            // ignore
          }
        }
      }
      await signaling.current?.leave();
      signaling.current = null;
      setRoomId(null);
      setState("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, flushPendingIce, negotiate, transport, user]);

  const leaveCall = useCallback(async () => {
    stopDialTone.current();
    localStream.current?.getTracks().forEach((track) => track.stop());
    localStream.current = null;
    peer.current?.close();
    peer.current = null;
    pendingIce.current = [];
    pendingLocalIce.current = [];
    remotePeerId.current = null;
    makingOffer.current = false;

    await signaling.current?.leave();
    signaling.current = null;
    await transport.disconnect();

    setRemoteStream(null);
    setRoomId(null);
    setState("idle");
  }, [transport]);

  return {
    state,
    participants,
    remoteStream,
    joinCall,
    leaveCall,
  };
}
