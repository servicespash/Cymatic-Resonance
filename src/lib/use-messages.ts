import { useEffect } from "@tanstack/react-query";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Msg } from "./comms-context-def";
import { toast } from "sonner";

export const useMessages = (channelId: string | null) => {
  const queryClient = useQueryClient();

  // Listen to Supabase Realtime for instant inserts and deletes
  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`realtime:messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const newMsg = payload.new as Msg;
          queryClient.setQueryData(["messages", channelId], (old: Msg[] | undefined) => {
            if (!old) return [newMsg];
            if (old.some((m) => m.id === newMsg.id)) return old;
            return [...old, newMsg];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const deletedId = payload.old.id;
          queryClient.setQueryData(["messages", channelId], (old: Msg[] | undefined) =>
            old ? old.filter((m) => m.id !== deletedId) : []
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, queryClient]);

  return useQuery({
    queryKey: ["messages", channelId],
    queryFn: async () => {
      if (!channelId) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Msg[];
    },
    enabled: !!channelId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useDeleteMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, channelId }: { messageId: string; channelId: string }) => {
      const { error } = await supabase.from("messages").delete().eq("id", messageId);
      if (error) throw error;
      return { messageId, channelId };
    },
    onMutate: async ({ messageId, channelId }) => {
      await queryClient.cancelQueries({ queryKey: ["messages", channelId] });
      const previousMessages = queryClient.getQueryData<Msg[]>(["messages", channelId]);

      queryClient.setQueryData(["messages", channelId], (old: Msg[] | undefined) =>
        old ? old.filter((m) => m.id !== messageId) : []
      );

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", variables.channelId], context.previousMessages);
      }
      toast.error(`Failed to delete message: ${err.message}`);
    },
    onSuccess: () => {
      toast.success("Message deleted");
    },
  });
};

export const useBatchDeleteMessages = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageIds, channelId }: { messageIds: string[]; channelId: string }) => {
      const { error } = await supabase.from("messages").delete().in("id", messageIds);
      if (error) throw error;
      return { messageIds, channelId };
    },
    onMutate: async ({ messageIds, channelId }) => {
      await queryClient.cancelQueries({ queryKey: ["messages", channelId] });
      const previousMessages = queryClient.getQueryData<Msg[]>(["messages", channelId]);

      queryClient.setQueryData(["messages", channelId], (old: Msg[] | undefined) =>
        old ? old.filter((m) => !messageIds.includes(m.id)) : []
      );

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", variables.channelId], context.previousMessages);
      }
      toast.error(`Batch deletion failed: ${err.message}`);
    },
    onSuccess: ({ messageIds }) => {
      toast.success(`${messageIds.length} messages deleted`);
    },
  });
};
