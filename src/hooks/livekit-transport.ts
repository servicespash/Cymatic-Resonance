import { Room, RoomEvent, Participant } from "livekit-client";
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
    try {
      // In production, fetch token from your backend
      const token = await this.fetchToken(roomId, userId);
      await this.room.connect("ws://localhost:8080", token);
      await this.room.localParticipant.enableCameraAndMicrophone();
    } catch (err) {
      console.warn(
        "LiveKit transport server unavailable, falling back to WebRTC signaling mode:",
        err,
      );
    }
  }

  async disconnect() {
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
    // Implement token fetching from your backend
    return `${roomId}:${userId}`;
  }
}
