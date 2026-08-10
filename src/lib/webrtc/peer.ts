// Pure peer-to-peer WebRTC factory using free Google STUN servers.
// No TURN — works for ~80% of users (those not behind strict symmetric NAT).

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:openrelay.metered.ca:80" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject@gmail.com",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject@gmail.com",
    credential: "openrelayproject",
  },
];

export type PeerEvents = {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
};

export function createPeer(events: PeerEvents): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.onicecandidate = (e) => {
    if (e.candidate) events.onIceCandidate(e.candidate.toJSON());
  };

  pc.ontrack = (e) => {
    if (e.streams[0]) events.onRemoteStream(e.streams[0]);
  };

  pc.onconnectionstatechange = () => {
    events.onConnectionStateChange?.(pc.connectionState);
  };

  return pc;
}

export async function getLocalMedia(video: boolean): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
  });
}
