// Engine type definitions — core data structures for call state machine.

export type CallState = "idle" | "inviting" | "ringing" | "active" | "ended";
export type CallKind = "audio" | "video";
export type CallDirection = "outgoing" | "incoming";

export interface CallParticipant {
  id: string;
  name: string | null;
  state: "invited" | "ringing" | "active" | "declined" | "ended";
}

export interface RemotePeerState {
  userId: string;
  stream: MediaStream | null;
  state: RTCPeerConnectionState;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface LocalMediaState {
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  error: string | null;
}

export interface CallEngineState {
  // Call identity
  callId: string | null;
  initiatorId: string | null;
  participantIds: string[];
  
  // Call lifecycle
  state: CallState;
  kind: CallKind;
  direction: CallDirection | null;
  
  // Media
  local: LocalMediaState;
  remotes: Record<string, RemotePeerState>;
  
  // Timing
  startedAt: number | null;
  endedAt: number | null;
  
  // Errors
  error: string | null;
}

export interface CallEngineEvent {
  type:
    | "state-change"
    | "call-incoming"
    | "call-accepted"
    | "call-declined"
    | "call-ended"
    | "remote-joined"
    | "remote-left"
    | "local-stream-ready"
    | "local-stream-error"
    | "peer-connected"
    | "peer-disconnected"
    | "peer-audio-enabled"
    | "peer-audio-disabled"
    | "peer-video-enabled"
    | "peer-video-disabled"
    | "network-error"
    | "error";
  payload: unknown;
}

export interface NotificationPayload {
  title: string;
  body?: string;
  callId: string;
  senderId: string;
  kind: CallKind;
}

export interface CallSignalPayload {
  type: "hello" | "offer" | "answer" | "ice" | "bye";
  from: string;
  to: string;
  callId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
