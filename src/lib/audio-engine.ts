/**
 * Professional Audio Engine for Cymatic Resonance.
 * Provides ADSR envelope support, centralized AudioContext management,
 * and looping patterns for ringtones/dialtones.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeLoops: Map<
    string,
    { intervalId: ReturnType<typeof setInterval>; duration: number }
  > = new Map();

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (
        window.AudioContext ||
        (
          window as unknown as {
            AudioContext: typeof AudioContext;
            webkitAudioContext: typeof AudioContext;
          }
        ).webkitAudioContext
      )();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  public async resume(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  }

  public playTone(
    freq: number,
    attack: number,
    decay: number,
    sustain: number,
    release: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 0.6,
  ) {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.connect(gain);
    gain.connect(this.masterGain!);

    // ADSR Envelope
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);

    // Attack
    gain.gain.linearRampToValueAtTime(volume, now + attack);

    // Decay to Sustain
    gain.gain.exponentialRampToValueAtTime(volume * sustain, now + attack + decay);

    // Release
    gain.gain.setValueAtTime(volume * sustain, now + duration - release);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  }

  /** Starts a looping pattern (e.g. for ringtones) */
  public startLoop(
    loopId: string,
    pattern: [number, number][],
    type: OscillatorType = "sine",
    intervalMs: number = 3000,
    volume: number = 0.6,
  ) {
    if (this.activeLoops.has(loopId)) return;

    const playInstance = () => {
      let t = 0;
      for (const [freq, dur] of pattern) {
        this.playTone(freq, 0.02, 0.05, 0.8, 0.05, dur, type, volume);
        t += dur;
      }
    };

    // Play immediately first
    playInstance();

    const intervalId = setInterval(playInstance, intervalMs);
    this.activeLoops.set(loopId, { intervalId, duration: intervalMs / 1000 });
  }

  /** Stops an active looping pattern */
  public stopLoop(loopId: string) {
    const active = this.activeLoops.get(loopId);
    if (active) {
      clearInterval(active.intervalId);
      this.activeLoops.delete(loopId);
    }
  }

  /** Stops all active loops */
  public stopAllLoops() {
    for (const loopId of this.activeLoops.keys()) {
      this.stopLoop(loopId);
    }
  }
}

export const audioEngine = new AudioEngine();
