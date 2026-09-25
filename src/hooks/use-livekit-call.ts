import { useEffect, useState, useCallback, useRef } from "react";
import { Room, RoomEvent, ConnectionQuality, RemoteParticipant, Track } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { CameraManager } from "@/lib/camera-manager";
import { joinCallChannel, type SignalPayload } from "@/lib/webrtc/signaling";
import { createPeer } from "@/lib/webrtc/peer";

export type RemotePeer = {
  userId: string;
  stream: MediaStream | null;
  state: RTCPeerConnectionState;
  connectionQuality: ConnectionQuality;
};

export function useLiveKitCall(opts: {
  callId: string | null;
  selfId: string | null;
  video: boolean;
  enabled: boolean;
  isHost: boolean;
}) {
  const { callId, selfId, video, enabled, isHost } = opts;

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [torchOn, setTorchOn] = useState(false);
  const [filter, setFilter] = useState<string>("none");

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<Record<string, RemotePeer>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(video);
  const [networkQuality, setNetworkQuality] = useState<ConnectionQuality>(
    ConnectionQuality.Excellent,
  );
  const [isCallAnswered, setIsCallAnswered] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const micStateRef = useRef(micOn);
  const camStateRef = useRef(camOn);

  const localStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // P2P WebRTC Refs
  const signalingRef = useRef<ReturnType<typeof joinCallChannel> | null>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});

  useEffect(() => {
    micStateRef.current = micOn;
  }, [micOn]);

  useEffect(() => {
    camStateRef.current = camOn;
  }, [camOn]);

  const syncLocalTracks = useCallback(async () => {
    const room = roomRef.current;

    // If room is connected, use LiveKit's participant management
    if (room && room.state === "connected") {
      try {
        await room.localParticipant.setMicrophoneEnabled(micStateRef.current);
        await room.localParticipant.setCameraEnabled(camStateRef.current);

        const tracks: MediaStreamTrack[] = [];
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);

        if (camPub?.track?.mediaStreamTrack && !camPub.isMuted) {
          tracks.push(camPub.track.mediaStreamTrack);
        }
        if (micPub?.track?.mediaStreamTrack && !micPub.isMuted) {
          tracks.push(micPub.track.mediaStreamTrack);
        }

        const stream = tracks.length > 0 ? new MediaStream(tracks) : null;
        setLocalStream(stream);
        return stream;
      } catch (err) {
        console.error("[Cymatic Resonance] Local track sync error:", err);
      }
    }

    // Fallback/Initial: Direct getUserMedia
    if (camStateRef.current || micStateRef.current) {
      try {
        const stream = await CameraManager.requestPermissions(
          camStateRef.current,
          micStateRef.current,
        );
        setLocalStream(stream);
        return stream;
      } catch (err) {
        console.error("[useLiveKitCall] CameraManager failed:", err);
        setLocalStream(null);
        return null;
      }
    } else {
      CameraManager.stopStream();
      setLocalStream(null);
      return null;
    }
  }, []);

  const getOrCreatePeer = useCallback(
    (userId: string, stream: MediaStream | null, isAnswered: boolean) => {
      if (peerConnections.current[userId]) return peerConnections.current[userId];

      console.log(`[useLiveKitCall] Creating P2P PeerConnection for ${userId}`);
      const pc = createPeer({
        onIceCandidate: (c) => {
          signalingRef.current?.send({ type: "ice", from: selfId!, to: userId, candidate: c });
        },
        onRemoteStream: (remoteStream) => {
          setRemotes((prev) => ({
            ...prev,
            [userId]: {
              ...prev[userId],
              userId,
              stream: remoteStream,
              state: "connected",
              connectionQuality: ConnectionQuality.Excellent,
            },
          }));
          setIsCallAnswered(true);
        },
        onConnectionStateChange: (state) => {
          console.log(`[useLiveKitCall] P2P state for ${userId}:`, state);
          if (state === "connected") {
            setIsCallAnswered(true);
          }
          setRemotes((prev) => ({
            ...prev,
            [userId]: {
              ...prev[userId],
              userId,
              state:
                state === "connected"
                  ? "connected"
                  : state === "connecting"
                    ? "connecting"
                    : "disconnected",
            },
          }));
        },
      });

      if (isAnswered && stream) {
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      }

      peerConnections.current[userId] = pc;
      return pc;
    },
    [selfId],
  );

  useEffect(() => {
    // Re-sync tracks when call is answered
    if (isCallAnswered) {
        Object.entries(peerConnections.current).forEach(([userId, pc]) => {
            const stream = localStreamRef.current;
            if (stream) {
                stream.getTracks().forEach((t) => {
                    const sender = pc.getSenders().find(s => s.track?.kind === t.kind);
                    if (sender) sender.replaceTrack(t);
                    else pc.addTrack(t, stream);
                });
            }
        });
    }
  }, [isCallAnswered]);

  const updateRemotes = useCallback(() => {
    // ... same as before
  }, []);

  useEffect(() => {
    if (!enabled || !callId || !selfId) return;

    let cancelled = false;

    // 1. Initialize P2P Signaling
    signalingRef.current = joinCallChannel(callId, selfId, async (sig: SignalPayload) => {
      if (cancelled) return;

      const currentStream = localStreamRef.current;

      if (sig.type === "hello") {
        // New participant joined, we are already here, so we send an offer
        const pc = getOrCreatePeer(sig.from, currentStream, isCallAnswered);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signalingRef.current?.send({ type: "offer", from: selfId, to: sig.from, sdp: offer });
      } else if (sig.type === "offer") {
        const pc = getOrCreatePeer(sig.from, currentStream, isCallAnswered);
        await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signalingRef.current?.send({ type: "answer", from: selfId, to: sig.from, sdp: answer });
      } else if (sig.type === "answer") {
        const pc = peerConnections.current[sig.from];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
        }
      } else if (sig.type === "ice") {
        const pc = peerConnections.current[sig.from];
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
        }
      } else if (sig.type === "bye") {
        const pc = peerConnections.current[sig.from];
        if (pc) {
          pc.close();
          delete peerConnections.current[sig.from];
        }
        setRemotes((prev) => {
          const next = { ...prev };
          delete next[sig.from];
          return next;
        });
      }
    });

    // 2. Initialize LiveKit (if available)
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: { simulcast: true, videoCodec: "vp8" },
      videoCaptureDefaults: { resolution: { width: 640, height: 360 } },
    });
    roomRef.current = room;

    const setupCall = async () => {
      await syncLocalTracks();
      if (cancelled) return;

      try {
        const { data: sfData, error: sfError } = await supabase.functions.invoke<{
          token?: string;
        }>("livekit-token", {
          body: { roomName: callId, isHost },
        });

        if (sfError || !sfData?.token || !import.meta.env.VITE_LIVEKIT_URL) {
          console.info("[useLiveKitCall] LiveKit unavailable, continuing with P2P only.");
          return;
        }

        const token = sfData.token;
        const url = import.meta.env.VITE_LIVEKIT_URL;

        await room.connect(url, token);
        if (cancelled) {
          await room.disconnect();
          return;
        }

        await syncLocalTracks();
        updateRemotes();

        room.on(RoomEvent.ParticipantConnected, updateRemotes);
        room.on(RoomEvent.ParticipantDisconnected, updateRemotes);
        room.on(RoomEvent.TrackSubscribed, () => {
          updateRemotes();
          syncLocalTracks();
        });
        room.on(RoomEvent.TrackUnsubscribed, () => {
          updateRemotes();
          syncLocalTracks();
        });
        room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
          if (!participant || participant === room.localParticipant) {
            setNetworkQuality(quality);
          } else {
            updateRemotes();
          }
        });
      } catch (err) {
        console.warn("[useLiveKitCall] LiveKit connection failed, fallback to P2P:", err);
      }
    };

    setupCall();

    return () => {
      cancelled = true;
      signalingRef.current?.leave();
      signalingRef.current = null;

      Object.values(peerConnections.current).forEach((pc) => pc.close());
      peerConnections.current = {};

      if (roomRef.current) {
        roomRef.current.localParticipant.trackPublications.forEach((pub) => {
          if (pub.track) pub.track.stop();
        });
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      CameraManager.stopStream();
      setLocalStream(null);
      setRemotes({});
      setIsCallAnswered(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, callId, selfId, isHost, video]);

  const toggleMic = useCallback(async () => {
    const next = !micOn;
    setMicOn(next);
    micStateRef.current = next;

    if (roomRef.current && roomRef.current.state === "connected") {
      await roomRef.current.localParticipant.setMicrophoneEnabled(next);
    }
    await syncLocalTracks();
  }, [micOn, syncLocalTracks]);

  const toggleCam = useCallback(async () => {
    const next = !camOn;
    setCamOn(next);
    camStateRef.current = next;

    if (roomRef.current && roomRef.current.state === "connected") {
      const room = roomRef.current;
      if (next) {
        await room.localParticipant.setCameraEnabled(true);
      } else {
        await room.localParticipant.setCameraEnabled(false);
      }
    }
    await syncLocalTracks();
  }, [camOn, syncLocalTracks]);

  const flipCamera = useCallback(async () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);

    if (roomRef.current && roomRef.current.state === "connected") {
      const room = roomRef.current;
      // In a real LiveKit implementation, you might need to create a new track
      // for the new device and swap it. This is a simplified placeholder.
      await room.localParticipant.setCameraEnabled(false);
      await room.localParticipant.setCameraEnabled(true);
    }
  }, [facingMode]);

  const toggleTorch = useCallback(async () => {
    const next = !torchOn;
    setTorchOn(next);

    // LiveKit torch control
    const track = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    if (track && "applyConstraints" in track.mediaStreamTrack) {
      // @ts-expect-error - Torch not in standard types yet
      await track.mediaStreamTrack.applyConstraints({ advanced: [{ torch: next }] });
    }
  }, [torchOn]);

  return {
    localStream,
    remotes: Object.values(remotes),
    micOn,
    camOn,
    networkQuality,
    isCallAnswered,
    toggleMic,
    toggleCam,
    flipCamera,
    toggleTorch,
    facingMode,
    setFacingMode,
    torchOn,
    setTorchOn,
    filter,
    setFilter,
  };
}
