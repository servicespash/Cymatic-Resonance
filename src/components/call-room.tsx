import { useEffect, useRef, useState, useCallback } from "react";
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
  Camera,
  Flashlight,
} from "lucide-react";
import { useLiveKitCall } from "@/hooks/use-livekit-call";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PermissionGate } from "@/components/permission-gate";

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
  initiatorId,
}: {
  callId: string;
  selfId: string;
  video: boolean;
  peers: Record<string, Sender>;
  kind: "audio" | "video";
  onLeave: () => void;
  initiatorId: string;
}) {
  const [hasPermission, setHasPermission] = useState(false);

  if (!hasPermission) {
    return (
      <PermissionGate
        onGranted={() => setHasPermission(true)}
        onCancel={onLeave}
        videoRequired={kind === "video"}
      />
    );
  }

  return (
    <CallRoomInner
      callId={callId}
      selfId={selfId}
      video={video}
      peers={peers}
      kind={kind}
      onLeave={onLeave}
      initiatorId={initiatorId}
    />
  );
}

function CallRoomInner({
  callId,
  selfId,
  video,
  peers,
  kind,
  onLeave,
  initiatorId,
}: {
  callId: string;
  selfId: string;
  video: boolean;
  peers: Record<string, Sender>;
  kind: "audio" | "video";
  onLeave: () => void;
  initiatorId: string;
}) {
  const isHost = initiatorId === selfId;
  const {
    localStream,
    remotes,
    micOn,
    camOn,
    isCallAnswered,
    toggleMic,
    toggleCam,
    flipCamera,
    toggleTorch,
    torchOn,
  } = useLiveKitCall({
    callId,
    selfId,
    video,
    enabled: true,
    isHost,
  });

  // Audio feedback
  useEffect(() => {
    const ringtone = new Audio("/ringtones/call-incoming.mp3");
    const dialtone = new Audio("/ringtones/crystal-resonance.mp3"); // Using crystal-resonance as dial tone
    if (!isCallAnswered) {
      if (isHost) {
        dialtone.loop = true;
        dialtone.play().catch(() => {});
      } else {
        ringtone.loop = true;
        ringtone.play().catch(() => {});
      }
    }

    return () => {
      ringtone.pause();
      ringtone.currentTime = 0;
      dialtone.pause();
      dialtone.currentTime = 0;
    };
  }, [isCallAnswered, isHost]);

  const [duration, setDuration] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({});
  const [bursts, setBursts] = useState<FloatingReaction[]>([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [activeButton, setActiveButton] = useState<"thumb" | "heart" | "clap" | null>(null);
  const [showVoicePrompt, setShowVoicePrompt] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Call duration clock tracking live execution - only starts when answered
  useEffect(() => {
    if (!isCallAnswered) {
      setDuration(0);
      return;
    }
    const t = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, [isCallAnswered]);

  const leave = useCallback(async () => {
    try {
      await supabase
        .from("call_participants")
        .update({ state: "left", left_at: new Date().toISOString() })
        .eq("call_id", callId)
        .eq("user_id", selfId);

      // If it's a 1-on-1 call, leaving should end it for both
      // We can check the number of participants or the kind of call
      const { data: participants } = await supabase
        .from("call_participants")
        .select("id, state")
        .eq("call_id", callId);

      const stillJoined = participants?.filter((p) => p.state === "joined") ?? [];

      if (stillJoined.length <= 1) {
        // Either I was the last one, or only one person is left.
        // In 1-on-1, if I leave, only one is left (the other person), but we want to end it.
        // Actually, if it's 1-on-1, and I leave, the other person is 'stillJoined'.
        // If it's a group call, we only end if NO ONE is left.
        // Let's check the total invited count to see if it was 1-on-1
        if (participants && participants.length <= 2) {
          await supabase
            .from("calls")
            .update({ status: "ended", ended_at: new Date().toISOString() })
            .eq("id", callId);
        } else if (stillJoined.length === 0) {
          await supabase
            .from("calls")
            .update({ status: "ended", ended_at: new Date().toISOString() })
            .eq("id", callId);
        }
      }
    } catch (e) {
      console.error(e);
    }
    onLeave();
  }, [callId, selfId, onLeave]);

  // Automatic timeout for unanswered calls
  useEffect(() => {
    if (!isHost || isCallAnswered || duration < 60) return;

    // Check if call is still ringing
    supabase
      .from("calls")
      .select("status")
      .eq("id", callId)
      .single()
      .then(({ data }) => {
        if (data?.status === "ringing") {
          supabase
            .from("calls")
            .update({ status: "ended", ended_at: new Date().toISOString() })
            .eq("id", callId)
            .then(() => {
              toast.info("Call timed out");
              setShowVoicePrompt(true);
            });
        }
      });
  }, [duration, isHost, isCallAnswered, callId]);

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
      className={`fixed z-50 flex flex-col bg-background/95 backdrop-blur-xl overflow-hidden selection:bg-primary/30 pointer-events-auto transition-all duration-300 ${
        minimized
          ? "bottom-6 right-6 w-80 h-48 rounded-2xl border border-white/10 shadow-2xl"
          : "inset-0"
      }`}
    >
      {minimized ? (
        /* Compact Picture-in-Picture View */
        <div className="flex flex-col h-full w-full relative">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-2 w-full bg-black/40 z-10 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="grid size-6 place-items-center rounded-full bg-frequency text-primary-foreground">
                {kind === "video" ? <Video className="size-3.5" /> : <Mic className="size-3.5" />}
              </span>
              <span className="truncate text-xs font-semibold text-white">
                Call ({mmss(duration)})
              </span>
            </div>
            <button
              onClick={() => setMinimized(false)}
              className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-white transition"
              title="Maximize"
            >
              <Maximize className="size-3.5" />
            </button>
          </header>

          <div className="flex-1 relative min-h-0 bg-black/20">
            {all[0]?.stream && video ? (
              <Tile
                stream={all[0].stream}
                name={peers[all[0].userId]?.full_name ?? "Connection"}
                isSelf={all[0].isSelf}
                state={all[0].state}
                video={video}
                isHandRaised={false}
                compact
              />
            ) : (
              <div className="grid size-full place-items-center bg-gradient-to-br from-primary/10 to-accent/5">
                <div className="size-12 rounded-full bg-frequency flex items-center justify-center text-sm font-bold text-white animate-pulse">
                  {peers[all[0]?.userId]?.full_name?.charAt(0).toUpperCase() || "C"}
                </div>
              </div>
            )}

            {/* Hover mini controls layer */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-zinc-950/90 border border-white/10 rounded-full px-3 py-1 shadow-lg backdrop-blur-sm z-20">
              <button
                onClick={toggleMic}
                className={`p-1.5 rounded-full transition-all ${
                  micOn ? "text-white hover:bg-white/10" : "text-destructive bg-destructive/20"
                }`}
                aria-label="Toggle mic"
              >
                {micOn ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
              </button>
              {video && (
                <button
                  onClick={toggleCam}
                  className={`p-1.5 rounded-full transition-all ${
                    camOn ? "text-white hover:bg-white/10" : "text-destructive bg-destructive/20"
                  }`}
                  aria-label="Toggle camera"
                >
                  {camOn ? <Video className="size-3.5" /> : <VideoOff className="size-3.5" />}
                </button>
              )}
              <button
                onClick={leave}
                className="p-1.5 rounded-full text-red-500 hover:bg-red-500/20 transition-colors"
                aria-label="End call"
              >
                <PhoneOff className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Full Screen Interactive Video Stream Matrix */
        <>
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
              <div>
                <div className="font-display text-base font-semibold tracking-wide text-foreground">
                  {kind === "video"
                    ? "Cymatic Resonance Video Stream"
                    : "Cymatic Resonance Audio Workspace"}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  {isCallAnswered ? (
                    <>
                      <span className="text-accent animate-pulse">●</span> Active · {mmss(duration)}
                    </>
                  ) : (
                    <>
                      <span className="text-yellow-500 animate-pulse">●</span>{" "}
                      {isHost ? "Dialing..." : "Ringing..."}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMinimized(true)}
                className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-white transition"
                title="Minimize"
              >
                <Minimize className="size-4" />
              </button>
              <div className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-medium text-muted-foreground ring-1 ring-white/10">
                <Users className="size-4 text-primary" /> {all.length} Execution Partners Connected
              </div>
            </div>
          </header>

          {/* Main Stream Layout - Featured View */}
          <div className="flex flex-1 flex-col p-4 gap-4 overflow-hidden">
            <div className="flex-1 min-h-0 bg-black rounded-2xl overflow-hidden relative">
              <Tile
                stream={
                  all.find((p) => p.userId === (selectedPeerId || all[0].userId))?.stream || null
                }
                name={peers[selectedPeerId || all[0].userId]?.full_name || "Featured"}
                isSelf={false}
                state="connected"
                video={video}
                isHandRaised={!!raisedHands[selectedPeerId || all[0].userId]}
              />
            </div>

            <div className="h-32 flex gap-4 overflow-x-auto pb-2">
              {all.map((p) => (
                <div key={p.userId} className="w-32 flex-shrink-0">
                  <Tile
                    stream={p.stream}
                    name={peers[p.userId]?.full_name ?? (p.isSelf ? "You" : "Execution Member")}
                    isSelf={p.isSelf}
                    state={p.state}
                    video={video}
                    isHandRaised={!!raisedHands[p.userId]}
                    compact
                    onClick={() => setSelectedPeerId(p.userId)}
                  />
                </div>
              ))}
            </div>
          </div>

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
                className={`grid size-14 place-items-center rounded-full transition-all ${
                  micOn
                    ? "bg-white/10 text-foreground hover:bg-white/20"
                    : "bg-destructive text-destructive-foreground"
                }`}
                aria-label="Toggle mic"
              >
                {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
              </button>
              {video && (
                <button
                  onClick={toggleCam}
                  className={`grid size-14 place-items-center rounded-full transition-all ${
                    camOn
                      ? "bg-white/10 text-foreground hover:bg-white/20"
                      : "bg-destructive text-destructive-foreground"
                  }`}
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
            {video && camOn && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => flipCamera()}
                  className="p-3 bg-white/10 rounded-full hover:bg-white/20"
                >
                  <Camera className="size-5" />
                </button>
                <button
                  onClick={() => toggleTorch()}
                  className={`p-3 rounded-full ${torchOn ? "bg-amber-500" : "bg-white/10"}`}
                >
                  <Flashlight className="size-5" />
                </button>
              </div>
            )}
          </div>

          {showVoicePrompt && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md">
              <div className="bg-background border border-white/10 rounded-3xl p-8 max-w-sm text-center shadow-2xl animate-in zoom-in-95">
                <div className="size-16 rounded-full bg-frequency/20 flex items-center justify-center mx-auto mb-4">
                  <Mic className="size-8 text-frequency" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Answer</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  The call timed out. Would you like to leave a recorded voice message?
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      toast.success("Recording feature coming soon");
                      leave();
                    }}
                    className="w-full bg-frequency text-white font-bold py-3 rounded-xl hover:brightness-110 transition"
                  >
                    Leave Voice Message
                  </button>
                  <button
                    onClick={leave}
                    className="w-full bg-white/5 text-foreground py-3 rounded-xl hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface TileProps {
  stream: MediaStream | null;
  name: string;
  isSelf: boolean;
  state: string;
  video: boolean;
  isHandRaised: boolean;
  compact?: boolean;
  onClick?: () => void;
}

function Tile({ stream, name, isSelf, state, video, isHandRaised, compact, onClick }: TileProps) {
  const hasVideo = !!stream && video;
  const setVideoRef = (el: HTMLVideoElement | null) => {
    if (el && stream) el.srcObject = stream;
  };

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-card transition-all duration-300 ring-2 ${
        compact
          ? "rounded-xl ring-1 ring-white/15 size-full"
          : isHandRaised
            ? "rounded-2xl ring-amber-500 shadow-xl shadow-amber-500/10 scale-[1.01] animate-pulse-glow"
            : "rounded-2xl ring-white/10"
      } ${onClick ? "cursor-pointer" : ""}`}
    >
      {hasVideo ? (
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className="size-full object-cover"
          style={{
            transform: "none",
            filter: "none",
          }}
        />
      ) : (
        <div
          className={`grid size-full place-items-center bg-gradient-to-br from-primary/20 to-accent/10 ${
            compact ? "min-h-0 py-4" : "min-h-[240px]"
          }`}
        >
          <div
            className={`grid place-items-center rounded-full bg-frequency font-bold text-primary-foreground resonance-glow transition-transform ${
              compact
                ? "size-12 text-sm"
                : isHandRaised
                  ? "size-24 text-3xl border-2 border-amber-500 scale-110"
                  : "size-24 text-3xl"
            }`}
          >
            {name?.charAt(0).toUpperCase()}
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
      {!compact && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-black/70 px-3 py-1.5 backdrop-blur-md border border-white/5">
          <span className="truncate text-xs font-medium tracking-wide">
            {name}
            {isSelf && " (you)"}
          </span>
          <div className="flex items-center gap-2">
            {isHandRaised && <Hand className="size-3.5 text-amber-500 animate-bounce" />}
            <span
              className={`size-1.5 rounded-full ${
                state === "connected"
                  ? "bg-accent"
                  : state === "failed" || state === "disconnected"
                    ? "bg-destructive"
                    : "bg-yellow-400"
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
