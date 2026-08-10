import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CymaticWave } from "@/components/cymatic-wave";
import { FrequencyVisualizer } from "@/components/frequency-visualizer";
import { RequireWorkspace } from "@/components/require-workspace";
import { Check, Clock, Coffee, LogOut, Flame, AlertTriangle, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { LeavePanel } from "@/components/leave-panel";

export const Route = createFileRoute("/_authenticated/pulse")({
  component: () => (
    <RequireWorkspace>
      <PulsePage />
    </RequireWorkspace>
  ),
});

type AttRow = {
  id: string;
  attendance_date: string;
  checked_in_at: string;
  checked_out_at: string | null;
  break_started_at: string | null;
  total_break_minutes: number;
  is_late: boolean;
  status: string;
  note: string | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function PulsePage() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [today, setToday] = useState<AttRow | null>(null);
  const [history, setHistory] = useState<AttRow[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startMic = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(s);
    } catch (e) {
      toast.error("Microphone access denied");
    }
  };

  const stopMic = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("attendance")
      .select(
        "id, attendance_date, checked_in_at, checked_out_at, break_started_at, total_break_minutes, is_late, status, note",
      )
      .eq("user_id", user.id)
      .order("attendance_date", { ascending: false })
      .limit(30);
    const rows = (data ?? []) as AttRow[];
    setHistory(rows);
    setToday(rows.find((r) => r.attendance_date === todayISO()) ?? null);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const checkIn = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("pulse_checkin", { _note: note || undefined });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Resonance recorded");
    setNote("");
    setToday(data as AttRow);
    setHistory((h) => [data as AttRow, ...h]);
  };

  const checkOut = async () => {
    if (!today) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("pulse_checkout", { _id: today.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Day sealed");
    setToday(data as AttRow);
    refresh();
  };

  const toggleBreak = async () => {
    if (!today) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("pulse_toggle_break", { _id: today.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    setToday(data as AttRow);
  };

  const state: "out" | "in" | "break" | "sealed" = !today
    ? "out"
    : today.checked_out_at
      ? "sealed"
      : today.break_started_at
        ? "break"
        : "in";

  const liveMinutes = useMemo(() => {
    if (!today) return 0;
    const end = today.checked_out_at ? new Date(today.checked_out_at) : now;
    const total = Math.max(
      0,
      Math.floor((end.getTime() - new Date(today.checked_in_at).getTime()) / 60000),
    );
    const activeBreak =
      today.break_started_at && !today.checked_out_at
        ? Math.floor((now.getTime() - new Date(today.break_started_at).getTime()) / 60000)
        : 0;
    return Math.max(0, total - today.total_break_minutes - activeBreak);
  }, [today, now]);

  const streak = useMemo(() => {
    const set = new Set(history.map((r) => r.attendance_date));
    let s = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      if (set.has(d)) s++;
      else break;
    }
    return s;
  }, [history]);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 animate-fade-up">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-6">
          <h1 className="sr-only">Your Resonance Pulse</h1>

          {/* Visualizer card */}
          <section className="glass relative h-32 overflow-hidden rounded-2xl border border-white/5 p-4 resonance-glow">
            <div className="absolute inset-0 -z-10 bg-frequency/5" />
            <div className="flex h-full items-center justify-between">
              <div className="flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Frequency Stream
                </div>
                <div className="mt-1 font-display text-sm font-semibold text-accent">
                  {stream ? "Active Signal" : "Sensor Offline"}
                </div>
              </div>
              <button
                onClick={stream ? stopMic : startMic}
                className={`grid size-10 place-items-center rounded-full transition ${
                  stream
                    ? "bg-accent/20 text-accent ring-1 ring-accent/30"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10"
                }`}
              >
                {stream ? <Mic className="size-4" /> : <MicOff className="size-4" />}
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-16 opacity-60">
              <FrequencyVisualizer stream={stream} barColor="oklch(0.78 0.16 200)" gap={3} />
            </div>
          </section>

          {/* Pulse card */}
          <section className="glass-strong relative overflow-hidden rounded-3xl p-8 resonance-glow">
            <div className="absolute inset-0 -z-10 bg-frequency/30 blur-3xl" />

            <div className="flex items-center justify-between">
              <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                {now.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              {streak > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-accent">
                  <Flame className="size-3" /> {streak}-day streak
                </div>
              )}
            </div>

            <div className="mt-3 text-center">
              <div className="font-display text-6xl font-bold tracking-tight tabular-nums md:text-7xl">
                {now.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>

              {/* big pulse button */}
              <div className="mt-8 flex flex-col items-center">
                <PulseButton state={state} busy={busy} onClick={checkIn} />

                {state === "out" && (
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note (optional)"
                    className="mt-6 w-full max-w-sm rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-sm outline-none focus:border-primary/40"
                  />
                )}

                {today && state !== "sealed" && (
                  <div className="mt-6 flex items-center gap-2">
                    <button
                      onClick={toggleBreak}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs transition hover:bg-white/10 disabled:opacity-50"
                    >
                      <Coffee className="size-3.5" />
                      {state === "break" ? "Resume" : "Take break"}
                    </button>
                    <button
                      onClick={checkOut}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs transition hover:bg-white/10 disabled:opacity-50"
                    >
                      <LogOut className="size-3.5" />
                      Check out
                    </button>
                  </div>
                )}

                {today && (
                  <div className="mt-6 grid w-full max-w-md grid-cols-3 gap-3">
                    <Stat label="Logged" value={fmtH(liveMinutes)} />
                    <Stat label="Break" value={`${today.total_break_minutes}m`} />
                    <Stat
                      label="Status"
                      value={
                        state === "sealed" ? "Sealed" : state === "break" ? "On break" : "Active"
                      }
                      tone={today.is_late ? "warn" : state === "sealed" ? "muted" : "ok"}
                    />
                  </div>
                )}

                {today?.is_late && (
                  <div className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-400">
                    <AlertTriangle className="size-3" /> Late check-in
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* History */}
      <section
        className="glass rounded-2xl p-5 animate-fade-up"
        style={{ animationDelay: "100ms" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Resonance ledger</h2>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            last {history.length} days
          </span>
        </div>
        <div className="divide-y divide-white/5">
          {history.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No check-ins yet — tap the pulse above.
            </div>
          )}
          {history.map((r) => {
            const dur = r.checked_out_at
              ? Math.max(
                  0,
                  Math.floor(
                    (new Date(r.checked_out_at).getTime() - new Date(r.checked_in_at).getTime()) /
                      60000,
                  ) - r.total_break_minutes,
                )
              : null;
            return (
              <div key={r.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-accent/15">
                    <Check className="size-4 text-accent" />
                  </span>
                  <div>
                    <div className="text-sm font-medium">
                      {new Date(r.attendance_date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                      {r.is_late && (
                        <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber-400">
                          late
                        </span>
                      )}
                    </div>
                    {r.note && (
                      <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {r.note}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5 font-mono text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {new Date(r.checked_in_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {r.checked_out_at && (
                      <>
                        <span className="opacity-50">→</span>
                        {new Date(r.checked_out_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </div>
                  {dur !== null && (
                    <div className="font-mono text-[10px] uppercase tracking-widest text-accent">
                      {fmtH(dur)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <LeavePanel />
    </div>
  );
}

function PulseButton({
  state,
  busy,
  onClick,
}: {
  state: "out" | "in" | "break" | "sealed";
  busy: boolean;
  onClick: () => void;
}) {
  const disabled = busy || state !== "out";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative size-44 rounded-full transition ${
        state === "out"
          ? "bg-frequency resonance-glow hover:scale-[1.02] animate-pulse-ring"
          : state === "sealed"
            ? "bg-muted/30 border border-white/10"
            : state === "break"
              ? "bg-amber-500/15 border border-amber-400/30"
              : "bg-accent/20 border border-accent/40"
      } disabled:cursor-default`}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="flex h-full flex-col items-center justify-center gap-2"
        >
          {state === "out" ? (
            <>
              <CymaticWave className="h-8" bars={6} />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary-foreground">
                Sync pulse
              </span>
            </>
          ) : state === "in" ? (
            <>
              <Check className="size-10 text-accent" />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">
                Active
              </span>
            </>
          ) : state === "break" ? (
            <>
              <Coffee className="size-10 text-amber-400" />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
                On break
              </span>
            </>
          ) : (
            <>
              <LogOut className="size-10 text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Sealed
              </span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}

function Stat({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "muted";
}) {
  const color =
    tone === "warn" ? "text-amber-400" : tone === "muted" ? "text-muted-foreground" : "text-accent";
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-display text-base font-semibold tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}

function fmtH(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
