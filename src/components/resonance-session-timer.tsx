import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Volume2,
  VolumeX,
  Sparkles,
  Timer,
  CheckCircle2,
  Bell,
  Waves,
} from "lucide-react";
import { toast } from "sonner";
import {
  useResonanceTimer,
  RESONANCE_PRESETS,
  type ResonanceTimerPreset,
} from "@/hooks/use-resonance-timer";
import { useCymaticAudio } from "@/hooks/use-cymatic-audio";
import { CymaticWave } from "@/components/cymatic-wave";
import { ClientOnly } from "@/components/client-only";

export interface ResonanceSessionTimerProps {
  className?: string;
  onSessionComplete?: (durationSeconds: number, frequency: number) => void;
  compact?: boolean;
}

export function ResonanceSessionTimer(props: ResonanceSessionTimerProps) {
  return (
    <ClientOnly
      fallback={
        <div className="glass rounded-2xl p-6 border border-white/10 animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 w-32 bg-white/10 rounded" />
            <div className="h-4 w-16 bg-white/10 rounded" />
          </div>
          <div className="flex justify-center my-8">
            <div className="w-44 h-44 rounded-full border border-white/10 bg-white/5" />
          </div>
        </div>
      }
    >
      <ResonanceSessionTimerInner {...props} />
    </ClientOnly>
  );
}

function ResonanceSessionTimerInner({
  className = "",
  onSessionComplete,
  compact = false,
}: ResonanceSessionTimerProps) {
  const [selectedPreset, setSelectedPreset] = useState<ResonanceTimerPreset>(
    RESONANCE_PRESETS[1], // 25m Deep Focus
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { playTone } = useCymaticAudio();

  const handleComplete = useCallback(() => {
    if (soundEnabled) {
      // Play harmonic chime chord: root frequency + overtone
      playTone(selectedPreset.frequency, 2.5, "sine", true);
      setTimeout(() => {
        playTone(selectedPreset.frequency * 1.5, 3.0, "sine", false);
      }, 250);
    }
    toast.success("Resonance Session Completed", {
      description: `Harmonic session concluded at ${selectedPreset.frequency}Hz.`,
      icon: <Sparkles className="size-4 text-accent" />,
    });
    if (onSessionComplete) {
      onSessionComplete(selectedPreset.durationMinutes * 60, selectedPreset.frequency);
    }
  }, [soundEnabled, selectedPreset, playTone, onSessionComplete]);

  const {
    isMounted,
    timeLeft,
    elapsedSeconds,
    status,
    mode,
    progress,
    formattedTime,
    start,
    pause,
    reset,
    setDuration,
    addTime,
    toggleMode,
  } = useResonanceTimer({
    initialDurationSeconds: selectedPreset.durationMinutes * 60,
    onComplete: handleComplete,
  });

  const selectPreset = (preset: ResonanceTimerPreset) => {
    setSelectedPreset(preset);
    setDuration(preset.durationMinutes * 60);
    if (soundEnabled) {
      // Brief subtle frequency bell
      playTone(preset.frequency, 0.4, "sine");
    }
  };

  const handleStartPause = () => {
    if (status === "running") {
      pause();
    } else {
      start();
      if (soundEnabled && status === "idle") {
        playTone(selectedPreset.frequency, 0.6, "sine");
      }
    }
  };

  const handleAddFiveMinutes = () => {
    addTime(5 * 60);
    toast.info("Added +5 minutes of resonance focus");
  };

  // Circular progress SVG calculations
  const radius = compact ? 56 : 84;
  const strokeWidth = compact ? 6 : 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  if (!isMounted) {
    return (
      <div className="glass rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-32 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`glass relative overflow-hidden rounded-2xl border border-white/10 p-5 md:p-6 shadow-xl transition-all ${className}`}
    >
      {/* Background ambient radial glow when running */}
      <AnimatePresence>
        {status === "running" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute -inset-10 bg-gradient-to-r from-primary/40 via-accent/30 to-purple-600/40 blur-3xl"
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-frequency text-primary-foreground resonance-glow">
            <Waves className="size-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              Resonance Session
              {status === "running" && <CymaticWave bars={3} className="h-3 ml-1" />}
            </h3>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {mode === "countdown"
                ? `${selectedPreset.frequency}Hz Harmonic Focus`
                : "Open Flow Stopwatch"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`grid size-7 place-items-center rounded-md border text-xs transition-colors ${
              soundEnabled
                ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
                : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
            }`}
            title={soundEnabled ? "Harmonic chimes active" : "Harmonic chimes muted"}
          >
            {soundEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
          </button>

          <button
            type="button"
            onClick={toggleMode}
            className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground hover:bg-white/10"
            title="Toggle between Countdown and Stopwatch mode"
          >
            <Timer className="size-3" />
            {mode === "countdown" ? "Timer" : "Stopwatch"}
          </button>
        </div>
      </div>

      {/* Center Stage: Radial Dial */}
      <div className="relative z-10 my-6 flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <svg
            className="-rotate-90 transform"
            width={radius * 2 + strokeWidth * 2 + 16}
            height={radius * 2 + strokeWidth * 2 + 16}
          >
            <defs>
              <linearGradient id="resonanceDialGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="oklch(0.65 0.24 275)" />
                <stop offset="50%" stopColor="oklch(0.78 0.18 190)" />
                <stop offset="100%" stopColor="oklch(0.82 0.20 145)" />
              </linearGradient>
            </defs>
            {/* Background ring */}
            <circle
              cx={radius + strokeWidth + 8}
              cy={radius + strokeWidth + 8}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-white/5"
              fill="transparent"
            />
            {/* Animated progress ring */}
            <circle
              cx={radius + strokeWidth + 8}
              cy={radius + strokeWidth + 8}
              r={radius}
              stroke="url(#resonanceDialGrad)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
          </svg>

          {/* Central Countdown Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono text-3xl md:text-4xl font-bold tracking-tight text-foreground tabular-nums drop-shadow-sm">
              {formattedTime}
            </span>
            <div className="mt-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {status === "completed" ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                  <CheckCircle2 className="size-3" /> Harmony achieved
                </span>
              ) : status === "running" ? (
                <span className="text-accent animate-pulse">Resonance in phase</span>
              ) : status === "paused" ? (
                <span className="text-amber-400">Suspended</span>
              ) : (
                <span>{selectedPreset.label}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preset Pills (Countdown Mode) */}
      {mode === "countdown" && (
        <div className="relative z-10 mb-5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {RESONANCE_PRESETS.map((preset) => {
            const isSelected = selectedPreset.durationMinutes === preset.durationMinutes;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => selectPreset(preset)}
                className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-all ${
                  isSelected
                    ? "border-accent/40 bg-accent/10 shadow-sm"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10"
                }`}
              >
                <span
                  className={`font-display text-xs font-semibold ${
                    isSelected ? "text-accent" : "text-foreground"
                  }`}
                >
                  {preset.label}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">
                  {preset.durationMinutes}m • {preset.frequency}Hz
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Control Actions */}
      <div className="relative z-10 flex items-center justify-between gap-2 border-t border-white/5 pt-4">
        <button
          type="button"
          onClick={reset}
          disabled={
            status === "idle" &&
            elapsedSeconds === 0 &&
            timeLeft === selectedPreset.durationMinutes * 60
          }
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
        >
          <RotateCcw className="size-3.5" />
          Reset
        </button>

        <div className="flex items-center gap-2">
          {mode === "countdown" && (
            <button
              type="button"
              onClick={handleAddFiveMinutes}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground"
              title="Add 5 minutes to active session"
            >
              <Plus className="size-3.5" />
              +5m
            </button>
          )}

          <button
            type="button"
            onClick={handleStartPause}
            className={`flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-semibold shadow-md transition-all ${
              status === "running"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30"
                : "bg-gradient-to-r from-indigo-500 to-accent text-white hover:opacity-95 resonance-glow"
            }`}
          >
            {status === "running" ? (
              <>
                <Pause className="size-3.5 fill-current" /> Pause
              </>
            ) : status === "paused" ? (
              <>
                <Play className="size-3.5 fill-current" /> Resume
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current" /> Start Focus
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
