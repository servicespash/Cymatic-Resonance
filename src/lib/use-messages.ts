import { useContext, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Msg } from "./comms-context-def";
import { CommsContext } from "./comms-context-core";
import { toast } from "sonner";

export const useMessages = (channelId: string | null) => {
  const queryClient = useQueryClient();
  const context = useContext(CommsContext);
  const orgId = context.activeChannel?.org_id;

  // Listen to Supabase Realtime for instant inserts and deletes
  useEffect(() => {
    if (!channelId || !orgId) return;

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
        },
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
            old ? old.filter((m) => m.id !== deletedId) : [],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as Msg;
          // Standard update logic: update the message in place
          queryClient.setQueryData(["messages", channelId], (old: Msg[] | undefined) =>
            old ? old.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)) : old,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, queryClient, orgId]);

  return useQuery({
    queryKey: ["messages", channelId],
    queryFn: async () => {
      if (!channelId || !orgId) return [];
      const { data, error } = await supabase
        .from("messages")
        .select(
          `
          *,
          profiles:sender_id(id, full_name, avatar_url, role)
        `,
        )
        .eq("channel_id", channelId)
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as (Msg & {
        profiles: { full_name: string; avatar_url: string; role: string };
      })[];
    },
    enabled: !!channelId && !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useDeleteMessage = () => {
  const queryClient = useQueryClient();
  const context = useContext(CommsContext);
  const orgId = context.activeChannel?.org_id;

  return useMutation({
    mutationFn: async ({ messageId, channelId }: { messageId: string; channelId: string }) => {
      if (!orgId) throw new Error("Could not determine organization");
      // Enforce foreign key constraints: delete child attachments & reactions first
      await supabase.from("message_reactions").delete().eq("message_id", messageId);
      await supabase.from("message_attachments").delete().eq("message_id", messageId);

      // Permanent hard delete of message
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("org_id", orgId);
      if (error) throw error;
      return { messageId, channelId };
    },
    onMutate: async ({ messageId, channelId }) => {
      await queryClient.cancelQueries({ queryKey: ["messages", channelId] });
      const previousMessages = queryClient.getQueryData<Msg[]>(["messages", channelId]);

      queryClient.setQueryData(["messages", channelId], (old: Msg[] | undefined) =>
        old ? old.filter((m) => m.id !== messageId) : [],
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
      toast.success("Message permanently deleted");
    },
  });
};

export const useBatchDeleteMessages = () => {
  const queryClient = useQueryClient();
  const context = useContext(CommsContext);
  const orgId = context.activeChannel?.org_id;

  return useMutation({
    mutationFn: async ({ messageIds, channelId }: { messageIds: string[]; channelId: string }) => {
      if (!orgId) throw new Error("Could not determine organization");
      // Enforce foreign key constraints: delete child attachments & reactions first
      if (messageIds.length > 0) {
        await supabase.from("message_reactions").delete().in("message_id", messageIds);
        await supabase.from("message_attachments").delete().in("message_id", messageIds);
      }

      const { error } = await supabase
        .from("messages")
        .delete()
        .in("id", messageIds)
        .eq("org_id", orgId);
      if (error) throw error;
      return { messageIds, channelId };
    },
    onMutate: async ({ messageIds, channelId }) => {
      await queryClient.cancelQueries({ queryKey: ["messages", channelId] });
      const previousMessages = queryClient.getQueryData<Msg[]>(["messages", channelId]);

      queryClient.setQueryData(["messages", channelId], (old: Msg[] | undefined) =>
        old ? old.filter((m) => !messageIds.includes(m.id)) : [],
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
