import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RequireWorkspace } from "@/components/require-workspace";
import { RegistryExport, ExportRow } from "@/components/registry-export";
import { useRealData } from "@/hooks/use-real-data";
import { Search, ArrowUpDown, Trash2 } from "lucide-react";
import { AddClientDialog } from "@/components/add-client-dialog";
import { toast } from "sonner";
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

  const handleDeleteClient = async (id: string) => {
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      toast.success("Client deleted successfully");
      // Refresh logic is handled by useRealData if it had a refresh mechanism,
      // but for now we'll just rely on the user refreshing or add a manual refresh if needed.
      // Actually, useRealData doesn't auto-refresh on external changes unless we add a refresh function.
      window.location.reload();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete client");
    }
  };

  const loadData = useCallback(async () => {
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!p?.org_id) return;

    const { data: att } = await supabase
      .from("attendance")
      .select("*, profiles(full_name, category)")
      .eq("org_id", p.org_id)
      .order("attendance_date", { ascending: false });

    if (att) {
      type AttendanceRow = {
        checked_in_at: string;
        checked_out_at: string | null;
        total_break_minutes: number | null;
        status: string | null;
        is_late: boolean | null;
        note: string | null;
        profiles?: { full_name: string | null; category: string | null } | null;
      };

      setRows(
        (att as unknown as AttendanceRow[]).map((r) => {
          let dur = 0;
          if (r.checked_out_at) {
            dur =
              Math.max(
                0,
                Math.floor(
                  (new Date(r.checked_out_at).getTime() - new Date(r.checked_in_at).getTime()) /
                    60000,
                ) - (r.total_break_minutes || 0),
              ) / 60;
          }

          let noteObj: Record<string, unknown> | null = null;
          if (typeof r.note === "string" && r.note.startsWith("{")) {
            try {
              noteObj = JSON.parse(r.note) as Record<string, unknown>;
            } catch {
              // ignore malformed telemetry payloads
            }
          }
          const telemetryStatus = (noteObj?.telemetry as { status?: string })?.status || "verified";

          return {
            name: r.profiles?.full_name || "Unknown",
            category: r.profiles?.category || "Unknown",
            checkIn: r.checked_in_at,
            checkOut: r.checked_out_at,
            hours: dur,
            status: r.status,
            late: r.is_late,
            telemetry: telemetryStatus,
          };
        }),
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-display font-bold">Reporting & Registry</h1>
      <RegistryExport availableRows={rows} />

      <div className="bg-white/5 rounded-xl border border-white/10 p-5 mt-6">
        <h3 className="font-display font-semibold mb-4">Recent Activity</h3>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-white/10">
                <tr>
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Check In</th>
                  <th className="pb-3 pr-4">Check Out</th>
                  <th className="pb-3 pr-4">Hours</th>
                  <th className="pb-3 pr-4">Telemetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td className="py-3 pr-4 font-medium">{r.name}</td>
                    <td className="py-3 pr-4">
                      {r.checkIn ? new Date(r.checkIn).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-3 pr-4">
                      {r.checkIn
                        ? new Date(r.checkIn).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
                    <td className="py-3 pr-4">
                      {r.checkOut
                        ? new Date(r.checkOut).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
                    <td className="py-3 pr-4 font-mono text-accent">{r.hours?.toFixed(2)}h</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded border ${
                          r.telemetry === "verified"
                            ? "border-green-400/30 text-green-400"
                            : r.telemetry === "external"
                              ? "border-amber-400/30 text-amber-400"
                              : "border-red-400/30 text-red-400"
                        }`}
                      >
                        {r.telemetry}
                      </span>
                    </td>
                  </tr>
                ))}
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
