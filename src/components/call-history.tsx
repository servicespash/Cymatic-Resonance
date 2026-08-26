import { useEffect, useState, useCallback } from "react";
import { ChevronDown, Phone, PhoneOff, PhoneIncoming, RefreshCw, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

interface CallRow {
  id: string;
  channel_id: string;
  created_at: string;
  started_at: string;
  ended_at: string | null;
  initiator_id: string;
  kind: string;
  status: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

export const CallHistoryPanel = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCalls = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("calls")
      .select("id, channel_id, created_at, started_at, ended_at, initiator_id, kind, status, profiles:initiator_id(full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setCalls(data as unknown as CallRow[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      fetchCalls();
      const subscription = supabase
        .channel("calls-history-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, () => {
          fetchCalls();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [isOpen, fetchCalls]);

  const groupedHistory = calls.reduce(
    (acc, call) => {
      const dateStr = new Date(call.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(call);
      return acc;
    },
    {} as Record<string, CallRow[]>,
  );

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "ended":
      case "active":
      case "connected":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Connected
          </span>
        );
      case "declined":
      case "rejected":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">
            Declined
          </span>
        );
      case "missed":
      case "ringing":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="border-t border-white/10 mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-white/5 transition"
      >
        <span>Call History</span>
        <ChevronDown className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="p-2 space-y-4 max-h-64 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Loading call history...
            </p>
          ) : Object.keys(groupedHistory).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No recent call history</p>
          ) : (
            Object.entries(groupedHistory).map(([date, dateCalls]) => (
              <div key={date} className="space-y-1">
                <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
                  {date}
                </h4>
                {dateCalls.map((call) => {
                  const durationSec =
                    call.started_at && call.ended_at
                      ? Math.round(
                          (new Date(call.ended_at).getTime() -
                            new Date(call.started_at).getTime()) /
                            1000,
                        )
                      : 0;

                  return (
                    <div
                      key={call.id}
                      className="flex items-center gap-3 text-xs p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition"
                    >
                      {call.status === "active" || call.status === "ended" ? (
                        <PhoneIncoming className="size-3.5 text-emerald-400 shrink-0" />
                      ) : call.status === "declined" ? (
                        <PhoneOff className="size-3.5 text-red-400 shrink-0" />
                      ) : (
                        <Phone className="size-3.5 text-amber-400 shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 font-medium">
                          {call.kind === "video" ? (
                            <Video className="size-3 text-accent" />
                          ) : (
                            <Phone className="size-3 text-accent" />
                          )}
                          <span className="truncate">
                            {call.initiator_id === user?.id 
                              ? "Outbound Call" 
                              : (call.profiles?.full_name ?? "Inbound Call")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {getStatusBadge(call.status)}
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {durationSec > 0 ? `${durationSec}s` : "0s"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => fetchCalls()}
                        title="Refresh history"
                        className="p-1.5 hover:bg-white/10 rounded-full transition text-muted-foreground hover:text-foreground"
                      >
                        <RefreshCw className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
