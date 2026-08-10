import { Phone, PhoneOff, Video, Sparkles, Maximize2 } from "lucide-react";
import { useCallController } from "@/hooks/use-call-controller";

export function CallPanel({ channelId }: { channelId: string }) {
  const { activeCalls, activeCallId, joinCall, startCall, leaveCall } = useCallController();

  const activeCall = activeCalls[channelId];
  const isSelfConnected = activeCall && activeCallId === activeCall.id;

  if (!activeCall) {
    return (
      <div className="glass-strong flex items-center justify-between rounded-xl border border-white/10 bg-card/60 p-3 shadow-md backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="size-2.5 rounded-full bg-muted-foreground/40" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-muted-foreground">
              No Active Calls in Channel
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/70">
              Start an audio or video session for team members
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => startCall(channelId, [], "audio")}
            className="flex items-center gap-1.5 rounded-xl bg-accent/10 border border-accent/20 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-primary-foreground active:scale-95 transition-all"
          >
            <Phone className="size-3.5" /> Start Audio Call
          </button>
          <button
            onClick={() => startCall(channelId, [], "video")}
            className="flex items-center gap-1.5 rounded-xl bg-frequency px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110 active:scale-95 transition-all resonance-glow"
          >
            <Video className="size-3.5" /> Start Video Call
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-strong flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 p-3 shadow-lg backdrop-blur-md animate-fade-up">
      <div className="flex items-center gap-3">
        <span className="relative flex size-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex size-3 rounded-full bg-accent" />
        </span>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Sparkles className="size-3.5 text-accent animate-spin-slow" />
            <span>Live {activeCall.kind.toUpperCase()} Call Active</span>
          </div>
          <span className="text-[10px] font-mono text-accent/80 font-medium">
            {isSelfConnected ? "Connected in Stage View" : "Session in progress · Tap Join Call"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isSelfConnected ? (
          <>
            <button
              onClick={() => joinCall(activeCall.id, activeCall.kind)}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-white/20 active:scale-95 transition-all"
            >
              <Maximize2 className="size-3.5 text-accent" /> Full Screen Stage
            </button>
            <button
              onClick={leaveCall}
              className="flex items-center gap-1.5 rounded-xl bg-destructive px-3.5 py-1.5 text-xs font-semibold text-destructive-foreground hover:brightness-110 active:scale-95 transition-all shadow-sm"
            >
              <PhoneOff className="size-3.5" /> Leave Call
            </button>
          </>
        ) : (
          <button
            onClick={() => joinCall(activeCall.id, activeCall.kind)}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110 active:scale-95 transition-all resonance-glow shadow-md"
          >
            <Phone className="size-3.5" /> Join Call Now
          </button>
        )}
      </div>
    </div>
  );
}
