import { useEffect, useState } from "react";
import { Volume2, VolumeX, Play, BellRing, MessageSquare, Check } from "lucide-react";
import {
  SOUND_LIBRARY,
  getNotificationPrefs,
  setNotificationPrefs,
  playSound,
  type SoundPrefs,
} from "@/lib/sound-library";
import { toast } from "sonner";

type Target = "ringtoneId" | "messageSoundId";

export const SoundSettings = () => {
  const [prefs, setPrefs] = useState<SoundPrefs | null>(null);
  const [target, setTarget] = useState<Target>("ringtoneId");

  useEffect(() => {
    setPrefs(getNotificationPrefs());
  }, []);

  if (!prefs) return null;

  const update = (patch: Partial<SoundPrefs>) => setPrefs(setNotificationPrefs(patch));

  const choose = (id: string) => {
    update({ [target]: id } as Partial<SoundPrefs>);
    playSound(id, { force: true, volume: prefs.volume });
    toast.success(`${target === "ringtoneId" ? "Ringtone" : "Message sound"} updated`);
  };

  return (
    <section className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2">
        <BellRing className="size-4 text-accent" />
        <h3 className="font-display text-lg font-semibold">Sound &amp; notifications</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose professional tones for calls and messages. Preferences are saved on this device.
      </p>

      <div className="mt-4 flex gap-2">
        {(
          [
            { key: "ringtoneId", label: "Ringtone", icon: BellRing },
            { key: "messageSoundId", label: "Message", icon: MessageSquare },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTarget(key)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
              target === key
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-5">
        {SOUND_LIBRARY.map((cat) => (
          <div key={cat.id}>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {cat.label} · {cat.description}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {cat.sounds.map((s) => {
                const selected = prefs[target] === s.id;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                      selected
                        ? "border-accent/50 bg-accent/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <button className="flex-1 text-left" onClick={() => choose(s.id)}>
                      {s.name}
                    </button>
                    <button
                      aria-label={`Preview ${s.name}`}
                      onClick={() => playSound(s.id, { force: true, volume: prefs.volume })}
                      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
                    >
                      {selected ? (
                        <Check className="size-3.5 text-accent" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <button
          onClick={() => update({ muted: !prefs.muted })}
          aria-label={prefs.muted ? "Unmute sounds" : "Mute sounds"}
          className="rounded-lg p-2 hover:bg-white/10"
        >
          {prefs.muted ? (
            <VolumeX className="size-4 text-red-300" />
          ) : (
            <Volume2 className="size-4 text-accent" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(prefs.volume * 100)}
          onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
          className="flex-1 accent-current"
          aria-label="Sound volume"
        />
        <span className="w-10 text-right font-mono text-xs text-muted-foreground">
          {Math.round(prefs.volume * 100)}%
        </span>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={prefs.showEncryptionBadges}
          onChange={(e) => update({ showEncryptionBadges: e.target.checked })}
        />
        Show encryption badges on secured messages
      </label>
    </section>
  );
};
