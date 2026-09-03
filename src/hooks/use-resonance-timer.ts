import { useState, useEffect, useRef, useCallback } from "react";

export type TimerStatus = "idle" | "running" | "paused" | "completed";
export type TimerMode = "countdown" | "stopwatch";

export interface ResonanceTimerPreset {
  label: string;
  durationMinutes: number;
  frequency: number; // Hz, e.g. 432Hz, 528Hz, 639Hz
  description: string;
}

export const RESONANCE_PRESETS: ResonanceTimerPreset[] = [
  {
    label: "Quick Shift",
    durationMinutes: 15,
    frequency: 432,
    description: "15m • 432Hz Alpha Clarity",
  },
  {
    label: "Deep Focus",
    durationMinutes: 25,
    frequency: 528,
    description: "25m • 528Hz Harmonic Flow",
  },
  {
    label: "Gamma Flow",
    durationMinutes: 45,
    frequency: 639,
    description: "45m • 639Hz Connection",
  },
  {
    label: "Master Session",
    durationMinutes: 60,
    frequency: 741,
    description: "60m • 741Hz Awakening",
  },
];

export interface UseResonanceTimerOptions {
  initialDurationSeconds?: number;
  onComplete?: () => void;
  onTick?: (remaining: number) => void;
  autoStart?: boolean;
}

export function useResonanceTimer(options: UseResonanceTimerOptions = {}) {
  const { initialDurationSeconds = 25 * 60, onComplete, onTick } = options;

  // Hydration safety flag: initial render is always deterministic
  const [isMounted, setIsMounted] = useState(false);
  const [totalDuration, setTotalDuration] = useState(initialDurationSeconds);
  const [timeLeft, setTimeLeft] = useState(initialDurationSeconds);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [mode, setMode] = useState<TimerMode>("countdown");

  // Keep references to callbacks to avoid effect invalidation
  const onCompleteRef = useRef(onComplete);
  const onTickRef = useRef(onTick);
  onCompleteRef.current = onComplete;
  onTickRef.current = onTick;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(0);

  // Mount effect to ensure client-side safety without SSR mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Interval execution
  useEffect(() => {
    if (!isMounted) return;

    if (status === "running") {
      lastTickRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const deltaSeconds = Math.max(1, Math.round((now - lastTickRef.current) / 1000));
        lastTickRef.current = now;

        if (mode === "countdown") {
          setTimeLeft((prev) => {
            const next = prev - deltaSeconds;
            if (next <= 0) {
              clearInterval(timerRef.current!);
              setStatus("completed");
              setElapsedSeconds(totalDuration);
              if (onCompleteRef.current) {
                onCompleteRef.current();
              }
              return 0;
            }
            if (onTickRef.current) {
              onTickRef.current(next);
            }
            setElapsedSeconds((prevElapsed) => prevElapsed + deltaSeconds);
            return next;
          });
        } else {
          // Stopwatch mode
          setElapsedSeconds((prev) => {
            const next = prev + deltaSeconds;
            if (onTickRef.current) {
              onTickRef.current(next);
            }
            return next;
          });
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, mode, totalDuration, isMounted]);

  const start = useCallback(() => {
    if (status === "completed" && mode === "countdown") {
      setTimeLeft(totalDuration);
      setElapsedSeconds(0);
    }
    setStatus("running");
  }, [status, mode, totalDuration]);

  const pause = useCallback(() => {
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    setStatus("running");
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setTimeLeft(totalDuration);
    setElapsedSeconds(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [totalDuration]);

  const setDuration = useCallback((seconds: number) => {
    setTotalDuration(seconds);
    setTimeLeft(seconds);
    setElapsedSeconds(0);
    setStatus("idle");
  }, []);

  const addTime = useCallback((seconds: number) => {
    setTimeLeft((prev) => prev + seconds);
    setTotalDuration((prev) => prev + seconds);
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const nextMode = prev === "countdown" ? "stopwatch" : "countdown";
      setStatus("idle");
      setElapsedSeconds(0);
      setTimeLeft(totalDuration);
      return nextMode;
    });
  }, [totalDuration]);

  // Progress computation (0.0 to 1.0)
  const progress =
    mode === "countdown"
      ? totalDuration > 0
        ? Math.min(1, Math.max(0, (totalDuration - timeLeft) / totalDuration))
        : 0
      : Math.min(1, (elapsedSeconds % 3600) / 3600);

  // Formatted string
  const displaySeconds = mode === "countdown" ? timeLeft : elapsedSeconds;
  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;
  const hours = Math.floor(minutes / 60);

  const formattedTime =
    hours > 0
      ? `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return {
    isMounted,
    timeLeft,
    elapsedSeconds,
    totalDuration,
    status,
    mode,
    progress,
    formattedTime,
    start,
    pause,
    resume,
    reset,
    setDuration,
    addTime,
    toggleMode,
  };
}
