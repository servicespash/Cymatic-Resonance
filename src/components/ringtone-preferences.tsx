import React from "react";
import { Volume2, Play, Check } from "lucide-react";
import { useRingtoneSettings, RINGTONE_DESCRIPTIONS, playRingtonePreview } from "@/hooks/use-ringtone-settings";
import type { RingtoneStyle } from "@/audio/ringtone-library";

const RINGTONE_STYLES: RingtoneStyle[] = [
  "default",
  "morning",
  "gentle",
  "modern",
  "minimal",
  "calm",
  "zenith",
  "whisper",
  "pulse",
];

export function RingtonePreferences() {
  const { settings, updateSettings, isLoaded } = useRingtoneSettings();
  const [previewing, setPreviewing] = React.useState<RingtoneStyle | null>(null);

  if (!isLoaded) {
    return <div className="text-muted-foreground">Loading settings...</div>;
  }

  const handlePlayPreview = async (style: RingtoneStyle) => {
    setPreviewing(style);
    await playRingtonePreview(style);
    setPreviewing(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Volume2 className="w-5 h-5" />
          Ringtone Preferences
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose your preferred notification tone for incoming calls.
        </p>
      </div>

      {/* Ringtone Style Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {RINGTONE_STYLES.map((style) => (
          <button
            key={style}
            onClick={() => updateSettings({ style })}
            className={`flex items-start justify-between p-3 rounded-lg border-2 transition-colors ${
              settings.style === style
                ? "border-primary bg-primary/5"
                : "border-border bg-background hover:border-primary/50"
            }`}
          >
            <div className="text-left flex-1">
              <div className="font-medium capitalize text-sm">
                {RINGTONE_DESCRIPTIONS[style].split(" - ")[0]}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {RINGTONE_DESCRIPTIONS[style].split(" - ")[1]}
              </div>
            </div>
            <div className="flex gap-2 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPreview(style);
                }}
                disabled={previewing !== null}
                className="p-1 hover:bg-foreground/10 rounded-md transition-colors disabled:opacity-50"
                title="Play preview"
              >
                <Play className="w-4 h-4" />
              </button>
              {settings.style === style && (
                <div className="p-1 text-primary">
                  <Check className="w-4 h-4" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Volume Control */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Volume: {Math.round(settings.volume * 100)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.volume}
          onChange={(e) => updateSettings({ volume: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Vibration Toggle */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="vibration"
          checked={settings.vibration}
          onChange={(e) => updateSettings({ vibration: e.target.checked })}
          className="w-4 h-4"
        />
        <label htmlFor="vibration" className="text-sm font-medium cursor-pointer">
          Vibration on incoming calls
        </label>
      </div>

      {/* Info Box */}
      <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
        <p>
          Your preferences are saved locally. Click "Play preview" to hear each ringtone style
          before choosing.
        </p>
      </div>
    </div>
  );
}
