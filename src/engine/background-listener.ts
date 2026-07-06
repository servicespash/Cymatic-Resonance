// Background listener — handles service worker messages when app is backgrounded.

export class BackgroundListener {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private onAcceptCall: (data: { callId: string; senderId: string; kind: string }) => void,
    private onDeclineCall: (data: { callId: string }) => void,
    private onPlayRingtone: () => void,
  ) {
    this.setupServiceWorkerListener();
  }

  // Setup listener for service worker messages
  private setupServiceWorkerListener(): void {
    if (!("serviceWorker" in navigator)) {
      console.log("[BackgroundListener] Service Worker not supported");
      return;
    }

    // Listen for messages from service worker
    const messageHandler = (event: MessageEvent) => {
      const { type, payload } = event.data;

      switch (type) {
        case "ACCEPT_CALL":
          this.onAcceptCall(payload);
          break;
        case "DECLINE_CALL":
          this.onDeclineCall(payload);
          break;
        case "PLAY_RINGTONE":
          this.onPlayRingtone();
          break;
        default:
          console.log("[BackgroundListener] Unknown message type:", type);
      }
    };

    navigator.serviceWorker.addEventListener("message", messageHandler);

    this.unsubscribe = () => {
      navigator.serviceWorker.removeEventListener("message", messageHandler);
    };
  }

  // Cleanup
  destroy(): void {
    this.unsubscribe?.();
  }
}
