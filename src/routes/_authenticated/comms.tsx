import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CymaticWave } from "@/components/cymatic-wave";
import { RequireWorkspace } from "@/components/require-workspace";
import {
  Hash, Send, Plus, Search, ArrowLeft, Phone, Video, SmilePlus, Paperclip, Mic, X,
  FileText, ImageIcon, CheckCheck, BadgeCheck, MessageSquarePlus, PhoneIncoming, Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { VoiceRecorder, type RecordedAudio } from "@/components/voice-recorder";
import { CommAttachment, type Attachment } from "@/components/comm-attachment";
import { useCallController } from "@/components/call-provider";
import { ensureNotificationPermission, isWindowActive, notify } from "@/lib/notifications";

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
const VERIFIED_CHANNELS = new Set(["announcements", "general", "leadership"]);

function CommsPage() {
  const { user } = useAuth();
  const callController = useCallController();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<Channel | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [senders, setSenders] = useState<Record<string, Sender>>({});
  const [reads, setReads] = useState<Record<string, string>>({});
  const [lastMessageByChannel, setLastMessageByChannel] = useState<Record<string, Msg>>({});
  const [tab, setTab] = useState<"all" | "channels" | "direct" | "verified">("all");
  const [search, setSearch] = useState("");
  const [body, setBody] = useState("");
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [pending, setPending] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const activeRef = useRef<Channel | null>(null);
  activeRef.current = active;

  useEffect(() => { ensureNotificationPermission(); }, []);

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

      // Load last message per channel for the list preview
      const chanIds = list.map((c) => c.id);
      if (chanIds.length) {
        const { data: recent } = await supabase
          .from("messages").select("*")
          .in("channel_id", chanIds)
          .order("created_at", { ascending: false })
          .limit(chanIds.length * 3);
        const last: Record<string, Msg> = {};
        for (const m of ((recent ?? []) as Msg[])) {
          if (!last[m.channel_id]) last[m.channel_id] = m;
        }
        setLastMessageByChannel(last);
      }
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
        const [{ data: rx }, { data: att }] = await Promise.all([
          supabase.from("message_reactions").select("*").in("message_id", ids),
          (supabase as any).from("message_attachments").select("*").in("message_id", ids),
        ]);
        setReactions((rx ?? []) as Reaction[]);
        const amap: Record<string, Attachment[]> = {};
        for (const a of (att ?? []) as Attachment[]) (amap[a.message_id] ??= []).push(a);
        setAttachments(amap);
      } else { setReactions([]); setAttachments({}); }

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_attachments" },
        (payload) => {
          const a = payload.new as Attachment;
          setAttachments((m) => ({ ...m, [a.message_id]: [...(m[a.message_id] ?? []), a] }));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active, user]);

  // Org-wide message stream: update list previews + fire notifications when out-of-focus
  useEffect(() => {
    if (!orgId || !user) return;
    const ch = supabase
      .channel(`org-msgs-${orgId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `org_id=eq.${orgId}` },
        (payload) => {
          const m = payload.new as Msg;
          setLastMessageByChannel((prev) => ({ ...prev, [m.channel_id]: m }));
          if (m.sender_id === user.id) return;
          const inActive = activeRef.current?.id === m.channel_id;
          if (inActive && isWindowActive()) return;
          const sender = senders[m.sender_id]?.full_name ?? "Member";
          const chan = channels.find((c) => c.id === m.channel_id);
          const title = chan?.kind === "dm" ? sender : `${sender} in #${chan?.name ?? "channel"}`;
          notify(title, {
            body: m.body || "Sent an attachment",
            tag: `msg-${m.channel_id}`,
            onClick: () => { if (chan) setActive(chan); },
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, user, senders, channels]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, attachments]);

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const valid: File[] = [];
    for (const f of incoming) {
      if (f.size > MAX_FILE_BYTES) { toast.error(`${f.name} exceeds 25 MB`); continue; }
      valid.push(f);
    }
    setPending((p) => {
      const next = [...p, ...valid];
      if (next.length > MAX_FILES) { toast.error(`Max ${MAX_FILES} files per message`); return next.slice(0, MAX_FILES); }
      return next;
    });
  };

  const kindOf = (mime: string): "image" | "audio" | "file" =>
    mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "audio" : "file";

  const uploadOne = async (file: Blob, filename: string, mime: string, messageId: string, extra: Partial<Attachment> = {}) => {
    if (!orgId || !active || !user) return;
    const safe = filename.replace(/[^\w.\-]+/g, "_");
    const path = `${orgId}/${active.id}/${messageId}/${crypto.randomUUID()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("comm-attachments").upload(path, file, {
      contentType: mime, upsert: false,
    });
    if (upErr) throw upErr;
    const { error: insErr } = await (supabase as any).from("message_attachments").insert({
      message_id: messageId, org_id: orgId, uploader_id: user.id,
      storage_path: path, mime_type: mime, size_bytes: (file as File).size ?? (file as Blob).size,
      kind: kindOf(mime), filename: safe, ...extra,
    });
    if (insErr) throw insErr;
  };

  const sendMessage = async (text: string, files: File[], audio?: RecordedAudio) => {
    if (!user || !active || !orgId) return;
    if (!text && files.length === 0 && !audio) return;
    setSending(true);
    try {
      const { data: msg, error } = await supabase.from("messages")
        .insert({ org_id: orgId, channel_id: active.id, sender_id: user.id, body: text || "" })
        .select().single();
      if (error || !msg) throw error ?? new Error("send failed");
      const uploads: Promise<void>[] = [];
      for (const f of files) uploads.push(uploadOne(f, f.name, f.type || "application/octet-stream", (msg as any).id));
      if (audio) uploads.push(uploadOne(
        audio.blob, `voice-${Date.now()}.${audio.ext}`, audio.mime, (msg as any).id,
        { duration_ms: audio.durationMs },
      ));
      const results = await Promise.allSettled(uploads);
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) toast.error(`${failed} attachment(s) failed to upload`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text && pending.length === 0) return;
    const files = pending;
    setBody(""); setPending([]);
    await sendMessage(text, files);
  };

  const sendVoice = async (audio: RecordedAudio) => {
    setRecording(false);
    await sendMessage("", [], audio);
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
    if (chan) { setActive(chan); setNewDmOpen(false); }
  };

  const react = async (messageId: string, emoji: string) => {
    setPickerFor(null);
    const { error } = await supabase.rpc("toggle_reaction", { _message: messageId, _emoji: emoji });
    if (error) toast.error(error.message);
  };

  const startCall = async (kind: "audio" | "video") => {
    if (!active || !user || !orgId) return;
    let recipients: string[] = [];
    if (active.kind === "dm") {
      const t = threads.find((x) => x.channel_id === active.id);
      if (t) recipients = [t.user_a === user.id ? t.user_b : t.user_a];
    } else {
      recipients = Object.keys(senders).filter((id) => id !== user.id);
    }
    if (recipients.length === 0) return toast.error("No one to call");
    await callController.startCall(active.id, recipients, kind);
  };

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
    const lastMsg = lastMessageByChannel[chId];
    if (!lastMsg) return 0;
    if (lastMsg.sender_id === user?.id) return 0;
    if (!last) return 1;
    return lastMsg.created_at > last ? 1 : 0;
  };

  // Conversation list: merge channels + dms with last message preview
  const conversations = useMemo(() => {
    const items = channels.map((c) => {
      const last = lastMessageByChannel[c.id];
      const isDm = c.kind === "dm";
      const thread = isDm ? threads.find((t) => t.channel_id === c.id) : undefined;
      const other = isDm && thread ? senders[thread.user_a === user?.id ? thread.user_b : thread.user_a] : undefined;
      const title = isDm ? other?.full_name ?? "Direct" : c.name;
      const sortKey = last?.created_at ?? "0";
      return { channel: c, last, title, other, sortKey, verified: !isDm && VERIFIED_CHANNELS.has(c.name) };
    });
    items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    return items;
  }, [channels, lastMessageByChannel, threads, senders, user]);

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

  if (!orgId) return <div className="grid place-items-center py-20"><CymaticWave className="h-10" bars={6} /></div>;

  const activeOther = active?.kind === "dm"
    ? senders[(threads.find((x) => x.channel_id === active.id)?.user_a === user?.id ? threads.find((x) => x.channel_id === active.id)?.user_b : threads.find((x) => x.channel_id === active.id)?.user_a) ?? ""]
    : undefined;
  const activeTitle = active ? (active.kind === "dm" ? activeOther?.full_name ?? "Direct" : `#${active.name}`) : "";

  return (
    <div className="-m-4 md:-m-6 flex h-[calc(100vh-4.5rem)] flex-col lg:h-[calc(100vh-4.5rem)] lg:grid lg:grid-cols-[380px_1fr]">
      {/* Conversation list — hidden on mobile when a chat is open */}
      <aside className={`flex min-h-0 flex-col border-r border-white/5 bg-card/30 ${active ? "hidden lg:flex" : "flex"}`}>
        <div className="border-b border-white/5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold tracking-tight">Chats</h1>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Dialog open={newChannelOpen} onOpenChange={setNewChannelOpen}>
                  <DialogTrigger asChild>
                    <button className="grid size-10 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground" aria-label="New channel">
                      <Hash className="size-4" />
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
              <Dialog open={newDmOpen} onOpenChange={setNewDmOpen}>
                <DialogTrigger asChild>
                  <button className="grid size-10 place-items-center rounded-full bg-frequency text-primary-foreground resonance-glow transition hover:brightness-110" aria-label="New chat">
                    <MessageSquarePlus className="size-4" />
                  </button>
                </DialogTrigger>
                <DialogContent className="glass-strong border-white/10">
                  <DialogHeader><DialogTitle className="font-display">Start a direct message</DialogTitle></DialogHeader>
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {otherMembers.map((m) => (
                      <button key={m.id} onClick={() => openDM(m.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5">
                        <Avatar name={m.full_name ?? "?"} size={40} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{m.full_name ?? "Member"}</div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{m.role}</div>
                        </div>
                      </button>
                    ))}
                    {otherMembers.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No other members yet.</div>}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              className="w-full rounded-full bg-white/5 py-3 pl-10 pr-4 text-sm outline-none ring-1 ring-white/5 placeholder:text-muted-foreground focus:ring-primary/40"
            />
          </div>

          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {([
              ["all", "All"],
              ["channels", "Channels"],
              ["direct", "DMs"],
              ["verified", "Verified"],
            ] as const).map(([key, label]) => (
              <button
                key={key} onClick={() => setTab(key)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  tab === key ? "bg-frequency text-primary-foreground resonance-glow" : "bg-white/5 text-muted-foreground hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              {search ? "No matches" : "No conversations yet"}
            </div>
          )}
          {filtered.map(({ channel, last, title, other, verified }) => {
            const u = unreadFor(channel.id);
            const isActive = active?.id === channel.id;
            const preview = last?.body || (last ? "📎 Attachment" : "No messages yet");
            const time = last ? new Date(last.created_at) : null;
            return (
              <button
                key={channel.id}
                onClick={() => setActive(channel)}
                className={`flex w-full items-center gap-3.5 border-l-2 px-5 py-4 text-left transition ${
                  isActive ? "border-accent bg-white/[0.04]" : "border-transparent hover:bg-white/[0.02]"
                }`}
              >
                {channel.kind === "dm" ? (
                  <Avatar name={other?.full_name ?? "?"} size={52} />
                ) : (
                  <span className="grid size-[52px] shrink-0 place-items-center rounded-full bg-frequency/20 text-accent ring-1 ring-white/10">
                    <Hash className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-display font-semibold">{title}</span>
                      {verified && <BadgeCheck className="size-3.5 shrink-0 text-accent" />}
                    </div>
                    {time && (
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {formatListTime(time)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${u > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {preview}
                    </p>
                    {u > 0 && (
                      <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-accent px-1.5 font-mono text-[10px] font-bold text-accent-foreground">
                        {u}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Chat thread */}
      <section className={`flex min-h-0 flex-col bg-background/40 ${active ? "flex" : "hidden lg:flex"}`}>
        {!active ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <CymaticWave className="mx-auto h-10" bars={7} />
              <p className="mt-4 font-display text-lg">Select a conversation</p>
              <p className="mt-1 text-sm text-muted-foreground">Choose a chat or start a new one to begin messaging.</p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-white/5 bg-card/50 px-4 py-3 backdrop-blur md:px-6">
              <button onClick={() => setActive(null)} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground lg:hidden" aria-label="Back">
                <ArrowLeft className="size-4" />
              </button>
              {active.kind === "dm" ? (
                <Avatar name={activeOther?.full_name ?? "?"} size={40} />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-frequency/20 text-accent ring-1 ring-white/10">
                  <Hash className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate font-display text-base font-semibold">{activeTitle.replace(/^#/, "")}</h2>
                  {active.kind !== "dm" && VERIFIED_CHANNELS.has(active.name) && (
                    <BadgeCheck className="size-3.5 shrink-0 text-accent" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-accent animate-pulse-ring" />
                  {active.kind === "dm" ? activeOther?.role ?? "online" : `${Object.keys(senders).length} members`}
                </div>
              </div>
              <button onClick={() => startCall("audio")} className="grid size-10 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-accent" aria-label="Voice call">
                <Phone className="size-4" />
              </button>
              <button onClick={() => startCall("video")} className="grid size-10 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-accent" aria-label="Video call">
                <Video className="size-4" />
              </button>
            </header>

            <div
              className={`relative flex-1 overflow-y-auto px-4 py-6 md:px-6 ${dragOver ? "ring-2 ring-inset ring-accent/40" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
            >
              <div className="mx-auto flex max-w-3xl flex-col gap-1">
                {msgs.length === 0 && (
                  <div className="grid place-items-center py-20 text-sm text-muted-foreground">
                    No messages yet — say hello 👋
                  </div>
                )}
                {msgs.map((m, i) => {
                  const me = m.sender_id === user?.id;
                  const s = senders[m.sender_id];
                  const prev = i > 0 ? msgs[i - 1] : null;
                  const newDay = !prev || !sameDay(prev.created_at, m.created_at);
                  const showHeader = !me && (newDay || !prev || prev.sender_id !== m.sender_id || timeDiffMin(prev.created_at, m.created_at) > 5);
                  const showAvatar = !me && (i === msgs.length - 1 || msgs[i + 1].sender_id !== m.sender_id);
                  const msgRx = reactions.filter((r) => r.message_id === m.id);
                  const grouped = groupReactions(msgRx);
                  const msgAtts = attachments[m.id] ?? [];

                  return (
                    <div key={m.id}>
                      {newDay && (
                        <div className="my-4 flex items-center justify-center">
                          <span className="rounded-full bg-card/80 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground ring-1 ring-white/5">
                            {formatDay(m.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={`group flex items-end gap-2 ${me ? "justify-end" : "justify-start"} ${showHeader ? "mt-3" : "mt-0.5"}`}>
                        {!me && (
                          <div className="w-8 shrink-0">
                            {showAvatar && <Avatar name={s?.full_name ?? "?"} size={32} />}
                          </div>
                        )}
                        <div className={`flex max-w-[78%] flex-col ${me ? "items-end" : "items-start"}`}>
                          {showHeader && (
                            <div className="mb-1 flex items-center gap-1.5 px-1">
                              <span className="font-display text-xs font-semibold">{s?.full_name ?? "Member"}</span>
                              {s?.role === "admin" && (
                                <span className="rounded-md bg-frequency/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent">Admin</span>
                              )}
                            </div>
                          )}
                          <div className="group/bubble relative flex items-end gap-1.5">
                            <div className={`flex flex-col gap-1.5 ${me ? "items-end" : "items-start"}`}>
                              {m.body && (
                                <div className={`relative max-w-full px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                                  me
                                    ? "rounded-2xl rounded-br-md bg-frequency text-primary-foreground"
                                    : "rounded-2xl rounded-bl-md bg-card text-foreground ring-1 ring-white/5"
                                }`}>
                                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                                  <div className={`mt-1 flex items-center justify-end gap-1 ${me ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                    <span className="font-mono text-[10px]">{formatTime(m.created_at)}</span>
                                    {me && <CheckCheck className="size-3" />}
                                  </div>
                                </div>
                              )}
                              {msgAtts.map((a) => (
                                <CommAttachment key={a.id} a={a} mine={me} />
                              ))}
                            </div>
                            <button
                              onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}
                              className={`mb-1 shrink-0 opacity-0 transition group-hover/bubble:opacity-100 ${me ? "order-first" : ""}`}
                              aria-label="React"
                            >
                              <SmilePlus className="size-4 text-muted-foreground hover:text-accent" />
                            </button>
                            {pickerFor === m.id && (
                              <div className={`absolute z-20 flex gap-1 rounded-full border border-white/10 bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl ${me ? "right-8 -top-12" : "left-8 -top-12"}`}>
                                {QUICK_EMOJIS.map((e) => (
                                  <button key={e} onClick={() => react(m.id, e)} className="rounded-full px-1.5 py-1 text-base hover:bg-white/10">{e}</button>
                                ))}
                              </div>
                            )}
                          </div>
                          {grouped.length > 0 && (
                            <div className={`mt-1 flex flex-wrap gap-1 ${me ? "justify-end" : ""}`}>
                              {grouped.map(([emoji, users]) => {
                                const mine = users.includes(user?.id ?? "");
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() => react(m.id, emoji)}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                                      mine ? "border-accent/40 bg-accent/15 text-accent" : "border-white/10 bg-card/60 text-muted-foreground hover:bg-white/10"
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
                    </div>
                  );
                })}
                <div ref={bottom} />
              </div>
            </div>

            {pending.length > 0 && (
              <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-2 border-t border-white/5 px-4 pt-3 md:px-6">
                {pending.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs ring-1 ring-white/10">
                    {f.type.startsWith("image/") ? <ImageIcon className="size-3.5 text-accent" /> : <FileText className="size-3.5 text-accent" />}
                    <span className="max-w-[160px] truncate">{f.name}</span>
                    <button type="button" onClick={() => setPending((p) => p.filter((_, j) => j !== i))} aria-label="Remove">
                      <X className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <form onSubmit={send} className="border-t border-white/5 bg-card/30 px-4 py-3 backdrop-blur md:px-6">
              <div className="mx-auto flex max-w-3xl items-center gap-2">
                {recording ? (
                  <VoiceRecorder onCancel={() => setRecording(false)} onSend={sendVoice} />
                ) : (
                  <>
                    <input
                      ref={fileInputRef} type="file" multiple
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                      className="hidden"
                      onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
                    />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground" aria-label="Attach">
                      <Paperclip className="size-4" />
                    </button>
                    <div className="flex-1">
                      <input
                        value={body} onChange={(e) => setBody(e.target.value)}
                        placeholder={`Message ${activeTitle.replace(/^#/, "")}`}
                        className="w-full rounded-full bg-white/5 px-5 py-3 text-[15px] outline-none ring-1 ring-white/5 placeholder:text-muted-foreground focus:ring-primary/40"
                      />
                    </div>
                    {body.trim() || pending.length > 0 ? (
                      <button type="submit" disabled={sending} className="grid size-11 shrink-0 place-items-center rounded-full bg-frequency text-primary-foreground resonance-glow transition hover:brightness-110 disabled:opacity-40" aria-label="Send">
                        <Send className="size-4" />
                      </button>
                    ) : (
                      <button type="button" onClick={() => setRecording(true)} className="grid size-11 shrink-0 place-items-center rounded-full bg-frequency text-primary-foreground resonance-glow transition hover:brightness-110" aria-label="Record voice note">
                        <Mic className="size-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
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

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-frequency text-primary-foreground font-bold ring-2 ring-white/5"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials || "?"}
    </span>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatListTime(d: Date) {
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 36e5;
  if (sameDay(d.toISOString(), now.toISOString())) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffH < 48) return "Yesterday";
  if (diffH < 24 * 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function formatDay(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(iso, now.toISOString())) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(iso, y.toISOString())) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
}

function sameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function timeDiffMin(a: string, b: string) {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 60000;
}
