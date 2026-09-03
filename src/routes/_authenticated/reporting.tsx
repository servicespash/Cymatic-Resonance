import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RequireWorkspace } from "@/components/require-workspace";
import { RegistryExport, ExportRow } from "@/components/registry-export";

export const Route = createFileRoute("/_authenticated/reporting")({
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
      setRows(
        att.map((r: Record<string, unknown>) => {
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
            } catch (e) {
              // ignore
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
    </div>
  );
}
