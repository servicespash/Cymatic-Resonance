import { useState, useEffect } from "react";
import type { RingtoneStyle } from "@/audio/ringtone-library";

const STORAGE_KEY = "ringtone-preference";

export interface RingtoneSettings {
  style: RingtoneStyle;
  volume: number;
  vibration: boolean;
}

const DEFAULT_SETTINGS: RingtoneSettings = {
  style: "default",
  volume: 0.15,
  vibration: true,
};

export const RINGTONE_DESCRIPTIONS: Record<RingtoneStyle, string> = {
  default: "Classic - Soft double tone (880/660 Hz)",
  morning: "Bright awakening - Uplifting tones (900/700 Hz)",
  gentle: "Softer & slower - Relaxing two-tone",
  modern: "Contemporary - Crisp double tone (950/750 Hz)",
  minimal: "Minimal chime - Simple single chime",
  calm: "Very relaxing - Low frequencies (750/550 Hz)",
  zenith: "High bright - Upper frequencies (980/680 Hz)",
  whisper: "Very subtle - Soft tones (850/620 Hz)",
  pulse: "Rhythmic - Three-pulse pattern",
};

export function useRingtoneSettings() {
  const [settings, setSettings] = useState<RingtoneSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error("[RingtoneSettings] Failed to load settings:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save settings to localStorage whenever they change
  const updateSettings = (newSettings: Partial<RingtoneSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("[RingtoneSettings] Failed to save settings:", error);
    }
  };

  return {
    settings,
    updateSettings,
    isLoaded,
  };
}

// Play a preview of the selected ringtone
export async function playRingtonePreview(style: RingtoneStyle): Promise<void> {
  try {
    const { createRingtonePlayer } = await import("@/audio/ringtone-library");
    const player = await createRingtonePlayer(style);
    player.start();

    // Stop after 2 rings
    setTimeout(() => {
      player.stop();
    }, 4400);
  } catch (error) {
    console.error("[RingtonePreview] Failed to play preview:", error);
  }
}
