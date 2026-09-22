import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Phone, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallController } from "@/hooks/use-call-controller";

interface Member {
  id: string;
  full_name: string | null;
  is_online: boolean;
}

export const CommunicationsDashboard = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const { openInitiationModal } = useCallController();

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, is_online");
      if (data) setMembers(data as Member[]);
    };
    fetchMembers();
  }, []);

  const initiateCall = async (member: Member) => {
    const { data, error } = await supabase.rpc("open_dm", { _other: member.id });
    if (error || !data) return;
    const thread = data as unknown as { channel_id: string };
    openInitiationModal(thread.channel_id, [member.id], member.full_name ?? "Member");
  };

  const getStatusColor = (isOnline: boolean) => {
    return isOnline ? "bg-green-500" : "bg-gray-500";
  };

  return (
    <div className="p-6 space-y-4 text-foreground">
      <h2 className="text-xl font-bold">Team</h2>
      <div className="grid gap-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-3 border rounded-lg bg-card"
          >
            <div className="flex items-center gap-3">
              <div className={cn("size-3 rounded-full", getStatusColor(member.is_online))} />
              <span>{member.full_name || "Unknown"}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => initiateCall(member.id, "audio")}>
                <Phone className="size-4 mr-2" /> Call
              </Button>
              <Button size="sm" variant="ghost" onClick={() => initiateCall(member.id, "video")}>
                <Video className="size-4 mr-2" /> Video
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
