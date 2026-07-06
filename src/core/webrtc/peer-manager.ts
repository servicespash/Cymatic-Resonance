// Peer manager — manages N peer connections with unified interface.

import { createPeer } from "@/lib/webrtc/peer";
import type { CallSignalPayload } from "@/engine/types";

export interface PeerManagerConfig {
  onIceCandidate: (userId: string, candidate: RTCIceCandidateInit) => void;
  onRemoteStream: (userId: string, stream: MediaStream) => void;
  onConnectionStateChange: (userId: string, state: RTCPeerConnectionState) => void;
  onError: (userId: string, error: string) => void;
}

export class PeerManager {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private pendingIce: Map<string, RTCIceCandidateInit[]> = new Map();
  private config: PeerManagerConfig;

  constructor(config: PeerManagerConfig) {
    this.config = config;
  }

  createPeer(userId: string, localStream: MediaStream | null): RTCPeerConnection {
    // Avoid duplicate peer creation
    if (this.peers.has(userId)) {
      return this.peers.get(userId)!;
    }

    const pc = createPeer({
      onIceCandidate: (candidate) => this.config.onIceCandidate(userId, candidate),
      onRemoteStream: (stream) => this.config.onRemoteStream(userId, stream),
      onConnectionStateChange: (state) => this.config.onConnectionStateChange(userId, state),
    });

    // Add local tracks if available
    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
    }

    this.peers.set(userId, pc);

    // Apply queued ICE candidates
    const queued = this.pendingIce.get(userId) ?? [];
    for (const candidate of queued) {
      pc.addIceCandidate(candidate).catch((error) => {
        console.error(`[PeerManager] Failed to add ICE candidate from ${userId}:`, error);
      });
    }
    this.pendingIce.delete(userId);

    return pc;
  }

  getPeer(userId: string): RTCPeerConnection | null {
    return this.peers.get(userId) ?? null;
  }

  getAllPeers(): Map<string, RTCPeerConnection> {
    return new Map(this.peers);
  }

  async createOffer(userId: string): Promise<RTCSessionDescriptionInit> {
    const pc = this.peers.get(userId);
    if (!pc) throw new Error(`No peer connection for ${userId}`);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(
    userId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<RTCSessionDescriptionInit> {
    const pc = this.peers.get(userId);
    if (!pc) throw new Error(`No peer connection for ${userId}`);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(userId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peers.get(userId);
    if (!pc) throw new Error(`No peer connection for ${userId}`);

    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(
    userId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    const pc = this.peers.get(userId);
    if (!pc) {
      // Queue ICE candidate until peer is created
      if (!this.pendingIce.has(userId)) {
        this.pendingIce.set(userId, []);
      }
      this.pendingIce.get(userId)!.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.error(`[PeerManager] Failed to add ICE candidate from ${userId}:`, error);
    }
  }

  closePeer(userId: string): void {
    const pc = this.peers.get(userId);
    if (pc) {
      pc.close();
      this.peers.delete(userId);
    }
    this.pendingIce.delete(userId);
  }

  closeAll(): void {
    for (const pc of this.peers.values()) {
      pc.close();
    }
    this.peers.clear();
    this.pendingIce.clear();
  }

  getConnectionStats(userId: string): RTCPeerConnectionStats | null {
    const pc = this.peers.get(userId);
    if (!pc) return null;

    return {
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      iceGatheringState: pc.iceGatheringState,
      signalingState: pc.signalingState,
    };
  }
}

export interface RTCPeerConnectionStats {
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  iceGatheringState: RTCIceGatheringState;
  signalingState: RTCSignalingState;
}
