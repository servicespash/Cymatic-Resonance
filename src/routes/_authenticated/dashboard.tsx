import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Users, Activity, AlertTriangle, Download } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid } from "recharts";
import { CymaticWave } from "@/components/cymatic-wave";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Member = { id: string; full_name: string | null; position: string | null; category: string | null; role: string };
type Att = { user_id: string; attendance_date: string; checked_in_at: string; status: string };

function todayISO() { return new Date().toISOString().slice(0, 10); }

function DashboardPage() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [att, setAtt] = useState<Att[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("role, org_id").eq("id", user.id).maybeSingle();
      setRole(p?.role ?? null);
      if (!p?.org_id) { setLoading(false); return; }

      const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
      const [{ data: mem }, { data: a }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, position, category, role").eq("org_id", p.org_id),
        supabase.from("attendance").select("user_id, attendance_date, checked_in_at, status").eq("org_id", p.org_id).gte("attendance_date", since),
      ]);
      setMembers((mem ?? []) as Member[]);
      setAtt((a ?? []) as Att[]);
      setLoading(false);
    })();
  }, [user]);

  const today = todayISO();
  const presentToday = useMemo(() => new Set(att.filter((r) => r.attendance_date === today).map((r) => r.user_id)), [att, today]);
  const lateCount = useMemo(() =>
    att.filter((r) => r.attendance_date === today && new Date(r.checked_in_at).getHours() >= 9).length,
  [att, today]);

  const trend = useMemo(() => {
    const days: { date: string; rate: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const presentN = new Set(att.filter((r) => r.attendance_date === d).map((r) => r.user_id)).size;
      days.push({ date: d.slice(5), rate: members.length ? Math.round((presentN / members.length) * 100) : 0 });
    }
    return days;
  }, [att, members]);

  const byCategory = useMemo(() => {
    const groups: Record<string, { cat: string; total: number; present: number }> = {};
    for (const m of members) {
      const k = m.category ?? "Uncategorized";
      groups[k] ??= { cat: k, total: 0, present: 0 };
      groups[k].total++;
      if (presentToday.has(m.id)) groups[k].present++;
    }
    return Object.values(groups);
  }, [members, presentToday]);

  const exportCSV = () => {
    const rows = [["Name", "Position", "Category", "Status", "Checked in"]];
    for (const m of members) {
      const a = att.find((r) => r.user_id === m.id && r.attendance_date === today);
      rows.push([m.full_name ?? "", m.position ?? "", m.category ?? "", a ? "Present" : "Absent", a ? new Date(a.checked_in_at).toLocaleTimeString() : ""]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `roll-call-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="grid place-items-center py-20"><CymaticWave className="h-10" bars={6} /></div>;
  }
  if (role !== "admin") return <Navigate to="/pulse" />;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi icon={Users} label="Total personnel" value={members.length} tone="indigo" />
        <Kpi icon={Activity} label="Present now" value={presentToday.size} sub={`${members.length ? Math.round((presentToday.size / members.length) * 100) : 0}% resonance`} tone="teal" />
        <Kpi icon={AlertTriangle} label="Late / anomalies" value={lateCount} sub="after 09:00" tone="warn" />
      </div>

      {/* Split layout */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Panel title="30-day resonance trend" subtitle="Daily attendance rate %">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="rate" stroke="oklch(0.78 0.16 200)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="By category — today" subtitle="Present vs total">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="cat" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Bar dataKey="total" fill="rgba(255,255,255,0.08)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="present" fill="oklch(0.62 0.22 275)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel
            title="Live roll call"
            subtitle={`${presentToday.size} / ${members.length} present`}
            action={
              <button onClick={exportCSV} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground">
                <Download className="size-3" /> CSV
              </button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="pb-2 pr-3">Name</th>
                    <th className="pb-2 pr-3">Category</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {members.map((m) => {
                    const a = att.find((r) => r.user_id === m.id && r.attendance_date === today);
                    return (
                      <tr key={m.id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">{m.full_name ?? "—"}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{m.position ?? ""}</div>
                        </td>
                        <td className="pr-3 text-muted-foreground">{m.category ?? "—"}</td>
                        <td className="pr-3">
                          {a ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-accent">
                              <span className="size-1.5 rounded-full bg-accent" /> present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                              absent
                            </span>
                          )}
                        </td>
                        <td className="font-mono text-xs text-muted-foreground">
                          {a ? new Date(a.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Comms preview" subtitle="Recent signal across channels">
            <div className="text-sm text-muted-foreground">
              Open Cymatic Comms to view broadcast channels and direct messages.
            </div>
          </Panel>
          <Panel title="Anomalies" subtitle="Today">
            <ul className="space-y-2 text-sm">
              {lateCount === 0 ? (
                <li className="text-muted-foreground">No late check-ins detected.</li>
              ) : (
                att
                  .filter((r) => r.attendance_date === today && new Date(r.checked_in_at).getHours() >= 9)
                  .map((r) => {
                    const m = members.find((x) => x.id === r.user_id);
                    return (
                      <li key={r.user_id} className="flex items-center justify-between">
                        <span>{m?.full_name ?? "—"}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {new Date(r.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </li>
                    );
                  })
              )}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number | string; sub?: string;
  tone: "indigo" | "teal" | "warn";
}) {
  const ring =
    tone === "indigo" ? "shadow-[0_0_40px_-10px_oklch(0.62_0.22_275/0.6)]"
    : tone === "teal" ? "shadow-[0_0_40px_-10px_oklch(0.78_0.16_200/0.6)]"
    : "shadow-[0_0_40px_-10px_oklch(0.65_0.24_25/0.5)]";
  return (
    <div className={`glass relative overflow-hidden rounded-2xl p-5 ${ring}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
        <Icon className="size-4 text-accent" />
      </div>
      <div className="mt-3 font-display text-4xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Panel({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold truncate">{title}</h3>
          {subtitle && <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
