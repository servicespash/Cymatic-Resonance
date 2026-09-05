import { Check, Clock, Navigation, MapPin } from "lucide-react";

interface CheckInRecord {
  id: string;
  attendance_date: string;
  checked_in_at: string;
  checked_out_at: string | null;
  total_break_minutes: number;
  is_late: boolean;
  note: string | null;
}

export function CheckInHistory({ history }: { history: CheckInRecord[] }) {
  const formatTelemetry = (raw: string | null) => {
    if (!raw) return null;
    try {
      if (raw.startsWith("{")) {
        const parsed = JSON.parse(raw);
        const { text, telemetry } = parsed;
        if (!telemetry) return text || null;

        const distanceStr =
          telemetry.variance > 1000
            ? `${(telemetry.variance / 1000).toFixed(2)}km`
            : `${Math.round(telemetry.variance)}m`;

        return (
          <div className="space-y-1">
            {text && <div className="text-sm font-medium text-foreground">{text}</div>}
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                <Navigation className="size-2.5" /> {telemetry.status}
              </div>
              {telemetry.status !== "denied" && (
                <div className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">
                  <MapPin className="size-2.5" /> {distanceStr} Delta
                </div>
              )}
            </div>
          </div>
        );
      }
    } catch (e) {
      // ignore
    }
    return raw;
  };

  return (
    <section className="glass rounded-2xl p-5 animate-fade-up shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">Resonance Ledger</h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
          Last {history.length} Cycles
        </span>
      </div>

      <div className="space-y-1">
        {history.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground italic">
            No institutional cycles recorded — tap to sync pulse.
          </div>
        )}
        {history.map((r) => {
          const durMinutes = r.checked_out_at
            ? Math.max(
                0,
                Math.floor(
                  (new Date(r.checked_out_at).getTime() - new Date(r.checked_in_at).getTime()) /
                    60000,
                ) - r.total_break_minutes,
              )
            : null;

          return (
            <div
              key={r.id}
              className="group flex flex-col gap-3 rounded-xl border border-transparent p-3 transition-all hover:border-white/5 hover:bg-white/[0.02]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-accent/15 text-accent group-hover:scale-105 transition-transform">
                    <Check className="size-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                      {new Date(r.attendance_date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                      {r.is_late && (
                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber-400">
                          late
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                      <Clock className="size-3" />
                      {new Date(r.checked_in_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {r.checked_out_at && (
                        <>
                          <span className="opacity-40">→</span>
                          {new Date(r.checked_out_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {durMinutes !== null && (
                  <div className="text-right">
                    <div className="font-mono text-xs font-bold text-accent">
                      {fmtH(durMinutes)}
                    </div>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground/60">
                      Duration
                    </div>
                  </div>
                )}
              </div>

              {r.note && (
                <div className="ml-12 border-l border-white/10 pl-4 py-0.5">
                  {formatTelemetry(r.note)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function fmtH(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
