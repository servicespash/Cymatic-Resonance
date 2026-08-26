import { Room, RoomEvent, Participant } from "livekit-client";
import { CallTransport } from "./call-transport";
import { supabase } from "@/integrations/supabase/client";

export class LiveKitTransport implements CallTransport {
  private room: Room;
  private participantsChangeCallback?: (participants: string[]) => void;

  constructor() {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    this.room.on(RoomEvent.ParticipantConnected, this.updateParticipants);
    this.room.on(RoomEvent.ParticipantDisconnected, this.updateParticipants);
  }

  capabilities = { supportsSimulcast: true };

  async connect(roomId: string, userId: string) {
    const token = await this.fetchToken(roomId, userId);
    const livekitUrl = import.meta.env.VITE_LIVEKIT_URL || "wss://livekit.cymatichub.xyz";

    if (!token) {
      throw new Error("Failed to acquire valid LiveKit JWT token.");
    }

    await this.room.connect(livekitUrl, token);
    await this.room.localParticipant.enableCameraAndMicrophone();
  }

  async disconnect() {
    this.room.off(RoomEvent.ParticipantConnected, this.updateParticipants);
    this.room.off(RoomEvent.ParticipantDisconnected, this.updateParticipants);
    await this.room.disconnect();
  }

  getParticipants(): string[] {
    const remotes: Participant[] = Array.from(this.room.remoteParticipants.values());
    return [this.room.localParticipant, ...remotes].map((p) => p.identity);
  }

  onParticipantsChange(callback: (participants: string[]) => void) {
    this.participantsChangeCallback = callback;
  }

  private updateParticipants = () => {
    if (this.participantsChangeCallback) {
      this.participantsChangeCallback(this.getParticipants());
    }
  };

  private async fetchToken(roomId: string, userId: string): Promise<string> {
    try {
      // 1. First try Supabase Edge Function endpoint
      const { data, error } = await supabase.functions.invoke("livekit-token", {
        body: { room: roomId, identity: userId },
      });

      if (!error && data?.token) {
        return data.token;
      }

      // 2. Fallback to API route parsing both JSON and raw text
      const res = await fetch(
        `/api/livekit-token?room=${encodeURIComponent(roomId)}&user=${encodeURIComponent(userId)}`,
      );
      if (!res.ok) throw new Error("Signaling bridge rejected token request.");

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const json = await res.json();
        return json.token;
      }
      return await res.text();
    } catch (err) {
      console.error("[Cymatic Transport] Token acquisition failure:", err);
      throw err;
    }
  }
}
