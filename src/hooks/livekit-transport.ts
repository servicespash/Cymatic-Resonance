import { Room, RoomEvent, Participant, Track } from "livekit-client";
import { CallTransport } from "./call-transport";

export class LiveKitTransport implements CallTransport {
  private room: Room;
  private participantsChangeCallback?: (participants: string[]) => void;

  constructor() {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true, // Enables simulcast
    });

    this.room.on(RoomEvent.ParticipantConnected, this.updateParticipants);
    this.room.on(RoomEvent.ParticipantDisconnected, this.updateParticipants);
  }

  capabilities = { supportsSimulcast: true };

  async connect(roomId: string, userId: string) {
    // In production, fetch token from your backend
    const token = await this.fetchToken(roomId, userId);
    await this.room.connect("ws://localhost:8080", token);
    await this.room.localParticipant.enableCameraAndMicrophone();
  }

  async disconnect() {
    await this.room.disconnect();
  }

  getParticipants(): string[] {
    return Array.from(this.room.participants.values()).map((p: Participant) => p.identity);
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
    // Implement token fetching from your backend (e.g., Supabase Edge Function)
    return "your-generated-token";
  }
}
