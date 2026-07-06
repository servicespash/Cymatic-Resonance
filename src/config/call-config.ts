// Configuration system for call engine — deployment profiles and feature flags.

import { z } from "zod";

const IceServerSchema = z.object({
  urls: z.string().or(z.array(z.string())),
  username: z.string().optional(),
  credential: z.string().optional(),
});

const CallConfigSchema = z.object({
  // WebRTC Configuration
  iceServers: z.array(IceServerSchema).default([
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ]),

  // Audio Configuration
  audioCodecs: z.array(z.string()).default(["opus"]),
  audioSampleRate: z.number().default(48000),
  audioBitrate: z.number().default(128000), // 128 kbps

  // Video Configuration
  videoCodecs: z.array(z.string()).default(["h264", "vp8"]),
  videoBitrate: z.number().default(1500000), // 1.5 mbps
  videoFramerate: z.number().default(30),
  videoResolution: z.enum(["low", "medium", "high"]).default("medium"),

  // Network Configuration
  enableBandwidthAdaptation: z.boolean().default(true),
  minBitrate: z.number().default(250000), // 250 kbps
  maxBitrate: z.number().default(5000000), // 5 mbps

  // Timeout Configuration
  iceGatheringTimeout: z.number().default(5000), // 5 seconds
  signalingTimeout: z.number().default(15000), // 15 seconds
  connectionTimeout: z.number().default(30000), // 30 seconds

  // Notification Configuration
  enableNotifications: z.boolean().default(true),
  notificationTimeout: z.number().default(60000), // 60 seconds

  // Mobile Optimization
  enableMobileOptimization: z.boolean().default(true),
  reducedMotion: z.boolean().default(false),
  lowPowerMode: z.boolean().default(false),

  // Feature Flags
  enableSimulcast: z.boolean().default(false),
  enableDynamicCodec: z.boolean().default(true),
  enableVolumeAdjustment: z.boolean().default(true),
});

export type CallConfig = z.infer<typeof CallConfigSchema>;

// Default configuration
const DEFAULT_CONFIG: CallConfig = CallConfigSchema.parse({});

// Profile configurations
const PROFILES: Record<string, Partial<CallConfig>> = {
  // High-bandwidth office environment
  office: {
    videoBitrate: 3000000, // 3 mbps
    enableBandwidthAdaptation: true,
    enableSimulcast: true,
    videoResolution: "high",
  },

  // Mobile with limited bandwidth
  "mobile-low-bandwidth": {
    audioBitrate: 64000, // 64 kbps
    videoBitrate: 500000, // 500 kbps
    videoFramerate: 15,
    videoResolution: "low",
    enableBandwidthAdaptation: true,
    enableMobileOptimization: true,
  },

  // Mobile with good bandwidth
  "mobile-high-bandwidth": {
    audioBitrate: 128000,
    videoBitrate: 2000000, // 2 mbps
    videoResolution: "medium",
    enableMobileOptimization: true,
  },

  // Development/testing
  development: {
    enableSimulcast: false,
    enableDynamicCodec: false,
    iceGatheringTimeout: 10000,
  },

  // Production minimal (maximum compatibility)
  production: {
    audioCodecs: ["opus", "pcmu"],
    videoCodecs: ["h264"],
    enableSimulcast: false,
    enableDynamicCodec: false,
  },
};

export function getConfig(profile: keyof typeof PROFILES = "office"): CallConfig {
  const profileConfig = PROFILES[profile] ?? {};
  return CallConfigSchema.parse({ ...DEFAULT_CONFIG, ...profileConfig });
}

export function detectProfile(): keyof typeof PROFILES {
  if (typeof navigator === "undefined") return "office";

  // Detect mobile
  const isMobile = /iPhone|iPad|Android|Windows Phone/i.test(navigator.userAgent);
  if (!isMobile) return "office";

  // Detect low bandwidth (Low End Android, limited connection)
  const isLowEnd =
    /Android.*5\.|Android.*4\./i.test(navigator.userAgent) ||
    navigator.deviceMemory? < 4;

  return isLowEnd ? "mobile-low-bandwidth" : "mobile-high-bandwidth";
}

export function getConfigForEnvironment(): CallConfig {
  const profile = detectProfile();
  return getConfig(profile);
}

// Validate and merge custom config
export function createConfig(override?: Partial<CallConfig>): CallConfig {
  const baseConfig = getConfigForEnvironment();
  if (!override) return baseConfig;
  return CallConfigSchema.parse({ ...baseConfig, ...override });
}

// Export singleton instance
export const callConfig = createConfig();
