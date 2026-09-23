/**
 * Dedicated audio handler for incoming calls.
 * Plays a distinct multi-tone harmonic ringtone pattern using Web Audio API.
 */
class CallRingtoneHandler {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private isRinging = false;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public startRinging() {
    if (this.isRinging) return;
    this.isRinging = true;

    try {
      const playTonePattern = () => {
        if (!this.isRinging) return;
        const ctx = this.getContext();
        const now = ctx.currentTime;

        // Dual frequency harmonics (distinct ringtone frequencies: 440Hz & 480Hz US standard ring / harmonic synth)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(440, now);
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.15, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.0);
        osc2.stop(now + 1.0);
      };

      playTonePattern();
      this.timer = window.setInterval(playTonePattern, 2000); // Repeat every 2s
    } catch (err) {
      console.warn("[CallRingtone] Failed to play ringtone:", err);
    }
  }

  public stopRinging() {
    this.isRinging = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const callRingtone = new CallRingtoneHandler();
