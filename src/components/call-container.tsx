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
  WifiOff,
  Wifi,
} from "lucide-react";
import { ConnectionQuality } from "livekit-client";
import { useLiveKitCall } from "@/hooks/use-livekit-call";
import { supabase } from "@/integrations/supabase/client";
import { CymaticWave } from "@/components/cymatic-wave";
import { RecordAudioMessage, type RecordedAudio } from "@/components/record-audio-message";
import { CommAttachment, type Attachment } from "@/components/comm-attachment";
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

interface TileProps {
  stream: MediaStream | null;
  name: string;
  isSelf: boolean;
  video: boolean;
  isHandRaised: boolean;
  isMuted: boolean;
}

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
  const {
    localStream,
    remotes,
    micOn,
    camOn,
    networkQuality,
    isCallAnswered,
    toggleMic,
    toggleCam,
    error,
  } = useLiveKitCall({
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
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Dial Tone Synthesizer while waiting for recipient to answer
  useEffect(() => {
    if (isCallAnswered) return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime); // Ringing frequency
      gain.gain.setValueAtTime(0.05, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      return () => {
        osc.stop();
        ctx.close();
      };
    } catch (e) {
      console.warn("AudioContext ring synth blocked by browser autoplay policy");
    }
  }, [isCallAnswered]);

  // Call duration counter — STAYS AT 0 UNTIL RECIPIENT ANSWERS
  useEffect(() => {
    if (!isCallAnswered) return;
    const t = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, [isCallAnswered]);

  // Consolidate participant streams
  const allParticipants = useMemo(() => {
    return [
      {
        userId: selfId,
        stream: localStream,
        isSelf: true,
        quality: networkQuality,
      },
      ...remotes.map((r) => ({
        userId: r.userId,
        stream: r.stream,
        isSelf: false,
        quality: r.connectionQuality,
      })),
    ];
  }, [selfId, localStream, networkQuality, remotes]);

  useEffect(() => {
    const exists = allParticipants.some((p) => p.userId === featuredUserId);
    if (!exists) {
      const firstRemote = allParticipants.find((p) => !p.isSelf);
      setFeaturedUserId(firstRemote ? firstRemote.userId : selfId);
    }
  }, [allParticipants, featuredUserId, selfId]);

  // Channel & Call Org lookup
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

  // Realtime Broadcast Channel
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
    if (!channelId || !orgId) return;

    setIsSending(true);
    try {
      const { data: msg, error: msgErr } = await supabase
        .from("messages")
        .insert({ org_id: orgId, channel_id: channelId, sender_id: selfId, body: chatInput.trim() })
        .select()
        .single();

      if (msgErr || !msg) throw msgErr;

      setChatInput("");
      setPendingFiles([]);
    } catch (e) {
      toast.error("Failed to send message in call");
    } finally {
      setIsSending(false);
    }
  };

  const mmss = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const featuredParticipant =
    allParticipants.find((p) => p.userId === featuredUserId) || allParticipants[0];

  const isLowBandwidth =
    networkQuality === ConnectionQuality.Poor || networkQuality === ConnectionQuality.Lost;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-background/98 backdrop-blur-2xl relative overflow-hidden select-none">
      {/* Weak Connection / Low-Bandwidth Alert Overlay */}
      {isLowBandwidth && (
        <div className="absolute top-2 inset-x-4 z-50 flex items-center justify-center gap-2 bg-amber-500/90 text-black px-4 py-2 rounded-2xl font-bold text-xs shadow-xl animate-pulse">
          <WifiOff className="size-4" />
          <span>
            Weak connection detected (Low Bandwidth / 2 Mbps link). Adjusting media quality...
          </span>
        </div>
      )}

      {/* Atmospheric Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/30 rounded-full filter blur-[120px] animate-pulse" />
      </div>

      {/* Floating Particles Reactions */}
      <div className="absolute inset-x-0 bottom-36 top-16 pointer-events-none z-40 overflow-hidden">
        {bursts.map((particle) => (
          <div
            key={particle.id}
            className="absolute bottom-0 text-5xl animate-float-up opacity-0 filter drop-shadow-[0_10px_8px_rgba(0,0,0,0.5)]"
            style={{ left: `${particle.left}%`, animationDelay: `${particle.delay}ms` }}
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
              <span>{kind === "video" ? "Cymatic Video Call" : "Cymatic Audio Call"}</span>
              <span
                className={`text-[10px] font-mono font-normal uppercase tracking-wider px-2 py-0.5 rounded-full border ${isCallAnswered ? "bg-accent/20 text-accent border-accent/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse"}`}
              >
                {isCallAnswered ? "Connected" : "Ringing..."}
              </span>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 text-accent font-semibold">
                <span className="size-2 rounded-full bg-accent animate-pulse" />{" "}
                {isCallAnswered ? mmss(duration) : "Calling recipient"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-foreground/80">
                <Users className="size-3.5 text-primary" /> {allParticipants.length} Member
                {allParticipants.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("stage")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${viewMode === "stage" ? "bg-accent text-primary-foreground" : "bg-white/5 text-muted-foreground"}`}
          >
            Speaker
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${viewMode === "grid" ? "bg-accent text-primary-foreground" : "bg-white/5 text-muted-foreground"}`}
          >
            Grid ({allParticipants.length})
          </button>
        </div>
      </header>

      {/* Main Call Stage */}
      <main className="flex-1 min-h-0 w-full p-4 md:p-6 overflow-hidden flex gap-4 z-30 relative">
        <div className="flex-1 min-h-0 flex flex-col h-full">
          {viewMode === "stage" ? (
            <div className="flex-1 min-h-0 relative rounded-3xl bg-black/80 ring-2 ring-primary/30 shadow-2xl overflow-hidden">
              <StageTile
                stream={featuredParticipant.stream}
                name={
                  peers[featuredParticipant.userId]?.full_name ??
                  (featuredParticipant.isSelf ? "You" : "Participant")
                }
                isSelf={featuredParticipant.isSelf}
                video={video}
                isHandRaised={!!raisedHands[featuredParticipant.userId]}
                isMuted={featuredParticipant.isSelf ? !micOn : false}
              />
            </div>
          ) : (
            <div
              className={`grid flex-1 gap-4 overflow-y-auto p-2 scrollbar-thin ${gridColsClass(allParticipants.length)}`}
            >
              {allParticipants.map((p, i) => (
                <GridTile
                  key={`grid-${p.userId}-${i}`}
                  stream={p.stream}
                  name={peers[p.userId]?.full_name ?? (p.isSelf ? "You" : "Participant")}
                  isSelf={p.isSelf}
                  video={video}
                  isHandRaised={!!raisedHands[p.userId]}
                  isMuted={p.isSelf ? !micOn : false}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Control Bar Footer */}
      <footer className="flex flex-col gap-3 border-t border-white/10 p-4 md:px-8 bg-background/90 backdrop-blur-xl z-50 shrink-0">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMic}
            className={`grid size-12 place-items-center rounded-2xl ${micOn ? "bg-white/10 text-foreground" : "bg-destructive text-destructive-foreground"}`}
          >
            {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </button>

          {video && (
            <button
              onClick={toggleCam}
              className={`grid size-12 place-items-center rounded-2xl ${camOn ? "bg-white/10 text-foreground" : "bg-destructive text-destructive-foreground"}`}
            >
              {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
            </button>
          )}

          <button
            onClick={leave}
            className="grid size-12 place-items-center rounded-2xl bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30"
          >
            <PhoneOff className="size-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function StageTile({ stream, name, isSelf, video, isHandRaised, isMuted }: TileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideoTrack =
    video &&
    stream &&
    stream.getVideoTracks().some((t: MediaStreamTrack) => t.enabled && t.readyState === "live");

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = hasVideoTrack ? stream : null;
    }
  }, [stream, hasVideoTrack]);

  return (
    <div className="relative size-full flex items-center justify-center overflow-hidden">
      {hasVideoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className="size-full object-cover"
        />
      ) : (
        <div className="grid size-full place-items-center bg-gradient-to-br from-primary/20 via-background to-accent/10">
          <div className="grid size-28 place-items-center rounded-full bg-frequency text-4xl font-bold text-primary-foreground resonance-glow">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="font-display text-xl font-bold text-foreground mt-4">
            {name} {isSelf && "(You)"}
          </div>
        </div>
      )}

      {!isSelf && stream && (
        <audio
          ref={(el) => {
            if (el) el.srcObject = stream;
          }}
          autoPlay
        />
      )}
    </div>
  );
}

function GridTile({ stream, name, isSelf, video, isHandRaised, isMuted }: TileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideoTrack =
    video &&
    stream &&
    stream.getVideoTracks().some((t: MediaStreamTrack) => t.enabled && t.readyState === "live");

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = hasVideoTrack ? stream : null;
    }
  }, [stream, hasVideoTrack]);

  return (
    <div className="relative min-h-[200px] rounded-2xl overflow-hidden bg-card border border-white/10">
      {hasVideoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className="size-full object-cover"
        />
      ) : (
        <div className="grid size-full place-items-center bg-primary/20 p-6">
          <div className="grid size-16 place-items-center rounded-full bg-frequency text-xl font-bold text-primary-foreground">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 text-xs font-bold bg-black/60 px-2 py-1 rounded-md">
        {name}
      </div>
    </div>
  );
}

function gridColsClass(n: number) {
  if (n <= 1) return "grid-cols-1 max-w-3xl mx-auto";
  if (n === 2) return "grid-cols-1 md:grid-cols-2";
  if (n <= 4) return "grid-cols-2";
  return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4";
}
