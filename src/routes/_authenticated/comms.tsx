import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CymaticWave } from "@/components/cymatic-wave";
import { RequireWorkspace } from "@/components/require-workspace";
import { Hash, Send, Plus, Users, MessageSquare, SmilePlus, Paperclip, Mic, X, FileText, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { VoiceRecorder, type RecordedAudio } from "@/components/voice-recorder";
import { CommAttachment, type Attachment } from "@/components/comm-attachment";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 5;

export const Route = createFileRoute("/_authenticated/comms")({
  component: () => (<RequireWorkspace><CommsPage /></RequireWorkspace>),
});

type Channel = { id: string; name: string; kind: "broadcast" | "dm"; org_id: string };
type Msg = { id: string; channel_id: string; sender_id: string; body: string; created_at: string };
type Sender = { id: string; full_name: string | null; role: string };
type Thread = { id: string; channel_id: string; user_a: string; user_b: string; last_message_at: string };
type Reaction = { id: string; message_id: string; user_id: string; emoji: string };

const QUICK_EMOJIS = ["👍", "❤️", "🔥", "🎉", "😂", "🙏", "👀", "✨"];

function CommsPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<Channel | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [senders, setSenders] = useState<Record<string, Sender>>({});
  const [reads, setReads] = useState<Record<string, string>>({}); // channel_id -> last_read_at
  const [tab, setTab] = useState<"channels" | "direct">("channels");
  const [body, setBody] = useState("");
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // init
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle();
      if (!p?.org_id) return;
      setOrgId(p.org_id);
      setIsAdmin(p.role === "admin");

      const [{ data: chs }, { data: mem }, { data: th }, { data: rd }] = await Promise.all([
        supabase.from("channels").select("*").eq("org_id", p.org_id).order("created_at"),
        supabase.from("profiles").select("id, full_name, role").eq("org_id", p.org_id),
        supabase.from("direct_threads").select("*").eq("org_id", p.org_id).order("last_message_at", { ascending: false }),
        supabase.from("message_reads").select("channel_id, last_read_at").eq("user_id", user.id),
      ]);

      let list = (chs ?? []) as Channel[];
      const broadcasts = list.filter((c) => c.kind === "broadcast");
      if (broadcasts.length === 0 && p.role === "admin") {
        const { data: created } = await supabase
          .from("channels")
          .insert({ name: "general", kind: "broadcast", org_id: p.org_id, created_by: user.id })
          .select();
        if (created) list = [...list, ...(created as Channel[])];
      }
      setChannels(list);
      setThreads((th ?? []) as Thread[]);
      const map: Record<string, Sender> = {};
      for (const m of (mem ?? []) as Sender[]) map[m.id] = m;
      setSenders(map);
      const readMap: Record<string, string> = {};
      for (const r of (rd ?? []) as { channel_id: string; last_read_at: string }[]) readMap[r.channel_id] = r.last_read_at;
      setReads(readMap);

      setActive(list.find((c) => c.kind === "broadcast") ?? list[0] ?? null);
    })();
  }, [user]);

  // load + subscribe to active channel
  useEffect(() => {
    if (!active || !user) { setMsgs([]); setReactions([]); return; }
    (async () => {
      const { data: m } = await supabase
        .from("messages").select("*")
        .eq("channel_id", active.id).order("created_at").limit(200);
      setMsgs((m ?? []) as Msg[]);
      const ids = (m ?? []).map((x: any) => x.id);
      if (ids.length) {
        const { data: rx } = await supabase.from("message_reactions").select("*").in("message_id", ids);
        setReactions((rx ?? []) as Reaction[]);
      } else setReactions([]);

      // mark read
      await supabase.from("message_reads").upsert({
        user_id: user.id, channel_id: active.id, last_read_at: new Date().toISOString(),
      });
      setReads((r) => ({ ...r, [active.id]: new Date().toISOString() }));
    })();

    const ch = supabase
      .channel(`msgs-${active.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${active.id}` },
        (payload) => setMsgs((m) => [...m, payload.new as Msg]))
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" },
        (payload) => {
          if (payload.eventType === "INSERT") setReactions((r) => [...r, payload.new as Reaction]);
          if (payload.eventType === "DELETE") setReactions((r) => r.filter((x) => x.id !== (payload.old as any).id));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active, user]);

  // subscribe to all messages for unread counting
  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel(`org-msgs-${orgId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `org_id=eq.${orgId}` },
        () => { /* triggers unreadFor() recompute via msgs/reads state below */ })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId]);

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
    if (!user || !orgId || !newChannelName.trim()) return;
    const clean = newChannelName.toLowerCase().replace(/\s+/g, "-").slice(0, 30);
    const { data, error } = await supabase
      .from("channels")
      .insert({ name: clean, kind: "broadcast", org_id: orgId, created_by: user.id })
      .select().single();
    if (error) return toast.error(error.message);
    setChannels((c) => [...c, data as Channel]);
    setActive(data as Channel);
    setNewChannelName("");
    setNewChannelOpen(false);
  };

  const openDM = async (otherId: string) => {
    const { data, error } = await supabase.rpc("open_dm", { _other: otherId });
    if (error) return toast.error(error.message);
    const t = data as Thread;
    setThreads((th) => (th.find((x) => x.id === t.id) ? th : [t, ...th]));
    let chan = channels.find((c) => c.id === t.channel_id);
    if (!chan) {
      const { data: c } = await supabase.from("channels").select("*").eq("id", t.channel_id).maybeSingle();
      if (c) { chan = c as Channel; setChannels((x) => [...x, chan!]); }
    }
    if (chan) setActive(chan);
  };

  const react = async (messageId: string, emoji: string) => {
    setPickerFor(null);
    const { error } = await supabase.rpc("toggle_reaction", { _message: messageId, _emoji: emoji });
    if (error) toast.error(error.message);
  };

  const broadcasts = channels.filter((c) => c.kind === "broadcast");
  const dmChannels = useMemo(() => {
    return threads
      .map((t) => {
        const c = channels.find((x) => x.id === t.channel_id);
        const other = senders[t.user_a === user?.id ? t.user_b : t.user_a];
        return c ? { channel: c, thread: t, other } : null;
      })
      .filter(Boolean) as { channel: Channel; thread: Thread; other?: Sender }[];
  }, [threads, channels, senders, user]);

  const otherMembers = useMemo(
    () => Object.values(senders).filter((s) => s.id !== user?.id),
    [senders, user],
  );

  const unreadFor = (chId: string) => {
    if (active?.id === chId) return 0;
    const last = reads[chId];
    return msgs.filter((m) => m.channel_id === chId && m.sender_id !== user?.id && (!last || m.created_at > last)).length;
  };

  if (!orgId) return <div className="grid place-items-center py-20"><CymaticWave className="h-10" bars={6} /></div>;

  return (
    <div className="grid h-[calc(100vh-7rem)] gap-4 md:grid-cols-[280px_1fr]">
      {/* Left rail */}
      <aside className="glass flex flex-col rounded-2xl p-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 text-xs">
          {(["channels", "direct"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 font-mono uppercase tracking-widest transition ${
                tab === t ? "bg-frequency text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "channels" ? <Hash className="size-3" /> : <Users className="size-3" />}
              {t}
            </button>
          ))}
        </div>

        {tab === "channels" ? (
          <>
            <div className="mt-3 flex items-center justify-between px-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Channels</span>
              {isAdmin && (
                <Dialog open={newChannelOpen} onOpenChange={setNewChannelOpen}>
                  <DialogTrigger asChild>
                    <button className="rounded-md p-1 text-muted-foreground transition hover:bg-white/5 hover:text-foreground" aria-label="New channel">
                      <Plus className="size-4" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="glass-strong border-white/10">
                    <DialogHeader><DialogTitle className="font-display">New channel</DialogTitle></DialogHeader>
                    <input
                      autoFocus value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="e.g. announcements"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                    />
                    <DialogFooter>
                      <button onClick={createChannel} className="rounded-xl bg-frequency px-4 py-2 text-sm font-semibold text-primary-foreground resonance-glow">
                        Create
                      </button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
              {broadcasts.map((c) => {
                const u = unreadFor(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => setActive(c)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                      active?.id === c.id ? "bg-frequency/15 text-foreground resonance-glow" : "text-muted-foreground hover:bg-white/5"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <Hash className="size-3.5 shrink-0" /><span className="truncate">{c.name}</span>
                    </span>
                    {u > 0 && <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[9px] text-primary-foreground">{u}</span>}
                  </button>
                );
              })}
              {broadcasts.length === 0 && <div className="px-2 py-4 text-xs text-muted-foreground">No channels yet.</div>}
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Direct messages</div>
            <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
              {dmChannels.map(({ channel, other }) => {
                const u = unreadFor(channel.id);
                return (
                  <button key={channel.id} onClick={() => setActive(channel)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                      active?.id === channel.id ? "bg-frequency/15 text-foreground resonance-glow" : "text-muted-foreground hover:bg-white/5"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <Avatar name={other?.full_name ?? "?"} />
                      <span className="truncate">{other?.full_name ?? "Member"}</span>
                    </span>
                    {u > 0 && <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[9px] text-primary-foreground">{u}</span>}
                  </button>
                );
              })}
              <div className="mt-4 px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Start a DM</div>
              {otherMembers.map((m) => (
                <button key={m.id} onClick={() => openDM(m.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-white/5">
                  <Avatar name={m.full_name ?? "?"} />
                  <span className="truncate">{m.full_name ?? "Member"}</span>
                  <MessageSquare className="ml-auto size-3 opacity-50" />
                </button>
              ))}
              {otherMembers.length === 0 && <div className="px-2 py-4 text-xs text-muted-foreground">No other members yet.</div>}
            </div>
          </>
        )}
      </aside>

      {/* Thread */}
      <section className="glass-strong flex flex-col rounded-2xl">
        <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <div className="flex items-center gap-2">
            {active?.kind === "dm" ? <MessageSquare className="size-4 text-accent" /> : <Hash className="size-4 text-accent" />}
            <h2 className="font-display text-base font-semibold">{dmTitle(active, threads, senders, user?.id)}</h2>
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
            const msgRx = reactions.filter((r) => r.message_id === m.id);
            const grouped = groupReactions(msgRx);
            return (
              <div key={m.id} className={`group flex ${me ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[78%] flex-col gap-1 ${me ? "items-end" : "items-start"}`}>
                  {showHeader && (
                    <div className={`flex items-center gap-2 px-1 ${me ? "flex-row-reverse" : ""}`}>
                      <span className="font-display text-xs font-semibold">{s?.full_name ?? "Member"}</span>
                      {s?.role === "admin" && (
                        <span className="rounded-md bg-frequency/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent">Admin</span>
                      )}
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                  <div className={`relative flex items-center gap-2 ${me ? "flex-row-reverse" : ""}`}>
                    <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      me ? "bg-frequency text-primary-foreground resonance-glow" : "glass text-foreground"
                    }`}>
                      {m.body}
                    </div>
                    <button
                      onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}
                      className="opacity-0 transition group-hover:opacity-100"
                      aria-label="React"
                    >
                      <SmilePlus className="size-4 text-muted-foreground hover:text-accent" />
                    </button>
                    {pickerFor === m.id && (
                      <div className={`glass-strong absolute z-10 flex gap-1 rounded-xl border border-white/10 p-1.5 shadow-2xl ${me ? "right-0 -top-12" : "left-0 -top-12"}`}>
                        {QUICK_EMOJIS.map((e) => (
                          <button key={e} onClick={() => react(m.id, e)} className="rounded-md px-1.5 py-1 text-base hover:bg-white/10">
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {grouped.length > 0 && (
                    <div className={`flex flex-wrap gap-1 ${me ? "justify-end" : ""}`}>
                      {grouped.map(([emoji, users]) => {
                        const mine = users.includes(user?.id ?? "");
                        return (
                          <button
                            key={emoji}
                            onClick={() => react(m.id, emoji)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                              mine ? "border-accent/40 bg-accent/15 text-accent" : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"
                            }`}
                          >
                            <span>{emoji}</span><span className="font-mono text-[10px]">{users.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
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
            placeholder={active ? `Message ${active.kind === "dm" ? dmTitle(active, threads, senders, user?.id) : "#" + active.name}` : ""}
            className="flex-1 rounded-xl bg-white/5 px-4 py-2.5 text-sm outline-none ring-1 ring-white/5 placeholder:text-muted-foreground focus:ring-primary/40"
          />
          <button type="submit" disabled={!body.trim()}
            className="grid size-10 place-items-center rounded-xl bg-frequency text-primary-foreground resonance-glow transition hover:brightness-110 disabled:opacity-40"
            aria-label="Send">
            <Send className="size-4" />
          </button>
        </form>
      </section>
    </div>
  );
}

function dmTitle(active: Channel | null, threads: Thread[], senders: Record<string, Sender>, uid?: string) {
  if (!active) return "—";
  if (active.kind !== "dm") return active.name;
  const t = threads.find((x) => x.channel_id === active.id);
  if (!t) return "Direct";
  const other = senders[t.user_a === uid ? t.user_b : t.user_a];
  return other?.full_name ?? "Direct";
}

function groupReactions(rx: Reaction[]): [string, string[]][] {
  const map = new Map<string, string[]>();
  for (const r of rx) {
    const arr = map.get(r.emoji) ?? [];
    arr.push(r.user_id);
    map.set(r.emoji, arr);
  }
  return Array.from(map.entries());
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-frequency/20 font-mono text-[10px] text-accent ring-1 ring-white/10">
      {initials || "?"}
    </span>
  );
}
