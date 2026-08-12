import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Hand,
  Minimize,
  Maximize,
} from "lucide-react";
import { useCall } from "@/hooks/use-call";
import { supabase } from "@/integrations/supabase/client";

type Sender = { id: string; full_name: string | null };

type RealtimePayload = {
  type: "broadcast";
  event: string;
  payload: {
    userId: string;
    reaction?: "thumb" | "heart" | "clap";
    raised?: boolean;
    burstId?: string;
  };
};

type FloatingReaction = {
  id: string;
  type: "thumb" | "heart" | "clap";
  left: number;
  delay: number;
};

export function CallRoom({
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
  const [minimized, setMinimized] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({});
  const [bursts, setBursts] = useState<FloatingReaction[]>([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [activeButton, setActiveButton] = useState<"thumb" | "heart" | "clap" | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Call duration clock tracking live execution
  useEffect(() => {
    const t = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Real-time synchronization layer for Reactions and Raised Hands via Supabase Broadcast
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
          // Explode 6 simultaneous floating elements spread out dynamically across screen real-estate
          const newParticles = Array.from({ length: 6 }).map((_, i) => ({
            id: `${burstId}-${i}`,
            type: reaction,
            left: 15 + Math.random() * 70, // Spread nicely across wide container structures
            delay: i * 80, // Micro-staggered kinetic releases
          }));

          setBursts((prev) => [...prev, ...newParticles]);

          // Clean up particles out of active memory when animation bounds expire
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

  const triggerReaction = (type: "thumb" | "heart" | "clap") => {
    setActiveButton(type);
    setTimeout(() => setActiveButton(null), 500); // Reset touch shake duration frame

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

  const mmss = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const all = [
    {
      userId: selfId,
      stream: localStream,
      isSelf: true,
      state: "connected" as RTCPeerConnectionState,
    },
    ...remotes.map((r) => ({ userId: r.userId, stream: r.stream, isSelf: false, state: r.state })),
  ];

  return (
    <div
      className={`fixed z-50 flex flex-col bg-background/95 backdrop-blur-xl relative overflow-hidden selection:bg-primary/30 ${minimized ? "bottom-4 right-4 w-64 h-48 rounded-2xl border border-white/10 shadow-2xl" : "inset-0"}`}
    >
      {/* Particle Overlay Plane */}
      <div className="absolute inset-x-0 bottom-36 top-0 pointer-events-none z-40 overflow-hidden">
        {bursts.map((particle) => (
          <div
            key={particle.id}
            className="absolute bottom-0 text-5xl animate-float-up opacity-0 filter drop-shadow-[0_10px_8px_rgba(0,0,0,0.4)]"
            style={{
              left: `${particle.left}%`,
              animationDelay: `${particle.delay}ms`,
            }}
          >
            {particle.type === "thumb" && "👍"}
            {particle.type === "heart" && "❤️"}
            {particle.type === "clap" && "👏"}
          </div>
        ))}
      </div>

      {/* Extended Width Workspace Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-8 py-4 w-full">
        <div className="flex items-center gap-4">
          <span className="grid size-10 place-items-center rounded-full bg-frequency text-primary-foreground resonance-glow">
            {kind === "video" ? <Video className="size-5" /> : <Mic className="size-5" />}
          </span>
          {!minimized && (
            <div>
              <div className="font-display text-base font-semibold tracking-wide text-foreground">
                {kind === "video"
                  ? "Cymatic Resonance Video Stream"
                  : "Cymatic Resonance Audio Workspace"}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <span className="text-accent animate-pulse">●</span> live · {mmss(duration)}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setMinimized(!minimized)}
          className="p-2 hover:bg-white/5 rounded-lg"
        >
          {minimized ? <Maximize className="size-4" /> : <Minimize className="size-4" />}
        </button>
        <div className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-medium text-muted-foreground ring-1 ring-white/10">
          <Users className="size-4 text-primary" /> {all.length} Execution Partners Connected
        </div>
      </header>

      {/* Main Stream Matrix Display - Stretched wide to support expanded layout design */}
      <div
        className={`grid flex-1 gap-4 p-6 w-full max-w-[1800px] mx-auto ${gridCols(all.length)}`}
      >
        {all.map((p) => (
          <Tile
            key={p.userId}
            stream={p.stream}
            name={peers[p.userId]?.full_name ?? (p.isSelf ? "You" : "Execution Member")}
            isSelf={p.isSelf}
            state={p.state}
            video={video}
            isHandRaised={!!raisedHands[p.userId]}
          />
        ))}
      </div>

      {error && (
        <div className="mx-auto mb-4 max-w-md rounded-xl bg-destructive/20 border border-destructive/30 px-4 py-2.5 text-center text-xs text-destructive animate-bounce">
          {error}
        </div>
      )}

      {/* Bottom Kinetic Command Layer */}
      <div className="flex flex-col gap-4 border-t border-white/10 p-6 bg-background/50 backdrop-blur-md z-50">
        {/* State Trigger Interaction Interface */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => triggerReaction("thumb")}
            className={`flex size-12 items-center justify-center rounded-full border text-xl transition-all duration-300 transform active:scale-90 ${
              activeButton === "thumb"
                ? "bg-emerald-500/20 border-emerald-500 scale-125 animate-shake-burst grayscale-0 opacity-100"
                : "bg-white/5 border-white/10 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 hover:bg-white/10"
            }`}
            title="Thumbs Up Execution"
          >
            👍
          </button>
          <button
            onClick={() => triggerReaction("heart")}
            className={`flex size-12 items-center justify-center rounded-full border text-xl transition-all duration-300 transform active:scale-90 ${
              activeButton === "heart"
                ? "bg-rose-500/20 border-rose-500 scale-125 animate-shake-burst grayscale-0 opacity-100"
                : "bg-white/5 border-white/10 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 hover:bg-white/10"
            }`}
            title="Heart Synchronization"
          >
            ❤️
          </button>
          <button
            onClick={() => triggerReaction("clap")}
            className={`flex size-12 items-center justify-center rounded-full border text-xl transition-all duration-300 transform active:scale-90 ${
              activeButton === "clap"
                ? "bg-amber-500/20 border-amber-500 scale-125 animate-shake-burst grayscale-0 opacity-100"
                : "bg-white/5 border-white/10 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 hover:bg-white/10"
            }`}
            title="Applaud Execution"
          >
            👏
          </button>

          <div className="w-px h-8 bg-white/10 mx-2" />

          <button
            onClick={toggleHandRaise}
            className={`flex items-center gap-2 px-5 h-12 rounded-full transition-all border font-semibold text-xs tracking-wider active:scale-95 ${
              isHandRaised
                ? "bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/20 animate-pulse-glow"
                : "bg-white/5 border-white/10 text-foreground hover:bg-white/10"
            }`}
          >
            <Hand className={`size-4 ${isHandRaised ? "animate-bounce" : ""}`} />
            {isHandRaised ? "Hand Raised" : "Raise Hand"}
          </button>
        </div>

        {/* Primary Hardware Media IO Switches */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={toggleMic}
            className={`grid size-14 place-items-center rounded-full transition-all ${micOn ? "bg-white/10 text-foreground hover:bg-white/20" : "bg-destructive text-destructive-foreground"}`}
            aria-label="Toggle mic"
          >
            {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </button>
          {video && (
            <button
              onClick={toggleCam}
              className={`grid size-14 place-items-center rounded-full transition-all ${camOn ? "bg-white/10 text-foreground hover:bg-white/20" : "bg-destructive text-destructive-foreground"}`}
              aria-label="Toggle camera"
            >
              {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
            </button>
          )}
          <button
            onClick={leave}
            className="grid size-14 place-items-center rounded-full bg-destructive text-destructive-foreground transition hover:brightness-110"
            aria-label="Leave call execution"
          >
            <PhoneOff className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function gridCols(n: number) {
  if (n <= 1) return "grid-cols-1";
  if (n === 2) return "grid-cols-1 md:grid-cols-2";
  if (n <= 4) return "grid-cols-2";
  return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
}

function Tile({
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
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  const hasVideo =
    video && stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-card transition-all duration-300 ring-2 ${
        isHandRaised
          ? "ring-amber-500 shadow-xl shadow-amber-500/10 scale-[1.01] animate-pulse-glow"
          : "ring-white/10"
      }`}
    >
      {hasVideo ? (
        <video ref={ref} autoPlay playsInline muted={isSelf} className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center bg-gradient-to-br from-primary/20 to-accent/10 min-h-[240px]">
          <div
            className={`grid size-24 place-items-center rounded-full bg-frequency text-3xl font-bold text-primary-foreground resonance-glow transition-transform ${
              isHandRaised ? "border-2 border-amber-500 scale-110" : ""
            }`}
          >
            {name.charAt(0).toUpperCase()}
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
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-black/70 px-3 py-1.5 backdrop-blur-md border border-white/5">
        <span className="truncate text-xs font-medium tracking-wide">
          {name}
          {isSelf && " (you)"}
        </span>
        <div className="flex items-center gap-2">
          {isHandRaised && <Hand className="size-3.5 text-amber-500 animate-bounce" />}
          <span
            className={`size-1.5 rounded-full ${state === "connected" ? "bg-accent" : state === "failed" || state === "disconnected" ? "bg-destructive" : "bg-yellow-400"}`}
          />
        </div>
      </div>
    </div>
  );
}
