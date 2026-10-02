// Production WebRTC peer factory.
//
// This module never manufactures synthetic media. If the browser cannot provide
// the requested device stream, the caller receives the real error and the call
// lifecycle must enter an explicit failure state.

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export type PeerEvents = {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange?: (state: RTCIceConnectionState) => void;
};

export function createPeer(events: PeerEvents): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.onicecandidate = (event) => {
    if (event.candidate) events.onIceCandidate(event.candidate.toJSON());
  };

  pc.ontrack = (event) => {
    const stream = event.streams[0];
    if (stream) events.onRemoteStream(stream);
  };

  pc.onconnectionstatechange = () => {
    console.info(`[WebRTC] Peer connection state: ${pc.connectionState}`);
    events.onConnectionStateChange?.(pc.connectionState);
  };

  pc.oniceconnectionstatechange = () => {
    console.info(`[WebRTC] ICE connection state: ${pc.iceConnectionState}`);
    events.onIceConnectionStateChange?.(pc.iceConnectionState);
  };

  return pc;
}

export async function getLocalMedia(video: boolean): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Media capture is unavailable in this browser or context");
  }

  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: video
      ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        }
      : false,
  });
}
