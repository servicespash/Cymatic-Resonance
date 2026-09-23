import { supabase } from "@/integrations/supabase/client";

export class PingSystem {
  private static intervalId: number | null = null;
  private static userId: string | null = null;

  static start(userId: string) {
    if (this.intervalId) return;
    this.userId = userId;

    // Send initial heartbeat ping
    this.sendPing();

    // Ping every 30 seconds to maintain online presence and sync heartbeat
    this.intervalId = window.setInterval(() => {
      this.sendPing();
    }, 30000);

    console.info("[PingSystem] Heartbeat ping system started for user:", userId);
  }

  private static async sendPing() {
    if (!this.userId) return;
    try {
      await supabase
        .from("profiles")
        .update({
          is_online: true,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", this.userId);
    } catch (err) {
      console.warn("[PingSystem] Heartbeat ping failed:", err);
    }
  }

  static stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.userId) {
      supabase
        .from("profiles")
        .update({ is_online: false, last_seen_at: new Date().toISOString() })
        .eq("id", this.userId)
        .then(() => {});
      this.userId = null;
    }
    console.info("[PingSystem] Heartbeat ping system stopped.");
  }
}
