import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CymaticWave } from "@/components/cymatic-wave";
import { toast } from "sonner";
import { Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; phone: string; position: string; category: string; role: string; org_id: string | null } | null>(null);
  const [org, setOrg] = useState<{ id: string; name: string; access_code: string; org_type: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("full_name, phone, position, category, role, org_id").eq("id", user.id).maybeSingle();
      if (p) setProfile({
        full_name: p.full_name ?? "", phone: p.phone ?? "", position: p.position ?? "",
        category: p.category ?? "", role: p.role, org_id: p.org_id,
      });
      if (p?.org_id) {
        const { data: o } = await supabase.from("organizations").select("*").eq("id", p.org_id).maybeSingle();
        if (o) setOrg(o);
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name, phone: profile.phone, position: profile.position, category: profile.category,
    }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  };

  const copyCode = () => {
    if (!org) return;
    navigator.clipboard.writeText(org.access_code);
    toast.success("CYM code copied");
  };

  if (loading || !profile) return <div className="grid place-items-center py-20"><CymaticWave className="h-10" bars={6} /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {org && (
        <section className="glass-strong rounded-2xl p-6 resonance-glow">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Workspace</div>
          <h2 className="mt-1 font-display text-2xl font-bold">{org.name}</h2>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Access code</div>
              <div className="mt-1 font-mono text-xl tracking-[0.3em] text-gradient">{org.access_code}</div>
            </div>
            <button onClick={copyCode} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:bg-white/10">
              <Copy className="size-3.5" /> Copy
            </button>
          </div>
        </section>
      )}

      <section className="glass rounded-2xl p-6">
        <h3 className="font-display text-lg font-semibold">Profile</h3>
        <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Full name" value={profile.full_name} onChange={(v) => setProfile({ ...profile, full_name: v })} />
          <Field label="Position" value={profile.position} onChange={(v) => setProfile({ ...profile, position: v })} />
          <Field label="Phone" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} />
          <Field label="Category" value={profile.category} onChange={(v) => setProfile({ ...profile, category: v })} />
          <div className="sm:col-span-2">
            <button disabled={busy} className="w-full rounded-xl bg-frequency px-4 py-2.5 text-sm font-semibold text-primary-foreground resonance-glow disabled:opacity-50">
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="space-y-1.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary/40"
      />
    </label>
  );
}
