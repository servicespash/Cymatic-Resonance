export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.ctx = new (
        window.AudioContext ||
        (
          window as unknown as Window &
            typeof globalThis & { webkitAudioContext: typeof AudioContext }
        ).webkitAudioContext
      )();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 1.0;
    }
  }

  async playRingtone(duration: number = 60) {
    // Ringtone with 4s ramp-up
    return this.playTone(440, duration, { rampUp: true, type: "sine" });
  }

  async playTone(
    frequency: number,
    duration: number,
    {
      rampUp = false,
      pitchShift = 0,
      type = "sine",
    }: { rampUp?: boolean; pitchShift?: number; type?: OscillatorType } = {},
  ) {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency + pitchShift;

    if (rampUp) {
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(1.0, this.ctx.currentTime + 4);
    } else {
      gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    }

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
    return osc;
  }
}
