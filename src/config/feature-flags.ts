// Feature flags — runtime toggles for experimental and optional features.

export interface FeatureFlags {
  // Core features
  enableCallEngine: boolean;
  enableAudioPipeline: boolean;
  enableServerOrchestration: boolean;

  // Media features
  enableVideoFeature: boolean;
  enableScreenShare: boolean;
  enableRecording: boolean;

  // Network features
  enableSimulcast: boolean;
  enableAdaptiveBitrate: boolean;
  enableNetworkQualityIndicator: boolean;

  // UI features
  enablePictureInPicture: boolean;
  enableCallHistory: boolean;
  enableMissedCallNotifications: boolean;

  // Mobile features
  enableMobileOptimizations: boolean;
  enableSpeakerDetection: boolean;
  enableProximityDetection: boolean;

  // Experimental
  enableExperimentalCodecs: boolean;
  enableDataChannel: boolean;
  enableMultipartyFeatures: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  // Core features (all enabled by default)
  enableCallEngine: true,
  enableAudioPipeline: true,
  enableServerOrchestration: true,

  // Media features
  enableVideoFeature: true,
  enableScreenShare: false, // Not implemented yet
  enableRecording: false, // Not implemented yet

  // Network features
  enableSimulcast: false, // Requires SFU
  enableAdaptiveBitrate: true,
  enableNetworkQualityIndicator: false,

  // UI features
  enablePictureInPicture: false, // Not implemented yet
  enableCallHistory: true,
  enableMissedCallNotifications: true,

  // Mobile features
  enableMobileOptimizations: true,
  enableSpeakerDetection: false, // Not implemented yet
  enableProximityDetection: false, // Not implemented yet

  // Experimental
  enableExperimentalCodecs: false,
  enableDataChannel: false,
  enableMultipartyFeatures: false,
};

let overrides: Partial<FeatureFlags> = {};

export function getFeatureFlags(): FeatureFlags {
  return { ...DEFAULT_FLAGS, ...overrides };
}

export function setFeatureFlag(flag: keyof FeatureFlags, enabled: boolean): void {
  overrides[flag] = enabled;
  console.log(`[FeatureFlags] Set ${flag} = ${enabled}`);
}

export function setFeatureFlags(flags: Partial<FeatureFlags>): void {
  overrides = { ...overrides, ...flags };
  console.log("[FeatureFlags] Updated:", flags);
}

export function resetFeatureFlags(): void {
  overrides = {};
}

export function getFeatureFlag(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag];
}

// Dev convenience: expose globally in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as any).__featureFlags = {
    get: getFeatureFlag,
    set: setFeatureFlag,
    setAll: setFeatureFlags,
    getAll: getFeatureFlags,
    reset: resetFeatureFlags,
  };
}
