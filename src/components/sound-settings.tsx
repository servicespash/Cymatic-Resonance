import { useState } from "react";
import { useCymaticAudio } from "@/hooks/use-cymatic-audio";

const PRESETS = {
  minimal: { freq: 440, name: "Minimal" },
  nature: { freq: 220, name: "Nature" },
  cymatic: { freq: 880, name: "Cymatic" },
};

export const SoundSettings = () => {
  const { playTone } = useCymaticAudio();
  const [selected, setSelected] = useState<keyof typeof PRESETS>("minimal");

  const handleTest = (key: keyof typeof PRESETS) => {
    playTone(PRESETS[key].freq, 1, "sine", true);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Sound Presets</h3>
      <div className="grid gap-2">
        {Object.entries(PRESETS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => {
              setSelected(key as keyof typeof PRESETS);
              handleTest(key as keyof typeof PRESETS);
            }}
            className={`p-3 rounded-lg border flex justify-between items-center ${
              selected === key ? "border-accent bg-accent/10" : "border-white/10"
            }`}
          >
            {preset.name}
            {selected === key && <span className="text-accent">Selected</span>}
          </button>
        ))}
      </div>
    </div>
  );
};
