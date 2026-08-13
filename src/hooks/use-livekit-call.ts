import { useEffect, useState, useCallback, useRef } from "react";
import {
  Room,
  RoomEvent,
  Participant,
  RemoteParticipant,
  RemoteTrackPublication,
} from "livekit-client";

export type RemotePeer = {
  userId: string;
  stream: MediaStream | null;
  state: "connected" | "disconnected" | "connecting";
};

export function useLiveKitCall(opts: {
  callId: string | null;
  selfId: string | null;
  video: boolean;
  enabled: boolean;
}) {
  const { callId, selfId, video, enabled } = opts;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<Record<string, RemotePeer>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(video);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    if (!enabled || !callId || !selfId) return;

    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    const setup = async () => {
      try {
        // Placeholder token fetch
        const tokenResponse = await fetch(`/api/livekit-token?room=${callId}&user=${selfId}`);
        if (!tokenResponse.ok) throw new Error("Failed to fetch token");
        const token = await tokenResponse.text();

        // Placeholder URL
        const url = import.meta.env.VITE_LIVEKIT_URL ?? "wss://localhost:8080";

        await room.connect(url, token);
        await room.localParticipant.setCameraEnabled(camOn);
        await room.localParticipant.setMicrophoneEnabled(micOn);

        if (cancelled) {
          await room.disconnect();
          return;
        }

        // Set local stream
        const videoPub = Array.from(room.localParticipant.videoTrackPublications.values())[0];
        if (videoPub?.track) {
          setLocalStream(new MediaStream([videoPub.track.mediaStreamTrack]));
        }

        // Remote participants handling
        const updateRemotes = () => {
          const newRemotes: Record<string, RemotePeer> = {};
          room.remoteParticipants.forEach((p) => {
            const videoPub = Array.from(p.videoTrackPublications.values())[0];
            newRemotes[p.identity] = {
              userId: p.identity,
              stream: videoPub?.track?.mediaStream ?? null,
              state: "connected",
            };
          });
          setRemotes(newRemotes);
        };

        room.on(RoomEvent.ParticipantConnected, updateRemotes);
        room.on(RoomEvent.ParticipantDisconnected, updateRemotes);
        room.on(RoomEvent.TrackSubscribed, updateRemotes);
        room.on(RoomEvent.TrackUnsubscribed, updateRemotes);
      } catch (e) {
        setError("Failed to connect to call");
        console.error(e);
      }
    };

    setup();

    return () => {
      cancelled = true;
      room.disconnect();
      roomRef.current = null;
    };
  }, [enabled, callId, selfId, video]);

  const toggleMic = useCallback(() => {
    if (!roomRef.current) return;
    const next = !micOn;
    roomRef.current.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, [micOn]);

  const toggleCam = useCallback(() => {
    if (!roomRef.current) return;
    const next = !camOn;
    roomRef.current.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  }, [camOn]);

  return {
    localStream,
    remotes: Object.values(remotes),
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    error,
  };
}
