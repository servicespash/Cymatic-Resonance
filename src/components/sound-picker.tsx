import React from "react";
import { AudioEngine } from "@/lib/audio-engine";

const SOUND_CATEGORIES = {
  minimal: [
    { id: "glass", name: "Glass Tap", freq: 600, duration: 0.5 },
    { id: "calcite", name: "Calcite Tri-Tone", freq: 440, duration: 1.0 },
    { id: "water", name: "Water Drop", freq: 800, duration: 0.4 },
    { id: "pulse", name: "Synth Pulse", freq: 200, duration: 0.8 },
  ],
  nature: [
    { id: "bamboo", name: "Bamboo Click", freq: 900, duration: 0.3 },
    { id: "rain", name: "Raindrop Accent", freq: 700, duration: 0.6 },
    { id: "bird", name: "Bird Chirp", freq: 1200, duration: 0.5 },
  ],
  cymatic: [
    { id: "resonance", name: "Resonance Pulse", freq: 150, duration: 1.5 },
    { id: "data", name: "Data Sync", freq: 400, duration: 0.7 },
  ],
};

export const SoundPicker = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const engine = React.useMemo(() => new AudioEngine(), []);

  return (
    <div className="space-y-4 p-4 bg-card/50 rounded-2xl border border-white/10">
      <h3 className="font-semibold">Notification Sound</h3>
      {Object.entries(SOUND_CATEGORIES).map(([cat, sounds]) => (
        <div key={cat} className="space-y-1">
          <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground">{cat}</h4>
          <div className="grid grid-cols-2 gap-2">
            {sounds.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  engine.playTone(s.freq, 0.02, 0.05, 0.8, 0.05, s.duration);
                  onSelect(s.id);
                }}
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-left"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
