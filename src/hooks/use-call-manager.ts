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

export function useCallManager(channelId: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<CallState>("idle");
  const [participants, setParticipants] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);

  const signaling = useRef<ReturnType<typeof joinCallChannel> | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const stopDialTone = useRef<() => void>(() => {});

  const transport = useMemo(() => new LiveKitTransport(), []);

  useEffect(() => {
    transport.onParticipantsChange(setParticipants);
  }, [transport]);

  const joinCall = useCallback(async () => {
    if (!channelId || !user) return;
    setState("dialing");
    stopDialTone.current = playDialTone();

    try {
      const { data: existing } = await supabase
        .from("calls")
        .select("id, status")
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

        const { data: created } = await supabase
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
        callId = created!.id;
      }
      setRoomId(callId);

      // P2P Handshake Setup
      localStream.current = await getLocalMedia(false);
      peer.current = createPeer({
        onIceCandidate: (c) =>
          signaling.current?.send({ type: "ice", from: user.id, to: "remote", candidate: c }),
        onRemoteStream: (stream) => console.log("Received remote stream:", stream),
        onConnectionStateChange: (s) => {
          console.log("Connection state:", s);
          if (s === "connected") {
            stopDialTone.current();
            setState("active");
          }
        },
      });
      localStream.current
        .getTracks()
        .forEach((t) => peer.current!.addTrack(t, localStream.current!));

      signaling.current = joinCallChannel(callId, user.id, async (sig) => {
        if (sig.type === "hello") {
          const offer = await peer.current!.createOffer();
          await peer.current!.setLocalDescription(offer);
          signaling.current!.send({ type: "offer", from: user.id, to: sig.from, sdp: offer });
        } else if (sig.type === "offer") {
          await peer.current!.setRemoteDescription(new RTCSessionDescription(sig.sdp));
          const answer = await peer.current!.createAnswer();
          await peer.current!.setLocalDescription(answer);
          signaling.current!.send({ type: "answer", from: user.id, to: sig.from, sdp: answer });
        } else if (sig.type === "answer") {
          await peer.current!.setRemoteDescription(new RTCSessionDescription(sig.sdp));
        } else if (sig.type === "ice") {
          await peer.current!.addIceCandidate(new RTCIceCandidate(sig.candidate));
        }
      });

      await transport.connect(callId, user.id);
    } catch (err) {
      console.error("Failed to join call:", err);
      setState("error");
    }
  }, [channelId, user, transport]);

  const leaveCall = useCallback(async () => {
    if (!roomId || !user) return;

    localStream.current?.getTracks().forEach((t) => t.stop());
    peer.current?.close();
    await signaling.current?.leave();
    await transport.disconnect();

    setRoomId(null);
    setState("idle");
  }, [roomId, user, transport]);

  return { state, participants, joinCall, leaveCall };
}
