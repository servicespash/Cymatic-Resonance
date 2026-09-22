import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useComms } from "@/lib/use-comms";
import { CommsProvider } from "@/lib/comms-context";
import { RequireWorkspace } from "@/components/require-workspace";
import { useCallController } from "@/hooks/use-call-controller";
import {
  Send,
  Plus,
  Search,
  ArrowLeft,
  SmilePlus,
  Paperclip,
  Users,
  ListTodo,
  MessageSquarePlus,
  Mic,
  Settings,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ensureNotificationPermission, notify } from "@/lib/notifications";
import { CallControls } from "@/components/call-controls";
import { CallHistoryPanel } from "@/components/call-history";
import { TasksPanel } from "@/components/tasks-panel";
import { RecordAudioMessage, RecordedAudio } from "@/components/record-audio-message";
import { CymaticWave } from "@/components/cymatic-wave";
import { MessageItem } from "@/components/message-item";
import { ChatItem } from "@/components/chat-item";
import type { Attachment } from "@/components/comm-attachment";
import { readCache, writeCache, onReconnect } from "@/lib/offline-cache";
import { ClientOnly } from "@/components/client-only";

import { useMessages, useDeleteMessage } from "@/lib/use-messages";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

const CommsComponent = () => (
  <RequireWorkspace>
    <CommsProvider>
      <CommsPage />
    </CommsProvider>
  </RequireWorkspace>
);

export const Route = createFileRoute("/_authenticated/comms")({
  component: CommsComponent,
});

type Channel = { id: string; name: string; kind: "broadcast" | "dm"; org_id: string };
type Thread = {
  id: string;
  channel_id: string;
  user_a: string;
  user_b: string;
  org_id: string;
  last_message_at: string;
};
type Msg = { id: string; channel_id: string; sender_id: string; body: string; created_at: string };
type Reaction = { id: string; message_id: string; emoji: string; user_id: string };

const VERIFIED_CHANNELS = new Set(["announcements", "general", "leadership"]);

function CommsPage() {
  const { user } = useAuth();
  const {
    channels,
    setChannels,
    activeChannel,
    setActiveChannel,
    threads,
    setThreads,
    senders,
    setSenders,
    setReads,
    lastMessageByChannel,
    setLastMessageByChannel,
    sendMessage,
    startDm,
    sending,
  } = useComms();
  const callController = useCallController();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [pending] = useState<string[]>([]);

  const active = activeChannel;
  const { data: rawMessages, isLoading: loadingMessages } = useMessages(active?.id || null);
  const activeMessages = useMemo(() => rawMessages ?? [], [rawMessages]);
  const activeMessageIdsKey = useMemo(
    () => activeMessages.map((m) => m.id).join(","),
    [activeMessages],
  );
  const queryClient = useQueryClient();
  const deleteMessageMutation = useDeleteMessage();
  const setActive = setActiveChannel;

  const [newDmOpen, setNewDmOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [tab] = useState<"channels" | "direct" | "verified" | "all">("all");
  const [search, setSearch] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const activeRef = useRef<Channel | null>(null);
  activeRef.current = active;

  const setChannelsStable = setChannels;
  const setSendersStable = setSenders;
  const setThreadsStable = setThreads;
  const setReadsStable = setReads;
  const setLastMessageByChannelStable = setLastMessageByChannel;
  const setOrgIdStable = setOrgId;
  const setIsAdminStable = setIsAdmin;
  const setUnreadCountsStable = setUnreadCounts;
  const setActiveChannelStable = setActiveChannel;
  const setReactionsStable = setReactions;
  const setAttachmentsStable = setAttachments;

  useEffect(() => {
    ensureNotificationPermission();
  }, [setLastMessageByChannelStable]);

  // Hydrate initial organization state & load channel message previews + unread logic.
  // Cached first (instant, works offline), then refreshed from the backend and
  // re-run whenever the tab/network comes back.
  const loadWorkspace = useCallback(async () => {
    if (!user?.id) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("org_id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!p?.org_id) return;
    setOrgIdStable(p.org_id);
    setIsAdminStable(p.role === "admin");

    const [{ data: chs }, { data: mem }, { data: th }, { data: rd }, { data: allMsgs }] =
      await Promise.all([
        supabase.from("channels").select("*").eq("org_id", p.org_id).order("created_at"),
        supabase.from("profiles").select("id, full_name, role").eq("org_id", p.org_id),
        supabase
          .from("direct_threads")
          .select("*")
          .eq("org_id", p.org_id)
          .order("last_message_at", { ascending: false }),
        supabase.from("message_reads").select("channel_id, last_read_at").eq("user_id", user.id),
        supabase
          .from("messages")
          .select("id, channel_id, sender_id, body, created_at, profiles(full_name)")
          .eq("org_id", p.org_id)
          .order("created_at", { ascending: false }),
      ]);

    if (chs) setChannelsStable(chs);
    if (mem) setSendersStable(Object.fromEntries(mem.map((s) => [s.id, s])));
    if (th) setThreadsStable(th);

    const readsMap: Record<string, string> = {};
    if (rd) {
      rd.forEach((r) => {
        readsMap[r.channel_id] = r.last_read_at;
      });
      setReadsStable(readsMap);
    }

    // Map last message per channel & build accurate unread message counts
    const lastMap: Record<string, Msg> = {};
    if (allMsgs && allMsgs.length > 0) {
      const unreadMap: Record<string, number> = {};

      (allMsgs as Msg[]).forEach((m) => {
        if (!lastMap[m.channel_id]) {
          lastMap[m.channel_id] = m;
        }

        const lastReadAt = readsMap[m.channel_id];
        const isUnread =
          m.sender_id !== user.id && (!lastReadAt || new Date(m.created_at) > new Date(lastReadAt));

        if (isUnread) {
          unreadMap[m.channel_id] = (unreadMap[m.channel_id] || 0) + 1;
        }
      });

      setLastMessageByChannelStable(lastMap);
      setUnreadCountsStable(unreadMap);
    }

    writeCache(`workspace:${user.id}`, {
      orgId: p.org_id,
      isAdmin: p.role === "admin",
      channels: chs ?? [],
      senders: mem ?? [],
      threads: th ?? [],
      reads: readsMap,
      lastMessageByChannel: lastMap,
    });
  }, [
    user?.id,
    setChannelsStable,
    setSendersStable,
    setThreadsStable,
    setReadsStable,
    setLastMessageByChannelStable,
    setOrgIdStable,
    setIsAdminStable,
    setUnreadCountsStable,
  ]);

  // Instant paint from the last known state so nothing looks "gone" offline.
  useEffect(() => {
    if (!user?.id) return;
    const cached = readCache<{
      orgId: string;
      isAdmin: boolean;
      channels: Channel[];
      senders: { id: string; full_name: string | null; role: string }[];
      threads: {
        id: string;
        channel_id: string;
        user_a: string;
        user_b: string;
        last_message_at: string;
      }[];
      reads: Record<string, string>;
      lastMessageByChannel: Record<string, Msg>;
    }>(`workspace:${user.id}`);
    if (!cached) return;
    setOrgIdStable((prev) => prev ?? cached.orgId);
    setIsAdminStable(cached.isAdmin);
    setChannelsStable((prev) => (prev.length ? prev : (cached.channels as Channel[])));
    setSendersStable(
      (
        prev: Record<
          string,
          { id: string; full_name: string | null; role: string; avatar_url?: string | null }
        >,
      ) =>
        Object.keys(prev).length ? prev : Object.fromEntries(cached.senders.map((s) => [s.id, s])),
    );
    setThreadsStable((prev) => (prev.length ? prev : (cached.threads as typeof prev)));
    setReadsStable((prev) => (Object.keys(prev).length ? prev : cached.reads));
    setLastMessageByChannelStable((prev) =>
      Object.keys(prev).length ? prev : cached.lastMessageByChannel,
    );

    const lastId = window.localStorage.getItem("cym.lastChannel");
    const restored = lastId ? cached.channels.find((c) => c.id === lastId) : null;
    if (restored) setActiveChannelStable(restored as Channel);
  }, [
    user?.id,
    setChannelsStable,
    setSendersStable,
    setThreadsStable,
    setReadsStable,
    setLastMessageByChannelStable,
    setActiveChannelStable,
    setIsAdminStable,
    setOrgIdStable,
  ]);

  const loadWorkspaceRef = useRef(loadWorkspace);
  useEffect(() => {
    loadWorkspaceRef.current = loadWorkspace;
  }, [loadWorkspace]);

  useEffect(() => {
    loadWorkspaceRef.current();
    return onReconnect(() => {
      loadWorkspaceRef.current();
    });
  }, [loadWorkspace]);

  // Update read receipts when opening a channel
  const markChannelAsRead = useCallback(
    async (channelId: string) => {
      if (!user?.id) return;
      const now = new Date().toISOString();
      setReadsStable((prev: Record<string, string>) => ({ ...prev, [channelId]: now }));
      setUnreadCountsStable((prev: Record<string, number>) => ({ ...prev, [channelId]: 0 }));

      await supabase.from("message_reads").upsert({
        channel_id: channelId,
        user_id: user.id,
        last_read_at: now,
      });
    },
    [user?.id, setReadsStable, setUnreadCountsStable],
  );

  useEffect(() => {
    if (active?.id) {
      markChannelAsRead(active.id);
      if (typeof window !== "undefined") window.localStorage.setItem("cym.lastChannel", active.id);
    }
  }, [active, markChannelAsRead]);

  const sendersRef = useRef(senders);
  useEffect(() => {
    sendersRef.current = senders;
  }, [senders]);

  // Realtime subscription for incoming messages, channels, and threads
  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel("comms-sidebar")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `org_id=eq.${orgId}`,
        },
        (p) => {
          const m = p.new as Msg;
          // Sidebar unread counts and last message logic
          if (activeRef.current?.id !== m.channel_id) {
            if (user?.id !== m.sender_id) {
              setUnreadCountsStable((prev) => ({
                ...prev,
                [m.channel_id]: (prev[m.channel_id] || 0) + 1,
              }));
              const sender = sendersRef.current[m.sender_id]?.full_name ?? "Someone";
              notify(sender, { body: m.body });
            }
          }
          setLastMessageByChannelStable((prev) => ({ ...prev, [m.channel_id]: m }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channels",
          filter: `org_id=eq.${orgId}`,
        },
        (p) => {
          const newChannel = p.new as Channel;
          setChannelsStable((prev) => {
            if (prev.some((c) => c.id === newChannel.id)) return prev;
            return [...prev, newChannel];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "channels",
          filter: `org_id=eq.${orgId}`,
        },
        (p) => {
          const deletedId = p.old?.id;
          if (deletedId) {
            setChannelsStable((prev) => prev.filter((c) => c.id !== deletedId));
            if (activeRef.current?.id === deletedId) {
              setActiveChannelStable(null);
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_threads",
          filter: `org_id=eq.${orgId}`,
        },
        (p) => {
          const newThread = p.new as Thread;
          setThreadsStable((prev) => {
            if (prev.some((t) => t.id === newThread.id)) return prev;
            return [newThread, ...prev];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "direct_threads",
          filter: `org_id=eq.${orgId}`,
        },
        (p) => {
          const deletedThreadId = p.old?.id;
          const deletedChannelId = p.old?.channel_id;
          if (deletedThreadId || deletedChannelId) {
            setThreadsStable((prev) =>
              prev.filter((t) => t.id !== deletedThreadId && t.channel_id !== deletedChannelId),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `org_id=eq.${orgId}`,
        },
        (p) => {
          const deletedMsgId = p.old?.id;
          if (deletedMsgId) {
            setLastMessageByChannelStable((prev) => {
              const updated = { ...prev };
              let changed = false;
              for (const [cid, m] of Object.entries(updated)) {
                if (m.id === deletedMsgId) {
                  delete updated[cid];
                  changed = true;
                }
              }
              return changed ? updated : prev;
            });
          }
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (p) => {
        if (p.eventType === "INSERT") {
          setReactionsStable((prev) => [...prev, p.new as Reaction]);
        } else if (p.eventType === "DELETE") {
          setReactionsStable((prev) => prev.filter((r) => r.id !== p.old.id));
        }
      })
      .subscribe();
    return () => {
      ch.unsubscribe();
    };
  }, [
    orgId,
    user,
    markChannelAsRead,
    setActiveChannelStable,
    setLastMessageByChannelStable,
    setReactionsStable,
    setUnreadCountsStable,
    setChannelsStable,
    setThreadsStable,
  ]);

  useEffect(() => {
    if (!active || !activeMessageIdsKey) {
      setReactionsStable((prev) => (prev.length === 0 ? prev : []));
      setAttachmentsStable((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const ids = activeMessageIdsKey.split(",").filter(Boolean);
    if (ids.length === 0) {
      setReactionsStable((prev) => (prev.length === 0 ? prev : []));
      setAttachmentsStable((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    Promise.all([
      supabase.from("message_reactions").select("*").in("message_id", ids),
      supabase.from("message_attachments").select("*").in("message_id", ids),
    ]).then(([{ data: rx }, { data: att }]) => {
      if (rx) setReactionsStable(rx.map((r) => ({ ...r, message_id: r.message_id })));
      if (att) setAttachmentsStable(att as Attachment[]);
    });
  }, [active, activeMessageIdsKey, setReactionsStable, setAttachmentsStable]);

  const handleSendMessage = async () => {
    if (!body.trim() && pending.length === 0) return;
    try {
      await sendMessage(body, []);
      setBody("");
    } catch {
      toast.error("Failed to send message");
    }
  };

  const handleDeleteChat = async (channelId: string) => {
    if (!user) return;
    try {
      // 1. Fetch message IDs in this channel to enforce foreign keys on child tables
      const { data: channelMsgs } = await supabase
        .from("messages")
        .select("id")
        .eq("channel_id", channelId);

      const msgIds = (channelMsgs ?? []).map((m) => m.id);
      if (msgIds.length > 0) {
        // Enforce foreign key constraints by deleting child reactions & attachments first
        await supabase.from("message_reactions").delete().in("message_id", msgIds);
        await supabase.from("message_attachments").delete().in("message_id", msgIds);
        await supabase.from("messages").delete().eq("channel_id", channelId);
      }

      // 2. Delete message reads referencing this channel
      await supabase.from("message_reads").delete().eq("channel_id", channelId);

      // 3. Delete calls & participants for this channel
      const { data: calls } = await supabase.from("calls").select("id").eq("channel_id", channelId);
      if (calls && calls.length > 0) {
        const callIds = calls.map((c) => c.id);
        await supabase.from("call_participants").delete().in("call_id", callIds);
        await supabase.from("calls").delete().eq("channel_id", channelId);
      }

      // 4. Delete direct thread if DM
      await supabase.from("direct_threads").delete().eq("channel_id", channelId);

      // 5. Delete channel itself
      await supabase.from("channels").delete().eq("id", channelId);

      // 6. Update local React states immediately
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      setThreads((prev) => prev.filter((t) => t.channel_id !== channelId));
      setLastMessageByChannel((prev) => {
        const copy = { ...prev };
        delete copy[channelId];
        return copy;
      });
      setUnreadCounts((prev) => {
        const copy = { ...prev };
        delete copy[channelId];
        return copy;
      });
      setReads((prev) => {
        const copy = { ...prev };
        delete copy[channelId];
        return copy;
      });

      // 7. Clear TanStack query cache for this channel's messages
      queryClient.removeQueries({ queryKey: ["messages", channelId] });

      // 8. Scrub local offline-cache workspace snapshot so it cannot re-hydrate
      const cached = readCache<{
        channels?: Channel[];
        threads?: Thread[];
        lastMessageByChannel?: Record<string, Msg>;
        reads?: Record<string, string>;
      }>(`workspace:${user.id}`);
      if (cached) {
        writeCache(`workspace:${user.id}`, {
          ...cached,
          channels: (cached.channels || []).filter((c) => c.id !== channelId),
          threads: (cached.threads || []).filter((t) => t.channel_id !== channelId),
          lastMessageByChannel: Object.fromEntries(
            Object.entries(cached.lastMessageByChannel || {}).filter(([cid]) => cid !== channelId),
          ),
          reads: Object.fromEntries(
            Object.entries(cached.reads || {}).filter(([cid]) => cid !== channelId),
          ),
        });
      }

      // 9. Remove from localStorage last channel pointer if active
      if (
        typeof window !== "undefined" &&
        window.localStorage.getItem("cym.lastChannel") === channelId
      ) {
        window.localStorage.removeItem("cym.lastChannel");
      }

      if (active?.id === channelId) setActive(null);
      toast.success("Chat and conversation deleted permanently");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete chat");
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!active || !user) return;
    deleteMessageMutation.mutate(
      { messageId: msgId, channelId: active.id },
      {
        onSuccess: async () => {
          // If this message was the last message displayed in sidebar, update it
          if (lastMessageByChannel[active.id]?.id === msgId) {
            const { data: latest } = await supabase
              .from("messages")
              .select("*")
              .eq("channel_id", active.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            setLastMessageByChannel((prev) => {
              const copy = { ...prev };
              if (latest) copy[active.id] = latest as Msg;
              else delete copy[active.id];
              return copy;
            });

            // Update workspace cache in localStorage so it doesn't re-hydrate the deleted message
            const cached = readCache<{ lastMessageByChannel?: Record<string, Msg> }>(
              `workspace:${user.id}`,
            );
            if (cached?.lastMessageByChannel) {
              const nextLast = { ...cached.lastMessageByChannel };
              if (latest) nextLast[active.id] = latest as Msg;
              else delete nextLast[active.id];
              writeCache(`workspace:${user.id}`, { ...cached, lastMessageByChannel: nextLast });
            }
          }
        },
      },
    );
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find(
      (r) => r.message_id === messageId && r.emoji === emoji && r.user_id === user.id,
    );
    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
    } else {
      const { data, error } = await supabase
        .from("message_reactions")
        .insert({
          message_id: messageId,
          emoji,
          user_id: user.id,
        })
        .select()
        .single();
      if (!error && data) {
        setReactions((prev) => [...prev, data]);
      }
    }
  };

  const handleStartDm = async (otherId: string) => {
    setNewDmOpen(false);
    await startDm(otherId);
  };

  const conversations = useMemo(() => {
    const items = channels.map((c) => {
      const last = lastMessageByChannel[c.id];
      const isDm = c.kind === "dm";
      const thread = isDm ? threads.find((t) => t.channel_id === c.id) : undefined;
      const other =
        isDm && thread
          ? senders[thread.user_a === user?.id ? thread.user_b : thread.user_a]
          : undefined;
      const title = isDm ? (other?.full_name ?? other?.id ?? "Direct Message") : c.name;
      const sortKey = last?.created_at ?? "0";
      const unreadCount = unreadCounts[c.id] || 0;
      return {
        channel: c,
        last,
        title,
        other,
        sortKey,
        unreadCount,
        verified: !isDm && VERIFIED_CHANNELS.has(c.name),
      };
    });
    items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    return items;
  }, [channels, lastMessageByChannel, threads, senders, user?.id, unreadCounts]);

  const filtered = useMemo(() => {
    let list = conversations;
    if (tab === "channels") list = list.filter((c) => c.channel.kind === "broadcast");
    else if (tab === "direct") list = list.filter((c) => c.channel.kind === "dm");
    else if (tab === "verified") list = list.filter((c) => c.verified);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }
    return list;
  }, [conversations, tab, search]);

  if (!orgId) {
    return (
      <div className="grid place-items-center py-20">
        <CymaticWave className="h-10" bars={6} />
      </div>
    );
  }

  const activeOther =
    active?.kind === "dm"
      ? senders[
          (threads.find((x) => x.channel_id === active.id)?.user_a === user?.id
            ? threads.find((x) => x.channel_id === active.id)?.user_b
            : threads.find((x) => x.channel_id === active.id)?.user_a) ?? ""
        ]
      : undefined;
  const activeTitle = active
    ? active.kind === "dm"
      ? (activeOther?.full_name ?? "Direct Message")
      : `#${active.name}`
    : "";

  return (
    <ClientOnly
      fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}
    >
      <div className="-m-4 flex h-[calc(100vh-4.5rem)] flex-col md:-m-6 lg:grid lg:grid-cols-[380px_1fr]">
        {/* Sidebar - Conversation list */}
        <aside
          className={`flex min-h-0 flex-col border-r border-white/5 bg-card/30 ${
            active ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="border-b border-white/5 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h1 className="font-display text-2xl font-bold tracking-tight">Chats</h1>
              <div className="flex items-center gap-1">
                <Link
                  to="/comms-settings"
                  className="rounded-lg p-2 hover:bg-white/5"
                  aria-label="Settings"
                >
                  <Settings className="h-5 w-5" />
                </Link>
                <Dialog open={newDmOpen} onOpenChange={setNewDmOpen}>
                  <DialogTrigger asChild>
                    <button className="rounded-lg p-2 hover:bg-white/5" aria-label="New chat">
                      <MessageSquarePlus className="h-5 w-5" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="glass-strong">
                    <DialogHeader>
                      <DialogTitle>New chat</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-72 space-y-1 overflow-y-auto">
                      {Object.values(senders)
                        .filter((s) => s.id !== user?.id)
                        .map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleStartDm(s.id)}
                            className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-sm hover:bg-white/5"
                          >
                            <span className="grid size-8 place-items-center rounded-full bg-frequency/20">
                              <Users className="size-4" />
                            </span>
                            <span className="flex-1 truncate">{s.full_name ?? "Member"}</span>
                            <span className="font-mono text-[10px] uppercase text-muted-foreground">
                              {s.role}
                            </span>
                          </button>
                        ))}
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={tasksOpen} onOpenChange={setTasksOpen}>
                  <DialogTrigger asChild>
                    <button className="rounded-lg p-2 hover:bg-white/5" aria-label="Tasks">
                      <ListTodo className="h-5 w-5" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="glass-strong max-w-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Task Management Board</DialogTitle>
                    </DialogHeader>
                    {user && (
                      <TasksPanel
                        orgId={orgId}
                        userId={user.id}
                        isAdmin={isAdmin}
                        members={Object.values(senders).map((s) => ({
                          id: s.id,
                          full_name: s.full_name || "Member",
                        }))}
                      />
                    )}
                  </DialogContent>
                </Dialog>

                {isAdmin && (
                  <Dialog open={newChannelOpen} onOpenChange={setNewChannelOpen}>
                    <DialogTrigger asChild>
                      <button className="rounded-lg p-2 hover:bg-white/5">
                        <Plus className="h-5 w-5" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="glass-strong">
                      <DialogHeader>
                        <DialogTitle>Create channel</DialogTitle>
                      </DialogHeader>
                      <input
                        className="w-full rounded-md border border-white/10 bg-white/5 p-2"
                        placeholder="Channel name"
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                      />
                      <DialogFooter>
                        <button
                          className="rounded-md bg-frequency px-4 py-2 text-primary-foreground"
                          onClick={async () => {
                            if (!user) return;
                            const { error } = await supabase.from("channels").insert({
                              name: newChannelName,
                              kind: "broadcast",
                              org_id: orgId,
                              created_by: user.id,
                            });

                            if (!error) {
                              setNewChannelOpen(false);
                              setNewChannelName("");
                            }
                          }}
                        >
                          Create
                        </button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm"
                placeholder="Search chats…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Dynamic Chat Items with Unread Badges */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.map((c) => (
              <div key={c.channel.id} className="relative group">
                <ChatItem
                  c={{
                    channel: c.channel,
                    title: c.title,
                    verified: c.verified,
                    last: c.last,
                  }}
                  active={active}
                  setActive={setActive}
                  onLongPress={() => {}}
                  isSelectionMode={false}
                  isSelected={false}
                  onToggleSelection={() => {}}
                  onDeleteChannel={handleDeleteChat}
                />
                {/* Live Unread Badge */}
                {c.unreadCount > 0 && active?.id !== c.channel.id && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center bg-accent text-accent-foreground font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md pointer-events-none">
                    {c.unreadCount > 99 ? "99+" : c.unreadCount}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <CallHistoryPanel />
        </aside>

        {/* Main Active Chat View */}
        <main className={`flex min-h-0 flex-col ${active ? "flex" : "hidden lg:flex"}`}>
          {active ? (
            <>
              <header className="flex items-center justify-between border-b border-white/5 p-4">
                <div className="flex items-center gap-3">
                  <button className="lg:hidden" onClick={() => setActive(null)}>
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="font-semibold">{activeTitle}</h2>
                </div>
                <CallControls
                  onStartAudioCall={() => {
                    const recipientId = active.kind === "dm" && activeOther ? activeOther.id : "";
                    callController.startCall(active.id, recipientId ? [recipientId] : [], "audio");
                  }}
                  onStartVideoCall={() => {
                    const recipientId = active.kind === "dm" && activeOther ? activeOther.id : "";
                    callController.startCall(active.id, recipientId ? [recipientId] : [], "video");
                  }}
                />
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center">
                    <CymaticWave className="h-6" bars={4} />
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                    <p className="text-sm">No messages yet.</p>
                    <p className="text-[10px] uppercase tracking-widest opacity-50">
                      Start the resonance
                    </p>
                  </div>
                ) : (
                  activeMessages.map((m, i) => {
                    const prev = activeMessages[i - 1];
                    const showHeader =
                      !prev ||
                      prev.sender_id !== m.sender_id ||
                      new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() >
                        300000;
                    const msgAttachments = attachments.filter((a) => a.message_id === m.id);
                    const msgReactions = reactions.filter((r) => r.message_id === m.id);
                    const reactionGroups = msgReactions.reduce(
                      (acc, r) => {
                        if (!acc[r.emoji])
                          acc[r.emoji] = { count: 0, users: [], hasReacted: false };
                        acc[r.emoji].count++;
                        acc[r.emoji].users.push(r.user_id);
                        if (r.user_id === user?.id) acc[r.emoji].hasReacted = true;
                        return acc;
                      },
                      {} as Record<string, { count: number; users: string[]; hasReacted: boolean }>,
                    );

                    return (
                      <MessageItem
                        key={m.id}
                        m={m}
                        showHeader={showHeader}
                        user={user}
                        msgAttachments={msgAttachments}
                        reactionGroups={reactionGroups}
                        activeReactionPicker={activeReactionPicker}
                        setActiveReactionPicker={setActiveReactionPicker}
                        handleToggleReaction={handleToggleReaction}
                        handleDeleteMessage={handleDeleteMessage}
                        onLongPress={() => {
                          setIsSelectionMode(true);
                          setSelectedMessageIds((prev) => new Set(prev).add(m.id));
                        }}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedMessageIds.has(m.id)}
                        onToggleSelection={() => {
                          setSelectedMessageIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(m.id)) next.delete(m.id);
                            else next.add(m.id);
                            return next;
                          });
                        }}
                      />
                    );
                  })
                )}
                <div ref={bottom} />
              </div>

              {isSelectionMode && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card/95 border border-white/10 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl animate-fade-up">
                  <span className="text-xs font-mono font-bold text-muted-foreground">
                    {selectedMessageIds.size} selected
                  </span>
                  <button
                    onClick={() => {
                      toast.success(`Archived ${selectedMessageIds.size} messages`);
                      setSelectedMessageIds(new Set());
                      setIsSelectionMode(false);
                    }}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-foreground text-xs font-semibold rounded-xl transition"
                  >
                    Archive
                  </button>
                  <button
                    onClick={() => setShowBatchDeleteConfirm(true)}
                    className="px-3 py-1.5 bg-destructive/20 hover:bg-destructive/30 text-destructive text-xs font-semibold rounded-xl transition"
                  >
                    Delete ({selectedMessageIds.size})
                  </button>
                  <ConfirmDeleteDialog
                    open={showBatchDeleteConfirm}
                    onOpenChange={setShowBatchDeleteConfirm}
                    title={`Delete ${selectedMessageIds.size} messages?`}
                    description="This will permanently delete all selected messages. This action cannot be undone."
                    onConfirm={() => {
                      selectedMessageIds.forEach((id) => handleDeleteMessage(id));
                      setSelectedMessageIds(new Set());
                      setIsSelectionMode(false);
                    }}
                    confirmText="Delete All"
                  />
                  <button
                    onClick={() => {
                      setSelectedMessageIds(new Set());
                      setIsSelectionMode(false);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {isRecording && (
                <div className="absolute bottom-20 left-4 right-4 z-50">
                  <RecordAudioMessage
                    onCancel={() => setIsRecording(false)}
                    onSend={async (audio: RecordedAudio) => {
                      setIsRecording(false);
                      try {
                        await sendMessage("", [], audio);
                        toast.success("Voice message sent!");
                      } catch {
                        toast.error("Failed to send audio message");
                      }
                    }}
                  />
                </div>
              )}

              <footer className="border-t border-white/5 p-4">
                <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2">
                  <button
                    className="p-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsRecording(true)}
                    aria-label="Record voice message"
                    title="Record voice message"
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                  <button className="p-2 text-muted-foreground hover:text-foreground">
                    <SmilePlus className="h-5 w-5" />
                  </button>
                  <button className="p-2 text-muted-foreground hover:text-foreground">
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <input
                    className="flex-1 bg-transparent py-2 text-sm focus:outline-none"
                    placeholder="Message..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  />
                  <button
                    className="rounded-lg bg-frequency p-2 text-primary-foreground disabled:opacity-50"
                    disabled={!body.trim() || sending}
                    onClick={handleSendMessage}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              Select a conversation to start
            </div>
          )}
        </main>
      </div>
    </ClientOnly>
  );
}
