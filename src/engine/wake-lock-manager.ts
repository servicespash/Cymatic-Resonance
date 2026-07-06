// Wake Lock manager — keeps device awake during calls on mobile.

export class WakeLockManager {
  private wakeLock: WakeLockSentinel | null = null;
  private isActive = false;

  constructor() {
    this.setupVisibilityListener();
  }

  // Request wake lock (keeps screen on during calls)
  async acquire(reason: "call" | "notification" = "call"): Promise<boolean> {
    if (!("wakeLock" in navigator)) {
      console.log("[WakeLock] Wake Lock API not supported");
      return false;
    }

    if (this.isActive) {
      return true; // Already acquired
    }

    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      this.isActive = true;

      // Listen for release (e.g., user hides the page)
      this.wakeLock.addEventListener("release", () => {
        this.isActive = false;
        console.log("[WakeLock] Released");
      });

      console.log(`[WakeLock] Acquired (reason: ${reason})`);
      return true;
    } catch (error) {
      console.error("[WakeLock] Failed to acquire:", error);
      return false;
    }
  }

  // Release wake lock
  async release(): Promise<void> {
    if (!this.wakeLock) return;

    try {
      await this.wakeLock.release();
      this.wakeLock = null;
      this.isActive = false;
      console.log("[WakeLock] Released");
    } catch (error) {
      console.error("[WakeLock] Error releasing:", error);
    }
  }

  // Re-acquire if page becomes visible again
  private setupVisibilityListener(): void {
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible" && this.isActive && !this.wakeLock) {
        console.log("[WakeLock] Page visible, re-acquiring");
        await this.acquire("call");
      }
    });
  }

  // Check if wake lock is active
  isAcquired(): boolean {
    return this.isActive;
  }

  // Cleanup
  destroy(): void {
    this.release().catch(console.error);
  }
}
