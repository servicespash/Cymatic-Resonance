import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  full_name: string | null;
  is_online: boolean;
}

export const CommunicationsDashboard = () => {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, is_online");
      if (data) setMembers(data as Member[]);
    };
    fetchMembers();
  }, []);

  const initiateCall = (userId: string) => {
    // Integration point: call logic here
    console.log("Initiating call to", userId);
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
            <Button size="sm" onClick={() => initiateCall(member.id)}>
              <Phone className="size-4 mr-2" /> Call
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
