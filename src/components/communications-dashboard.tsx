import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Phone, Video, PhoneIncoming, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallController } from "@/hooks/use-call-controller";
import { CallHistoryDropdown } from "@/components/call-history-dropdown";

interface Member {
  id: string;
  full_name: string | null;
  is_online: boolean;
}

export const CommunicationsDashboard = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [callHistoryOpen, setCallHistoryOpen] = useState(false);
  const { startCall } = useCallController();

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, is_online");
      if (data) setMembers(data as Member[]);
    };
    fetchMembers();
  }, []);

  const initiateCall = (userId: string, kind: "audio" | "video") => {
    const channelId = `direct-${userId}`;
    startCall(channelId, [userId], kind);
  };

  const getStatusColor = (isOnline: boolean) => {
    return isOnline ? "bg-green-500" : "bg-gray-500";
  };

  return (
    <div className="p-6 space-y-4 text-foreground">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Team</h2>
        <Button variant="outline" size="sm" onClick={() => setCallHistoryOpen(!callHistoryOpen)}>
          <History className="size-4 mr-2" /> Call History
        </Button>
      </div>

      {callHistoryOpen && <CallHistoryDropdown onClose={() => setCallHistoryOpen(false)} />}

      <div className="grid gap-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg bg-card"
          >
            <div className="flex items-center gap-3">
              <div className={cn("size-3 rounded-full", getStatusColor(member.is_online))} />
              <span>{member.full_name || "Unknown"}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <PhoneIncoming className="size-4 mr-2" /> Call
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => initiateCall(member.id, "audio")}>
                    <Phone className="size-4 mr-2" /> Audio Call
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => initiateCall(member.id, "video")}>
                    <Video className="size-4 mr-2" /> Video Call
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
