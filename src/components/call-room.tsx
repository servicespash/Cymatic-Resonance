import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users } from "lucide-react";
import { useCall, type RemotePeer } from "@/hooks/use-call";
import { supabase } from "@/integrations/supabase/client";

type Sender = { id: string; full_name: string | null };

export function CallRoom({
  callId, selfId, video, peers, kind,
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
    callId, selfId, video, enabled: true,
  });
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const leave = async () => {
    try {
      await (supabase as any).from("call_participants")
        .update({ state: "left", left_at: new Date().toISOString() })
        .eq("call_id", callId).eq("user_id", selfId);
      // If only person left, mark call ended
      const { data: still } = await (supabase as any).from("call_participants")
        .select("id").eq("call_id", callId).eq("state", "joined");
      if (!still || still.length === 0) {
        await (supabase as any).from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", callId);
      }
    } catch {}
    onLeave();
  };

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const all = [
    { userId: selfId, stream: localStream, isSelf: true, state: "connected" as RTCPeerConnectionState },
    ...remotes.map((r) => ({ userId: r.userId, stream: r.stream, isSelf: false, state: r.state })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-frequency text-primary-foreground resonance-glow">
            {kind === "video" ? <Video className="size-4" /> : <Mic className="size-4" />}
          </span>
          <div>
            <div className="font-display text-sm font-semibold">{kind === "video" ? "Video call" : "Voice call"}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="text-accent">●</span> live · {mmss(duration)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" /> {all.length}
        </div>
      </header>

      <div className={`grid flex-1 gap-3 p-4 ${gridCols(all.length)}`}>
        {all.map((p) => (
          <Tile key={p.userId} stream={p.stream} name={peers[p.userId]?.full_name ?? (p.isSelf ? "You" : "Member")} isSelf={p.isSelf} state={p.state} video={video} />
        ))}
      </div>

      {error && (
        <div className="mx-auto mb-2 max-w-md rounded-xl bg-destructive/20 px-4 py-2 text-center text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 border-t border-white/10 p-5">
        <button onClick={toggleMic} className={`grid size-14 place-items-center rounded-full transition ${micOn ? "bg-white/10 text-foreground hover:bg-white/20" : "bg-destructive text-destructive-foreground"}`} aria-label="Toggle mic">
          {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        </button>
        {video && (
          <button onClick={toggleCam} className={`grid size-14 place-items-center rounded-full transition ${camOn ? "bg-white/10 text-foreground hover:bg-white/20" : "bg-destructive text-destructive-foreground"}`} aria-label="Toggle camera">
            {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </button>
        )}
        <button onClick={leave} className="grid size-14 place-items-center rounded-full bg-destructive text-destructive-foreground transition hover:brightness-110" aria-label="Leave call">
          <PhoneOff className="size-5" />
        </button>
      </div>
    </div>
  );
}

function gridCols(n: number) {
  if (n <= 1) return "grid-cols-1";
  if (n === 2) return "grid-cols-1 md:grid-cols-2";
  if (n <= 4) return "grid-cols-2";
  return "grid-cols-2 md:grid-cols-3";
}

function Tile({ stream, name, isSelf, state, video }: { stream: MediaStream | null; name: string; isSelf: boolean; state: RTCPeerConnectionState; video: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  const hasVideo = video && stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
      {hasVideo ? (
        <video ref={ref} autoPlay playsInline muted={isSelf} className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center bg-gradient-to-br from-primary/20 to-accent/10">
          <div className="grid size-24 place-items-center rounded-full bg-frequency text-3xl font-bold text-primary-foreground resonance-glow">
            {name.charAt(0).toUpperCase()}
          </div>
          {stream && !video && (
            <audio ref={(el) => { if (el && stream && !isSelf) el.srcObject = stream; }} autoPlay />
          )}
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-lg bg-black/60 px-2.5 py-1 backdrop-blur">
        <span className="truncate text-xs font-medium">{name}{isSelf && " (you)"}</span>
        <span className={`size-1.5 rounded-full ${state === "connected" ? "bg-accent" : state === "failed" || state === "disconnected" ? "bg-destructive" : "bg-yellow-400"}`} />
      </div>
    </div>
  );
}
