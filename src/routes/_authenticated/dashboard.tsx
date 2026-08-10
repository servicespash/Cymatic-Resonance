import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
import { AnimatePresence, motion } from "framer-motion";
import { CymaticWave } from "@/components/cymatic-wave";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, differenceInMinutes, addDays, startOfMonth, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { RequireWorkspace } from "@/components/require-workspace";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Member, Profile, LeaveRequest } from "@/types";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: unknown) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: () => (
    <RequireWorkspace>
      <DashboardPage />
    </RequireWorkspace>
  ),
});

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

type SortKey = "name" | "category" | "in" | "out" | "hours" | "status" | "late";
type SortDir = "asc" | "desc";

function toISO(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [att, setAtt] = useState<Att[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "absent" | "late">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Time off form
  const [showTimeOff, setShowTimeOff] = useState(false);
  const [timeOffData, setTimeOffData] = useState({
    start: "",
    end: "",
    type: "vacation",
    reason: "",
  });

  useEffect(() => {
    if (!user || !range?.from || !range?.to) return;
    (async () => {
      setLoading(true);
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(p);

      if (!p?.org_id) {
        setLoading(false);
        return;
      }

      const from = toISO(range.from!);
      const to = toISO(range.to!);

      const queries = [];
      if (p.role === "admin") {
        queries.push(
          supabase
            .from("profiles")
            .select("id, full_name, position, category, role")
            .eq("org_id", p.org_id),
          supabase
            .from("attendance")
            .select("*")
            .eq("org_id", p.org_id)
            .gte("attendance_date", from)
            .lte("attendance_date", to),
          supabase
            .from("leave_requests")
            .select("*")
            .eq("org_id", p.org_id)
            .eq("status", "pending"),
        );
      } else {
        queries.push(
          Promise.resolve({ data: [p] }), // Members only see themselves in some lists
          supabase
            .from("attendance")
            .select("*")
            .eq("user_id", user.id)
            .gte("attendance_date", from)
            .lte("attendance_date", to),
          supabase
            .from("leave_requests")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        );
      }

      const [memRes, attRes, leaveRes] = await Promise.all(queries);
      setMembers((memRes.data ?? []) as Member[]);
      setAtt((attRes.data ?? []) as Att[]);
      setLeaves((leaveRes.data ?? []) as unknown as LeaveRequest[]);
      setLoading(false);
    })();
  }, [user, range?.from, range?.to]);

  const submitTimeOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.org_id || !user) return;
    setBusy(true);
    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      org_id: profile.org_id,
      start_date: timeOffData.start,
      end_date: timeOffData.end,
      type: timeOffData.type as "sick" | "vacation" | "personal" | "other",
      reason: timeOffData.reason,
      status: "pending",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Request submitted");
    setShowTimeOff(false);
    // Refresh leaves
    const { data } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setLeaves(data as LeaveRequest[]);
  };

  const lastDay = useMemo(() => (range?.to ? toISO(range.to) : toISO(new Date())), [range]);

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
    return {
      totalCheckins,
      onTimePct,
      avgHours,
      lateCount,
      activeMembers,
      totalHours: +hours.toFixed(1),
    };
  }, [att]);

  const trend = useMemo(() => {
    if (!range?.from || !range?.to) return [];
    const days: { date: string; checkins: number; late: number; hours: number }[] = [];
    const start = startOfDay(range.from);
    const end = startOfDay(range.to);
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const iso = toISO(d);
      const dayRows = att.filter((r) => r.attendance_date === iso);
      const dayHours =
        dayRows.reduce((acc, r) => {
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
      days.push({
        date: format(d, "MMM d"),
        checkins: dayRows.length,
        late: dayRows.filter((r) => r.is_late).length,
        hours: +dayHours.toFixed(1),
      });
    }
    return days;
  }, [att, range]);

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
    return [...r].sort((a, b) => {
      const ax = a[sortKey as keyof typeof a];
      const bx = b[sortKey as keyof typeof b];
      if (ax == null && bx == null) return 0;
      if (ax == null) return 1;
      if (bx == null) return -1;
      if (typeof ax === "number" && typeof bx === "number") return (ax - bx) * dir;
      return String(ax).localeCompare(String(bx)) * dir;
    });
  }, [rows, query, statusFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const decideLeave = async (id: string, approve: boolean) => {
    const { error } = await supabase.rpc("decide_leave", { _id: id, _approved: approve });
    if (error) return toast.error(error.message);
    setLeaves((l) => l.filter((x) => x.id !== id));
    toast.success(approve ? "Leave approved" : "Leave denied");
  };

  const exportCSV = () => {
    if (!range?.from || !range?.to) return;
    const header = ["Name", "Category", "Check-in", "Check-out", "Hours", "Status", "Late"];
    const csv = [
      header,
      ...filteredSorted.map((r) => [
        r.name,
        r.category,
        r.checkIn,
        r.checkOut,
        r.hours,
        r.status,
        r.late,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger_${toISO(range.from)}_${toISO(range.to)}.csv`;
    a.click();
  };

  const exportPDF = () => {
    if (!range?.from || !range?.to) return;
    const doc = new jsPDF();

    // Header styling
    doc.setFillColor(3, 7, 18);
    doc.rect(0, 0, 210, 45, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("CYMATIC RESONANCE", 15, 25);

    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("ELITE WORKSPACE ACTIVITY LEDGER", 15, 32);

    // Add a simple geometric brand element
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.line(15, 35, 60, 35);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`PERIOD: ${format(range.from, "PPP")} TO ${format(range.to, "PPP")}`, 15, 41);

    // Summary Section
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(14);
    doc.text("WORKSPACE PERFORMANCE SUMMARY", 15, 65);

    const summaryData = [
      ["Metric", "Value"],
      ["Total Members", members.length.toString()],
      ["Check-ins", metrics.totalCheckins.toString()],
      ["Hours", metrics.totalHours.toString()],
      ["Punctuality", `${metrics.onTimePct}%`],
      ["Late Incidents", metrics.lateCount.toString()],
    ];

    autoTable(doc, {
      startY: 70,
      head: [summaryData[0]],
      body: summaryData.slice(1),
      theme: "grid",
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 5 },
      margin: { left: 15 },
      columnStyles: { 0: { fontStyle: "bold", fillColor: [245, 245, 250] } },
    });

    const finalY1 =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;

    // Detailed Log
    doc.text("DETAILED ACTIVITY LOG", 15, finalY1 + 15);

    const tableData = filteredSorted.map((r) => [
      r.name,
      r.category,
      r.checkIn ? format(new Date(r.checkIn), "HH:mm") : "—",
      r.checkOut ? format(new Date(r.checkOut), "HH:mm") : "—",
      r.hours?.toFixed(1) ?? "0.0",
      r.status.toUpperCase(),
      r.late ? "LATE" : "ON-TIME",
    ]);

    autoTable(doc, {
      startY: finalY1 + 20,
      head: [["NAME", "CATEGORY", "CHECK-IN", "CHECK-OUT", "HRS", "STATUS", "PUNCTUALITY"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [3, 7, 18], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 15 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save(`resonance_report_${toISO(range.from)}.pdf`);
    toast.success("Resonance Report exported successfully");
  };

  if (loading && !members.length) {
    return (
      <div className="grid place-items-center py-20">
        <CymaticWave className="h-10" bars={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="bg-white/5 border-white/10 gap-2 h-9 text-xs">
                <CalendarDays className="size-4" />
                {range?.from && range?.to
                  ? `${format(range.from, "MMM d")} → ${format(range.to, "MMM d")}`
                  : "Range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0 border-white/10 glass-strong">
              <Calendar
                mode="range"
                selected={range}
                onSelect={setRange}
                numberOfMonths={2}
                className="p-3"
              />
            </PopoverContent>
          </Popover>
          {[
            { l: "7d", v: 7 },
            { l: "30d", v: 30 },
          ].map((p) => (
            <button
              key={p.l}
              onClick={() => setRange({ from: addDays(new Date(), -p.v + 1), to: new Date() })}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              {p.l}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {!isAdmin && (
            <button
              onClick={() => setShowTimeOff(true)}
              className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-primary-foreground resonance-glow"
            >
              Request Time Off
            </button>
          )}
          <Button
            onClick={exportCSV}
            variant="outline"
            className="gap-2 bg-white/5 border-white/10 h-9 text-xs font-mono opacity-60 hover:opacity-100"
          >
            <Download className="size-4" /> CSV
          </Button>
          <Button
            onClick={exportPDF}
            className="gap-2 bg-accent text-primary-foreground h-9 text-xs font-semibold resonance-glow"
          >
            <Download className="size-4" /> Export Report (PDF)
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Activity} label="Total Hours" value={metrics.totalHours} />
        <Kpi icon={Check} label="On Time %" value={`${metrics.onTimePct}%`} />
        <Kpi icon={CalendarDays} label="Check-ins" value={metrics.totalCheckins} />
        <Kpi
          icon={AlertTriangle}
          label="Late Count"
          value={metrics.lateCount}
          tone={metrics.lateCount > 0 ? "warn" : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Activity Trend"
          subtitle="Resonance hours over time"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.62 0.22 275)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="oklch(0.62 0.22 275)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="oklch(0.62 0.22 275)"
                fill="url(#g1)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <section className="glass rounded-2xl p-5 space-y-4">
          <div className="font-display font-semibold">Recent Requests</div>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {leaves.slice(0, 4).map((lv) => (
                <motion.div
                  key={lv.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-xl border border-white/5 bg-white/5 p-3 hover:bg-white/10 hover:border-white/10 transition-all group cursor-default"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground group-hover:text-accent transition-colors">
                      {lv.type}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] uppercase font-bold tracking-tighter ${
                        lv.status === "approved"
                          ? "bg-green-500/10 text-green-400"
                          : lv.status === "denied"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {lv.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-medium">
                    {format(new Date(lv.start_date), "MMM d")} —{" "}
                    {format(new Date(lv.end_date), "MMM d")}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {leaves.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No requests found
              </div>
            )}
          </div>
        </section>
      </div>

      {isAdmin && leaves.length > 0 && (
        <Panel title="Pending Approval" subtitle={`${leaves.length} requests awaiting resonance`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {leaves.map((lv) => {
                const m = members.find((x) => x.id === lv.user_id);
                return (
                  <motion.div
                    key={lv.id}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-col justify-between rounded-2xl border border-white/5 bg-white/5 p-5 transition-all hover:bg-white/[0.08] hover:border-white/20 group shadow-lg shadow-black/20"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold tracking-tight">
                          {m?.full_name ?? "—"}
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-accent/70 px-2 py-0.5 bg-accent/10 rounded-full">
                          {lv.type}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 opacity-60">
                        {format(new Date(lv.start_date), "MMM d")} →{" "}
                        {format(new Date(lv.end_date), "MMM d")}
                      </div>
                      {lv.reason && (
                        <div className="relative group/reason">
                          <p className="text-xs text-muted-foreground line-clamp-2 italic border-l-2 border-white/20 pl-3 py-1 group-hover:border-accent/40 transition-colors">
                            "{lv.reason}"
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                      <button
                        onClick={() => decideLeave(lv.id, true)}
                        className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-accent/20"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => decideLeave(lv.id, false)}
                        className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 hover:border-red-500/20 active:scale-95 transition-all"
                      >
                        Deny
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </Panel>
      )}

      {isAdmin && (
        <Panel
          title="Team Daily Ledger"
          subtitle={`Monitoring ${filteredSorted.length} members for ${lastDay}`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="pb-3 pr-3">Name</th>
                  <th className="pb-3 pr-3">In</th>
                  <th className="pb-3 pr-3">Out</th>
                  <th className="pb-3 pr-3">Hours</th>
                  <th className="pb-3 pr-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredSorted.map((r) => (
                  <tr key={r.id} className="group hover:bg-white/[0.02]">
                    <td className="py-3 pr-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">
                        {r.category}
                      </div>
                    </td>
                    <td className="pr-3 font-mono text-xs">
                      {r.checkIn ? format(new Date(r.checkIn), "HH:mm") : "—"}
                    </td>
                    <td className="pr-3 font-mono text-xs">
                      {r.checkOut ? format(new Date(r.checkOut), "HH:mm") : "—"}
                    </td>
                    <td className="pr-3 font-mono text-xs">{r.hours?.toFixed(1) ?? "—"}h</td>
                    <td className="pr-3 text-right">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Time Off Dialog */}
      <Dialog open={showTimeOff} onOpenChange={setShowTimeOff}>
        <DialogContent className="glass-strong border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle>Request Time Off</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitTimeOff} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Start Date
                </label>
                <input
                  required
                  type="date"
                  value={timeOffData.start}
                  onChange={(e) => setTimeOffData((d) => ({ ...d, start: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  End Date
                </label>
                <input
                  required
                  type="date"
                  value={timeOffData.end}
                  onChange={(e) => setTimeOffData((d) => ({ ...d, end: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Type
              </label>
              <select
                value={timeOffData.type}
                onChange={(e) => setTimeOffData((d) => ({ ...d, type: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm"
              >
                <option value="vacation">Vacation</option>
                <option value="sick">Sick Leave</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Reason
              </label>
              <textarea
                rows={3}
                value={timeOffData.reason}
                onChange={(e) => setTimeOffData((d) => ({ ...d, reason: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm resize-none"
                placeholder="Brief explanation..."
              />
            </div>
            <Button
              disabled={busy}
              className="w-full bg-accent text-primary-foreground font-semibold"
            >
              {busy ? "Submitting..." : "Send Request"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
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
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`glass rounded-2xl p-6 ${className}`}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
          {subtitle && (
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
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
