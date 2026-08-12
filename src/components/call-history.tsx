import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  RefreshCw,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCallController } from "@/hooks/use-call-controller";

interface CallRow {
  id: string;
  channel_id: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  initiator_id: string;
  kind: "audio" | "video";
  status: string;
}

export const CallHistoryPanel = ({ defaultOpen = false }: { defaultOpen?: boolean }) => {
  const { user } = useAuth();
  const { startCall } = useCallController();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [others, setOthers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const fetchCalls = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("calls")
      .select("id, channel_id, created_at, started_at, ended_at, initiator_id, kind, status")
      .order("created_at", { ascending: false })
      .limit(25);

    if (!error && data) {
      const rows = data as CallRow[];
      setCalls(rows);

      const ids = rows.map((c) => c.id);
      if (ids.length) {
        const { data: parts } = await supabase
          .from("call_participants")
          .select("call_id, user_id")
          .in("call_id", ids);
        const map: Record<string, string[]> = {};
        for (const p of parts ?? []) {
          if (p.user_id === user.id) continue;
          (map[p.call_id] ??= []).push(p.user_id);
        }
        setOthers(map);
      }

      const { data: profiles } = await supabase.from("profiles").select("id, full_name");
      setNames(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? "Member"])));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (isOpen) fetchCalls();
  }, [isOpen, fetchCalls]);

  const groupedHistory = calls.reduce(
    (acc, call) => {
      const d = new Date(call.created_at);
      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);
      const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
      const dateStr = same(d, today)
        ? "Today"
        : same(d, yesterday)
          ? "Yesterday"
          : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      (acc[dateStr] ??= []).push(call);
      return acc;
    },
    {} as Record<string, CallRow[]>,
  );

  const labelFor = (call: CallRow) => {
    if (call.initiator_id !== user?.id) return names[call.initiator_id] ?? "Member";
    const peers = (others[call.id] ?? []).map((id) => names[id] ?? "Member");
    if (peers.length === 0) return "Workspace call";
    if (peers.length === 1) return peers[0];
    return `${peers[0]} +${peers.length - 1}`;
  };

  return (
    <div className="border-t border-white/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-3 text-sm font-medium transition hover:bg-white/5"
      >
        <span>Call history</span>
        <span className="flex items-center gap-2">
          {isOpen && (
            <RefreshCw
              onClick={(e) => {
                e.stopPropagation();
                fetchCalls();
              }}
              className={`size-3.5 text-muted-foreground hover:text-foreground ${loading ? "animate-spin" : ""}`}
            />
          )}
          <ChevronDown className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {isOpen && (
        <div className="max-h-72 space-y-4 overflow-y-auto p-2">
          {loading ? (
            <p className="py-2 text-center text-xs text-muted-foreground">Loading call history…</p>
          ) : Object.keys(groupedHistory).length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">No recent calls</p>
          ) : (
            Object.entries(groupedHistory).map(([date, dateCalls]) => (
              <div key={date} className="space-y-1">
                <h4 className="px-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {date}
                </h4>
                {dateCalls.map((call) => {
                  const durationSec =
                    call.started_at && call.ended_at
                      ? Math.max(
                          0,
                          Math.round(
                            (new Date(call.ended_at).getTime() -
                              new Date(call.started_at).getTime()) /
                              1000,
                          ),
                        )
                      : 0;
                  const outbound = call.initiator_id === user?.id;
                  const duration =
                    durationSec >= 60
                      ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
                      : `${durationSec}s`;

                  return (
                    <div
                      key={call.id}
                      className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5 text-xs transition hover:bg-white/10"
                    >
                      {call.status === "declined" || call.status === "missed" ? (
                        <PhoneOff className="size-3.5 shrink-0 text-red-400" />
                      ) : outbound ? (
                        <PhoneOutgoing className="size-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <PhoneIncoming className="size-3.5 shrink-0 text-accent" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-medium">
                          {call.kind === "video" ? (
                            <Video className="size-3 text-accent" />
                          ) : (
                            <Phone className="size-3 text-accent" />
                          )}
                          <span className="truncate">{labelFor(call)}</span>
                        </div>
                        <p className="text-[10px] capitalize text-muted-foreground">
                          {call.status} ·{" "}
                          {new Date(call.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {duration}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          startCall(
                            call.channel_id,
                            outbound
                              ? (others[call.id] ?? [])
                              : [call.initiator_id, ...(others[call.id] ?? [])],
                            call.kind,
                          )
                        }
                        title="Call back"
                        className="rounded-full bg-accent/15 p-1.5 text-accent transition hover:bg-accent/25"
                        aria-label="Call back"
                      >
                        <Phone className="size-3" />
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
