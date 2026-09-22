import { useState, useMemo } from "react";
import { Check, Clock, Navigation, MapPin, Coffee, Calendar, FileText } from "lucide-react";
import { format, addDays, startOfMonth, parseISO } from "date-fns";
import { RegistryExport } from "@/components/registry-export";
import { buildMultiDayExportRows } from "@/lib/export-utils";

export interface CheckInRecord {
  id: string;
  attendance_date: string;
  checked_in_at: string;
  checked_out_at: string | null;
  break_started_at?: string | null;
  total_break_minutes: number;
  is_late: boolean;
  status?: string;
  note: string | null;
}

export interface LeaveRecord {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "denied";
}

interface CheckInHistoryProps {
  history: CheckInRecord[];
  leaves?: LeaveRecord[];
  userName?: string | null;
  userCategory?: string | null;
  userId?: string;
}

type RangePreset = "7d" | "30d" | "month" | "all";

export function CheckInHistory({
  history,
  leaves = [],
  userName,
  userCategory,
  userId = "self",
}: CheckInHistoryProps) {
  const [preset, setPreset] = useState<RangePreset>("7d");

  const { rangeFrom, rangeTo } = useMemo(() => {
    const today = new Date();
    if (preset === "7d") {
      return { rangeFrom: addDays(today, -6), rangeTo: today };
    }
    if (preset === "30d") {
      return { rangeFrom: addDays(today, -29), rangeTo: today };
    }
    if (preset === "month") {
      return { rangeFrom: startOfMonth(today), rangeTo: today };
    }
    // "all": find earliest record or fallback to 90 days ago
    let earliest = addDays(today, -90);
    if (history.length > 0) {
      const dates = history.map((h) => new Date(h.attendance_date).getTime());
      earliest = new Date(Math.min(...dates));
    }
    return { rangeFrom: earliest, rangeTo: today };
  }, [preset, history]);

  // Build the multi-day export dataset across the selected range
  const exportRows = useMemo(() => {
    return buildMultiDayExportRows({
      rangeFrom,
      rangeTo,
      members: [
        {
          id: userId,
          full_name: userName || "Member",
          category: userCategory || "Member",
        },
      ],
      attendance: history.map((h) => ({
        id: h.id,
        user_id: userId,
        attendance_date: h.attendance_date,
        checked_in_at: h.checked_in_at,
        checked_out_at: h.checked_out_at,
        break_started_at: h.break_started_at,
        total_break_minutes: h.total_break_minutes || 0,
        is_late: h.is_late || false,
        status: h.status || "present",
        note: h.note,
      })),
      leaves: leaves.map((l) => ({
        id: l.id,
        user_id: userId,
        type: l.type,
        start_date: l.start_date,
        end_date: l.end_date,
        reason: l.reason,
        status: l.status,
      })),
      includeAbsent: true,
    });
  }, [rangeFrom, rangeTo, history, leaves, userId, userName, userCategory]);

  // Filter UI display items for the selected range
  const fromIso = format(rangeFrom, "yyyy-MM-dd");
  const toIso = format(rangeTo, "yyyy-MM-dd");

  const visibleHistory = useMemo(() => {
    return history.filter((h) => h.attendance_date >= fromIso && h.attendance_date <= toIso);
  }, [history, fromIso, toIso]);

  const visibleLeaves = useMemo(() => {
    return leaves.filter((l) => l.start_date <= toIso && l.end_date >= fromIso);
  }, [leaves, fromIso, toIso]);

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
    } catch {
      // ignore malformed notes
    }
    return raw;
  };

  return (
    <section className="glass rounded-2xl p-5 animate-fade-up shadow-sm">
      {/* Header & Controls */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Personal File & Ledger
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
            {userName || "Member"} · Check-in, Break & Leave History
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
            {(
              [
                { l: "7 Days", v: "7d" },
                { l: "30 Days", v: "30d" },
                { l: "Month", v: "month" },
                { l: "All", v: "all" },
              ] as const
            ).map((p) => (
              <button
                key={p.v}
                onClick={() => setPreset(p.v)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  preset === p.v
                    ? "bg-accent/20 text-accent font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.l}
              </button>
            ))}
          </div>

          <RegistryExport
            compact={true}
            availableRows={exportRows}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
            title={`${userName || "Personal"} Activity Ledger`}
            subtitle="Check-in, Check-out, Break & Leave Report"
          />
        </div>
      </div>

      {/* Content Feed */}
      <div className="space-y-3">
        {/* Render Leaves active in this range */}
        {visibleLeaves.map((lv) => (
          <div
            key={lv.id}
            className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Calendar className="size-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                    <span>Leave: {lv.type}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest border ${
                        lv.status === "approved"
                          ? "border-accent/30 bg-accent/10 text-accent"
                          : lv.status === "denied"
                            ? "border-red-500/30 bg-red-500/10 text-red-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {lv.status}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {lv.start_date} → {lv.end_date}
                  </div>
                </div>
              </div>
            </div>

            {/* Stated Reason */}
            <div className="ml-12 border-l border-primary/20 pl-3 py-0.5 text-xs text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/80 flex items-center gap-1 mb-0.5">
                <FileText className="size-3 text-primary" /> Stated Reason:
              </span>
              <p className="italic text-foreground/90 font-sans">
                "{lv.reason || "No explicit reason specified"}"
              </p>
            </div>
          </div>
        ))}

        {/* Render Attendance Cycles */}
        {visibleHistory.map((r) => {
          const durMinutes = r.checked_out_at
            ? Math.max(
                0,
                Math.floor(
                  (new Date(r.checked_out_at).getTime() - new Date(r.checked_in_at).getTime()) /
                    60000,
                ) - (r.total_break_minutes || 0),
              )
            : null;

          return (
            <div
              key={r.id}
              className="group flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-all hover:border-white/10 hover:bg-white/[0.04]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-accent/15 text-accent group-hover:scale-105 transition-transform">
                    <Check className="size-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                      {format(parseISO(r.attendance_date), "EEE, MMM d, yyyy")}
                      {r.is_late && (
                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber-400">
                          late
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground flex-wrap">
                      <Clock className="size-3" />
                      <span>
                        {new Date(r.checked_in_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="opacity-40">→</span>
                      <span>
                        {r.checked_out_at
                          ? new Date(r.checked_out_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "In Progress"}
                      </span>

                      {/* Break Time Indicator */}
                      {r.total_break_minutes > 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.2 text-[9px] text-amber-300 font-mono">
                          <Coffee className="size-2.5" /> Break: {fmtH(r.total_break_minutes)}
                        </span>
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
                      Work Duration
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

        {visibleHistory.length === 0 && visibleLeaves.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground italic">
            No institutional cycles or leave records in the selected range.
          </div>
        )}
      </div>
    </section>
  );
}

function fmtH(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
