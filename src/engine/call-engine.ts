// Call engine — orchestrates the entire call lifecycle, independent of React.

import { CallStateMachine } from "./call-state-machine";
import { EventEmitter } from "./event-emitter";
import { PeerManager } from "@/core/webrtc/peer-manager";
import { SignalingChannel } from "@/core/webrtc/signaling-channel";
import { WakeLockManager } from "./wake-lock-manager";
import { BackgroundListener } from "./background-listener";
import type { CallEngineEvent, CallKind } from "./types";

export interface CallEngineConfig {
  userId: string;
  signalingChannel?: SignalingChannel; // Optional override for testing
}

export class CallEngine {
  private userId: string;
  private stateMachine: CallStateMachine;
  private emitter: EventEmitter;
  private peerManager: PeerManager;
  private signalingChannel: SignalingChannel | null = null;
  private localMediaStream: MediaStream | null = null;
  private wakeLock: WakeLockManager;
  private backgroundListener: BackgroundListener;

  constructor(config: CallEngineConfig) {
    this.userId = config.userId;
    this.emitter = new EventEmitter();
    this.stateMachine = new CallStateMachine(this.emitter);
    this.wakeLock = new WakeLockManager();

    // Setup background listener for service worker messages
    this.backgroundListener = new BackgroundListener(
      ({ callId, senderId, kind }) => {
        this.acceptCall(kind === "video").catch(console.error);
      },
      ({ callId }) => {
        this.declineCall();
      },
      () => {
        // Service worker is requesting ringtone play
        console.log("[CallEngine] Service worker requesting ringtone");
      },
    );

    // Configure peer manager
    this.peerManager = new PeerManager({
      onIceCandidate: (userId, candidate) => {
        this.signalingChannel?.sendIceCandidate(userId, candidate).catch(console.error);
      },
      onRemoteStream: (userId, stream) => {
        this.stateMachine.setRemoteStream(userId, stream);
      },
      onConnectionStateChange: (userId, state) => {
        this.stateMachine.setRemotePeerState(userId, state);
      },
      onError: (userId, error) => {
        console.error(`[CallEngine] Peer error for ${userId}:`, error);
      },
    });

    if (config.signalingChannel) {
      this.signalingChannel = config.signalingChannel;
    }
  }

  // Subscribe to engine events
  subscribe(listener: (event: CallEngineEvent) => void): () => void {
    return this.emitter.subscribe(listener);
  }

  // Get current state
  getState() {
    return this.stateMachine.getState();
  }

  // Initiate an outgoing call
  async initiateCall(opts: {
    callId: string;
    participantIds: string[];
    kind: CallKind;
    video: boolean;
  }): Promise<void> {
    try {
      // Get local media first
      const { getLocalMedia } = await import("@/lib/webrtc/peer");
      const stream = await getLocalMedia(opts.video);
      this.localMediaStream = stream;
      this.stateMachine.setLocalStream(stream);

      // Update state machine
      this.stateMachine.initiateCall({
        callId: opts.callId,
        initiatorId: this.userId,
        participantIds: opts.participantIds,
        kind: opts.kind,
      });

      // Setup signaling if not already done
      if (!this.signalingChannel) {
        this.signalingChannel = new SignalingChannel(opts.callId, this.userId, (payload) =>
          this.handleSignal(payload),
        );
        this.signalingChannel.connect();
      }

      // Announce presence
      await this.signalingChannel.sendHello();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.stateMachine.setError(msg);
      throw error;
    }
  }

  // Receive an incoming call
  async receiveCall(opts: { callId: string; initiatorId: string; kind: CallKind }): Promise<void> {
    try {
      this.stateMachine.receiveCall(opts);

      // Setup signaling
      if (!this.signalingChannel) {
        this.signalingChannel = new SignalingChannel(opts.callId, this.userId, (payload) =>
          this.handleSignal(payload),
        );
        this.signalingChannel.connect();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.stateMachine.setError(msg);
      throw error;
    }
  }

  // Accept incoming call and get local media
  async acceptCall(video: boolean): Promise<void> {
    try {
      const state = this.stateMachine.getState();
      if (state.state !== "ringing") {
        throw new Error("Call not in ringing state");
      }

      // Get local media
      const { getLocalMedia } = await import("@/lib/webrtc/peer");
      const stream = await getLocalMedia(video);
      this.localMediaStream = stream;
      this.stateMachine.setLocalStream(stream);

      // Update state
      this.stateMachine.acceptCall();

      // Keep device awake during call
      await this.wakeLock.acquire("call");

      // Announce presence in call
      await this.signalingChannel?.sendHello();

      // Create peers for all participants
      for (const participantId of state.participantIds) {
        if (participantId !== this.userId) {
          this.stateMachine.remotePeerJoined(participantId);
          this.peerManager.createPeer(participantId, stream);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.stateMachine.setLocalStreamError(msg);
      throw error;
    }
  }

  // Decline incoming call
  declineCall(): void {
    this.stateMachine.declineCall();
    this.cleanup();
  }

  // End the call
  endCall(): void {
    this.stateMachine.endCall();
    this.wakeLock.release().catch(console.error);
    this.cleanup();
  }

  // Handle incoming signaling messages
  private async handleSignal(payload: any) {
    const state = this.stateMachine.getState();
    if (state.state === "idle" || state.state === "ended") return;

    try {
      if (payload.type === "hello") {
        const { from } = payload;
        if (from === this.userId) return;

        // Ensure peer exists for remote user
        const peer = this.peerManager.getPeer(from);
        if (!peer) {
          this.stateMachine.remotePeerJoined(from);
          this.peerManager.createPeer(from, this.localMediaStream);
        }

        // Deterministic offerer: lexicographically smaller ID sends offer
        if (this.userId < from && state.state === "active") {
          const offer = await this.peerManager.createOffer(from);
          await this.signalingChannel?.sendOffer(from, offer);
        }
      } else if (payload.type === "offer") {
        const { from, sdp } = payload;
        const answer = await this.peerManager.handleOffer(from, sdp);
        await this.signalingChannel?.sendAnswer(from, answer);
      } else if (payload.type === "answer") {
        const { from, sdp } = payload;
        await this.peerManager.handleAnswer(from, sdp);
      } else if (payload.type === "ice") {
        const { from, candidate } = payload;
        await this.peerManager.addIceCandidate(from, candidate);
      } else if (payload.type === "bye") {
        const { from } = payload;
        this.peerManager.closePeer(from);
        this.stateMachine.remotePeerLeft(from);
      }
    } catch (error) {
      console.error("[CallEngine] Error handling signal:", error);
    }
  }

  // Audio/video control
  setAudioEnabled(enabled: boolean): void {
    this.stateMachine.setLocalAudioEnabled(enabled);
  }

  setVideoEnabled(enabled: boolean): void {
    this.stateMachine.setLocalVideoEnabled(enabled);
  }

  // Cleanup resources
  private cleanup(): void {
    // Stop all tracks
    if (this.localMediaStream) {
      for (const track of this.localMediaStream.getTracks()) {
        track.stop();
      }
      this.localMediaStream = null;
    }

    // Close all peer connections
    this.peerManager.closeAll();

    // Send bye message
    this.signalingChannel?.sendBye().catch(console.error);

    // Disconnect signaling
    this.signalingChannel?.disconnect();
    this.signalingChannel = null;

    // Reset state machine
    this.stateMachine.reset();
  }

  // Destroy engine
  destroy(): void {
    this.cleanup();
    this.wakeLock.destroy();
    this.backgroundListener.destroy();
    this.emitter.clear();
  }
}

// Global engine instance (one per app)
let globalEngine: CallEngine | null = null;

export function getCallEngine(config?: CallEngineConfig): CallEngine {
  if (!globalEngine && config) {
    globalEngine = new CallEngine(config);
  }
  return globalEngine!;
}

export function createCallEngine(config: CallEngineConfig): CallEngine {
  if (globalEngine) {
    globalEngine.destroy();
  }
  globalEngine = new CallEngine(config);
  return globalEngine;
}
