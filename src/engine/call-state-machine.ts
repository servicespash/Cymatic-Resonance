// Call state machine — manages legal state transitions and guards.

import type { CallEngineState, CallState, CallKind, CallDirection } from "./types";
import { EventEmitter } from "./event-emitter";

export class CallStateMachine {
  private state: CallEngineState;
  private emitter: EventEmitter;

  constructor(emitter: EventEmitter) {
    this.emitter = emitter;
    this.state = {
      callId: null,
      initiatorId: null,
      participantIds: [],
      state: "idle",
      kind: "audio",
      direction: null,
      local: { stream: null, audioEnabled: true, videoEnabled: false, error: null },
      remotes: {},
      startedAt: null,
      endedAt: null,
      error: null,
    };
  }

  getState(): Readonly<CallEngineState> {
    return Object.freeze({ ...this.state });
  }

  // Initiate a new outgoing call
  initiateCall(opts: {
    callId: string;
    initiatorId: string;
    participantIds: string[];
    kind: CallKind;
  }): boolean {
    if (this.state.state !== "idle") {
      console.error("[StateMachine] Cannot initiate call: not idle");
      return false;
    }

    this.state = {
      ...this.state,
      callId: opts.callId,
      initiatorId: opts.initiatorId,
      participantIds: opts.participantIds,
      kind: opts.kind,
      direction: "outgoing",
      state: "inviting",
      startedAt: Date.now(),
      error: null,
    };

    this.emitter.emit({ type: "state-change", payload: this.getState() });
    return true;
  }

  // Receive an incoming call (CallProvider broadcasts it)
  receiveCall(opts: {
    callId: string;
    initiatorId: string;
    kind: CallKind;
  }): boolean {
    if (this.state.state !== "idle") {
      console.error("[StateMachine] Cannot receive call: not idle");
      return false;
    }

    this.state = {
      ...this.state,
      callId: opts.callId,
      initiatorId: opts.initiatorId,
      participantIds: [opts.initiatorId],
      kind: opts.kind,
      direction: "incoming",
      state: "ringing",
      error: null,
    };

    this.emitter.emit({ type: "call-incoming", payload: this.getState() });
    this.emitter.emit({ type: "state-change", payload: this.getState() });
    return true;
  }

  // Accept an incoming call
  acceptCall(): boolean {
    if (this.state.state !== "ringing" || this.state.direction !== "incoming") {
      console.error("[StateMachine] Cannot accept: not ringing");
      return false;
    }

    this.state = { ...this.state, state: "active", startedAt: Date.now() };

    this.emitter.emit({ type: "call-accepted", payload: this.getState() });
    this.emitter.emit({ type: "state-change", payload: this.getState() });
    return true;
  }

  // Decline an incoming call
  declineCall(): boolean {
    if (this.state.state !== "ringing") {
      console.error("[StateMachine] Cannot decline: not ringing");
      return false;
    }

    this.state = { ...this.state, state: "ended", endedAt: Date.now() };

    this.emitter.emit({ type: "call-declined", payload: this.getState() });
    this.emitter.emit({ type: "state-change", payload: this.getState() });
    return true;
  }

  // End the call (from any active state)
  endCall(): boolean {
    if (this.state.state === "idle" || this.state.state === "ended") {
      console.error("[StateMachine] Cannot end: already idle/ended");
      return false;
    }

    this.state = { ...this.state, state: "ended", endedAt: Date.now() };

    this.emitter.emit({ type: "call-ended", payload: this.getState() });
    this.emitter.emit({ type: "state-change", payload: this.getState() });
    return true;
  }

  // Remote participant joined
  remotePeerJoined(userId: string): boolean {
    if (!this.state.participantIds.includes(userId)) {
      this.state = {
        ...this.state,
        participantIds: [...this.state.participantIds, userId],
      };
    }

    this.state = {
      ...this.state,
      remotes: {
        ...this.state.remotes,
        [userId]: {
          userId,
          stream: null,
          state: "new",
          audioEnabled: true,
          videoEnabled: this.state.kind === "video",
        },
      },
    };

    this.emitter.emit({ type: "remote-joined", payload: { userId } });
    return true;
  }

  // Remote participant left
  remotePeerLeft(userId: string): boolean {
    const newRemotes = { ...this.state.remotes };
    delete newRemotes[userId];

    this.state = {
      ...this.state,
      remotes: newRemotes,
      participantIds: this.state.participantIds.filter((id) => id !== userId),
    };

    this.emitter.emit({ type: "remote-left", payload: { userId } });
    return true;
  }

  // Update local media state
  setLocalStream(stream: MediaStream | null): void {
    this.state = {
      ...this.state,
      local: { ...this.state.local, stream, error: null },
    };

    if (stream) {
      this.emitter.emit({ type: "local-stream-ready", payload: { stream } });
    }
  }

  setLocalStreamError(error: string): void {
    this.state = {
      ...this.state,
      local: { ...this.state.local, error },
    };

    this.emitter.emit({ type: "local-stream-error", payload: { error } });
  }

  // Update local media track states
  setLocalAudioEnabled(enabled: boolean): void {
    if (this.state.local.stream) {
      for (const track of this.state.local.stream.getAudioTracks()) {
        track.enabled = enabled;
      }
    }
    this.state = { ...this.state, local: { ...this.state.local, audioEnabled: enabled } };
  }

  setLocalVideoEnabled(enabled: boolean): void {
    if (this.state.local.stream) {
      for (const track of this.state.local.stream.getVideoTracks()) {
        track.enabled = enabled;
      }
    }
    this.state = { ...this.state, local: { ...this.state.local, videoEnabled: enabled } };
  }

  // Update remote peer state
  setRemotePeerState(userId: string, state: RTCPeerConnectionState): void {
    if (this.state.remotes[userId]) {
      this.state = {
        ...this.state,
        remotes: {
          ...this.state.remotes,
          [userId]: { ...this.state.remotes[userId], state },
        },
      };

      this.emitter.emit({
        type: state === "connected" ? "peer-connected" : "peer-disconnected",
        payload: { userId, state },
      });
    }
  }

  setRemoteStream(userId: string, stream: MediaStream | null): void {
    if (this.state.remotes[userId]) {
      this.state = {
        ...this.state,
        remotes: {
          ...this.state.remotes,
          [userId]: { ...this.state.remotes[userId], stream },
        },
      };
    }
  }

  // Record engine-level error
  setError(error: string): void {
    this.state = { ...this.state, error };
    this.emitter.emit({ type: "error", payload: { error } });
  }

  // Reset to idle
  reset(): void {
    this.state = {
      callId: null,
      initiatorId: null,
      participantIds: [],
      state: "idle",
      kind: "audio",
      direction: null,
      local: { stream: null, audioEnabled: true, videoEnabled: false, error: null },
      remotes: {},
      startedAt: null,
      endedAt: null,
      error: null,
    };

    this.emitter.emit({ type: "state-change", payload: this.getState() });
  }
}
