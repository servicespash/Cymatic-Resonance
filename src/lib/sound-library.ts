// Professional sound library + persisted user preferences (client-only).
import { audioEngine } from "./audio-engine";

export type SoundDef = {
  id: string;
  name: string;
  /** tone sequence: [frequency, duration(s)] */
  pattern: [number, number][];
  type: OscillatorType;
};

export type SoundCategory = {
  id: string;
  label: string;
  description: string;
  sounds: SoundDef[];
};

export const SOUND_LIBRARY: SoundCategory[] = [
  {
    id: "professional",
    label: "Professional",
    description: "Crisp, boardroom-safe tones",
    sounds: [
      {
        id: "executive",
        name: "Executive",
        type: "sine",
        pattern: [
          [880, 0.18],
          [660, 0.22],
        ],
      },
      {
        id: "glass-tap",
        name: "Glass Tap",
        type: "triangle",
        pattern: [[1200, 0.14]],
      },
      {
        id: "briefing",
        name: "Briefing",
        type: "sine",
        pattern: [
          [520, 0.16],
          [780, 0.16],
          [1040, 0.2],
        ],
      },
    ],
  },
  {
    id: "cymatic",
    label: "Cymatic",
    description: "Signature resonance frequencies",
    sounds: [
      {
        id: "resonance",
        name: "Resonance Pulse",
        type: "sine",
        pattern: [
          [174, 0.3],
          [285, 0.3],
        ],
      },
      {
        id: "harmonic",
        name: "Harmonic Sweep",
        type: "sine",
        pattern: [
          [432, 0.2],
          [864, 0.25],
        ],
      },
      {
        id: "data-sync",
        name: "Data Sync",
        type: "square",
        pattern: [
          [400, 0.08],
          [600, 0.08],
          [900, 0.12],
        ],
      },
    ],
  },
  {
    id: "ambient",
    label: "Ambient",
    description: "Soft, low-intrusion cues",
    sounds: [
      { id: "water", name: "Water Drop", type: "sine", pattern: [[780, 0.25]] },
      {
        id: "zen",
        name: "Zen Chime",
        type: "sine",
        pattern: [
          [660, 0.35],
          [990, 0.4],
        ],
      },
      { id: "bamboo", name: "Bamboo Click", type: "triangle", pattern: [[900, 0.1]] },
    ],
  },
];

export const ALL_SOUNDS: SoundDef[] = SOUND_LIBRARY.flatMap((c) => c.sounds);

export function findSound(id: string): SoundDef {
  return ALL_SOUNDS.find((s) => s.id === id) ?? ALL_SOUNDS[0];
}

export type SoundPrefs = {
  ringtoneId: string;
  messageSoundId: string;
  volume: number; // 0..1
  muted: boolean;
  showEncryptionBadges: boolean;
};

export const DEFAULT_PREFS: SoundPrefs = {
  ringtoneId: "executive",
  messageSoundId: "glass-tap",
  volume: 0.6,
  muted: false,
  showEncryptionBadges: true,
};

const KEY = "cymatic.sound.prefs";

export function getNotificationPrefs(): SoundPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<SoundPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setNotificationPrefs(patch: Partial<SoundPrefs>): SoundPrefs {
  const next = { ...getNotificationPrefs(), ...patch };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }
  return next;
}

/** Play one library sound once. Returns the total duration in seconds. */
export function playSound(id: string, opts: { volume?: number; force?: boolean } = {}): number {
  const prefs = getNotificationPrefs();
  if (prefs.muted && !opts.force) return 0;

  audioEngine.resume();

  const sound = findSound(id);
  const volume = opts.volume ?? prefs.volume;

  let t = 0;
  for (const [freq, dur] of sound.pattern) {
    // Professional ADSR Envelope mapping
    // Attack: 0.02s, Decay: 0.05s, Sustain: 0.8, Release: 0.05s
    audioEngine.playTone(freq, 0.02, 0.05, 0.8, 0.05, dur, sound.type, volume);
    t += dur;
  }
  return t;
}

export function playMessageSound() {
  playSound(getNotificationPrefs().messageSoundId);
}

export function playCallConnected() {
  playSound("briefing", { force: true });
}
