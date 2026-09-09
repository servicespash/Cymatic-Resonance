import { useEffect, useState, useCallback, useRef } from "react";
import { Room, RoomEvent, ConnectionQuality, RemoteParticipant, Track } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";

export type RemotePeer = {
  userId: string;
  stream: MediaStream | null;
  state: "connected" | "disconnected" | "connecting";
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

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<Record<string, RemotePeer>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(video);
  const [networkQuality, setNetworkQuality] = useState<ConnectionQuality>(
    ConnectionQuality.Excellent,
  );
  const [error, setError] = useState<string | null>(null);
  const [isCallAnswered, setIsCallAnswered] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const micStateRef = useRef(micOn);
  const camStateRef = useRef(camOn);

  useEffect(() => {
    micStateRef.current = micOn;
  }, [micOn]);

  useEffect(() => {
    camStateRef.current = camOn;
  }, [camOn]);

  const syncLocalTracks = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;

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

      setLocalStream(tracks.length > 0 ? new MediaStream(tracks) : null);
    } catch (err) {
      console.error("[Cymatic Resonance] Local track sync error:", err);
    }
  }, []);

  const updateRemotes = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const newRemotes: Record<string, RemotePeer> = {};
    let peerConnected = false;

    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      const tracks: MediaStreamTrack[] = [];
      const camPub = p.getTrackPublication(Track.Source.Camera);
      const micPub = p.getTrackPublication(Track.Source.Microphone);

      if (camPub?.track?.mediaStreamTrack && !camPub.isMuted) {
        tracks.push(camPub.track.mediaStreamTrack);
      }
      if (micPub?.track?.mediaStreamTrack && !micPub.isMuted) {
        tracks.push(micPub.track.mediaStreamTrack);
      }

      if (p.connectionQuality !== ConnectionQuality.Unknown) {
        peerConnected = true;
      }

      newRemotes[p.identity] = {
        userId: p.identity,
        stream: tracks.length > 0 ? new MediaStream(tracks) : null,
        state: "connected",
        connectionQuality: p.connectionQuality,
      };
    });

    setRemotes(newRemotes);
    if (peerConnected) setIsCallAnswered(true);
  }, []);

  useEffect(() => {
    if (!enabled || !callId || !selfId) return;

    let cancelled = false;

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        simulcast: true,
        videoCodec: "vp8",
      },
      videoCaptureDefaults: {
        resolution: { width: 640, height: 360 },
      },
    });

    roomRef.current = room;

    const setupCall = async () => {
      try {
        // Fetch token via Supabase Edge Function
        const { data: sfData, error: sfError } = await supabase.functions.invoke("livekit-token", {
          body: { roomName: callId, isHost },
        });

        if (sfError) throw new Error(`Token fetch failed: ${sfError.message}`);
        if (!sfData?.token) throw new Error("No token returned from server");

        const token = sfData.token;
        const url = import.meta.env.VITE_LIVEKIT_URL;

        if (!url || !token) {
          throw new Error("LiveKit not configured or token unavailable");
        }

        if (cancelled) return;

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
        room.on(RoomEvent.TrackMuted, updateRemotes);
        room.on(RoomEvent.TrackUnmuted, updateRemotes);

        room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
          if (!participant || participant === room.localParticipant) {
            setNetworkQuality(quality);
          } else {
            updateRemotes();
          }
        });
      } catch (err: unknown) {
        console.error("[Cymatic Resonance Engine] LiveKit failure:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Media bridge failure");
        }
      }
    };

    setupCall();

    return () => {
      cancelled = true;
      if (roomRef.current) {
        // Unpublish tracks explicitly to turn off Android camera/mic indicator LED
        roomRef.current.localParticipant.trackPublications.forEach((pub) => {
          if (pub.track) {
            pub.track.stop();
          }
        });
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      setLocalStream(null);
      setRemotes({});
      setIsCallAnswered(false);
    };
  }, [enabled, callId, selfId, syncLocalTracks, updateRemotes, isHost]);

  const toggleMic = useCallback(async () => {
    const next = !micOn;
    setMicOn(next);
    micStateRef.current = next;

    if (roomRef.current && roomRef.current.state === "connected") {
      await roomRef.current.localParticipant.setMicrophoneEnabled(next);
      await syncLocalTracks();
    }
  }, [micOn, syncLocalTracks]);

  const toggleCam = useCallback(async () => {
    const next = !camOn;
    setCamOn(next);
    camStateRef.current = next;

    if (roomRef.current && roomRef.current.state === "connected") {
      await roomRef.current.localParticipant.setCameraEnabled(next);
      await syncLocalTracks();
    }
  }, [camOn, syncLocalTracks]);

  return {
    localStream,
    remotes: Object.values(remotes),
    micOn,
    camOn,
    networkQuality,
    isCallAnswered,
    toggleMic,
    toggleCam,
    error,
  };
}
