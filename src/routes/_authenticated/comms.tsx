import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useComms, CommsProvider } from "@/lib/comms-context";
import { type Channel, type Msg, type Reaction } from "@/lib/comms-context-def";
import { type Attachment } from "@/components/comm-attachment";
import { CymaticWave } from "@/components/cymatic-wave";
import { RequireWorkspace } from "@/components/require-workspace";
import { useCallController } from "@/hooks/use-call-controller";
import { useMessageSender } from "@/hooks/useMessageSender";
import { useLongPress } from "@/hooks/use-long-press";
import { ChatItem } from "@/components/chat-item";
import { MessageItem } from "@/components/message-item";
import { CallHistoryPanel } from "@/components/call-history";
import { VoiceRecorder, type RecordedAudio } from "@/components/voice-recorder";
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
  Mic,
  X,
  FileText,
  Smile,
  Loader2,
  Shield,
  Lock,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CallPanel } from "@/components/call-panel";
import {
  ensureNotificationPermission,
  notify,
  playMessageChime,
  getNotificationPrefs,
} from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/comms")({
  component: () => (
    <RequireWorkspace>
      <CommsProvider>
        <CommsPage />
      </CommsProvider>
    </RequireWorkspace>
  ),
});

// Local types removed, using shared definitions

const EMOJI_OPTIONS = ["👍", "❤️", "👏", "🔥", "😮", "🎉"];
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
    deleteMessage,
    deleteChat,
  } = useComms();
  const callController = useCallController();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, Attachment[]>>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    id: string;
    type: "chat" | "message";
  } | null>(null);

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedChats(new Set());
    setSelectedMessages(new Set());
    setContextMenu(null);
  };

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if ("clientX" in e) {
      return { x: e.clientX, y: e.clientY };
    }
    const touchEvent = e as React.TouchEvent;
    if (touchEvent.touches && touchEvent.touches[0]) {
      return { x: touchEvent.touches[0].clientX, y: touchEvent.touches[0].clientY };
    }
    if (touchEvent.changedTouches && touchEvent.changedTouches[0]) {
      return { x: touchEvent.changedTouches[0].clientX, y: touchEvent.changedTouches[0].clientY };
    }
    return { x: 0, y: 0 };
  };

  const active = activeChannel;
  const setActive = setActiveChannel;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { sendMessage: sendWithSender, sending: isUploading } = useMessageSender(
    orgId,
    active?.id ?? null,
    user?.id,
  );

  const [tab] = useState<"all" | "channels" | "direct" | "verified">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = [
      ...channels.map((c) => ({
        channel: c,
        title: c.name,
        verified: VERIFIED_CHANNELS.has(c.name),
        last: lastMessageByChannel[c.id],
      })),
      ...threads.map((t) => {
        const otherId = t.user_a === user?.id ? t.user_b : t.user_a;
        const other = senders[otherId];
        return {
          channel: {
            id: t.channel_id,
            name: other?.full_name ?? "DM",
            kind: "dm" as const,
            org_id: orgId ?? "",
          },
          title: other?.full_name ?? "DM",
          verified: false,
          last: lastMessageByChannel[t.channel_id],
        };
      }),
    ];

    // Ensure unique channels by ID
    const uniqueList = Array.from(new Map(list.map((item) => [item.channel.id, item])).values());

    return uniqueList.filter((item) => {
      if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (tab === "channels" && item.channel.kind !== "broadcast") return false;
      if (tab === "direct" && item.channel.kind !== "dm") return false;
      if (tab === "verified" && !item.verified) return false;
      return true;
    });
  }, [channels, threads, search, tab, senders, lastMessageByChannel, user?.id, orgId]);

  const activeOther = useMemo(() => {
    if (!active || active.kind !== "dm" || !user) return null;
    const thread = threads.find((t) => t.channel_id === active.id);
    if (!thread) return null;
    const otherId = thread.user_a === user.id ? thread.user_b : thread.user_a;
    return senders[otherId];
  }, [active, threads, senders, user]);

  const activeTitle =
    active?.kind === "dm" ? (activeOther?.full_name ?? "Direct Message") : (active?.name ?? "");

  const [body, setBody] = useState("");
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<(EventTarget & { stop: () => void; start: () => void }) | null>(
    null,
  );

  const bottom = useRef<HTMLDivElement>(null);
  const activeRef = useRef<Channel | null>(null);
  activeRef.current = active;

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  // Fetch Organization & Profile data
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
    })();
  }, [user, setChannels, setSenders, setThreads, setReads]);

  const fetchReactionsForChannel = useCallback(async (channelId: string) => {
    const { data: currentMsgs } = await supabase
      .from("messages")
      .select("id")
      .eq("channel_id", channelId);

    if (!currentMsgs || currentMsgs.length === 0) {
      setReactions([]);
      return;
    }

    const ids = currentMsgs.map((m) => m.id);
    const { data: rx } = await supabase.from("message_reactions").select("*").in("message_id", ids);

    if (rx) {
      setReactions(rx.map((r) => ({ ...r, message_id: r.message_id })));
    }
  }, []);

  const handleDeleteMessage = async (messageId: string) => {
    const oldMessages = msgs;
    await deleteMessage(messageId);
    try {
      const { error } = await supabase.from("messages").delete().eq("id", messageId);
      if (error) throw error;
      toast.success("Message deleted");
    } catch (err: unknown) {
      setMsgs(oldMessages);
      const message = err instanceof Error ? err.message : "Failed to delete message";
      toast.error(message);
    }
  };

  const handleDeleteChat = async (channelId: string) => {
    const oldThreads = threads;
    await deleteChat(channelId);
    try {
      const { error } = await supabase.from("direct_threads").delete().eq("channel_id", channelId);
      if (error) throw error;
      toast.success("Chat deleted");
    } catch (err: unknown) {
      setThreads(oldThreads);
      const message = err instanceof Error ? err.message : "Failed to delete chat";
      toast.error(message);
    }
  };

  // Real-time message subscription
  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel("comms")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as Msg;
        setMsgs((prev) => {
          if (prev.some((msg) => msg.id === m.id)) return prev;
          return [...prev, m];
        });
        setLastMessageByChannel((prev) => ({ ...prev, [m.channel_id]: m }));
        if (activeRef.current?.id === m.channel_id) {
          supabase.from("message_reads").upsert({
            channel_id: m.channel_id,
            user_id: user!.id,
            last_read_at: new Date().toISOString(),
          });
        } else if (user?.id !== m.sender_id) {
          playMessageChime();
          const sender = senders[m.sender_id]?.full_name ?? "Someone";
          notify(sender, { body: m.body });
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => {
        const oldM = p.old as { id: string };
        setMsgs((prev) => prev.filter((m) => m.id !== oldM.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        if (!activeRef.current) return;
        fetchReactionsForChannel(activeRef.current.id);
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_attachments" },
        (p) => {
          const att = p.new as Attachment;
          setAttachmentsMap((prev) => ({
            ...prev,
            [att.message_id]: [...(prev[att.message_id] || []), att],
          }));
        },
      )
      .subscribe();

    return () => {
      ch.unsubscribe();
    };
  }, [orgId, senders, user, setMsgs, setLastMessageByChannel, fetchReactionsForChannel]);

  // Fetch messages, attachments & reactions when active channel changes
  useEffect(() => {
    if (!active) return;
    setPendingFiles([]);
    setIsRecordingVoice(false);

    supabase
      .from("messages")
      .select("*")
      .eq("channel_id", active.id)
      .order("created_at")
      .then(async ({ data }) => {
        if (!data) return;
        setMsgs(data);
        const ids = data.map((m) => m.id);
        if (ids.length === 0) {
          setReactions([]);
          setAttachmentsMap({});
          return;
        }

        const [{ data: rx }, { data: atts }] = await Promise.all([
          supabase.from("message_reactions").select("*").in("message_id", ids),
          supabase.from("message_attachments").select("*").in("message_id", ids),
        ]);

        if (rx) setReactions(rx.map((r) => ({ ...r, message_id: r.message_id })));

        if (atts) {
          const map: Record<string, Attachment[]> = {};
          for (const a of atts as Attachment[]) {
            (map[a.message_id] ??= []).push(a);
          }
          setAttachmentsMap(map);
        }
      });
  }, [active, setMsgs]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, pendingFiles]);

  const toggleSpeech = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    type SpeechConstructor = new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: (() => void) | null;
      onresult: ((event: unknown) => void) | null;
      onerror: ((event: unknown) => void) | null;
      onend: (() => void) | null;
      stop: () => void;
      start: () => void;
    };

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition: SpeechConstructor }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: SpeechConstructor }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.warn("Microphone access check failed:", err);
        toast.error("Microphone access denied.");
        return;
      }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      toast.info("Listening... Speak now");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) {
        setBody((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognitionRef.current = recognition as any;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleSendMessage = async () => {
    if (!body.trim() && pendingFiles.length === 0) return;
    if (!active || !user || !orgId) return;

    try {
      await sendWithSender(body, pendingFiles);
      setBody("");
      setPendingFiles([]);
      toast.success("Message sent", { duration: 1000 });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send message");
    }
  };

  const handleSendVoiceNote = async (audio: RecordedAudio) => {
    if (!active || !user || !orgId) return;
    try {
      await sendWithSender("", [], audio);
      setIsRecordingVoice(false);
      toast.success("Voice message sent", { duration: 1000 });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send voice message");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const selected = Array.from(e.target.files);

    const tooLarge = selected.filter((f) => f.size > 25 * 1024 * 1024);
    if (tooLarge.length > 0) {
      toast.error(`Some files are too large (max 25MB): ${tooLarge.map((f) => f.name).join(", ")}`);
      return;
    }

    setPendingFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    setActiveReactionPicker(null);
    try {
      await supabase.rpc("toggle_reaction", {
        _emoji: emoji,
        _message: messageId,
      });
      if (active) fetchReactionsForChannel(active.id);
    } catch (e: unknown) {
      console.error("Failed to toggle reaction:", e);
    }
  };

  const onCall = async (kind: "audio" | "video") => {
    if (!active || !user) return;
    try {
      let recipientIds: string[] = [];
      if (active.kind === "dm") {
        if (activeOther) recipientIds = [activeOther.id];
      }
      toast.info(`Booting full ${kind} call screen...`);
      await callController.startCall(active.id, recipientIds, kind);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to start call";
      toast.error(message);
    }
  };

  const startDm = async (otherId: string) => {
    const { data, error } = await supabase.rpc("open_dm", { _other: otherId });
    if (error) return toast.error(error.message);
    if (data) {
      const { data: ch } = await supabase
        .from("channels")
        .select("*")
        .eq("id", data.channel_id)
        .single();
      if (ch) {
        setChannels((prev) => {
          if (prev.find((c) => c.id === ch.id)) return prev;
          return [...prev, ch];
        });
        setActive(ch);
      }
      setNewChannelOpen(false);
    }
  };

  return (
    <div className="-m-4 flex h-[calc(100vh-4.5rem)] flex-col md:-m-6 lg:grid lg:grid-cols-[380px_1fr] animate-fade-up">
      {/* Hidden File Upload Element */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Conversation List Sidebar */}
      <aside
        className={`flex min-h-0 flex-col border-r border-white/5 bg-card/10 backdrop-blur-md ${
          active ? "hidden lg:flex" : "flex"
        }`}
      >
        <div className="border-b border-white/5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold tracking-tight">Chats</h1>
            <div className="flex items-center gap-1">
              <Dialog open={newChannelOpen} onOpenChange={setNewChannelOpen}>
                <DialogTrigger asChild>
                  <button className="rounded-lg p-2 text-accent transition hover:bg-accent/10">
                    <Plus className="h-5 w-5" />
                  </button>
                </DialogTrigger>
                <DialogContent className="glass-strong border-white/10">
                  <DialogHeader>
                    <DialogTitle>Start Conversation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {isAdmin && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                          New Channel
                        </label>
                        <div className="flex gap-2">
                          <input
                            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                            placeholder="channel-name"
                            value={newChannelName}
                            onChange={(e) => setNewChannelName(e.target.value)}
                          />
                          <button
                            className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-primary-foreground"
                            onClick={async () => {
                              if (!user) return;
                              const { error } = await supabase.from("channels").insert({
                                name: newChannelName,
                                kind: "broadcast",
                                org_id: orgId || "",
                                created_by: user.id,
                              });
                              if (!error) {
                                setNewChannelOpen(false);
                                setNewChannelName("");
                                toast.success("Channel created");
                              }
                            }}
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        Direct Message
                      </label>
                      <div className="max-h-[200px] space-y-1 overflow-y-auto pr-1">
                        {Object.values(senders)
                          .filter((s) => s.id !== user?.id)
                          .map((s) => (
                            <button
                              key={s.id}
                              onClick={() => startDm(s.id)}
                              className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-2 text-left transition hover:bg-accent/10"
                            >
                              <div className="grid size-8 place-items-center rounded-full bg-accent/20 font-mono text-[10px] text-accent font-bold">
                                {s.full_name
                                  ?.split(" ")
                                  .map((x) => x[0])
                                  .join("")
                                  .slice(0, 2)}
                              </div>
                              <span className="text-sm font-medium">{s.full_name}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="relative">
            <CallHistoryPanel />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm focus:border-accent/40"
              placeholder="Search chats…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map((c) => (
            <ChatItem
              key={c.channel.id}
              c={c}
              active={active}
              setActive={setActive}
              onLongPress={(e) => {
                const coords = getCoords(e);
                setContextMenu({ x: coords.x, y: coords.y, id: c.channel.id, type: "chat" });
              }}
              isSelectionMode={isSelectionMode}
              isSelected={selectedChats.has(c.channel.id)}
              onToggleSelection={() => {
                const newSelected = new Set(selectedChats);
                if (newSelected.has(c.channel.id)) newSelected.delete(c.channel.id);
                else newSelected.add(c.channel.id);
                setSelectedChats(newSelected);
              }}
            />
          ))}
        </nav>
      </aside>

      {/* Main Chat Canvas */}
      <main
        className={`relative flex min-h-0 flex-col bg-card/5 backdrop-blur-sm ${
          active ? "flex" : "hidden lg:flex"
        }`}
      >
        {active ? (
          <>
            {/* Active Channel Header */}
            <header className="flex items-center justify-between border-b border-white/5 bg-white/5 p-4 backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                <button
                  className="grid size-9 place-items-center rounded-lg bg-white/5 text-muted-foreground transition hover:bg-white/10 lg:hidden"
                  onClick={() => setActive(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="font-display font-semibold tracking-tight">{activeTitle}</h2>
                  {active.kind === "dm" && (
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                      <span className="size-1.5 rounded-full bg-accent animate-pulse" /> Live
                      Connected
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onCall("audio")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 border border-accent/20 text-accent font-medium text-xs hover:bg-accent hover:text-primary-foreground transition-all shadow-sm active:scale-95"
                  title="Boot Full Audio Call Screen"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Audio Call</span>
                </button>

                <button
                  onClick={() => onCall("video")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-frequency text-primary-foreground font-medium text-xs hover:brightness-110 transition-all resonance-glow shadow-sm active:scale-95"
                  title="Boot Full Video Call Screen"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>Video Call</span>
                </button>
              </div>
            </header>

            {/* Active Call Floating Status Banner if call is active */}
            {callController.activeCallId && (
              <div className="p-2 border-b border-white/5 bg-primary/10">
                <CallPanel channelId={active.id} />
              </div>
            )}

            {/* Messages Feed */}
            <div className="flex-1 space-y-6 overflow-y-auto p-6 scrollbar-thin relative">
              {msgs.map((m, i) => {
                const prev = msgs[i - 1];
                const showHeader =
                  !prev ||
                  prev.sender_id !== m.sender_id ||
                  new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 300000;

                const msgAttachments = attachmentsMap[m.id] || [];
                const msgReactions = reactions.filter((r) => r.message_id === m.id);

                // Group reactions by emoji
                const reactionGroups = msgReactions.reduce<
                  Record<string, { count: number; users: string[]; hasReacted: boolean }>
                >((acc, r) => {
                  if (!acc[r.emoji]) {
                    acc[r.emoji] = { count: 0, users: [], hasReacted: false };
                  }
                  acc[r.emoji].count += 1;
                  acc[r.emoji].users.push(r.user_id);
                  if (r.user_id === user?.id) acc[r.emoji].hasReacted = true;
                  return acc;
                }, {});

                return (
                  <MessageItem
                    key={`msg-${m.id}`}
                    m={m}
                    showHeader={showHeader}
                    senders={senders}
                    user={user}
                    msgAttachments={msgAttachments}
                    reactionGroups={reactionGroups}
                    activeReactionPicker={activeReactionPicker}
                    setActiveReactionPicker={setActiveReactionPicker}
                    handleToggleReaction={handleToggleReaction}
                    handleDeleteMessage={handleDeleteMessage}
                    onLongPress={(e) => {
                      const coords = getCoords(e);
                      setContextMenu({ x: coords.x, y: coords.y, id: m.id, type: "message" });
                    }}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedMessages.has(m.id)}
                    onToggleSelection={() => {
                      const newSelected = new Set(selectedMessages);
                      if (newSelected.has(m.id)) newSelected.delete(m.id);
                      else newSelected.add(m.id);
                      setSelectedMessages(newSelected);
                    }}
                  />
                );
              })}
              <div ref={bottom} />
            </div>

            {/* Input Footer & Attachment Preview Area */}
            <footer className="p-4 bg-background/50 backdrop-blur-md border-t border-white/5">
              {/* Pending Files Chip Bar */}
              {pendingFiles.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-3 p-2 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest pl-1">
                    Attachments ({pendingFiles.length}):
                  </span>
                  {pendingFiles.map((file) => (
                    <div
                      key={file.name + file.size}
                      className="flex items-center gap-2 bg-primary/20 border border-primary/30 px-2.5 py-1 rounded-lg text-xs font-medium text-foreground"
                    >
                      <FileText className="size-3.5 text-accent" />
                      <span className="max-w-[140px] truncate">{file.name}</span>
                      <button
                        onClick={() => setPendingFiles((prev) => prev.filter((f) => f !== file))}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Voice Recording Widget OR Normal Input Bar */}
              {isRecordingVoice ? (
                <VoiceRecorder
                  onCancel={() => setIsRecordingVoice(false)}
                  onSend={handleSendVoiceNote}
                />
              ) : (
                <div className="flex items-center gap-2 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10 shadow-lg backdrop-blur-xl transition-all focus-within:ring-accent/30">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="grid size-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                    title="Attach files or images"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>

                  <input
                    className="flex-1 bg-transparent py-2 text-sm focus:outline-none placeholder:text-muted-foreground/60"
                    placeholder={isListening ? "Listening... Speak now" : "Type a message..."}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  />

                  {/* Dictation Microphone */}
                  <button
                    type="button"
                    onClick={toggleSpeech}
                    className={`grid size-10 place-items-center rounded-xl transition-all ${
                      isListening
                        ? "bg-red-500/20 text-red-500 resonance-glow"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    }`}
                    title={isListening ? "Stop listening" : "Speech-to-text dictation"}
                  >
                    <Mic className="h-5 w-5" />
                  </button>

                  {/* Audio Note Recorder Button */}
                  <button
                    type="button"
                    onClick={() => setIsRecordingVoice(true)}
                    className="grid size-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-accent/20 hover:text-accent"
                    title="Record Audio Voice Message"
                  >
                    <span className="relative grid place-items-center">
                      <Mic className="h-5 w-5 text-accent" />
                      <span className="absolute -top-1 -right-1 size-2 rounded-full bg-accent animate-ping" />
                    </span>
                  </button>

                  {/* Send Message Button */}
                  <button
                    className="grid size-10 place-items-center rounded-xl bg-accent text-primary-foreground transition-all active:scale-95 disabled:opacity-30"
                    disabled={(!body.trim() && pendingFiles.length === 0) || isUploading}
                    onClick={handleSendMessage}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            </footer>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="mb-6 grid size-20 place-items-center rounded-[2.5rem] bg-accent/10 text-accent resonance-glow">
              <CymaticWave className="h-8" bars={4} />
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight">Your Resonance Comms</h3>
            <p className="mt-2 max-w-[280px] text-sm text-muted-foreground leading-relaxed">
              Select a conversation or start a new resonance stream with your team.
            </p>
          </div>
        )}
      </main>

      {/* Overlay for selection mode and context menu */}
      {(isSelectionMode || contextMenu) && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => {
            setIsSelectionMode(false);
            setContextMenu(null);
            setSelectedChats(new Set());
            setSelectedMessages(new Set());
          }}
        />
      )}

      {/* Floating Action Bar */}
      {isSelectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-card border border-border rounded-full shadow-2xl z-50">
          <button
            onClick={() => {
              // Implement Archive logic
              setIsSelectionMode(false);
              setSelectedChats(new Set());
              setSelectedMessages(new Set());
            }}
            className="px-4 py-2 rounded-full hover:bg-accent/10"
          >
            Archive
          </button>
          <button
            onClick={() => {
              // Implement Delete logic
              selectedChats.forEach(handleDeleteChat);
              selectedMessages.forEach(handleDeleteMessage);
              setIsSelectionMode(false);
              setSelectedChats(new Set());
              setSelectedMessages(new Set());
            }}
            className="px-4 py-2 rounded-full hover:bg-red-500/10 text-red-500"
          >
            Delete
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-card border border-border rounded-xl shadow-xl p-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 rounded-lg"
            onClick={() => {
              setIsSelectionMode(true);
              if (contextMenu.type === "chat") setSelectedChats(new Set([contextMenu.id]));
              else setSelectedMessages(new Set([contextMenu.id]));
              setContextMenu(null);
            }}
          >
            Select
          </button>
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 rounded-lg"
            onClick={() => {
              if (contextMenu.type === "chat") {
                // Implement Archive
              } else {
                // Implement Archive
              }
              setContextMenu(null);
            }}
          >
            Archive
          </button>
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-red-500/10 text-red-500 rounded-lg"
            onClick={() => {
              if (contextMenu.type === "chat") handleDeleteChat(contextMenu.id);
              else handleDeleteMessage(contextMenu.id);
              setContextMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
