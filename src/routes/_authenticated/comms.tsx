import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useComms, CommsProvider } from "@/lib/comms-context";
import { CymaticWave } from "@/components/cymatic-wave";
import { RequireWorkspace } from "@/components/require-workspace";
import { useCallController } from "@/hooks/use-call-controller";
import {
  Hash,
  Send,
  Plus,
  Search,
  ArrowLeft,
  Phone,
  Video,
  SmilePlus,
  Paperclip,
  Users,
  BadgeCheck,
  ListTodo,
  MessageSquarePlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ensureNotificationPermission, notify } from "@/lib/notifications";
import { CallHistoryPanel } from "@/components/call-history";
import { TasksPanel } from "@/components/tasks-panel";

export const Route = createFileRoute("/_authenticated/comms")({
  component: () => (
    <RequireWorkspace>
      <CommsProvider>
        <CommsPage />
      </CommsProvider>
    </RequireWorkspace>
  ),
});

type Channel = { id: string; name: string; kind: "broadcast" | "dm"; org_id: string };
type Msg = { id: string; channel_id: string; sender_id: string; body: string; created_at: string };
type Reaction = { id: string; message_id: string; emoji: string; user_id: string };

const VERIFIED_CHANNELS = new Set(["announcements", "general", "leadership"]);

function CommsPage() {
  const { user } = useAuth();
  const {
    channels,
    setChannels,
    activeChannel,
    setActiveChannel,
    threads,
    setThreads,
    messages: msgs,
    setMessages: setMsgs,
    senders,
    setSenders,
    setReads,
    lastMessageByChannel,
    setLastMessageByChannel,
    sendMessage,
    startDm,
  } = useComms();
  const callController = useCallController();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [, setReactions] = useState<Reaction[]>([]);
  const [pending] = useState<string[]>([]);

  const active = activeChannel;
  const setActive = setActiveChannel;

  const [tab] = useState<"all" | "channels" | "direct" | "verified">("all");
  const [search, setSearch] = useState("");
  const [body, setBody] = useState("");
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const activeRef = useRef<Channel | null>(null);
  activeRef.current = active;

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("org_id, role")
        .eq("id", user.id)
        .maybeSingle();
      if (!p?.org_id) return;
      setOrgId(p.org_id);
      setIsAdmin(p.role === "admin");

      const [{ data: chs }, { data: mem }, { data: th }, { data: rd }] = await Promise.all([
        supabase.from("channels").select("*").eq("org_id", p.org_id).order("created_at"),
        supabase.from("profiles").select("id, full_name, role").eq("org_id", p.org_id),
        supabase
          .from("direct_threads")
          .select("*")
          .eq("org_id", p.org_id)
          .order("last_message_at", { ascending: false }),
        supabase.from("message_reads").select("channel_id, last_read_at").eq("user_id", user.id),
      ]);
      if (chs) setChannels(chs);
      if (mem) setSenders(Object.fromEntries(mem.map((s) => [s.id, s])));
      if (th) setThreads(th);
      if (rd) setReads(Object.fromEntries(rd.map((r) => [r.channel_id, r.last_read_at])));

      // Restore the last opened conversation so chat history survives reloads.
      const lastId =
        typeof window !== "undefined" ? window.localStorage.getItem("cym.lastChannel") : null;
      const restored = lastId ? (chs ?? []).find((c) => c.id === lastId) : null;
      if (restored) setActiveChannel(restored as Channel);
    })();
  }, [user, setChannels, setSenders, setThreads, setReads, setActiveChannel]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (active?.id) window.localStorage.setItem("cym.lastChannel", active.id);
    else window.localStorage.removeItem("cym.lastChannel");
  }, [active?.id]);

  // Cache the loaded history per channel so it renders instantly on return.
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const cached = window.localStorage.getItem(`cym.msgs.${active.id}`);
    if (cached && msgs.length === 0) {
      try {
        setMsgs(JSON.parse(cached) as Msg[]);
      } catch {
        /* ignore malformed cache */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  useEffect(() => {
    if (!active || typeof window === "undefined" || msgs.length === 0) return;
    window.localStorage.setItem(`cym.msgs.${active.id}`, JSON.stringify(msgs.slice(-100)));
  }, [msgs, active?.id, active]);

  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel("comms")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as Msg;
        setMsgs((prev) => [...prev, m]);
        setLastMessageByChannel((prev) => ({ ...prev, [m.channel_id]: m }));
        if (activeRef.current?.id === m.channel_id) {
          supabase.from("message_reads").upsert({
            channel_id: m.channel_id,
            user_id: user!.id,
            last_read_at: new Date().toISOString(),
          });
        } else if (user?.id !== m.sender_id) {
          const sender = senders[m.sender_id]?.full_name ?? "Someone";
          notify(sender, { body: m.body });
        }
      })
      .subscribe();
    return () => {
      ch.unsubscribe();
    };
  }, [orgId, senders, user, setMsgs, setLastMessageByChannel]);

  useEffect(() => {
    if (!active) return;
    supabase
      .from("messages")
      .select("*")
      .eq("channel_id", active.id)
      .order("created_at")
      .then(({ data }) => {
        if (!data) return;
        setMsgs(data);
        const ids = data.map((m) => m.id);
        if (ids.length === 0) {
          setReactions([]);
          return;
        }
        supabase
          .from("message_reactions")
          .select("*")
          .in("message_id", ids)
          .then(({ data: rx }) => {
            if (rx) setReactions(rx.map((r) => ({ ...r, message_id: r.message_id })));
          });
      });
  }, [active, setMsgs]);

  const handleSendMessage = async () => {
    if (!body.trim() && pending.length === 0) return;
    setSending(true);
    await sendMessage(body);
    setSending(false);
    setBody("");
  };

  const handleStartDm = async (otherId: string) => {
    setNewDmOpen(false);
    await startDm(otherId);
  };

  const dmTarget = () => {
    if (!active || active.kind !== "dm" || !user) return null;
    const t = threads.find((x) => x.channel_id === active.id);
    if (!t) return null;
    return t.user_a === user.id ? t.user_b : t.user_a;
  };

  const placeCall = (kind: "audio" | "video") => {
    if (!active) return;
    const target = dmTarget();
    const recipients = target ? [target] : Object.keys(senders).filter((id) => id !== user?.id);
    if (recipients.length === 0) return toast.error("No one else in this workspace yet");
    callController.startCall(active.id, recipients, kind);
  };

  const conversations = useMemo(() => {
    const items = channels.map((c) => {
      const last = lastMessageByChannel[c.id];
      const isDm = c.kind === "dm";
      const thread = isDm ? threads.find((t) => t.channel_id === c.id) : undefined;
      const other =
        isDm && thread
          ? senders[thread.user_a === user?.id ? thread.user_b : thread.user_a]
          : undefined;
      const title = isDm ? (other?.full_name ?? "Direct") : c.name;
      const sortKey = last?.created_at ?? "0";
      return {
        channel: c,
        last,
        title,
        other,
        sortKey,
        verified: !isDm && VERIFIED_CHANNELS.has(c.name),
      };
    });
    items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    return items;
  }, [channels, lastMessageByChannel, threads, senders, user?.id]);

  const filtered = useMemo(() => {
    let list = conversations;
    if (tab === "channels") list = list.filter((c) => c.channel.kind === "broadcast");
    else if (tab === "direct") list = list.filter((c) => c.channel.kind === "dm");
    else if (tab === "verified") list = list.filter((c) => c.verified);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }
    return list;
  }, [conversations, tab, search]);

  if (!orgId) {
    return (
      <div className="grid place-items-center py-20">
        <CymaticWave className="h-10" bars={6} />
      </div>
    );
  }

  const activeOther =
    active?.kind === "dm"
      ? senders[
          (threads.find((x) => x.channel_id === active.id)?.user_a === user?.id
            ? threads.find((x) => x.channel_id === active.id)?.user_b
            : threads.find((x) => x.channel_id === active.id)?.user_a) ?? ""
        ]
      : undefined;
  const activeTitle = active
    ? active.kind === "dm"
      ? (activeOther?.full_name ?? "Direct")
      : `#${active.name}`
    : "";

  return (
    <div className="-m-4 flex h-[calc(100vh-4.5rem)] flex-col md:-m-6 lg:grid lg:grid-cols-[380px_1fr]">
      {/* Conversation list */}
      <aside
        className={`flex min-h-0 flex-col border-r border-white/5 bg-card/30 ${active ? "hidden lg:flex" : "flex"}`}
      >
        <div className="border-b border-white/5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold tracking-tight">Chats</h1>
            <div className="flex items-center gap-1">
              <Dialog open={newDmOpen} onOpenChange={setNewDmOpen}>
                <DialogTrigger asChild>
                  <button className="rounded-lg p-2 hover:bg-white/5" aria-label="New chat">
                    <MessageSquarePlus className="h-5 w-5" />
                  </button>
                </DialogTrigger>
                <DialogContent className="glass-strong">
                  <DialogHeader>
                    <DialogTitle>New chat</DialogTitle>
                  </DialogHeader>
                  <div className="max-h-72 space-y-1 overflow-y-auto">
                    {Object.values(senders)
                      .filter((s) => s.id !== user?.id)
                      .map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleStartDm(s.id)}
                          className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-sm hover:bg-white/5"
                        >
                          <span className="grid size-8 place-items-center rounded-full bg-frequency/20">
                            <Users className="size-4" />
                          </span>
                          <span className="flex-1 truncate">{s.full_name ?? "Member"}</span>
                          <span className="font-mono text-[10px] uppercase text-muted-foreground">
                            {s.role}
                          </span>
                        </button>
                      ))}
                    {Object.keys(senders).length <= 1 && (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        Invite teammates to start chatting.
                      </p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={tasksOpen} onOpenChange={setTasksOpen}>
                <DialogTrigger asChild>
                  <button className="rounded-lg p-2 hover:bg-white/5" aria-label="Tasks">
                    <ListTodo className="h-5 w-5" />
                  </button>
                </DialogTrigger>
                <DialogContent className="glass-strong max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Tasks</DialogTitle>
                  </DialogHeader>
                  {user && (
                    <TasksPanel
                      orgId={orgId}
                      userId={user.id}
                      isAdmin={isAdmin}
                      members={Object.values(senders).map((s) => ({
                        id: s.id,
                        full_name: s.full_name,
                      }))}
                    />
                  )}
                </DialogContent>
              </Dialog>

              {isAdmin && (
                <Dialog open={newChannelOpen} onOpenChange={setNewChannelOpen}>
                  <DialogTrigger asChild>
                    <button className="rounded-lg p-2 hover:bg-white/5">
                      <Plus className="h-5 w-5" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="glass-strong">
                    <DialogHeader>
                      <DialogTitle>Create channel</DialogTitle>
                    </DialogHeader>
                    <input
                      className="w-full rounded-md border border-white/10 bg-white/5 p-2"
                      placeholder="Channel name"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                    />
                    <DialogFooter>
                      <button
                        className="rounded-md bg-frequency px-4 py-2"
                        onClick={async () => {
                          if (!user) return;
                          const { error } = await supabase.from("channels").insert({
                            name: newChannelName,
                            kind: "broadcast",
                            org_id: orgId,
                            created_by: user.id,
                          });

                          if (!error) {
                            setNewChannelOpen(false);
                            setNewChannelName("");
                          }
                        }}
                      >
                        Create
                      </button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm"
              placeholder="Search chats…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {filtered.map((c) => (
            <button
              key={c.channel.id}
              onClick={() => setActive(c.channel)}
              className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                active?.id === c.channel.id ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              <div className="relative">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/5 ${c.channel.kind === "dm" ? "bg-frequency/20" : ""}`}
                >
                  {c.channel.kind === "dm" ? (
                    <Users className="h-5 w-5" />
                  ) : (
                    <Hash className="h-5 w-5" />
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate font-medium">{c.title}</span>
                  {c.verified && <BadgeCheck className="h-4 w-4 text-frequency" />}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {c.last?.body ?? "No messages"}
                </p>
              </div>
            </button>
          ))}
        </nav>

        <CallHistoryPanel />
      </aside>

      {/* Main chat */}
      <main className={`flex min-h-0 flex-col ${active ? "flex" : "hidden lg:flex"}`}>
        {active ? (
          <>
            <header className="flex items-center justify-between border-b border-white/5 p-4">
              <div className="flex items-center gap-3">
                <button className="lg:hidden" onClick={() => setActive(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="font-semibold">{activeTitle}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => placeCall("audio")}
                  aria-label="Start audio call"
                  className="rounded-full p-2 hover:bg-white/5"
                >
                  <Phone className="h-5 w-5" />
                </button>
                <button
                  onClick={() => placeCall("video")}
                  aria-label="Start video call"
                  className="rounded-full p-2 hover:bg-white/5"
                >
                  <Video className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {msgs.map((m) => (
                <div key={m.id} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-white/5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {senders[m.sender_id]?.full_name ?? "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground/90">{m.body}</p>
                  </div>
                </div>
              ))}
              <div ref={bottom} />
            </div>

            <footer className="border-t border-white/5 p-4">
              <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2">
                <button className="p-2 text-muted-foreground hover:text-foreground">
                  <SmilePlus className="h-5 w-5" />
                </button>
                <button className="p-2 text-muted-foreground hover:text-foreground">
                  <Paperclip className="h-5 w-5" />
                </button>
                <input
                  className="flex-1 bg-transparent py-2 text-sm focus:outline-none"
                  placeholder="Message..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <button
                  className="rounded-lg bg-frequency p-2 text-primary-foreground disabled:opacity-50"
                  disabled={!body.trim() || sending}
                  onClick={handleSendMessage}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Select a conversation to start
          </div>
        )}
      </main>

      {/* Call panel for incoming/active calls */}
    </div>
  );
}
