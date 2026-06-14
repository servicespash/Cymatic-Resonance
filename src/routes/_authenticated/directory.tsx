import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CymaticWave } from "@/components/cymatic-wave";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/directory")({
  component: DirectoryPage,
});

type Row = { id: string; full_name: string | null; position: string | null; category: string | null; role: string; phone: string | null };

function DirectoryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
      if (!p?.org_id) { setLoading(false); return; }
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, position, category, role, phone")
        .eq("org_id", p.org_id)
        .order("full_name");
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, [user]);

  const filtered = rows.filter((r) =>
    !q ||
    (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (r.category ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (r.position ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  if (loading) return <div className="grid place-items-center py-20"><CymaticWave className="h-10" bars={6} /></div>;

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
          <div key={r.id} className="glass rounded-2xl p-4 animate-fade-up" style={{ animationDelay: `${i * 25}ms` }}>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-frequency font-display text-sm font-bold text-primary-foreground">
                {(r.full_name ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold">{r.full_name ?? "—"}</div>
                <div className="truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {r.role === "admin" ? "Admin · " : ""}{r.position ?? "—"}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono uppercase tracking-widest text-muted-foreground">{r.category ?? "—"}</span>
              {r.phone && <span className="font-mono text-muted-foreground">{r.phone}</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full glass rounded-2xl p-10 text-center text-sm text-muted-foreground">No members match.</div>
        )}
      </div>
    </div>
  );
}
