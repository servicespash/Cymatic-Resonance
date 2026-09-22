import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { CymaticWave } from "@/components/cymatic-wave";
import { Search, Phone, Video } from "lucide-react";
import { useCallController } from "@/hooks/use-call-controller";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { RequireWorkspace } from "@/components/require-workspace";

export const Route = createFileRoute("/_authenticated/directory")({
  component: () => (
    <RequireWorkspace>
      <DirectoryPage />
    </RequireWorkspace>
  ),
});

type Row = {
  id: string;
  full_name: string | null;
  position: string | null;
  category: string | null;
  role: string;
  phone: string | null;
  is_online?: boolean;
  last_seen_at?: string;
};

function DirectoryPage() {
  const { user } = useAuth();
  const { openInitiationModal } = useCallController();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!p?.org_id) {
        setLoading(false);
        return;
      }
      setOrgId(p.org_id);

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, position, category, role, phone, is_online, last_seen_at")
        .eq("org_id", p.org_id)
        .order("full_name");
      setRows((data ?? []) as Row[]);
      setLoading(false);
    };

    fetchData();

    // Subscribe to profile changes for real-time presence updates
    const channel = supabase
      .channel("directory_presence")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: orgId ? `org_id=eq.${orgId}` : undefined,
        },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, orgId]);

  const handleInitiate = async (r: Row) => {
    if (!orgId) return;

    // Find or create a DM channel first
    const { data, error } = await supabase.rpc("open_dm", { _other: r.id });
    if (error || !data) {
      toast.error("Failed to start call: could not establish a connection channel");
      return;
    }

    const thread = data as unknown as { channel_id: string };
    openInitiationModal(thread.channel_id, [r.id], r.full_name ?? "Member");
  };

  const filtered = rows.filter(
    (r) =>
      !q ||
      (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (r.category ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (r.position ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  if (loading)
    return (
      <div className="grid place-items-center py-20">
        <CymaticWave className="h-10" bars={6} />
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Team directory</h1>
        <div className="glass flex items-center gap-2 rounded-xl px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="bg-transparent outline-none placeholder:text-muted-foreground text-sm w-40 md:w-64"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((r, i) => (
          <div
            key={r.id}
            className="glass rounded-2xl p-4 animate-fade-up"
            style={{ animationDelay: `${i * 25}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-frequency font-display text-sm font-bold text-primary-foreground">
                {(r.full_name ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate font-display text-sm font-semibold">
                    {r.full_name ?? "—"}
                  </div>
                  {r.is_online ? (
                    <span
                      className="size-2 rounded-full bg-accent animate-pulse-ring"
                      title="Online"
                    />
                  ) : (
                    <span className="size-2 rounded-full bg-muted-foreground/30" title="Offline" />
                  )}
                </div>
                <div className="truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {r.role === "admin" ? "Admin · " : ""}
                  {r.position ?? "—"}
                  {!r.is_online && r.last_seen_at && (
                    <span className="ml-2 text-[9px] lowercase opacity-60">
                      · last seen{" "}
                      {new Date(r.last_seen_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-2 rounded-lg bg-accent/10 hover:bg-accent/20 px-3 transition-all"
                onClick={() => handleInitiate(r)}
              >
                <Phone className="size-3" />
                <span className="text-[10px] font-medium">Call</span>
              </Button>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono uppercase tracking-widest text-muted-foreground">
                  {r.category ?? "—"}
                </span>
                {r.phone && <span className="font-mono text-muted-foreground">{r.phone}</span>}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            No members match.
          </div>
        )}
      </div>
    </div>
  );
}
