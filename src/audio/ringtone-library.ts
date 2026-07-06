// Ringtone library with multiple soft, modern tones matching the system aesthetic.
// All tones use sine waves with gentle envelopes - modern, minimalist feel.

import type { AudioContext as AudioContextType } from "web-audio-api";

export type RingtoneStyle = 
  | "default"      // Classic 880/660Hz double tone
  | "morning"      // Bright awakening: 900/700Hz
  | "gentle"       // Softer, slower: 800/600Hz
  | "modern"       // Contemporary: 950/750Hz
  | "minimal"      // Minimal chime: 1000/400Hz
  | "calm"         // Relaxing: 750/550Hz
  | "zenith"       // High bright: 980/680Hz
  | "whisper"      // Very soft: 850/620Hz
  | "pulse";       // Rhythm: 920/660Hz with rhythm

export interface RingtoneConfig {
  style: RingtoneStyle;
  duration?: number;        // Total tone duration in ms (default: 300)
  interval?: number;        // Repeat interval in ms (default: 2200)
  volume?: number;          // 0-1 volume (default: 0.15)
}

export class RingtonePlayer {
  private audioContext: AudioContextType;
  private masterGain: GainNode;
  private isPlaying = false;
  private cancelledRef = { value: false };
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(audioContext: AudioContextType, masterGain: GainNode) {
    this.audioContext = audioContext;
    this.masterGain = masterGain;
  }

  private getToneConfig(style: RingtoneStyle): { high: number; low: number; timing: "sequential" | "staggered" | "rhythm" } {
    const configs: Record<RingtoneStyle, { high: number; low: number; timing: "sequential" | "staggered" | "rhythm" }> = {
      default: { high: 880, low: 660, timing: "sequential" },     // Original
      morning: { high: 900, low: 700, timing: "sequential" },     // Bright, uplifting
      gentle: { high: 800, low: 600, timing: "sequential" },      // Soft, relaxing
      modern: { high: 950, low: 750, timing: "sequential" },      // Contemporary, crisp
      minimal: { high: 1000, low: 400, timing: "staggered" },     // Chime-like
      calm: { high: 750, low: 550, timing: "sequential" },        // Very relaxing
      zenith: { high: 980, low: 680, timing: "sequential" },      // Bright, high
      whisper: { high: 850, low: 620, timing: "sequential" },     // Very subtle
      pulse: { high: 920, low: 660, timing: "rhythm" },           // Rhythmic pattern
    };
    return configs[style];
  }

  play(config: RingtoneConfig): () => void {
    if (this.isPlaying) {
      this.stop();
    }

    const {
      style,
      duration = 300,
      interval = 2200,
      volume = 0.15,
    } = config;

    const toneConfig = this.getToneConfig(style);
    this.isPlaying = true;
    this.cancelledRef.value = false;

    const ringGain = this.audioContext.createGain();
    ringGain.gain.value = volume;
    ringGain.connect(this.masterGain);

    const playTone = () => {
      if (this.cancelledRef.value) return;

      if (toneConfig.timing === "sequential") {
        this.playSequentialTones(ringGain, toneConfig.high, toneConfig.low, duration);
      } else if (toneConfig.timing === "staggered") {
        this.playStaggeredTones(ringGain, toneConfig.high, toneConfig.low, duration);
      } else if (toneConfig.timing === "rhythm") {
        this.playRhythmicTones(ringGain, toneConfig.high, toneConfig.low, duration);
      }

      this.timeoutId = setTimeout(playTone, interval);
    };

    playTone();

    return () => {
      this.cancelledRef.value = true;
      if (this.timeoutId) clearTimeout(this.timeoutId);
      ringGain.disconnect();
      this.isPlaying = false;
    };
  }

  private playSequentialTones(
    gain: GainNode,
    highFreq: number,
    lowFreq: number,
    duration: number,
  ): void {
    const tones = [highFreq, lowFreq];
    const toneDelay = duration * 0.35 / 1000; // Delay between tones in seconds

    tones.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      const g = this.audioContext.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(gain);

      const t0 = this.audioContext.currentTime + i * toneDelay;
      const fadeIn = 0.03;
      const fadeOut = duration / 1000 - 0.03;

      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(1, t0 + fadeIn);
      g.gain.linearRampToValueAtTime(0, t0 + fadeOut);

      osc.start(t0);
      osc.stop(t0 + duration / 1000);
    });
  }

  private playStaggeredTones(
    gain: GainNode,
    highFreq: number,
    lowFreq: number,
    duration: number,
  ): void {
    // High tone first, then low tone overlaps
    const toneDuration = duration / 1000;
    const staggerDelay = toneDuration * 0.5;

    [
      { freq: highFreq, delay: 0 },
      { freq: lowFreq, delay: staggerDelay },
    ].forEach(({ freq, delay }) => {
      const osc = this.audioContext.createOscillator();
      const g = this.audioContext.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(gain);

      const t0 = this.audioContext.currentTime + delay;
      const fadeIn = 0.04;
      const adjustedDuration = toneDuration + (staggerDelay - delay) * 0.5;

      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(1, t0 + fadeIn);
      g.gain.linearRampToValueAtTime(0, t0 + adjustedDuration);

      osc.start(t0);
      osc.stop(t0 + adjustedDuration);
    });
  }

  private playRhythmicTones(
    gain: GainNode,
    highFreq: number,
    lowFreq: number,
    duration: number,
  ): void {
    // Play three short pulses: high-low-high pattern
    const pulseLength = duration / 3 / 1000;
    const pulseGap = pulseLength * 0.5;
    const pulses = [
      { freq: highFreq, delay: 0 },
      { freq: lowFreq, delay: pulseLength + pulseGap },
      { freq: highFreq, delay: (pulseLength + pulseGap) * 2 },
    ];

    pulses.forEach(({ freq, delay }) => {
      const osc = this.audioContext.createOscillator();
      const g = this.audioContext.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(gain);

      const t0 = this.audioContext.currentTime + delay;
      const fadeDuration = pulseLength * 0.8;

      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(1, t0 + 0.02);
      g.gain.linearRampToValueAtTime(0, t0 + fadeDuration);

      osc.start(t0);
      osc.stop(t0 + fadeDuration);
    });
  }

  stop(): void {
    this.cancelledRef.value = true;
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.isPlaying = false;
  }
}

// Create a simple ringtone player for backward compatibility
export async function createRingtonePlayer(
  style: RingtoneStyle = "default",
): Promise<{ start: () => void; stop: () => void }> {
  const pipeline = await import("@/audio/audio-pipeline").then(m => m.getAudioPipeline());
  const masterGain = pipeline.getSourceGain("ringtone");

  if (!masterGain) {
    throw new Error("[RingtoneLibrary] No ringtone gain node available");
  }

  const player = new RingtonePlayer(masterGain.context, masterGain);
  let stopFn: (() => void) | null = null;

  return {
    start: () => {
      pipeline.setSourceActive("ringtone", true);
      stopFn = player.play({ style, duration: 300, interval: 2200, volume: 0.15 });
    },
    stop: () => {
      stopFn?.();
      pipeline.setSourceActive("ringtone", false);
    },
  };
}

// Configuration presets for different use cases
export const RINGTONE_PRESETS = {
  incoming: { style: "default" as const, volume: 0.15 },
  notification: { style: "gentle" as const, volume: 0.12 },
  alert: { style: "modern" as const, volume: 0.18 },
  reminder: { style: "calm" as const, volume: 0.1 },
} as const;
