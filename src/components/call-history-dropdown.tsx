import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Video, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Call {
  id: string;
  kind: "audio" | "video";
  status: "active" | "ended" | "declined" | "missed_call";
  created_at: string;
}

export const CallHistoryDropdown = ({ onClose }: { onClose: () => void }) => {
  const [history, setHistory] = useState<Call[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase
        .from("calls")
        .select("id, kind, status, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) setHistory(data as Call[]);
    };
    fetchHistory();
  }, []);

  return (
    <div className="absolute top-16 right-4 z-[100] w-80 bg-background border rounded-2xl shadow-2xl p-4 animate-in fade-in zoom-in-95">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold">Call History</h3>
        <button onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-2">
        {history.map((call) => (
          <div key={call.id} className="flex justify-between items-center text-sm p-2 border-b">
            <div className="flex items-center gap-2">
              {call.kind === "audio" ? <Phone className="size-4" /> : <Video className="size-4" />}
              <span className="capitalize">{call.status.replace("_", " ")}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(call.created_at))} ago
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
