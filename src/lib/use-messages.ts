import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Msg } from "./comms-context-def";

export const useMessages = (channelId: string | null) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["messages", channelId],
    queryFn: async () => {
      if (!channelId) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at");
      if (error) throw error;
      return data as Msg[];
    },
    enabled: !!channelId,
    // Enable Realtime here in a future step
  });
};
