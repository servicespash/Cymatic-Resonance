import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CymaticWave } from "@/components/cymatic-wave";
import { Hash, Send, Plus } from "lucide-react";
import { toast } from "sonner";

import { RequireWorkspace } from "@/components/require-workspace";

export const Route = createFileRoute("/_authenticated/comms")({
  component: () => (<RequireWorkspace><CommsPage /></RequireWorkspace>),
});

type Channel = { id: string; name: string; kind: "broadcast" | "dm"; org_id: string };
type Msg = { id: string; channel_id: string; sender_id: string; body: string; created_at: string };
type Sender = { id: string; full_name: string | null; role: string };

function CommsPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<Channel | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [senders, setSenders] = useState<Record<string, Sender>>({});
  const [body, setBody] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  // load org + channels
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle();
      if (!p?.org_id) return;
      setOrgId(p.org_id);
      setIsAdmin(p.role === "admin");

      let { data: chs } = await supabase.from("channels").select("*").eq("org_id", p.org_id).order("created_at");
      if (!chs || chs.length === 0) {
        // ensure a default broadcast channel exists
        if (p.role === "admin") {
          const { data: created } = await supabase
            .from("channels")
            .insert({ name: "general", kind: "broadcast", org_id: p.org_id, created_by: user.id })
            .select();
          chs = created;
        }
      }
      const list = (chs ?? []) as Channel[];
      setChannels(list);
      setActive(list[0] ?? null);

      const { data: mem } = await supabase.from("profiles").select("id, full_name, role").eq("org_id", p.org_id);
      const map: Record<string, Sender> = {};
      for (const m of (mem ?? []) as Sender[]) map[m.id] = m;
      setSenders(map);
    })();
  }, [user]);

  // load messages + subscribe
  useEffect(() => {
    if (!active) { setMsgs([]); return; }
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", active.id)
        .order("created_at")
        .limit(200);
      setMsgs((data ?? []) as Msg[]);
    })();

    const ch = supabase
      .channel(`msgs-${active.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${active.id}` },
        (payload) => setMsgs((m) => [...m, payload.new as Msg]),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !active || !orgId || !body.trim()) return;
    const text = body.trim();
    setBody("");
    const { error } = await supabase.from("messages").insert({
      org_id: orgId, channel_id: active.id, sender_id: user.id, body: text,
    });
    if (error) { toast.error(error.message); setBody(text); }
  };

  const createChannel = async () => {
    if (!user || !orgId) return;
    const name = prompt("Channel name (lowercase, no spaces)");
    if (!name) return;
    const clean = name.toLowerCase().replace(/\s+/g, "-").slice(0, 30);
    const { data, error } = await supabase
      .from("channels")
      .insert({ name: clean, kind: "broadcast", org_id: orgId, created_by: user.id })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setChannels((c) => [...c, data as Channel]);
    setActive(data as Channel);
  };

  if (!orgId) return <div className="grid place-items-center py-20"><CymaticWave className="h-10" bars={6} /></div>;

  return (
    <div className="grid h-[calc(100vh-7rem)] gap-4 md:grid-cols-[260px_1fr]">
      {/* Channel rail */}
      <aside className="glass flex flex-col rounded-2xl p-3">
        <div className="flex items-center justify-between px-1 py-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Channels</span>
          {isAdmin && (
            <button onClick={createChannel} className="rounded-md p-1 text-muted-foreground transition hover:bg-white/5 hover:text-foreground" aria-label="New channel">
              <Plus className="size-4" />
            </button>
          )}
        </div>
        <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                active?.id === c.id ? "bg-frequency/15 text-foreground resonance-glow" : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              <Hash className="size-3.5" />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
          {channels.length === 0 && (
            <div className="px-2 py-4 text-xs text-muted-foreground">No channels yet.</div>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className="glass-strong flex flex-col rounded-2xl">
        <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <div className="flex items-center gap-2">
            <Hash className="size-4 text-accent" />
            <h2 className="font-display text-base font-semibold">{active?.name ?? "—"}</h2>
          </div>
          <div className="flex items-center gap-2">
            <CymaticWave className="h-3.5" bars={4} />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">live</span>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {msgs.length === 0 && (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No signal yet — say hello.</div>
          )}
          {msgs.map((m, i) => {
            const me = m.sender_id === user?.id;
            const s = senders[m.sender_id];
            const showHeader = i === 0 || msgs[i - 1].sender_id !== m.sender_id;
            return (
              <div key={m.id} className={`flex ${me ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] ${me ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {showHeader && (
                    <div className={`flex items-center gap-2 px-1 ${me ? "flex-row-reverse" : ""}`}>
                      <span className="font-display text-xs font-semibold">{s?.full_name ?? "Member"}</span>
                      {s?.role === "admin" && (
                        <span className="rounded-md bg-frequency/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent backdrop-blur">
                          Admin
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      me
                        ? "bg-frequency text-primary-foreground resonance-glow"
                        : "glass text-foreground"
                    }`}
                  >
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>

        <form onSubmit={send} className="flex items-center gap-2 border-t border-white/5 p-3">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Message #${active?.name ?? ""}`}
            className="flex-1 rounded-xl bg-white/5 px-4 py-2.5 text-sm outline-none ring-1 ring-white/5 placeholder:text-muted-foreground focus:ring-primary/40"
          />
          <button
            type="submit"
            disabled={!body.trim()}
            className="grid size-10 place-items-center rounded-xl bg-frequency text-primary-foreground resonance-glow transition hover:brightness-110 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </form>
      </section>
    </div>
  );
}
