import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Invite = {
  id: string; email: string; role: string; token: string; category: string | null;
  expires_at: string; accepted_at: string | null;
};

export function InvitePanel() {
  const [list, setList] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const { data } = await supabase.from("org_invites").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as Invite[]);
  };
  useEffect(() => { refresh(); }, []);

  const create = async () => {
    if (!email.trim()) return toast.error("Email required");
    setBusy(true);
    const { data, error } = await supabase.rpc("create_invite", {
      _email: email.trim(), _role: role, _category: category.trim() || null,
    }).single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Invite created — copy the link", { description: email });
    setEmail(""); setCategory("");
    setList((l) => [data as Invite, ...l]);
    copyLink((data as Invite).token);
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/auth?invite=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.rpc("revoke_invite", { _id: id });
    if (error) return toast.error(error.message);
    setList((l) => l.filter((x) => x.id !== id));
    toast.success("Invite revoked");
  };

  return (
    <section className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-accent" />
        <h3 className="font-display text-lg font-semibold">Invite members</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Generate a private link to share via your own email or chat. Valid for 14 days.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1.4fr_1fr_0.8fr_auto]">
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" type="email" className="bg-white/5 border-white/10" />
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (optional)" className="bg-white/5 border-white/10" />
        <select value={role} onChange={(e) => setRole(e.target.value as any)} className="rounded-md border border-white/10 bg-white/5 px-3 text-sm">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <Button onClick={create} disabled={busy} className="bg-frequency text-primary-foreground resonance-glow">
          {busy ? "…" : "Invite"}
        </Button>
      </div>

      <div className="mt-5 divide-y divide-white/5">
        {list.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">No outstanding invites.</div>
        )}
        {list.map((i) => {
          const expired = new Date(i.expires_at) < new Date();
          const accepted = !!i.accepted_at;
          return (
            <div key={i.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{i.email}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {i.role} {i.category ? `· ${i.category}` : ""} ·{" "}
                  {accepted ? <span className="text-accent">accepted</span> : expired ? <span className="text-amber-400">expired</span> : <span>expires {new Date(i.expires_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {!accepted && !expired && (
                  <button onClick={() => copyLink(i.token)} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10">
                    <Copy className="size-3" /> Copy link
                  </button>
                )}
                <button onClick={() => revoke(i.id)} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
