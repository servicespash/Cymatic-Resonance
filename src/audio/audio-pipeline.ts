// Audio pipeline — mixes multiple audio sources with priority and volume ducking.

import { getAudioContextManager } from "./audio-context";

export type AudioSourceType = "notification" | "ringtone" | "call-audio" | "media";

export interface AudioSource {
  type: AudioSourceType;
  node: GainNode;
  isActive: boolean;
}

export class AudioPipeline {
  private sources: Map<string, AudioSource> = new Map();
  private audioContextManager = getAudioContextManager();
  private duckingEnabled = true;
  private ringtoneActive = false;

  constructor() {
    // Initialize sources with independent gain controls
    this.createSource("notification", 0.7);
    this.createSource("ringtone", 0.15);
    this.createSource("call-audio", 0.6);
    this.createSource("media", 0.5);
  }

  private createSource(type: AudioSourceType, volume: number): void {
    const ctx = this.audioContextManager.getContext();
    const masterGain = this.audioContextManager.getMasterGain();

    if (!ctx || !masterGain) {
      console.warn("[AudioPipeline] Cannot create source:", type);
      return;
    }

    const sourceGain = ctx.createGain();
    sourceGain.gain.value = volume;
    sourceGain.connect(masterGain);

    this.sources.set(type, {
      type,
      node: sourceGain,
      isActive: false,
    });
  }

  getSourceGain(type: AudioSourceType): GainNode | null {
    return this.sources.get(type)?.node ?? null;
  }

  setSourceVolume(type: AudioSourceType, volume: number): void {
    const source = this.sources.get(type);
    if (source) {
      source.node.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  getSourceVolume(type: AudioSourceType): number {
    return this.sources.get(type)?.node.gain.value ?? 0;
  }

  setSourceActive(type: AudioSourceType, active: boolean): void {
    const source = this.sources.get(type);
    if (source) {
      source.isActive = active;

      // Apply ducking when ringtone is active
      if (type === "ringtone") {
        this.ringtoneActive = active;
        this.applyDucking();
      }
    }
  }

  private applyDucking(): void {
    if (!this.duckingEnabled) return;

    // When ringtone/notification is active, reduce call audio volume
    const callSource = this.sources.get("call-audio");
    const mediaSource = this.sources.get("media");

    if (this.ringtoneActive) {
      // Duck call and media audio
      if (callSource) callSource.node.gain.value = 0.2; // Reduce to 20%
      if (mediaSource) mediaSource.node.gain.value = 0.2;
    } else {
      // Restore normal volumes
      if (callSource) callSource.node.gain.value = 0.6;
      if (mediaSource) mediaSource.node.gain.value = 0.5;
    }
  }

  setDuckingEnabled(enabled: boolean): void {
    this.duckingEnabled = enabled;
    if (!enabled) {
      // Restore all sources to normal
      this.sources.forEach((source) => {
        if (source.type === "call-audio") source.node.gain.value = 0.6;
        if (source.type === "media") source.node.gain.value = 0.5;
      });
    }
  }

  // Resume AudioContext after user interaction
  async resumeAudio(): Promise<void> {
    await this.audioContextManager.resume();
  }

  // Get all source information
  getSourcesInfo(): Array<{ type: AudioSourceType; volume: number; active: boolean }> {
    const info: Array<{ type: AudioSourceType; volume: number; active: boolean }> = [];
    this.sources.forEach((source) => {
      info.push({
        type: source.type,
        volume: source.node.gain.value,
        active: source.isActive,
      });
    });
    return info;
  }

  destroy(): void {
    this.sources.clear();
  }
}

// Global pipeline singleton
let globalAudioPipeline: AudioPipeline | null = null;

export function getAudioPipeline(): AudioPipeline {
  if (!globalAudioPipeline) {
    globalAudioPipeline = new AudioPipeline();
  }
  return globalAudioPipeline;
}

export function createAudioPipeline(): AudioPipeline {
  globalAudioPipeline?.destroy();
  globalAudioPipeline = new AudioPipeline();
  return globalAudioPipeline;
}
