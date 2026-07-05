import { Phone, PhoneOff, Users } from "lucide-react";
import { useCallManager, CallState } from "@/hooks/useCallManager";

export function CallPanel({ channelId }: { channelId: string }) {
  const { state, participants, joinCall, leaveCall } = useCallManager(channelId);

  return (
    <div className="glass-strong flex items-center justify-between rounded-xl border border-white/10 p-3">
      <div className="flex items-center gap-3">
        <div
          className={`size-3 rounded-full ${state === "connected" ? "bg-green-500 animate-pulse" : "bg-muted"}`}
        />
        <span className="text-sm font-medium">
          {state === "connected" ? "Call Active" : "No Active Call"}
        </span>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="size-4" />
          <span className="text-xs">{participants.length}</span>
        </div>
      </div>

      {state === "idle" ? (
        <button
          onClick={joinCall}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
        >
          <Phone className="size-4" /> Join
        </button>
      ) : (
        <button
          onClick={leaveCall}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
        >
          <PhoneOff className="size-4" /> Leave
        </button>
      )}
    </div>
  );
}
