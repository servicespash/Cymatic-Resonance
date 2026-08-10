import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CymaticWave } from "@/components/cymatic-wave";
import { RequireWorkspace } from "@/components/require-workspace";
import { toast } from "sonner";
import {
  Copy,
  RefreshCw,
  UserMinus,
  Crown,
  User as UserIcon,
  Download,
  FileText,
  CheckCircle,
  Trophy,
  Bell,
  Volume2,
  VolumeX,
  PhoneCall,
  Sparkles,
  Shield,
  Lock,
  ShieldCheck,
} from "lucide-react";
import {
  getNotificationPrefs,
  saveNotificationPrefs,
  playMessageChime,
  createRingtone,
  ensureNotificationPermission,
  type NotificationPreferences,
} from "@/lib/notifications";
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
import { InvitePanel } from "@/components/invite-panel";
import { BrandPanel } from "@/components/brand-panel";
import { CallHistoryPanel } from "@/components/call-history";

export const Route = createFileRoute("/_authenticated/settings")({
  component: () => (
    <RequireWorkspace>
      <SettingsPage />
    </RequireWorkspace>
  ),
});

type Profile = {
  full_name: string;
  phone: string;
  position: string;
  category: string;
  role: string;
  org_id: string | null;
};
type Org = {
  id: string;
  name: string;
  access_code: string;
  org_type: string;
  day_start_cutoff: string;
  timezone: string;
  logo_url: string | null;
  accent_color: string | null;
};
type Member = { id: string; full_name: string | null; role: string; position: string | null };
type LeaveRequest = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  type: string;
  reason: string | null;
  status: "pending" | "approved" | "denied";
  profiles: { full_name: string | null };
};

function SettingsPage() {
  const { user, isAdmin: authIsAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [confirmName, setConfirmName] = useState("");

  const isAdmin = useMemo(() => profile?.role === "admin", [profile]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name, phone, position, category, role, org_id")
      .eq("id", user.id)
      .maybeSingle();

    if (p) {
      setProfile({
        full_name: p.full_name ?? "",
        phone: p.phone ?? "",
        position: p.position ?? "",
        category: p.category ?? "",
        role: p.role,
        org_id: p.org_id,
      });
    }

    if (p?.org_id) {
      const [{ data: o }, { data: mem }, { data: leave }] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", p.org_id).maybeSingle(),
        supabase.from("profiles").select("id, full_name, role, position").eq("org_id", p.org_id),
        supabase
          .from("leave_requests")
          .select("*, profiles(full_name)")
          .eq("org_id", p.org_id)
          .eq("status", "pending"),
      ]);

      if (o) setOrg(o as Org);
      setMembers((mem ?? []) as Member[]);
      setLeaveRequests((leave ?? []) as unknown as LeaveRequest[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const downloadLedger = async (targetUserId?: string) => {
    if (!org) return;
    setBusy(true);
    let query = supabase
      .from("attendance")
      .select("attendance_date, checked_in_at, checked_out_at, status, total_break_minutes")
      .eq("org_id", org.id);

    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    } else if (!isAdmin) {
      query = query.eq("user_id", user?.id || "");
    }

    const { data, error } = await query.order("attendance_date", { ascending: false });
    setBusy(false);

    if (error) return toast.error(error.message);
    if (!data?.length) return toast.info("No records found");

    const headers = ["Date", "In", "Out", "Status", "Break (min)"];
    const csv = [
      headers.join(","),
      ...data.map((r) =>
        [
          r.attendance_date,
          r.checked_in_at ? new Date(r.checked_in_at).toLocaleTimeString() : "-",
          r.checked_out_at ? new Date(r.checked_out_at).toLocaleTimeString() : "-",
          r.status,
          r.total_break_minutes,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${targetUserId ?? "my"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Ledger exported");
  };

  const decideLeave = async (id: string, approved: boolean) => {
    const { error } = await supabase.rpc("decide_leave", { _id: id, _approved: approved });
    if (error) return toast.error(error.message);
    setLeaveRequests((prev) => prev.filter((r) => r.id !== id));
    toast.success(`Request ${approved ? "approved" : "denied"}`);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        position: profile.position,
        category: profile.category,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  };

  const saveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("update_org_settings", {
      _name: org.name,
      _org_type: org.org_type,
      _cutoff: org.day_start_cutoff,
      _tz: org.timezone,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setOrg(data as Org);
    toast.success("Workspace updated");
  };

  const rotate = async () => {
    const { data, error } = await supabase.rpc("rotate_access_code");
    if (error) return toast.error(error.message);
    if (org) setOrg({ ...org, access_code: data as string });
    toast.success("Access code rotated");
  };

  const setRole = async (uid: string, role: "admin" | "member") => {
    const { error } = await supabase.rpc("set_member_role", { _user: uid, _role: role });
    if (error) return toast.error(error.message);
    setMembers((m) => m.map((x) => (x.id === uid ? { ...x, role } : x)));
    toast.success(`Role set to ${role}`);
  };

  const remove = async (uid: string) => {
    const { error } = await supabase.rpc("remove_member", { _user: uid });
    if (error) return toast.error(error.message);
    setMembers((m) => m.filter((x) => x.id !== uid));
    toast.success("Member removed");
  };

  const deleteOrg = async () => {
    if (!org || confirmName !== org.name) return toast.error("Workspace name does not match");
    const { error } = await supabase.rpc("delete_org");
    if (error) return toast.error(error.message);
    toast.success("Workspace deleted");
    window.location.href = "/";
  };

  const copyCode = () => {
    if (!org) return;
    navigator.clipboard.writeText(org.access_code);
    toast.success("CYM code copied");
  };

  if (loading || !profile)
    return (
      <div className="grid place-items-center py-20">
        <CymaticWave className="h-10" bars={6} />
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-up">
      {/* Workspace card */}
      {org && (
        <section className="glass-strong rounded-2xl p-6 resonance-glow">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Workspace
              </div>
              <h2 className="mt-1 font-display text-2xl font-bold">{org.name}</h2>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadLedger()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10"
                >
                  <Download className="size-3.5" /> Export All Registries
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Access code
              </div>
              <div className="mt-1 font-mono text-xl tracking-[0.3em] text-gradient">
                {org.access_code}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyCode}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:bg-white/10"
              >
                <Copy className="size-3.5" /> Copy
              </button>
              {isAdmin && (
                <button
                  onClick={rotate}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:bg-white/10"
                >
                  <RefreshCw className="size-3.5" /> Rotate
                </button>
              )}
            </div>
          </div>

          {isAdmin && (
            <form onSubmit={saveOrg} className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field
                label="Workspace name"
                value={org.name}
                onChange={(v) => setOrg({ ...org, name: v })}
              />
              <Field
                label="Type"
                value={org.org_type}
                onChange={(v) => setOrg({ ...org, org_type: v })}
              />
              <Field
                label="Day-start cutoff"
                value={org.day_start_cutoff?.slice(0, 5) ?? "09:00"}
                onChange={(v) => setOrg({ ...org, day_start_cutoff: v })}
              />
              <Field
                label="Timezone"
                value={org.timezone}
                onChange={(v) => setOrg({ ...org, timezone: v })}
              />
              <div className="sm:col-span-2">
                <button
                  disabled={busy}
                  className="w-full rounded-xl bg-frequency px-4 py-2.5 text-sm font-semibold text-primary-foreground resonance-glow transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save workspace"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* Admin Features */}
      {isAdmin && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Leave Approvals */}
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              <CheckCircle className="size-5 text-accent" />
              Approvals
            </div>
            <div className="mt-4 space-y-3">
              {leaveRequests.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No pending requests
                </div>
              ) : (
                leaveRequests.map((r) => (
                  <div key={r.id} className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{r.profiles.full_name}</div>
                      <div className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                        {r.type}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.start_date).toLocaleDateString()} —{" "}
                      {new Date(r.end_date).toLocaleDateString()}
                    </div>
                    {r.reason && (
                      <div className="mt-2 text-xs italic text-muted-foreground">"{r.reason}"</div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => decideLeave(r.id, true)}
                        className="flex-1 rounded-lg bg-accent/20 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/30"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => decideLeave(r.id, false)}
                        className="flex-1 rounded-lg bg-white/5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-white/10"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Super Admin Panel */}
          {isAdmin && (
            <section className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 font-display text-lg font-semibold">
                <ShieldCheck className="size-5 text-accent" />
                Super Admin Panel
              </div>
              <div className="mt-4 space-y-3">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl bg-white/5 p-3"
                  >
                    <div className="text-sm font-medium">{m.full_name}</div>
                    <div className="text-xs text-muted-foreground">{m.role}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Call History */}
          <section className="glass rounded-2xl p-6">
            <CallHistoryPanel />
          </section>
          {/* Members & Performers */}
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              <Trophy className="size-5 text-accent" />
              Best Performers
            </div>
            <div className="mt-4 space-y-3">
              {members.slice(0, 3).map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl bg-white/5 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid size-7 place-items-center rounded-full text-[10px] font-bold ${
                        i === 0 ? "bg-accent text-primary-foreground" : "bg-white/10"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="text-sm font-medium">{m.full_name}</div>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground uppercase">
                    {m.position || "Member"}
                  </div>
                </div>
              ))}
              <div className="pt-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
                Mapping performance based on check-ins
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Ledgers Section */}
      <section className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg font-semibold">
            <FileText className="size-5 text-accent" />
            Ledger & Records
          </div>
          <button
            onClick={() => downloadLedger()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-primary-foreground resonance-glow transition hover:opacity-90"
          >
            <Download className="size-3.5" /> Download My Ledger
          </button>
        </div>

        {isAdmin && (
          <div className="mt-6 space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Team Daily Ledgers
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3"
                >
                  <div className="text-xs font-medium">{m.full_name}</div>
                  <button
                    onClick={() => downloadLedger(m.id)}
                    className="rounded-md bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider transition hover:bg-white/10"
                  >
                    Export
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Brand & Invites (Nested for Admin) */}
      {isAdmin && org && (
        <>
          <BrandPanel
            orgId={org.id}
            logoUrl={org.logo_url ?? null}
            accentColor={org.accent_color ?? null}
            onChange={(patch) => setOrg({ ...org, ...patch })}
          />
          <InvitePanel />
        </>
      )}

      {/* Members Management */}
      {isAdmin && (
        <section className="glass rounded-2xl p-6">
          <h3 className="font-display text-lg font-semibold">User Management</h3>
          <div className="mt-4 divide-y divide-white/5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-frequency/15 font-mono text-xs text-accent">
                    {(m.full_name ?? "?")
                      .split(" ")
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div>
                    <div className="text-sm font-medium">{m.full_name ?? "—"}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {m.role} {m.position ? `· ${m.position}` : ""}
                    </div>
                  </div>
                </div>
                {m.id !== user?.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRole(m.id, m.role === "admin" ? "member" : "admin")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:bg-white/10"
                    >
                      {m.role === "admin" ? (
                        <UserIcon className="size-3.5" />
                      ) : (
                        <Crown className="size-3.5" />
                      )}
                      {m.role === "admin" ? "Make Member" : "Make Admin"}
                    </button>
                    <button
                      onClick={() => remove(m.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/10"
                    >
                      <UserMinus className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notification Preferences */}
      <NotificationSettingsPanel />

      {/* Profile */}
      <section className="glass rounded-2xl p-6">
        <h3 className="font-display text-lg font-semibold">My Account</h3>
        <form onSubmit={saveProfile} className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            value={profile.full_name}
            onChange={(v) => setProfile({ ...profile, full_name: v })}
          />
          <Field
            label="Position"
            value={profile.position}
            onChange={(v) => setProfile({ ...profile, position: v })}
          />
          <Field
            label="Phone"
            value={profile.phone}
            onChange={(v) => setProfile({ ...profile, phone: v })}
          />
          <Field
            label="Category"
            value={profile.category}
            onChange={(v) => setProfile({ ...profile, category: v })}
          />
          <div className="sm:col-span-2">
            <button
              disabled={busy}
              className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/15 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Update Profile"}
            </button>
          </div>
        </form>
      </section>

      {/* Danger zone */}
      {isAdmin && org && (
        <section className="glass rounded-2xl border border-red-500/20 p-6">
          <h3 className="font-display text-lg font-semibold text-red-400">Danger zone</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Deleting the workspace permanently removes all members, attendance and messages.
          </p>
          <AlertDialog>
            <AlertDialogTrigger className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400">
              Delete workspace
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{org.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cannot be undone. Type the workspace name to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={org.name}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-red-500/40"
              />

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteOrg} className="bg-red-500/80 hover:bg-red-500">
                  Delete forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary/40"
      />
    </label>
  );
}

function NotificationSettingsPanel() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => getNotificationPrefs());

  const update = <K extends keyof NotificationPreferences>(
    key: K,
    val: NotificationPreferences[K],
  ) => {
    const updated = saveNotificationPrefs({ [key]: val });
    setPrefs(updated);
    toast.success("Notification preferences updated");
  };

  const handleTestChime = () => {
    playMessageChime();
    toast.success("Playing message notification chime!");
  };

  const handleTestRingtone = () => {
    const r = createRingtone();
    r.start();
    toast.info("Ringtone playing for 3 seconds...");
    setTimeout(() => {
      r.stop();
    }, 3000);
  };

  const handleEnablePush = async () => {
    const perm = await ensureNotificationPermission();
    if (perm === "granted") {
      update("browserPush", true);
      toast.success("Browser push notifications enabled!");
    } else {
      toast.error("Browser push notification permission denied or blocked by browser.");
    }
  };

  return (
    <section className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent">
            <Bell className="size-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Notification & Alert Preferences
            </h3>
            <p className="text-xs text-muted-foreground">
              Customize call ringtones, message audio alerts, and push notifications
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestChime}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-white/10 transition"
          >
            <Volume2 className="size-3.5 text-accent" /> Test Chime
          </button>
          <button
            onClick={handleTestRingtone}
            className="flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-primary-foreground transition"
          >
            <PhoneCall className="size-3.5" /> Test Ringtone
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-foreground flex items-center gap-2">
              <Volume2 className="size-4 text-accent" /> Message Audio Alert
            </div>
            <div className="text-xs text-muted-foreground">
              Play a soft chime when a new chat message arrives
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefs.messageSound}
            onChange={(e) => update("messageSound", e.target.checked)}
            className="size-4 rounded accent-accent"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-foreground flex items-center gap-2">
              <PhoneCall className="size-4 text-accent" /> Incoming Call Ringtone
            </div>
            <div className="text-xs text-muted-foreground">
              Play ringing sound for incoming audio/video calls
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefs.callRingtone}
            onChange={(e) => update("callRingtone", e.target.checked)}
            className="size-4 rounded accent-accent"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-accent" /> Call Ringing Banner
            </div>
            <div className="text-xs text-muted-foreground">
              Show top incoming call overlay banner
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefs.callBanner}
            onChange={(e) => update("callBanner", e.target.checked)}
            className="size-4 rounded accent-accent"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-foreground flex items-center gap-2">
              <Bell className="size-4 text-accent" /> Desktop Push Notifications
            </div>
            <div className="text-xs text-muted-foreground">
              Send native OS popups when tab is inactive
            </div>
          </div>
          {prefs.browserPush ? (
            <input
              type="checkbox"
              checked={prefs.browserPush}
              onChange={(e) => update("browserPush", e.target.checked)}
              className="size-4 rounded accent-accent"
            />
          ) : (
            <button
              onClick={handleEnablePush}
              className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:brightness-110"
            >
              Enable
            </button>
          )}
        </div>

        {/* Encrypted vs Non-Encrypted Chat Mode Controls */}
        <div className="flex items-center justify-between rounded-xl border border-accent/20 bg-accent/5 p-4 sm:col-span-2">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" /> End-to-End Encrypted Chat Mode
            </div>
            <div className="text-xs text-muted-foreground">
              Toggle between E2EE client-side resonance key encryption and standard non-encrypted
              chat mode
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-semibold">
              {prefs.encryptedChatMode ? (
                <span className="text-accent flex items-center gap-1">
                  <Lock className="size-3" /> Encrypted
                </span>
              ) : (
                <span className="text-muted-foreground">Standard</span>
              )}
            </span>
            <input
              type="checkbox"
              checked={prefs.encryptedChatMode}
              onChange={(e) => update("encryptedChatMode", e.target.checked)}
              className="size-4 rounded accent-accent"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-foreground flex items-center gap-2">
              <Shield className="size-4 text-accent" /> Show Visual Encryption Badges
            </div>
            <div className="text-xs text-muted-foreground">
              Display protective shield indicators on end-to-end encrypted messages in chat threads
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefs.showEncryptionBadges}
            onChange={(e) => update("showEncryptionBadges", e.target.checked)}
            className="size-4 rounded accent-accent"
          />
        </div>
      </div>
    </section>
  );
}
