// Signaling channel — abstraction over Supabase for SDP/ICE exchange.

import { supabase } from "@/integrations/supabase/client";
import type { CallSignalPayload } from "@/engine/types";

export type SignalPayload = CallSignalPayload;

export type OnSignal = (payload: SignalPayload) => void;

export class SignalingChannel {
  private callId: string;
  private userId: string;
  private onSignal: OnSignal;
  private unsubscribe: (() => void) | null = null;

  constructor(callId: string, userId: string, onSignal: OnSignal) {
    this.callId = callId;
    this.userId = userId;
    this.onSignal = onSignal;
  }

  // Subscribe to call signaling channel
  connect(): void {
    if (this.unsubscribe) return; // Already connected

    const channel = supabase
      .channel(`call-signal-${this.callId}`)
      .on("broadcast", { event: "signal" }, (payload) => {
        const signal = payload.payload as SignalPayload;
        // Only process messages not from self
        if (signal.from !== this.userId) {
          this.onSignal(signal);
        }
      })
      .subscribe();

    this.unsubscribe = () => {
      supabase.removeChannel(channel);
    };
  }

  // Send SDP offer
  async sendOffer(to: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const payload: SignalPayload = {
      type: "offer",
      from: this.userId,
      to,
      callId: this.callId,
      sdp,
    };

    try {
      await supabase.channel(`call-signal-${this.callId}`).send("broadcast", {
        event: "signal",
        payload,
      });
    } catch (error) {
      console.error("[SignalingChannel] Failed to send offer:", error);
      throw error;
    }
  }

  // Send SDP answer
  async sendAnswer(to: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const payload: SignalPayload = {
      type: "answer",
      from: this.userId,
      to,
      callId: this.callId,
      sdp,
    };

    try {
      await supabase.channel(`call-signal-${this.callId}`).send("broadcast", {
        event: "signal",
        payload,
      });
    } catch (error) {
      console.error("[SignalingChannel] Failed to send answer:", error);
      throw error;
    }
  }

  // Send ICE candidate
  async sendIceCandidate(to: string, candidate: RTCIceCandidateInit): Promise<void> {
    const payload: SignalPayload = {
      type: "ice",
      from: this.userId,
      to,
      callId: this.callId,
      candidate,
    };

    try {
      await supabase.channel(`call-signal-${this.callId}`).send("broadcast", {
        event: "signal",
        payload,
      });
    } catch (error) {
      console.error("[SignalingChannel] Failed to send ICE candidate:", error);
      // Don't throw for ICE candidates — they're not critical
    }
  }

  // Announce presence in call
  async sendHello(): Promise<void> {
    const payload: SignalPayload = {
      type: "hello",
      from: this.userId,
      to: "all",
      callId: this.callId,
    };

    try {
      await supabase.channel(`call-signal-${this.callId}`).send("broadcast", {
        event: "signal",
        payload,
      });
    } catch (error) {
      console.error("[SignalingChannel] Failed to send hello:", error);
    }
  }

  // Announce departure from call
  async sendBye(): Promise<void> {
    const payload: SignalPayload = {
      type: "bye",
      from: this.userId,
      to: "all",
      callId: this.callId,
    };

    try {
      await supabase.channel(`call-signal-${this.callId}`).send("broadcast", {
        event: "signal",
        payload,
      });
    } catch (error) {
      console.error("[SignalingChannel] Failed to send bye:", error);
    }
  }

  // Disconnect from channel
  disconnect(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
