import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Hand,
  Maximize2,
  Minimize2,
  LayoutGrid,
  Monitor,
  Sparkles,
  Volume2,
  MessageSquare,
  X,
  Paperclip,
  Smile,
  Send,
  Loader2,
  FileText,
} from "lucide-react";
import { useCall } from "@/hooks/use-call";
import { supabase } from "@/integrations/supabase/client";
import { CymaticWave } from "@/components/cymatic-wave";
import { RecordAudioMessage, type RecordedAudio } from "@/components/record-audio-message";
import { CommAttachment, type Attachment } from "@/components/comm-attachment";
import { playCallConnected } from "@/lib/notifications";
import { toast } from "sonner";

type Sender = { id: string; full_name: string | null };

type RealtimePayload = {
  type: "broadcast";
  event: string;
  payload: {
    userId: string;
    reaction?: "thumb" | "heart" | "clap" | "fire" | "wow" | "party";
    raised?: boolean;
    burstId?: string;
  };
};

type FloatingReaction = {
  id: string;
  type: "thumb" | "heart" | "clap" | "fire" | "wow" | "party";
  left: number;
  delay: number;
};

type CallMsg = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type Reaction = { id: string; message_id: string; emoji: string; user_id: string };

const EMOJI_OPTIONS = ["👍", "❤️", "👏", "🔥", "😮", "🎉"];

export function CallContainer({
  callId,
  selfId,
  video,
  peers,
  kind,
  onLeave,
}: {
  callId: string;
  selfId: string;
  video: boolean;
  peers: Record<string, Sender>;
  kind: "audio" | "video";
  onLeave: () => void;
}) {
  const { localStream, remotes, micOn, camOn, toggleMic, toggleCam, error } = useCall({
    callId,
    selfId,
    video,
    enabled: true,
  });

  const [duration, setDuration] = useState(0);
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({});
  const [bursts, setBursts] = useState<FloatingReaction[]>([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"stage" | "grid">("stage");
  const [featuredUserId, setFeaturedUserId] = useState<string>(selfId);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const connected = remotes.some((r) => r.state === "connected");
    if (connected && !isConnected) {
      setIsConnected(true);
      playCallConnected();
      toast.success("Call connected");
    }
  }, [remotes, isConnected]);

  // In-Call Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CallMsg[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, Attachment[]>>({});
  const [chatInput, setChatInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Call clock
  useEffect(() => {
    const t = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Consolidate participant video/audio streams
  const allParticipants = useMemo(() => {
    return [
      {
        userId: selfId,
        stream: localStream,
        isSelf: true,
        state: "connected" as RTCPeerConnectionState,
      },
      ...remotes.map((r) => ({
        userId: r.userId,
        stream: r.stream,
        isSelf: false,
        state: r.state,
      })),
    ];
  }, [selfId, localStream, remotes]);

  // Keep featured user valid as participants join/leave
  useEffect(() => {
    const exists = allParticipants.some((p) => p.userId === featuredUserId);
    if (!exists) {
      const firstRemote = allParticipants.find((p) => !p.isSelf);
      setFeaturedUserId(firstRemote ? firstRemote.userId : selfId);
    }
  }, [allParticipants, featuredUserId, selfId]);

  // Lookup orgId & channelId associated with call
  useEffect(() => {
    (async () => {
      const { data: callData } = await supabase
        .from("calls")
        .select("channel_id, org_id")
        .eq("id", callId)
        .maybeSingle();

      if (callData) {
        setChannelId(callData.channel_id);
        setOrgId(callData.org_id);
      }
    })();
  }, [callId]);

  // Real-time synchronization for reactions/hand-raises via broadcast
  useEffect(() => {
    const channelName = `call_room_${callId}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "interaction" }, (response: RealtimePayload) => {
        const { userId, reaction, raised, burstId } = response.payload;

        if (raised !== undefined) {
          setRaisedHands((prev) => ({ ...prev, [userId]: raised }));
        }

        if (reaction && burstId) {
          const newParticles = Array.from({ length: 6 }).map((_, i) => ({
            id: `${burstId}-${i}`,
            type: reaction,
            left: 10 + Math.random() * 80,
            delay: i * 70,
          }));

          setBursts((prev) => [...prev, ...newParticles]);

          setTimeout(() => {
            setBursts((prev) => prev.filter((p) => !p.id.startsWith(burstId)));
          }, 3000);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId]);

  // Fetch & Subscribe to In-Call Chat messages
  const fetchReactions = useCallback(async (cId: string) => {
    const { data: msgs } = await supabase.from("messages").select("id").eq("channel_id", cId);
    if (!msgs || msgs.length === 0) {
      setReactions([]);
      return;
    }
    const ids = msgs.map((m) => m.id);
    const { data: rx } = await supabase.from("message_reactions").select("*").in("message_id", ids);
    if (rx) setReactions(rx.map((r) => ({ ...r, message_id: r.message_id })));
  }, []);

  useEffect(() => {
    if (!channelId) return;

    // Fetch initial messages, attachments, reactions
    supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at")
      .then(async ({ data }) => {
        if (!data) return;
        setMessages(data);
        const ids = data.map((m) => m.id);
        if (ids.length === 0) return;

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

    const ch = supabase
      .channel(`call-chat-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as CallMsg;
        if (m.channel_id === channelId) {
          setMessages((prev) => [...prev, m]);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        fetchReactions(channelId);
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
  }, [channelId, fetchReactions]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (isChatOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isChatOpen, pendingFiles]);

  const leave = async () => {
    try {
      await supabase
        .from("call_participants")
        .update({ state: "left", left_at: new Date().toISOString() })
        .eq("call_id", callId)
        .eq("user_id", selfId);

      const { data: still } = await supabase
        .from("call_participants")
        .select("id")
        .eq("call_id", callId)
        .eq("state", "joined");

      if (!still || still.length === 0) {
        await supabase
          .from("calls")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", callId);
      }
    } catch (e) {
      console.error(e);
    }
    onLeave();
  };

  const toggleHandRaise = () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "interaction",
        payload: { userId: selfId, raised: nextState },
      });
    }
  };

  const triggerReaction = (type: "thumb" | "heart" | "clap" | "fire" | "wow" | "party") => {
    setActiveButton(type);
    setTimeout(() => setActiveButton(null), 500);

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "interaction",
        payload: {
          userId: selfId,
          reaction: type,
          burstId: `burst-${Date.now()}-${Math.random()}`,
        },
      });
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() && pendingFiles.length === 0) return;
    if (!channelId || !orgId) {
      toast.error("In-call chat is initializing...");
      return;
    }

    setIsSending(true);
    try {
      const { data: msg, error: msgErr } = await supabase
        .from("messages")
        .insert({
          org_id: orgId,
          channel_id: channelId,
          sender_id: selfId,
          body: chatInput.trim(),
        })
        .select()
        .single();

      if (msgErr || !msg) throw msgErr ?? new Error("Failed to send");

      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const safe = file.name.replace(/[^\w.-]+/g, "_");
          const path = `${orgId}/${channelId}/${msg.id}/${crypto.randomUUID()}-${safe}`;
          const mime = file.type || "application/octet-stream";
          const kind = mime.startsWith("image/")
            ? "image"
            : mime.startsWith("audio/")
              ? "audio"
              : "file";

          const { error: upErr } = await supabase.storage
            .from("comm-attachments")
            .upload(path, file, { contentType: mime });
          if (!upErr) {
            await supabase.from("message_attachments").insert({
              message_id: msg.id,
              org_id: orgId,
              uploader_id: selfId,
              storage_path: path,
              mime_type: mime,
              size_bytes: file.size,
              kind,
              filename: safe,
            });
          }
        }
      }

      setChatInput("");
      setPendingFiles([]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendVoiceNote = async (audio: RecordedAudio) => {
    if (!channelId || !orgId) return;
    setIsSending(true);
    try {
      const { data: msg, error: msgErr } = await supabase
        .from("messages")
        .insert({
          org_id: orgId,
          channel_id: channelId,
          sender_id: selfId,
          body: "",
        })
        .select()
        .single();

      if (msgErr || !msg) throw msgErr;

      const path = `${orgId}/${channelId}/${msg.id}/voice-${Date.now()}.${audio.ext}`;
      const { error: upErr } = await supabase.storage
        .from("comm-attachments")
        .upload(path, audio.blob, { contentType: audio.mime });

      if (!upErr) {
        await supabase.from("message_attachments").insert({
          message_id: msg.id,
          org_id: orgId,
          uploader_id: selfId,
          storage_path: path,
          mime_type: audio.mime,
          size_bytes: audio.blob.size,
          kind: "audio",
          filename: `voice-${Date.now()}.${audio.ext}`,
          duration_ms: audio.durationMs,
        });
      }

      setIsRecordingVoice(false);
      toast.success("Voice snippet sent in call chat");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send audio message");
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const selected = Array.from(e.target.files);
    setPendingFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setActiveReactionPicker(null);
    try {
      await supabase.rpc("toggle_reaction", {
        _emoji: emoji,
        _message: messageId,
      });
      if (channelId) fetchReactions(channelId);
    } catch (e) {
      console.error("Failed to toggle reaction:", e);
    }
  };

  const mmss = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const featuredParticipant =
    allParticipants.find((p) => p.userId === featuredUserId) || allParticipants[0];

  const sideParticipants = allParticipants.filter((p) => p.userId !== featuredParticipant.userId);

  // If minimized, render floating active call overlay
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 bg-card/95 border border-primary/30 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl animate-fade-up cursor-pointer hover:scale-105 transition-all group"
      >
        <span className="grid size-10 place-items-center rounded-full bg-frequency text-primary-foreground resonance-glow">
          {kind === "video" ? <Video className="size-5" /> : <Mic className="size-5" />}
        </span>
        <div className="flex flex-col min-w-[120px]">
          <span className="text-xs font-bold text-foreground truncate">
            {kind === "video" ? "Video Call Active" : "Audio Call Active"}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
            <span className="size-2 rounded-full bg-accent animate-pulse" /> {mmss(duration)} ·{" "}
            {allParticipants.length} connected
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(false);
          }}
          className="grid size-8 place-items-center rounded-xl bg-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all ml-1"
          title="Expand Call Screen"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-background/98 backdrop-blur-2xl relative overflow-hidden select-none">
      {/* Hidden File Upload Selector */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Atmospheric Visual Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/30 rounded-full filter blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/20 rounded-full filter blur-[100px]" />
      </div>

      {/* Floating Particles Reactions */}
      <div className="absolute inset-x-0 bottom-36 top-16 pointer-events-none z-40 overflow-hidden">
        {bursts.map((particle) => (
          <div
            key={particle.id}
            className="absolute bottom-0 text-5xl animate-float-up opacity-0 filter drop-shadow-[0_10px_8px_rgba(0,0,0,0.5)]"
            style={{
              left: `${particle.left}%`,
              animationDelay: `${particle.delay}ms`,
            }}
          >
            {particle.type === "thumb" && "👍"}
            {particle.type === "heart" && "❤️"}
            {particle.type === "clap" && "👏"}
            {particle.type === "fire" && "🔥"}
            {particle.type === "wow" && "😮"}
            {particle.type === "party" && "🎉"}
          </div>
        ))}
      </div>

      {/* Call Header Bar */}
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-3.5 w-full bg-background/80 backdrop-blur-xl z-50 shrink-0">
        <div className="flex items-center gap-3.5">
          <span className="grid size-10 place-items-center rounded-2xl bg-frequency text-primary-foreground resonance-glow">
            {kind === "video" ? <Video className="size-5" /> : <Mic className="size-5" />}
          </span>
          <div>
            <div className="font-display text-sm md:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{kind === "video" ? "Video Call Stage" : "Audio Call Stage"}</span>
              <span className="text-[10px] font-mono font-normal uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                Live
              </span>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 text-accent font-semibold">
                <span className="size-2 rounded-full bg-accent animate-pulse" /> {mmss(duration)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-foreground/80">
                <Users className="size-3.5 text-primary" /> {allParticipants.length} Member
                {allParticipants.length !== 1 ? "s" : ""} in Call
              </span>
            </div>
          </div>
        </div>

        {/* View Switchers, In-Call Chat Toggle, & Minimize */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setViewMode("stage")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "stage"
                  ? "bg-accent text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              <Monitor className="size-3.5" /> Speaker View
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "grid"
                  ? "bg-accent text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              <LayoutGrid className="size-3.5" /> Gallery Grid ({allParticipants.length})
            </button>
          </div>

          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all relative ${
              isChatOpen
                ? "bg-accent border-accent text-primary-foreground shadow-lg"
                : "bg-white/5 border-white/10 text-foreground hover:bg-white/10"
            }`}
            title="Toggle In-Call Chat Panel"
          >
            <MessageSquare className="size-4" />
            <span className="hidden md:inline">In-Call Chat</span>
            {messages.length > 0 && !isChatOpen && (
              <span className="absolute -top-1 -right-1 size-3 bg-accent rounded-full border-2 border-background animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            className="grid size-9 place-items-center rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
            title="Minimize Call Window"
          >
            <Minimize2 className="size-4" />
          </button>
        </div>
      </header>

      {/* Main Call View + In-Call Chat Drawer */}
      <main className="flex-1 min-h-0 w-full p-4 md:p-6 overflow-hidden flex gap-4 z-30 relative">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-destructive/20 border border-destructive/30 p-3 text-center text-xs font-medium text-destructive animate-bounce">
            {error}
          </div>
        )}

        {/* Call Stage Area */}
        <div className="flex-1 min-h-0 flex flex-col h-full">
          {/* SPEAKER / STAGE VIEW MODE */}
          {viewMode === "stage" ? (
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_260px] lg:grid-cols-[1fr_300px] gap-4 h-full">
              {/* Main Wide-Screen Speaker Container */}
              <div className="flex-1 min-h-0 flex flex-col relative rounded-3xl bg-black/80 ring-2 ring-primary/30 shadow-2xl overflow-hidden group">
                <StageTile
                  stream={featuredParticipant.stream}
                  name={
                    peers[featuredParticipant.userId]?.full_name ??
                    (featuredParticipant.isSelf ? "You" : "Participant")
                  }
                  isSelf={featuredParticipant.isSelf}
                  state={featuredParticipant.state}
                  video={video}
                  isHandRaised={!!raisedHands[featuredParticipant.userId]}
                />

                {/* Speaker Stage Header Tag */}
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-primary">
                    <Sparkles className="size-3 text-accent animate-spin-slow" /> Active Wide
                    Display
                  </span>
                  {allParticipants.length > 1 && (
                    <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-black/50 backdrop-blur-md border border-white/5 text-[10px] font-mono text-muted-foreground">
                      Click any gallery thumbnail to feature speaker
                    </span>
                  )}
                </div>
              </div>

              {/* Side-Bar Gallery for Other Participants */}
              {allParticipants.length > 1 && (
                <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto pr-1 pb-2 md:pb-0 scrollbar-thin max-h-[160px] md:max-h-full shrink-0">
                  <div className="hidden md:flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted-foreground px-1 py-1">
                    <span>Call Members ({sideParticipants.length})</span>
                    <span className="text-[10px] text-accent font-semibold">Tap to focus</span>
                  </div>

                  {sideParticipants.map((p, i) => (
                    <ThumbnailTile
                      key={`thumb-${p.userId}-${i}`}
                      stream={p.stream}
                      name={peers[p.userId]?.full_name ?? (p.isSelf ? "You" : "Participant")}
                      isSelf={p.isSelf}
                      video={video}
                      isHandRaised={!!raisedHands[p.userId]}
                      onClick={() => setFeaturedUserId(p.userId)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* FLEXIBLE GALLERY GRID VIEW MODE */
            <div
              className={`grid flex-1 gap-4 overflow-y-auto p-2 scrollbar-thin ${gridColsClass(
                allParticipants.length,
              )}`}
            >
              {allParticipants.map((p, i) => (
                <div
                  key={`grid-${p.userId}-${i}`}
                  onClick={() => {
                    setFeaturedUserId(p.userId);
                    setViewMode("stage");
                  }}
                  className="cursor-pointer group/grid transition-all transform hover:scale-[1.01]"
                >
                  <GridTile
                    stream={p.stream}
                    name={peers[p.userId]?.full_name ?? (p.isSelf ? "You" : "Participant")}
                    isSelf={p.isSelf}
                    state={p.state}
                    video={video}
                    isHandRaised={!!raisedHands[p.userId]}
                    isFeatured={p.userId === featuredUserId}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* IN-CALL CHAT SIDEBAR DRAWER */}
        {isChatOpen && (
          <aside className="w-full md:w-[340px] lg:w-[380px] h-full flex flex-col bg-card/95 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-2xl overflow-hidden shrink-0 animate-fade-left">
            <header className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-accent" />
                <span className="font-display text-sm font-bold text-foreground">
                  In-Call Chat & Media
                </span>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="grid size-8 place-items-center rounded-xl bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
              >
                <X className="size-4" />
              </button>
            </header>

            {/* Chat Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <MessageSquare className="size-10 text-primary/40 mb-2 animate-bounce" />
                  <p className="text-xs font-medium">No messages yet in this call session.</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Send text, audio notes, images, or files to call members.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMine = m.sender_id === selfId;
                  const senderName =
                    peers[m.sender_id]?.full_name ?? (isMine ? "You" : "Participant");
                  const msgAttachments = attachmentsMap[m.id] || [];
                  const msgReactions = reactions.filter((r) => r.message_id === m.id);

                  const reactionGroups = msgReactions.reduce<
                    Record<string, { count: number; users: string[]; hasReacted: boolean }>
                  >((acc, r) => {
                    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [], hasReacted: false };
                    acc[r.emoji].count += 1;
                    acc[r.emoji].users.push(r.user_id);
                    if (r.user_id === selfId) acc[r.emoji].hasReacted = true;
                    return acc;
                  }, {});

                  return (
                    <div
                      key={`call-msg-${m.id}`}
                      className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
                        <span className="font-bold text-foreground">{senderName}</span>
                        <span>
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {m.body && (
                        <div
                          className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed max-w-[85%] break-words ${
                            isMine
                              ? "bg-accent text-primary-foreground font-medium rounded-tr-none shadow-md"
                              : "bg-white/10 text-foreground rounded-tl-none border border-white/5"
                          }`}
                        >
                          {m.body}
                        </div>
                      )}

                      {/* Attachments */}
                      {msgAttachments.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-1 max-w-[85%]">
                          {msgAttachments.map((att, j) => (
                            <CommAttachment key={`${att.id}-${j}`} a={att} mine={isMine} />
                          ))}
                        </div>
                      )}

                      {/* Reactions Badges */}
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        {Object.entries(reactionGroups).map(([emoji, g]) => (
                          <button
                            key={emoji}
                            onClick={() => handleToggleReaction(m.id, emoji)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] transition-all border ${
                              g.hasReacted
                                ? "bg-accent/20 border-accent/50 text-accent font-bold"
                                : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="font-mono">{g.count}</span>
                          </button>
                        ))}

                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveReactionPicker(activeReactionPicker === m.id ? null : m.id)
                            }
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="React with Emoji"
                          >
                            <Smile className="size-3.5" />
                          </button>

                          {activeReactionPicker === m.id && (
                            <div className="absolute right-0 bottom-full mb-1 z-50 flex items-center gap-1 bg-card border border-white/10 p-1.5 rounded-2xl shadow-xl backdrop-blur-xl animate-fade-up">
                              {EMOJI_OPTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(m.id, emoji)}
                                  className="p-1 hover:bg-white/10 rounded-xl text-sm transition-transform active:scale-125"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input & Attachments Selector */}
            <footer className="p-3 border-t border-white/10 bg-black/40 flex flex-col gap-2">
              {/* Pending Files Bar */}
              {pendingFiles.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase pl-1">
                    Attachments ({pendingFiles.length}):
                  </span>
                  {pendingFiles.map((file) => (
                    <div
                      key={file.name + file.size}
                      className="flex items-center gap-1 bg-primary/20 border border-primary/30 px-2 py-0.5 rounded-lg text-[11px] font-medium text-foreground"
                    >
                      <FileText className="size-3 text-accent" />
                      <span className="max-w-[100px] truncate">{file.name}</span>
                      <button
                        onClick={() => setPendingFiles((prev) => prev.filter((f) => f !== file))}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Record Audio Snippet Component OR Normal Text Input */}
              {isRecordingVoice ? (
                <RecordAudioMessage
                  onCancel={() => setIsRecordingVoice(false)}
                  onSend={handleSendVoiceNote}
                />
              ) : (
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 p-1.5 rounded-2xl focus-within:border-accent/40 transition-all">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="grid size-8 place-items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                    title="Attach Files / Images / Documents"
                  >
                    <Paperclip className="size-4" />
                  </button>

                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    placeholder="Type call message..."
                    className="flex-1 bg-transparent text-xs text-foreground focus:outline-none placeholder:text-muted-foreground/60 px-1"
                  />

                  <button
                    type="button"
                    onClick={() => setIsRecordingVoice(true)}
                    className="grid size-8 place-items-center rounded-xl text-accent hover:bg-accent/20 transition-all relative"
                    title="Record Audio Message Snippet"
                  >
                    <Mic className="size-4" />
                    <span className="absolute top-1 right-1 size-1.5 rounded-full bg-accent animate-ping" />
                  </button>

                  <button
                    onClick={handleSendMessage}
                    disabled={(!chatInput.trim() && pendingFiles.length === 0) || isSending}
                    className="grid size-8 place-items-center rounded-xl bg-accent text-primary-foreground hover:brightness-110 disabled:opacity-40 transition-all active:scale-95"
                  >
                    {isSending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                  </button>
                </div>
              )}
            </footer>
          </aside>
        )}
      </main>

      {/* Control Bar Footer */}
      <footer className="flex flex-col gap-3 border-t border-white/10 p-4 md:px-8 bg-background/90 backdrop-blur-xl z-50 shrink-0">
        {/* Live Reactions Bar */}
        <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap">
          {[
            { type: "thumb", emoji: "👍", label: "Thumbs Up" },
            { type: "heart", emoji: "❤️", label: "Heart" },
            { type: "clap", emoji: "👏", label: "Clap" },
            { type: "fire", emoji: "🔥", label: "Fire" },
            { type: "wow", emoji: "😮", label: "Surprised" },
            { type: "party", emoji: "🎉", label: "Party" },
          ].map((r) => (
            <button
              key={r.type}
              onClick={() => triggerReaction(r.type as FloatingReaction["type"])}
              className={`flex size-10 md:size-11 items-center justify-center rounded-2xl border text-lg transition-all duration-300 transform active:scale-90 ${
                activeButton === r.type
                  ? "bg-accent/30 border-accent scale-125 grayscale-0 opacity-100 shadow-lg"
                  : "bg-white/5 border-white/10 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:bg-white/10"
              }`}
              title={r.label}
            >
              {r.emoji}
            </button>
          ))}

          <div className="w-px h-7 bg-white/10 mx-1 hidden sm:block" />

          <button
            onClick={toggleHandRaise}
            className={`flex items-center gap-2 px-4 h-10 md:h-11 rounded-2xl transition-all border font-semibold text-xs tracking-wide active:scale-95 ${
              isHandRaised
                ? "bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/20 animate-pulse"
                : "bg-white/5 border-white/10 text-foreground hover:bg-white/10"
            }`}
          >
            <Hand className={`size-4 ${isHandRaised ? "animate-bounce" : ""}`} />
            <span>{isHandRaised ? "Hand Raised" : "Raise Hand"}</span>
          </button>
        </div>

        {/* Primary Hardware Call Controls */}
        <div className="flex items-center justify-center gap-4 pt-1">
          <button
            onClick={toggleMic}
            className={`grid size-12 md:size-14 place-items-center rounded-2xl transition-all shadow-lg ${
              micOn
                ? "bg-white/10 text-foreground hover:bg-white/20 border border-white/10"
                : "bg-destructive text-destructive-foreground shadow-destructive/20"
            }`}
            aria-label="Toggle microphone"
            title={micOn ? "Mute Microphone" : "Unmute Microphone"}
          >
            {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </button>

          {video && (
            <button
              onClick={toggleCam}
              className={`grid size-12 md:size-14 place-items-center rounded-2xl transition-all shadow-lg ${
                camOn
                  ? "bg-white/10 text-foreground hover:bg-white/20 border border-white/10"
                  : "bg-destructive text-destructive-foreground shadow-destructive/20"
              }`}
              aria-label="Toggle camera"
              title={camOn ? "Turn Camera Off" : "Turn Camera On"}
            >
              {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
            </button>
          )}

          <button
            onClick={leave}
            className="grid size-12 md:size-14 place-items-center rounded-2xl bg-destructive text-destructive-foreground transition-all hover:brightness-110 shadow-lg shadow-destructive/30 active:scale-95"
            aria-label="Leave call"
            title="End / Leave Call"
          >
            <PhoneOff className="size-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}

/* Stage Tile — Wide Main Display Speaker Container */
function StageTile({
  stream,
  name,
  isSelf,
  state,
  video,
  isHandRaised,
}: {
  stream: MediaStream | null;
  name: string;
  isSelf: boolean;
  state: RTCPeerConnectionState;
  video: boolean;
  isHandRaised: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const hasVideo =
    video && stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");

  return (
    <div className="relative size-full flex items-center justify-center overflow-hidden">
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className="size-full object-cover"
        />
      ) : (
        <div className="grid size-full place-items-center bg-gradient-to-br from-primary/20 via-background to-accent/10 relative overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 top-1/2 opacity-30 pointer-events-none flex items-center justify-center">
            <CymaticWave className="h-32 w-full max-w-2xl" bars={24} />
          </div>

          <div className="flex flex-col items-center gap-4 z-10">
            <div
              className={`grid size-28 md:size-36 place-items-center rounded-full bg-frequency text-4xl md:text-5xl font-bold text-primary-foreground resonance-glow shadow-2xl transition-transform ${
                isHandRaised ? "border-4 border-amber-500 scale-110" : ""
              }`}
            >
              {name.charAt(0).toUpperCase()}
            </div>

            <div className="text-center">
              <div className="font-display text-xl md:text-2xl font-bold text-foreground">
                {name} {isSelf && "(You)"}
              </div>
              <div className="font-mono text-xs text-muted-foreground mt-1 flex items-center justify-center gap-2">
                <Volume2 className="size-3.5 text-accent animate-pulse" /> Audio Stream Active
              </div>
            </div>
          </div>

          {stream && !video && (
            <audio
              ref={(el) => {
                if (el && stream && !isSelf) el.srcObject = stream;
              }}
              autoPlay
            />
          )}
        </div>
      )}

      {/* Participant Footer Tag */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl bg-black/80 px-4 py-2.5 backdrop-blur-xl border border-white/10 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm font-semibold text-foreground">
            {name} {isSelf && "(You)"}
          </span>
          <span
            className={`size-2 rounded-full ${
              state === "connected"
                ? "bg-accent"
                : state === "failed" || state === "disconnected"
                  ? "bg-destructive"
                  : "bg-amber-400 animate-ping"
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          {isHandRaised && (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/20 px-2.5 py-1 rounded-xl border border-amber-500/30">
              <Hand className="size-3.5 animate-bounce" /> Hand Raised
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* Thumbnail Tile — Compact Side Container */
function ThumbnailTile({
  stream,
  name,
  isSelf,
  video,
  isHandRaised,
  onClick,
}: {
  stream: MediaStream | null;
  name: string;
  isSelf: boolean;
  video: boolean;
  isHandRaised: boolean;
  onClick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const hasVideo =
    video && stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");

  return (
    <div
      onClick={onClick}
      className={`group/thumb relative w-36 h-28 shrink-0 md:w-full md:h-36 rounded-2xl overflow-hidden bg-card border-2 cursor-pointer transition-all duration-200 transform hover:scale-[1.02] shadow-md ${
        isHandRaised
          ? "border-amber-500 shadow-amber-500/20"
          : "border-white/10 hover:border-accent"
      }`}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className="size-full object-cover"
        />
      ) : (
        <div className="grid size-full place-items-center bg-gradient-to-br from-primary/10 to-accent/10">
          <div className="grid size-12 place-items-center rounded-full bg-frequency text-lg font-bold text-primary-foreground">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Hover Promote Hint */}
      <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover/thumb:opacity-100 backdrop-blur-[2px] transition-opacity flex items-center justify-center p-2 text-center">
        <span className="text-[10px] font-bold text-primary-foreground bg-black/70 px-2.5 py-1 rounded-xl border border-white/20 shadow-lg">
          Promote to Main Stage
        </span>
      </div>

      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-lg bg-black/80 px-2 py-1 backdrop-blur-md border border-white/5">
        <span className="truncate text-[10px] font-medium text-foreground">
          {name} {isSelf && "(You)"}
        </span>
        {isHandRaised && <Hand className="size-3 text-amber-400 animate-bounce" />}
      </div>
    </div>
  );
}

/* Grid Tile — Equal Responsive Container */
function GridTile({
  stream,
  name,
  isSelf,
  state,
  video,
  isHandRaised,
  isFeatured,
}: {
  stream: MediaStream | null;
  name: string;
  isSelf: boolean;
  state: RTCPeerConnectionState;
  video: boolean;
  isHandRaised: boolean;
  isFeatured: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const hasVideo =
    video && stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");

  return (
    <div
      className={`relative min-h-[200px] md:min-h-[260px] rounded-2xl overflow-hidden bg-card border-2 transition-all ${
        isFeatured
          ? "border-primary ring-2 ring-primary/40"
          : isHandRaised
            ? "border-amber-500 shadow-lg shadow-amber-500/10"
            : "border-white/10 hover:border-accent/50"
      }`}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className="size-full object-cover"
        />
      ) : (
        <div className="grid size-full place-items-center bg-gradient-to-br from-primary/20 to-accent/10 p-6">
          <div className="grid size-20 place-items-center rounded-full bg-frequency text-2xl font-bold text-primary-foreground resonance-glow">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Hover Promote Hint */}
      <div className="absolute inset-0 bg-primary/30 opacity-0 hover:opacity-100 backdrop-blur-[1px] transition-opacity flex items-center justify-center p-2 text-center pointer-events-none">
        <span className="text-xs font-bold text-primary-foreground bg-black/70 px-3 py-1.5 rounded-xl border border-white/20 shadow-lg">
          Promote to Main Stage
        </span>
      </div>

      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-black/80 px-3 py-1.5 backdrop-blur-md border border-white/10">
        <span className="truncate text-xs font-medium text-foreground">
          {name} {isSelf && "(You)"}
        </span>
        <div className="flex items-center gap-1.5">
          {isHandRaised && <Hand className="size-3.5 text-amber-400 animate-bounce" />}
          <span
            className={`size-1.5 rounded-full ${
              state === "connected" ? "bg-accent" : "bg-amber-400"
            }`}
          />
        </div>
      </div>
    </div>
  );
}

function gridColsClass(n: number) {
  if (n <= 1) return "grid-cols-1 max-w-3xl mx-auto";
  if (n === 2) return "grid-cols-1 md:grid-cols-2";
  if (n <= 4) return "grid-cols-2";
  if (n <= 9) return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
  return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";
}
