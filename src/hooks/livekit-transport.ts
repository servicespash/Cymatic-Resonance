import { Room, RoomEvent, Participant } from "livekit-client";
import { CallTransport } from "./call-transport";
import { supabase } from "@/integrations/supabase/client";

export type TransportMode = "livekit" | "p2p";

/**
 * Connects through LiveKit when the workspace has LiveKit credentials configured.
 * When the token service reports LiveKit is unavailable, the transport reports
 * `p2p` mode so the caller can fall back to the direct peer-to-peer engine.
 */
export class LiveKitTransport implements CallTransport {
  private room: Room;
  private participantsChangeCallback?: (participants: string[]) => void;
  public mode: TransportMode = "p2p";

  constructor() {
    this.room = new Room({ adaptiveStream: true, dynacast: true });
    this.room.on(RoomEvent.ParticipantConnected, this.updateParticipants);
    this.room.on(RoomEvent.ParticipantDisconnected, this.updateParticipants);
  }

  capabilities = { supportsSimulcast: true };

  async connect(roomId: string, userId: string) {
    const creds = await this.fetchToken(roomId, userId);

    if (!creds) {
      this.mode = "p2p";
      console.info("[Cymatic Transport] LiveKit unavailable — using direct peer-to-peer calling.");
      return;
    }

    try {
      await this.room.connect(creds.url, creds.token);
      await this.room.localParticipant.enableCameraAndMicrophone();
      this.mode = "livekit";
    } catch (err) {
      this.mode = "p2p";
      console.info(
        "[Cymatic Transport] LiveKit connect failed — falling back to peer-to-peer:",
        err,
      );
    }
  }

  async disconnect() {
    this.room.off(RoomEvent.ParticipantConnected, this.updateParticipants);
    this.room.off(RoomEvent.ParticipantDisconnected, this.updateParticipants);
    await this.room.disconnect();
  }

  getParticipants(): string[] {
    if (this.mode !== "livekit") return [];
    const remotes: Participant[] = Array.from(this.room.remoteParticipants.values());
    return [this.room.localParticipant, ...remotes].map((p) => p.identity);
  }

  onParticipantsChange(callback: (participants: string[]) => void) {
    this.participantsChangeCallback = callback;
  }

  private updateParticipants = () => {
    this.participantsChangeCallback?.(this.getParticipants());
  };

  private async fetchToken(
    roomId: string,
    identity: string,
  ): Promise<{ token: string; url: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke<{
        available?: boolean;
        token?: string;
        url?: string;
      }>("livekit-token", { body: { roomName: roomId, identity, isHost: false } });

      if (error || !data?.available || !data.token) return null;

      const url = data.url || import.meta.env.VITE_LIVEKIT_URL;
      return url ? { token: data.token, url } : null;
    } catch (err) {
      console.info("[Cymatic Transport] Token request failed:", err);
      return null;
    }
  }
}
