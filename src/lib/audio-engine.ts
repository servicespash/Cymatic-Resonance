export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private stopTimeout: number | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const AudioCtx =
        window.AudioContext ||
        (
          window as unknown as Window &
            typeof globalThis & { webkitAudioContext: typeof AudioContext }
        ).webkitAudioContext;

      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 1.0;
        this.initAutoplayUnlock();
      }
    }
  }

  private initAutoplayUnlock() {
    if (!this.ctx || typeof window === "undefined") return;

    const unlock = async () => {
      if (this.ctx && this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }

  async playTone(
    frequency: number,
    duration: number,
    { rampUp = false, type = "sine" }: { rampUp?: boolean; type?: OscillatorType } = {},
  ) {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    const now = this.ctx.currentTime;

    if (rampUp) {
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
    } else {
      gain.gain.setValueAtTime(0.3, now);
    }

    // Smooth release ramp to prevent audio popping
    gain.gain.setValueAtTime(0.3, now + duration - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + duration);
  }

  async playLoopingTone(type: "dial" | "ringtone", duration: number = 60) {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();

    this.stopAll();

    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();

    if (type === "dial") {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.value = 350;
      osc2.frequency.value = 440;

      gain.gain.setValueAtTime(0.15, now);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain!);

      osc1.start(now);
      osc2.start(now);

      this.activeOscillators = [osc1, osc2];
    } else {
      // Deep institutional ringtone with sub-bass layer
      const lead1 = this.ctx.createOscillator();
      const lead2 = this.ctx.createOscillator();
      const subBass = this.ctx.createOscillator();

      lead1.type = "triangle";
      lead2.type = "sine";
      subBass.type = "sine";

      // Frequencies: High harmonic dual tone + Low sub-bass frequency
      lead1.frequency.value = 440; // A4
      lead2.frequency.value = 659.25; // E5
      subBass.frequency.value = 110; // A2 Low Bass

      // Warm low-pass filter for sub-bass profile
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1200;

      gain.gain.setValueAtTime(0.25, now);

      lead1.connect(filter);
      lead2.connect(filter);
      subBass.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      lead1.start(now);
      lead2.start(now);
      subBass.start(now);

      this.activeOscillators = [lead1, lead2, subBass];
    }

    this.stopTimeout = window.setTimeout(() => {
      this.stopAll();
    }, duration * 1000);
  }

  stopAll() {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    this.activeOscillators.forEach((osc) => {
      try {
        // Smoothly fade out active sound before stopping to kill audio clicks
        osc.stop(now + 0.05);
      } catch (_) {
        // Ignore if oscillator was already stopped
      }
    });

    this.activeOscillators = [];

    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
  }
}
