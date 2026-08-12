import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import {
  Users,
  Activity,
  AlertTriangle,
  Download,
  ArrowUpDown,
  CalendarDays,
  Check,
  X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { CymaticWave } from "@/components/cymatic-wave";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, differenceInMinutes, addDays, startOfMonth, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { RequireWorkspace } from "@/components/require-workspace";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: () => (
    <RequireWorkspace>
      <DashboardPage />
    </RequireWorkspace>
  ),
});

type Member = {
  id: string;
  full_name: string | null;
  position: string | null;
  category: string | null;
  role: string;
};
type Att = {
  id: string;
  user_id: string;
  attendance_date: string;
  checked_in_at: string;
  checked_out_at: string | null;
  total_break_minutes: number;
  is_late: boolean;
  status: string;
};
type Leave = {
  id: string;
  user_id: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "denied";
};

type SortKey = "name" | "category" | "in" | "out" | "hours" | "status" | "late";
type SortDir = "asc" | "desc";

function toISO(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function DashboardPage() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [att, setAtt] = useState<Att[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -6),
    to: new Date(),
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "absent" | "late">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    if (!user || !range?.from || !range?.to) return;
    (async () => {
      setLoading(true);
      const { data: p } = await supabase
        .from("profiles")
        .select("role, org_id")
        .eq("id", user.id)
        .maybeSingle();
      setRole(p?.role ?? null);
      if (!p?.org_id) {
        setLoading(false);
        return;
      }

      const from = toISO(range.from!);
      const to = toISO(range.to!);
      const [{ data: mem }, { data: a }, { data: lv }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, position, category, role")
          .eq("org_id", p.org_id),
        supabase
          .from("attendance")
          .select(
            "id, user_id, attendance_date, checked_in_at, checked_out_at, total_break_minutes, is_late, status",
          )
          .eq("org_id", p.org_id)
          .gte("attendance_date", from)
          .lte("attendance_date", to),
        supabase.from("leave_requests").select("*").eq("org_id", p.org_id).eq("status", "pending"),
      ]);
      setMembers((mem ?? []) as Member[]);
      setAtt((a ?? []) as Att[]);
      setLeaves((lv ?? []) as Leave[]);
      setLoading(false);
    })();
  }, [user, range?.from, range?.to]);

  const lastDay = useMemo(() => (range?.to ? toISO(range.to) : toISO(new Date())), [range]);

  // metrics across range
  const metrics = useMemo(() => {
    const totalCheckins = att.length;
    const lateCount = att.filter((r) => r.is_late).length;
    const onTimePct = totalCheckins
      ? Math.round(((totalCheckins - lateCount) / totalCheckins) * 100)
      : 0;
    const hours =
      att.reduce((acc, r) => {
        if (!r.checked_out_at) return acc;
        return (
          acc +
          Math.max(
            0,
            differenceInMinutes(new Date(r.checked_out_at), new Date(r.checked_in_at)) -
              (r.total_break_minutes ?? 0),
          )
        );
      }, 0) / 60;
    const avgHours = totalCheckins ? +(hours / totalCheckins).toFixed(1) : 0;
    const activeMembers = new Set(att.map((r) => r.user_id)).size;
    return { totalCheckins, onTimePct, avgHours, lateCount, activeMembers };
  }, [att]);

  const trend = useMemo(() => {
    if (!range?.from || !range?.to) return [];
    const days: { date: string; checkins: number; late: number }[] = [];
    const start = startOfDay(range.from);
    const end = startOfDay(range.to);
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const iso = toISO(d);
      const dayRows = att.filter((r) => r.attendance_date === iso);
      days.push({
        date: format(d, "MMM d"),
        checkins: dayRows.length,
        late: dayRows.filter((r) => r.is_late).length,
      });
    }
    return days;
  }, [att, range]);

  // roll-call rows = for the last day in range
  const rows = useMemo(() => {
    const dayAtt = att.filter((r) => r.attendance_date === lastDay);
    return members.map((m) => {
      const a = dayAtt.find((r) => r.user_id === m.id);
      const hours = a?.checked_out_at
        ? Math.max(
            0,
            differenceInMinutes(new Date(a.checked_out_at), new Date(a.checked_in_at)) -
              (a.total_break_minutes ?? 0),
          ) / 60
        : null;
      return {
        id: m.id,
        name: m.full_name ?? "—",
        category: m.category ?? "—",
        checkIn: a?.checked_in_at ?? null,
        checkOut: a?.checked_out_at ?? null,
        hours,
        status: a ? (a.checked_out_at ? "sealed" : "present") : "absent",
        late: !!a?.is_late,
      };
    });
  }, [members, att, lastDay]);

  const filteredSorted = useMemo(() => {
    let r = rows;
    if (query) {
      const q = query.toLowerCase();
      r = r.filter((x) => x.name.toLowerCase().includes(q) || x.category.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      r = r.filter((x) =>
        statusFilter === "late"
          ? x.late
          : x.status === statusFilter || (statusFilter === "present" && x.status === "sealed"),
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...r].sort((a, b) => {
      const ax: unknown = a[sortKey as keyof typeof a];
      const bx: unknown = b[sortKey as keyof typeof b];
      if (ax == null && bx == null) return 0;
      if (ax == null) return 1;
      if (bx == null) return -1;
      if (typeof ax === "number" && typeof bx === "number") return (ax - bx) * dir;
      return String(ax).localeCompare(String(bx)) * dir;
    });
    return sorted;
  }, [rows, query, statusFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const exportCSV = () => {
    if (!range?.from || !range?.to) return;
    const header = ["Name", "Category", "Check-in", "Check-out", "Hours", "Status", "Late"];
    const lines = [
      header,
      ...filteredSorted.map((r) => [
        r.name,
        r.category,
        r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : "",
        r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : "",
        r.hours != null ? r.hours.toFixed(2) : "",
        r.status,
        r.late ? "yes" : "no",
      ]),
    ];
    const csv = lines
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse_${toISO(range.from)}_${toISO(range.to)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const decideLeave = async (id: string, approve: boolean) => {
    const { error } = await supabase.rpc("decide_leave", { _id: id, _approved: approve });
    if (error) return toast.error(error.message);
    setLeaves((l) => l.filter((x) => x.id !== id));
    toast.success(approve ? "Leave approved" : "Leave denied");
  };

  const preset = (days: number | "month") => {
    const to = new Date();
    const from = days === "month" ? startOfMonth(to) : addDays(to, -(days - 1));
    setRange({ from, to });
  };

  if (loading && !members.length) {
    return (
      <div className="grid place-items-center py-20">
        <CymaticWave className="h-10" bars={6} />
      </div>
    );
  }
  if (role !== "admin") return <Navigate to="/pulse" />;

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Workspace Analytics Dashboard</h1>
      {/* Range + presets */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="bg-white/5 border-white/10 gap-2">
              <CalendarDays className="size-4" />
              {range?.from && range?.to
                ? `${format(range.from, "MMM d")} → ${format(range.to, "MMM d")}`
                : "Pick range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0 pointer-events-auto">
            <Calendar
              mode="range"
              selected={range}
              onSelect={setRange}
              numberOfMonths={2}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        {[
          { l: "Today", v: 1 },
          { l: "7d", v: 7 },
          { l: "30d", v: 30 },
        ].map((p) => (
          <button
            key={p.l}
            onClick={() => preset(p.v)}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            {p.l}
          </button>
        ))}
        <button
          onClick={() => preset("month")}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          Month
        </button>
        <div className="ml-auto" />
        <Button onClick={exportCSV} variant="outline" className="gap-2 bg-white/5 border-white/10">
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-5">
        <Kpi icon={Users} label="Members" value={members.length} />
        <Kpi icon={Activity} label="Check-ins" value={metrics.totalCheckins} />
        <Kpi icon={Activity} label="On time" value={`${metrics.onTimePct}%`} />
        <Kpi icon={AlertTriangle} label="Late" value={metrics.lateCount} tone="warn" />
        <Kpi icon={Activity} label="Avg hrs" value={metrics.avgHours} />
      </div>

      {/* Pending leave */}
      {leaves.length > 0 && (
        <Panel title="Pending time-off requests" subtitle={`${leaves.length} awaiting decision`}>
          <div className="divide-y divide-white/5">
            {leaves.map((lv) => {
              const m = members.find((x) => x.id === lv.user_id);
              return (
                <div key={lv.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{m?.full_name ?? "—"}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {lv.type} · {lv.start_date} → {lv.end_date}
                    </div>
                    {lv.reason && (
                      <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {lv.reason}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => decideLeave(lv.id, true)}
                      className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20"
                    >
                      <Check className="size-3" /> Approve
                    </button>
                    <button
                      onClick={() => decideLeave(lv.id, false)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
                    >
                      <X className="size-3" /> Deny
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Trend */}
      <Panel title="Attendance trend" subtitle="Daily check-ins vs late">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.62 0.22 275)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="oklch(0.62 0.22 275)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.78 0.16 60)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="oklch(0.78 0.16 60)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} />
            <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} />
            <Tooltip
              contentStyle={{
                background: "rgba(15,23,42,0.92)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="checkins"
              stroke="oklch(0.62 0.22 275)"
              fill="url(#g1)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="late"
              stroke="oklch(0.78 0.16 60)"
              fill="url(#g2)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      {/* Roll-call */}
      <Panel
        title="Roll call"
        subtitle={`${format(range?.to ?? new Date(), "EEE, MMM d")} · ${filteredSorted.length} shown`}
        action={
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="h-8 w-40 bg-white/5 border-white/10"
            />
            <div className="flex gap-1 rounded-md border border-white/10 bg-white/5 p-0.5">
              {(["all", "present", "absent", "late"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${statusFilter === s ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {(
                  [
                    ["name", "Name"],
                    ["category", "Category"],
                    ["in", "Check-in"],
                    ["out", "Check-out"],
                    ["hours", "Hours"],
                    ["status", "Status"],
                    ["late", "Late"],
                  ] as [SortKey, string][]
                ).map(([k, l]) => (
                  <th key={k} className="pb-2 pr-3">
                    <button
                      onClick={() => toggleSort(k)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {l} <ArrowUpDown className="size-3 opacity-50" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSorted.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-3 font-medium">{r.name}</td>
                  <td className="pr-3 text-muted-foreground">{r.category}</td>
                  <td className="pr-3 font-mono text-xs">
                    {r.checkIn
                      ? new Date(r.checkIn).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="pr-3 font-mono text-xs">
                    {r.checkOut
                      ? new Date(r.checkOut).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="pr-3 font-mono text-xs">
                    {r.hours != null ? `${r.hours.toFixed(1)}h` : "—"}
                  </td>
                  <td className="pr-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="pr-3">
                    {r.late ? (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber-400">
                        yes
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredSorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No rows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    present: ["bg-accent/15 text-accent", "present"],
    sealed: ["bg-primary/15 text-primary", "sealed"],
    absent: ["bg-white/5 text-muted-foreground", "absent"],
  };
  const [cls, label] = map[status] ?? map.absent;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${cls}`}
    >
      {label}
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone?: "warn";
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {label}
        </span>
        <Icon className={`size-4 ${tone === "warn" ? "text-amber-400" : "text-accent"}`} />
      </div>
      <div className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold truncate">{title}</h3>
          {subtitle && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
