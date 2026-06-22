// useCall — orchestrates one call session: local media, peer connections per
// remote participant, SDP/ICE exchange via Supabase broadcast signaling.

import { useEffect, useRef, useState, useCallback } from "react";
import { createPeer, getLocalMedia } from "@/lib/webrtc/peer";
import { joinCallChannel, type SignalPayload } from "@/lib/webrtc/signaling";

export type RemotePeer = { userId: string; stream: MediaStream | null; state: RTCPeerConnectionState };

export function useCall(opts: {
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

  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const sendRef = useRef<((p: SignalPayload) => Promise<void>) | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<Record<string, RTCIceCandidateInit[]>>({});

  const setRemote = useCallback((uid: string, patch: Partial<RemotePeer>) => {
    setRemotes((r) => {
      const prev = r[uid] ?? { userId: uid, stream: null, state: "new" as RTCPeerConnectionState };
      return { ...r, [uid]: { ...prev, ...patch, userId: uid } };
    });
  }, []);

  const ensurePeer = useCallback((remoteId: string): RTCPeerConnection => {
    if (peersRef.current[remoteId]) return peersRef.current[remoteId];
    const pc = createPeer({
      onIceCandidate: (candidate) => sendRef.current?.({ type: "ice", from: selfId!, to: remoteId, candidate }),
      onRemoteStream: (stream) => setRemote(remoteId, { stream }),
      onConnectionStateChange: (state) => setRemote(remoteId, { state }),
    });
    if (localRef.current) {
      for (const track of localRef.current.getTracks()) pc.addTrack(track, localRef.current);
    }
    peersRef.current[remoteId] = pc;
    return pc;
  }, [selfId, setRemote]);

  const callTo = useCallback(async (remoteId: string) => {
    const pc = ensurePeer(remoteId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendRef.current?.({ type: "offer", from: selfId!, to: remoteId, sdp: offer });
  }, [ensurePeer, selfId]);

  useEffect(() => {
    if (!enabled || !callId || !selfId) return;
    let cancelled = false;
    let leaveFn: (() => Promise<void>) | null = null;

    (async () => {
      try {
        const stream = await getLocalMedia(video);
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localRef.current = stream;
        setLocalStream(stream);

        const sig = joinCallChannel(callId, selfId, async (p) => {
          if (p.from === selfId) return;
          if (p.type === "hello") {
            // Deterministic offerer: lexicographically smaller id initiates
            if (selfId < p.from) await callTo(p.from);
            else ensurePeer(p.from);
            return;
          }
          if (p.type === "bye") {
            const pc = peersRef.current[p.from];
            if (pc) { pc.close(); delete peersRef.current[p.from]; }
            setRemotes((r) => { const n = { ...r }; delete n[p.from]; return n; });
            return;
          }
          if (p.type === "offer") {
            const pc = ensurePeer(p.from);
            await pc.setRemoteDescription(p.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendRef.current?.({ type: "answer", from: selfId, to: p.from, sdp: answer });
            for (const c of pendingIce.current[p.from] ?? []) {
              try { await pc.addIceCandidate(c); } catch {}
            }
            delete pendingIce.current[p.from];
            return;
          }
          if (p.type === "answer") {
            const pc = peersRef.current[p.from];
            if (pc) await pc.setRemoteDescription(p.sdp);
            return;
          }
          if (p.type === "ice") {
            const pc = peersRef.current[p.from];
            if (pc && pc.remoteDescription) {
              try { await pc.addIceCandidate(p.candidate); } catch {}
            } else {
              (pendingIce.current[p.from] ??= []).push(p.candidate);
            }
          }
        });
        sendRef.current = sig.send;
        leaveFn = sig.leave;
      } catch (e: any) {
        setError(e?.message ?? "Could not access camera/microphone");
      }
    })();

    return () => {
      cancelled = true;
      if (leaveFn) leaveFn();
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      setLocalStream(null);
      setRemotes({});
      sendRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, callId, selfId, video]);

  const toggleMic = useCallback(() => {
    const s = localRef.current;
    if (!s) return;
    const next = !micOn;
    s.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, [micOn]);

  const toggleCam = useCallback(() => {
    const s = localRef.current;
    if (!s) return;
    const next = !camOn;
    s.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  }, [camOn]);

  return { localStream, remotes: Object.values(remotes), micOn, camOn, toggleMic, toggleCam, error };
}
