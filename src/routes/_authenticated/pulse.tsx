import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CymaticWave } from "@/components/cymatic-wave";
import { Check, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pulse")({
  component: PulsePage,
});

type AttRow = { id: string; attendance_date: string; checked_in_at: string; status: string };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function PulsePage() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [today, setToday] = useState<AttRow | null>(null);
  const [history, setHistory] = useState<AttRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
      setOrgId(p?.org_id ?? null);

      const { data: hist } = await supabase
        .from("attendance")
        .select("id, attendance_date, checked_in_at, status")
        .eq("user_id", user.id)
        .order("attendance_date", { ascending: false })
        .limit(30);
      const rows = (hist ?? []) as AttRow[];
      setHistory(rows);
      setToday(rows.find((r) => r.attendance_date === todayISO()) ?? null);
    })();
  }, [user]);

  const checkIn = async () => {
    if (!user || !orgId) return toast.error("Workspace not linked yet");
    setBusy(true);
    const { data, error } = await supabase
      .from("attendance")
      .insert({ user_id: user.id, org_id: orgId, status: "present" })
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Resonance recorded");
    const row = data as AttRow;
    setToday(row);
    setHistory((h) => [row, ...h]);
  };

  const checkedIn = !!today;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      {/* Pulse card */}
      <section className="glass-strong relative overflow-hidden rounded-3xl p-8 resonance-glow animate-fade-up">
        <div className="absolute inset-0 opacity-30 bg-frequency blur-3xl -z-10" />
        <div className="flex flex-col items-center text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div className="mt-3 font-display text-6xl font-bold tracking-tight tabular-nums md:text-7xl">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>

          <button
            onClick={checkIn}
            disabled={busy || checkedIn}
            className={`group relative mt-10 size-44 rounded-full transition ${
              checkedIn
                ? "bg-accent/20 border border-accent/40"
                : "bg-frequency resonance-glow hover:scale-[1.02] animate-pulse-ring"
            } disabled:cursor-not-allowed`}
          >
            <div className="flex h-full flex-col items-center justify-center gap-2">
              {checkedIn ? (
                <>
                  <Check className="size-10 text-accent" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">Synced</span>
                </>
              ) : busy ? (
                <CymaticWave className="h-8" bars={6} />
              ) : (
                <>
                  <CymaticWave className="h-8" bars={6} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary-foreground">Sync pulse</span>
                </>
              )}
            </div>
          </button>

          {checkedIn && today && (
            <div className="mt-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Locked at {new Date(today.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </section>

      {/* History */}
      <section className="glass rounded-2xl p-5 animate-fade-up" style={{ animationDelay: "100ms" }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Resonance ledger</h2>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            last {history.length} days
          </span>
        </div>
        <div className="divide-y divide-white/5">
          {history.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No check-ins yet — tap the pulse above.</div>
          )}
          {history.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-accent/15">
                  <Check className="size-4 text-accent" />
                </span>
                <div>
                  <div className="text-sm font-medium">
                    {new Date(r.attendance_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{r.status}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Clock className="size-3" />
                {new Date(r.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
