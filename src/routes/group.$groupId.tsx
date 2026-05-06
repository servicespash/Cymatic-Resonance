import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/group/$groupId")({ component: GroupPage });

type Group = { id: string; name: string; code: string };
type Row = {
  id: string;
  user_id: string;
  checked_in_at: string;
  profiles: { full_name: string; position: string | null } | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function GroupPage() {
  const { groupId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const refresh = async () => {
    const today = todayISO();
    const [{ data: g }, { data: att }, { count }] = await Promise.all([
      supabase.from("groups").select("id, name, code").eq("id", groupId).maybeSingle(),
      supabase
        .from("attendance")
        .select("id, user_id, checked_in_at")
        .eq("group_id", groupId)
        .eq("attendance_date", today)
        .order("checked_in_at", { ascending: true }),
      supabase.from("group_members").select("*", { count: "exact", head: true }).eq("group_id", groupId),
    ]);
    setGroup(g);
    const ids = (att ?? []).map((a) => a.user_id);
    let profMap: Record<string, { full_name: string; position: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, position").in("id", ids);
      profMap = Object.fromEntries((profs ?? []).map((p) => [p.id, { full_name: p.full_name, position: p.position }]));
    }
    setRows((att ?? []).map((a) => ({ ...a, profiles: profMap[a.user_id] ?? null })));
    setMemberCount(count ?? 0);
  };

  useEffect(() => { if (user) refresh(); /* eslint-disable-next-line */ }, [user, groupId]);

  const checkedIn = !!user && rows.some((r) => r.user_id === user.id);

  const checkIn = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("attendance").insert({ group_id: groupId, user_id: user.id });
    setBusy(false);
    if (error) {
      if (error.message.includes("duplicate")) toast.info("Already checked in today");
      else toast.error(error.message);
      return;
    }
    toast.success("Checked in!");
    refresh();
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: "var(--gradient-bg)" }}>
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="bg-card rounded-2xl p-6 mb-6" style={{ boxShadow: "var(--shadow-soft)" }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{group?.name ?? "..."}</h1>
              <p className="text-xs text-muted-foreground mt-1">Code: {group?.code}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-foreground">{rows.length}<span className="text-sm text-muted-foreground font-normal">/{memberCount}</span></div>
              <div className="text-xs text-muted-foreground">today</div>
            </div>
          </div>

          <Button
            onClick={checkIn}
            disabled={busy || checkedIn}
            className="w-full mt-6 h-12 text-base"
            style={checkedIn ? undefined : { background: "var(--gradient-primary)" }}
            variant={checkedIn ? "secondary" : "default"}
          >
            {checkedIn ? (<><CheckCircle2 className="h-5 w-5 mr-2" /> Checked in today</>) : (<><Check className="h-5 w-5 mr-2" /> Check in now</>)}
          </Button>
        </div>

        <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">Today's attendance</h2>
        {rows.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center text-sm text-muted-foreground" style={{ boxShadow: "var(--shadow-soft)" }}>
            No one has checked in yet today.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="bg-card rounded-xl p-4 flex items-center justify-between" style={{ boxShadow: "var(--shadow-soft)" }}>
                <div>
                  <div className="font-medium text-foreground">{r.profiles?.full_name || "Member"}</div>
                  {r.profiles?.position && <div className="text-xs text-muted-foreground">{r.profiles.position}</div>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
