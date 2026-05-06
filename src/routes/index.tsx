import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Plus, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/")({ component: Home });

type Group = { id: string; name: string; code: string };

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function Home() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [profileName, setProfileName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setProfileName(profile?.full_name ?? "");
      const { data: memberships } = await supabase
        .from("group_members")
        .select("groups(id, name, code)")
        .eq("user_id", user.id);
      const gs = (memberships ?? []).map((m: { groups: Group | null }) => m.groups).filter((g): g is Group => g !== null);
      setGroups(gs);
    })();
  }, [user]);

  const createGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    if (!name || name.length > 80) return toast.error("Enter a group name (max 80 chars)");
    setBusy(true);
    const { data, error } = await supabase
      .from("groups")
      .insert({ name, code: genCode(), created_by: user.id })
      .select("id, name, code")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    setGroups((g) => [...g, data]);
    setCreateOpen(false);
    toast.success(`Group created. Code: ${data.code}`);
  };

  const joinGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const code = String(fd.get("code") || "").trim().toUpperCase();
    if (!code) return toast.error("Enter a code");
    setBusy(true);
    const { data: g, error: gErr } = await supabase.from("groups").select("id, name, code").eq("code", code).maybeSingle();
    if (gErr || !g) { setBusy(false); return toast.error("Group not found"); }
    const { error: mErr } = await supabase.from("group_members").insert({ group_id: g.id, user_id: user.id });
    setBusy(false);
    if (mErr && !mErr.message.includes("duplicate")) return toast.error(mErr.message);
    setGroups((gs) => (gs.find((x) => x.id === g.id) ? gs : [...gs, g]));
    setJoinOpen(false);
    toast.success(`Joined ${g.name}`);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: "var(--gradient-bg)" }}>
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back</p>
            <h1 className="text-2xl font-bold text-foreground">{profileName || user.email}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
        </header>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-auto py-4 flex-col gap-1"><Plus className="h-5 w-5" /><span>Create group</span></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a group</DialogTitle></DialogHeader>
              <form onSubmit={createGroup} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="g-name">Group name</Label><Input id="g-name" name="name" required maxLength={80} placeholder="Lincoln High School" /></div>
                <DialogFooter><Button type="submit" disabled={busy} style={{ background: "var(--gradient-primary)" }}>Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-auto py-4 flex-col gap-1"><Users className="h-5 w-5" /><span>Join group</span></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Join with code</DialogTitle></DialogHeader>
              <form onSubmit={joinGroup} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="j-code">Group code</Label><Input id="j-code" name="code" required maxLength={12} placeholder="ABC123" className="uppercase" /></div>
                <DialogFooter><Button type="submit" disabled={busy} style={{ background: "var(--gradient-primary)" }}>Join</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">Your groups</h2>
        {groups.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center text-sm text-muted-foreground" style={{ boxShadow: "var(--shadow-soft)" }}>
            No groups yet. Create one or join with a code.
          </div>
        ) : (
          <ul className="space-y-2">
            {groups.map((g) => (
              <li key={g.id}>
                <Link to="/group/$groupId" params={{ groupId: g.id }} className="block bg-card rounded-2xl p-4 flex items-center justify-between transition hover:translate-x-0.5" style={{ boxShadow: "var(--shadow-soft)" }}>
                  <div>
                    <div className="font-semibold text-foreground">{g.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Code: {g.code}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
