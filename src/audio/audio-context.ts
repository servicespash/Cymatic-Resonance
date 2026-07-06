// AudioContext singleton — centralized audio initialization and lifecycle management.

export class AudioContextManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (this.isInitialized) return;

    try {
      const AudioContextClass =
        typeof window !== "undefined" ? window.AudioContext || (window as any).webkitAudioContext : null;

      if (!AudioContextClass) {
        console.warn("[AudioContextManager] AudioContext not supported");
        return;
      }

      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8; // Default master volume 80%
      this.masterGain.connect(this.ctx.destination);

      this.isInitialized = true;
      console.log("[AudioContextManager] Initialized with sample rate:", this.ctx.sampleRate);
    } catch (error) {
      console.error("[AudioContextManager] Failed to initialize:", error);
    }
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  getMasterVolume(): number {
    return this.masterGain?.gain.value ?? 0.8;
  }

  // Resume AudioContext if suspended (required for user interaction)
  async resume(): Promise<void> {
    if (this.ctx?.state === "suspended") {
      try {
        await this.ctx.resume();
        console.log("[AudioContextManager] Resumed");
      } catch (error) {
        console.error("[AudioContextManager] Failed to resume:", error);
      }
    }
  }

  close(): void {
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close();
    }
    this.ctx = null;
    this.masterGain = null;
    this.isInitialized = false;
  }
}

// Global singleton
let globalAudioContext: AudioContextManager | null = null;

export function getAudioContextManager(): AudioContextManager {
  if (!globalAudioContext) {
    globalAudioContext = new AudioContextManager();
  }
  return globalAudioContext;
}

export function closeAudioContext(): void {
  globalAudioContext?.close();
  globalAudioContext = null;
}
