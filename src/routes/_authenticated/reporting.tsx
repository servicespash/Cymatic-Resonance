import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RequireWorkspace } from "@/components/require-workspace";
import { RegistryExport, ExportRow } from "@/components/registry-export";
import { useRealData } from "@/hooks/use-real-data";
import { Search, ArrowUpDown, Trash2, CalendarDays } from "lucide-react";
import { AddClientDialog } from "@/components/add-client-dialog";
import { toast } from "sonner";
import { format, addDays, startOfMonth } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buildMultiDayExportRows,
  formatTimeSafe,
  type LeaveRecordLike,
  type MemberRecordLike,
  type AttendanceRecordLike,
} from "@/lib/export-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reporting")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      console.warn("[Reporting Guard] Unauthorized analytics access attempt. Redirecting to auth.");
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <RequireWorkspace>
      <ReportingPage />
    </RequireWorkspace>
  ),
});

function ReportingPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { clients, members, loading: loadingReal, error: realError } = useRealData();

  const [range, setRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -6),
    to: new Date(),
  });

  const handleDeleteClient = async (id: string) => {
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      toast.success("Client deleted successfully");
      window.location.reload();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete client");
    }
  };

  const preset = (days: number | "month") => {
    const to = new Date();
    const from = days === "month" ? startOfMonth(to) : addDays(to, -(days - 1));
    setRange({ from, to });
  };

  const loadData = useCallback(async () => {
    if (!user || !range?.from || !range?.to) return;
    setLoading(true);
    try {
      const { data: p } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();
      if (!p?.org_id) {
        setLoading(false);
        return;
      }

      const fromIso = format(range.from, "yyyy-MM-dd");
      const toIso = format(range.to, "yyyy-MM-dd");

      const [{ data: memData }, { data: attData }, { data: leavesData }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, category, role").eq("org_id", p.org_id),
        supabase
          .from("attendance")
          .select(
            "id, user_id, attendance_date, checked_in_at, checked_out_at, break_started_at, total_break_minutes, is_late, status, note",
          )
          .eq("org_id", p.org_id)
          .gte("attendance_date", fromIso)
          .lte("attendance_date", toIso),
        supabase
          .from("leave_requests")
          .select("*")
          .eq("org_id", p.org_id)
          .lte("start_date", toIso)
          .gte("end_date", fromIso),
      ]);

      const multiDay = buildMultiDayExportRows({
        rangeFrom: range.from,
        rangeTo: range.to,
        members: (memData ?? []) as MemberRecordLike[],
        attendance: (attData ?? []) as AttendanceRecordLike[],
        leaves: (leavesData ?? []) as LeaveRecordLike[],
        includeAbsent: true,
      });

      setRows(multiDay);
    } catch (err) {
      console.error("Failed to load reporting records:", err);
      toast.error("Failed to load records for date range");
    } finally {
      setLoading(false);
    }
  }, [user, range?.from, range?.to]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Reporting & Registry</h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
            Administrative Attendance, Break & Leave Ledgers
          </p>
        </div>
      </div>

      {/* Date Range Selector & Export Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="gap-2 bg-white/5 border-white/10 font-mono text-xs hover:bg-white/10"
            >
              <CalendarDays className="size-4 text-accent" />
              {range?.from
                ? range.to
                  ? `${format(range.from, "MMM d, yyyy")} → ${format(range.to, "MMM d, yyyy")}`
                  : format(range.from, "MMM d, yyyy")
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
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          >
            {p.l}
          </button>
        ))}
        <button
          onClick={() => preset("month")}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
        >
          Month
        </button>

        <div className="ml-auto" />
        <RegistryExport
          availableRows={rows}
          rangeFrom={range?.from}
          rangeTo={range?.to}
          title="Administrative Attendance & Activity Ledger"
          subtitle="Check-in, Check-out, Break & Leave Records"
        />
      </div>

      {/* Multi-Day Detailed Ledger Table */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-5 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">Ledger Activity Details</h3>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full">
            {rows.length} Total Records
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
            Compiling date range records...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-white/10">
                <tr>
                  <th className="pb-3 pr-4">Member</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Check In</th>
                  <th className="pb-3 pr-4">Check Out</th>
                  <th className="pb-3 pr-4">Break</th>
                  <th className="pb-3 pr-4">Leave & Reason</th>
                  <th className="pb-3 pr-4">Hours</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Telemetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={`${r.date}-${r.name}-${i}`} className="hover:bg-white/[0.02]">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {r.category || "General"}
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">{r.date}</td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {r.checkIn ? formatTimeSafe(r.checkIn) : "—"}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {r.checkOut ? formatTimeSafe(r.checkOut) : r.checkIn ? "In Progress" : "—"}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {r.breakDisplay ||
                        (r.breakDurationMinutes != null && r.breakDurationMinutes > 0
                          ? `${r.breakDurationMinutes}m`
                          : r.checkIn
                            ? "0m"
                            : "—")}
                    </td>
                    <td className="py-3 pr-4 max-w-xs">
                      {r.leaveType ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary font-semibold">
                            {r.leaveType} ({r.leaveStatus || "active"})
                          </span>
                          {r.leaveReason && (
                            <p
                              className="text-xs italic text-muted-foreground truncate"
                              title={r.leaveReason}
                            >
                              "{r.leaveReason}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-accent">
                      {r.hours != null && r.hours > 0 ? `${r.hours.toFixed(2)}h` : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
                          r.status.toLowerCase().includes("leave")
                            ? "bg-primary/20 text-primary"
                            : r.status === "present"
                              ? "bg-accent/15 text-accent"
                              : r.status === "absent"
                                ? "bg-white/5 text-muted-foreground"
                                : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`text-[9px] uppercase font-mono tracking-widest px-2 py-0.5 rounded border ${
                          (r.telemetry || "").toLowerCase() === "verified"
                            ? "border-green-400/30 text-green-400"
                            : (r.telemetry || "").toLowerCase() === "external"
                              ? "border-amber-400/30 text-amber-400"
                              : "border-white/10 text-muted-foreground"
                        }`}
                      >
                        {r.telemetry || "N/A"}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      No records found for the selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Real Supabase Database Sync Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Clients Sync */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-lg">Clients Database</h3>
            <div className="flex items-center gap-3">
              <AddClientDialog onSuccess={() => window.location.reload()} />
              <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded border border-accent/30 text-accent">
                Live Supabase
              </span>
            </div>
          </div>
          {loadingReal ? (
            <div className="text-sm text-muted-foreground animate-pulse">
              Syncing client ledger...
            </div>
          ) : realError ? (
            <div className="text-sm text-red-400">Sync error: {realError}</div>
          ) : clients.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed border-white/10 rounded-lg p-6 text-center">
              <div className="mb-4">No real clients in database.</div>
              <AddClientDialog onSuccess={() => window.location.reload()} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="text-xs uppercase text-muted-foreground border-b border-white/10">
                  <tr>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Company</th>
                    <th className="pb-2 pr-4">Contact</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 pr-4 font-medium text-white">{c.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{c.company || "-"}</td>
                      <td className="py-2 pr-4 text-[11px] font-mono opacity-70">
                        {c.email && <div>{c.email}</div>}
                        {c.phone && <div className="text-accent">{c.phone}</div>}
                        {!c.email && !c.phone && "-"}
                      </td>
                      <td className="py-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            c.status === "active"
                              ? "bg-green-500/10 text-green-400 border border-green-500/20"
                              : c.status === "archived"
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "bg-white/10 text-muted-foreground"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-red-400"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the client record for{" "}
                                <strong>{c.name}</strong>. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteClient(c.id)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Members Sync */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-lg">Members Database</h3>
            <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded border border-green-500/30 text-green-400">
              Live Supabase
            </span>
          </div>
          {loadingReal ? (
            <div className="text-sm text-muted-foreground animate-pulse">
              Syncing active members...
            </div>
          ) : realError ? (
            <div className="text-sm text-red-400">Sync error: {realError}</div>
          ) : members.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed border-white/10 rounded-lg p-6 text-center">
              No real members in database. Apply the schema and insert records.
            </div>
          ) : (
            <MembersDataGrid members={members} />
          )}
        </div>
      </div>
    </div>
  );
}

function formatLastSeen(lastSeenAt: string | null) {
  if (!lastSeenAt) return "Never";
  const date = new Date(lastSeenAt);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PulseIndicator({ lastSeenAt }: { lastSeenAt: string | null }) {
  if (!lastSeenAt) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-600"></span>
        </span>
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Offline</span>
      </div>
    );
  }

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const diffMins = diffMs / 60000;

  if (diffMins < 5) {
    return (
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-3 w-3">
          <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
        <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">
          Active
        </span>
      </div>
    );
  } else if (diffMins < 60) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <span className="text-xs font-mono text-amber-400 uppercase tracking-wider">
          Away ({Math.round(diffMins)}m ago)
        </span>
      </div>
    );
  } else if (diffMins < 1440) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
        <span className="text-xs font-mono text-blue-400 uppercase tracking-wider">Recent</span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-500"></span>
        </span>
        <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Inactive</span>
      </div>
    );
  }
}

interface MemberType {
  id: string;
  name: string;
  role: string | null;
  last_seen_at: string | null;
}

function MembersDataGrid({ members }: { members: MemberType[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"name" | "role" | "last_seen_at">("name");
  const [sortAsc, setSortAsc] = useState(true);

  const filteredMembers = useMemo(() => {
    return members
      .filter((m) => {
        const matchesSearch =
          m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (m.role || "").toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
      })
      .sort((a, b) => {
        if (sortField === "last_seen_at") {
          const valA = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
          const valB = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
          return sortAsc ? valA - valB : valB - valA;
        }

        const fieldA = a[sortField] || "";
        const fieldB = b[sortField] || "";

        if (fieldA < fieldB) return sortAsc ? -1 : 1;
        if (fieldA > fieldB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [members, searchTerm, sortField, sortAsc]);

  const toggleSort = (field: "name" | "role" | "last_seen_at") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Filter team members by name or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent border-0 text-sm focus:ring-0 focus:outline-none w-full text-white placeholder:text-muted-foreground"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/20">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-white/5 text-xs uppercase text-muted-foreground tracking-wider border-b border-white/10">
            <tr>
              <th
                className="py-3 px-4 font-semibold cursor-pointer select-none hover:text-white"
                onClick={() => toggleSort("name")}
              >
                <div className="flex items-center gap-2">
                  Name
                  <ArrowUpDown className="h-3 w-3 shrink-0" />
                </div>
              </th>
              <th
                className="py-3 px-4 font-semibold cursor-pointer select-none hover:text-white"
                onClick={() => toggleSort("role")}
              >
                <div className="flex items-center gap-2">
                  Role
                  <ArrowUpDown className="h-3 w-3 shrink-0" />
                </div>
              </th>
              <th
                className="py-3 px-4 font-semibold cursor-pointer select-none hover:text-white"
                onClick={() => toggleSort("last_seen_at")}
              >
                <div className="flex items-center gap-2">
                  Last Seen
                  <ArrowUpDown className="h-3 w-3 shrink-0" />
                </div>
              </th>
              <th className="py-3 px-4 font-semibold">Pulse Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground">
                  No matching members found in database.
                </td>
              </tr>
            ) : (
              filteredMembers.map((m) => (
                <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-medium text-white">{m.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{m.role || "Member"}</td>
                  <td className="py-3 px-4 font-mono text-xs text-zinc-300">
                    {formatLastSeen(m.last_seen_at)}
                  </td>
                  <td className="py-3 px-4">
                    <PulseIndicator lastSeenAt={m.last_seen_at} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
