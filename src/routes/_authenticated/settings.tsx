import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CymaticWave } from "@/components/cymatic-wave";
import { RequireWorkspace } from "@/components/require-workspace";
import { toast } from "sonner";
import { Copy, RefreshCw, ShieldAlert, UserMinus, Crown, User as UserIcon } from "lucide-react";
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

function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [confirmName, setConfirmName] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name, phone, position, category, role, org_id")
      .eq("id", user.id)
      .maybeSingle();
    if (p)
      setProfile({
        full_name: p.full_name ?? "",
        phone: p.phone ?? "",
        position: p.position ?? "",
        category: p.category ?? "",
        role: p.role,
        org_id: p.org_id,
      });
    if (p?.org_id) {
      const [{ data: o }, { data: mem }] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", p.org_id).maybeSingle(),
        supabase.from("profiles").select("id, full_name, role, position").eq("org_id", p.org_id),
      ]);
      if (o) setOrg(o as Org);
      setMembers((mem ?? []) as Member[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
  const isAdmin = profile.role === "admin";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Workspace card */}
      {org && (
        <section className="glass-strong rounded-2xl p-6 resonance-glow">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Workspace
          </div>
          <h2 className="mt-1 font-display text-2xl font-bold">{org.name}</h2>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
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
            <form onSubmit={saveOrg} className="mt-5 grid gap-3 sm:grid-cols-2">
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
                  className="w-full rounded-xl bg-frequency px-4 py-2.5 text-sm font-semibold text-primary-foreground resonance-glow disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save workspace"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* Brand */}
      {isAdmin && org && (
        <BrandPanel
          orgId={org.id}
          logoUrl={org.logo_url}
          accentColor={org.accent_color}
          onChange={(patch) => setOrg({ ...org, ...patch })}
        />
      )}

      {/* Invites */}
      {isAdmin && <InvitePanel />}

      {/* Members */}
      {isAdmin && (
        <section className="glass rounded-2xl p-6">
          <h3 className="font-display text-lg font-semibold">Members</h3>
          <div className="mt-3 divide-y divide-white/5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-frequency/15 font-mono text-xs text-accent">
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
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setRole(m.id, m.role === "admin" ? "member" : "admin")}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs transition hover:bg-white/10"
                    >
                      {m.role === "admin" ? (
                        <UserIcon className="size-3" />
                      ) : (
                        <Crown className="size-3" />
                      )}
                      {m.role === "admin" ? "Demote" : "Promote"}
                    </button>
                    <button
                      onClick={() => remove(m.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-red-300 transition hover:bg-red-500/10"
                    >
                      <UserMinus className="size-3" /> Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Profile */}
      <section className="glass rounded-2xl p-6">
        <h3 className="font-display text-lg font-semibold">Profile</h3>
        <form onSubmit={saveProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
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
              className="w-full rounded-xl bg-frequency px-4 py-2.5 text-sm font-semibold text-primary-foreground resonance-glow disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </section>

      {/* Danger zone */}
      {isAdmin && org && (
        <section className="glass rounded-2xl border border-red-500/20 p-6">
          <h3 className="font-display text-lg font-semibold text-red-400">Danger Zone</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Delete this organization and all its data permanently.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20">
                Delete organization
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-background/95 backdrop-blur-xl border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. Type <span className="font-mono text-foreground font-bold">{org.name}</span> to confirm.
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
