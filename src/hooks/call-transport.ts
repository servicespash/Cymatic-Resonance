export interface CallTransport {
  connect(roomId: string, userId: string): Promise<void>;
  disconnect(): Promise<void>;
  getParticipants(): string[];
  onParticipantsChange(callback: (participants: string[]) => void): void;
  // Transport-specific capabilities (e.g. for simulcast/renegotiation)
  capabilities: {
    supportsSimulcast: boolean;
  };
}
