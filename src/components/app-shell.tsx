import { useEffect, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Radio, Users, MessageSquare, Settings, LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CymaticLogo, CymaticWave } from "@/components/cymatic-wave";
import { toast } from "sonner";

type Profile = {
  id: string;
  full_name: string | null;
  role: "admin" | "member";
  org_id: string | null;
  category: string | null;
  position: string | null;
};
type Org = { id: string; name: string; access_code: string; org_type: string };

const nav: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  { to: "/pulse", label: "Sync Pulse", icon: Radio },
  { to: "/directory", label: "Team Directory", icon: Users },
  { to: "/comms", label: "Cymatic Comms", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(p as Profile | null);
      if (p?.org_id) {
        const { data: o } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", p.org_id)
          .maybeSingle();
        setOrg(o as Org | null);
      }
    })();
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  };

  const items = nav.filter((n) => !n.adminOnly || profile?.role === "admin");

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-white/5 glass-strong transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="px-2 py-2">
            <CymaticLogo />
          </div>

          {org && (
            <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                Workspace
              </div>
              <div className="mt-1 truncate font-display text-sm font-semibold">{org.name}</div>
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-frequency/10 px-2 py-1 font-mono text-[10px] tracking-widest text-accent">
                <span className="size-1.5 rounded-full bg-accent animate-pulse-ring" />
                {org.access_code}
              </div>
            </div>
          )}

          <nav className="mt-6 flex-1 space-y-1">
            {items.map((n) => {
              const active = path === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-frequency/15 text-foreground resonance-glow"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <n.icon className="size-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="truncate font-display text-sm font-semibold">
              {profile?.full_name ?? "Member"}
            </div>
            <div className="truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {profile?.role === "admin" ? "Admin" : (profile?.category ?? "Member")}
            </div>
            <button
              onClick={signOut}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
            >
              <LogOut className="size-3.5" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/5 glass px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button className="md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <div className="truncate font-display text-base font-semibold">
                {org?.name ?? "Cymatic Resonance"}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {path.replace("/", "") || "home"} · signal locked
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <CymaticWave className="h-4" bars={5} />
            <span className="font-mono text-[10px] uppercase tracking-widest text-accent">
              live
            </span>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export type { Profile, Org };
