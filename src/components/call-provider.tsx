// Global call state: ringing overlay for incoming calls, mounted active call,
// API for the rest of the app to start and join calls.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Phone, PhoneOff, Video } from "lucide-react";
import {
  createRingtone,
  ensureNotificationPermission,
  notify,
  getNotificationPrefs,
} from "@/lib/notifications";
import { CallRoom } from "@/components/call-room";
import { Ctx, type ActiveCallInfo } from "@/hooks/use-call-controller";
import type { Database } from "@/integrations/supabase/types";

type Sender = { id: string; full_name: string | null };
type Call = Database["public"]["Tables"]["calls"]["Row"];

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Sender>>({});
  const [incoming, setIncoming] = useState<Call | null>(null);
  const [active, setActive] = useState<{ id: string; kind: "audio" | "video" } | null>(null);
  const [activeCalls, setActiveCalls] = useState<Record<string, ActiveCallInfo>>({});

  const ringtone = useRef(createRingtone());
  const activeCallRef = useRef<string | null>(null);

  useEffect(() => {
    activeCallRef.current = active?.id ?? null;
  }, [active]);

  // Fetch Organization & Member Directory
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!p?.org_id || !isMounted) return;
      setOrgId(p.org_id);

      const { data: m } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("org_id", p.org_id);

      if (!isMounted) return;
      const map: Record<string, Sender> = {};
      for (const s of (m ?? []) as Sender[]) map[s.id] = s;
      setMembers(map);
      ensureNotificationPermission();
    })();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Load Existing Active Calls for Workspace
  const loadActiveCalls = useCallback(async () => {
    if (!orgId) return;
    const { data: calls } = await supabase
      .from("calls")
      .select("id, channel_id, kind, initiator_id, created_at, status")
      .eq("org_id", orgId)
      .in("status", ["ringing", "active"]);

    const map: Record<string, ActiveCallInfo> = {};
    if (calls) {
      for (const c of calls) {
        map[c.channel_id] = {
          id: c.id,
          channel_id: c.channel_id,
          kind: c.kind as "audio" | "video",
          initiator_id: c.initiator_id,
          created_at: c.created_at,
          status: c.status,
        };
      }
    }
    setActiveCalls(map);
  }, [orgId]);

  useEffect(() => {
    if (orgId) {
      loadActiveCalls();
    }
  }, [orgId, loadActiveCalls]);

  // Real-time Subscriptions for Calls & Participants in Organization
  useEffect(() => {
    if (!user || !orgId) return;
    const ringtoneRef = ringtone.current;

    const channel = supabase
      .channel(`org-calls-rt-${orgId}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_participants",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const part = payload.new as Database["public"]["Tables"]["call_participants"]["Row"];
          if (part.state !== "invited") return;
          if (activeCallRef.current) return;

          const { data: c } = await supabase
            .from("calls")
            .select("*")
            .eq("id", part.call_id)
            .maybeSingle();

          if (!c || (c.status !== "ringing" && c.status !== "active")) return;
          if (c.initiator_id === user.id) return;

          const prefs = getNotificationPrefs();
          if (prefs.callBanner) {
            setIncoming(c);
            ringtoneRef.start();
          }

          const who = members[c.initiator_id]?.full_name ?? "Workspace Member";
          notify(`Incoming ${c.kind} call`, {
            body: `${who} started a call`,
            tag: `call-${c.id}`,
            requireInteraction: true,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calls",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const c = payload.new as Database["public"]["Tables"]["calls"]["Row"];
          if (!c || !c.channel_id) return;

          if (c.status === "active" || c.status === "ringing") {
            setActiveCalls((prev) => ({
              ...prev,
              [c.channel_id]: {
                id: c.id,
                channel_id: c.channel_id,
                kind: c.kind as "audio" | "video",
                initiator_id: c.initiator_id,
                created_at: c.created_at,
                status: c.status,
              },
            }));
          } else if (c.status === "ended" || c.status === "declined") {
            if (c.status === "declined" && c.initiator_id === user?.id) {
              notify("Call declined", { body: "The recipient declined your call." });
            }
            setActiveCalls((prev) => {
              const copy = { ...prev };
              delete copy[c.channel_id];
              return copy;
            });

            if (incoming?.id === c.id) {
              setIncoming(null);
              ringtoneRef.stop();
            }

            if (activeCallRef.current === c.id) {
              setActive(null);
              ringtoneRef.stop();
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      ringtoneRef.stop();
    };
  }, [user, orgId, members, incoming?.id]);

  const startCall = useCallback(
    async (channelId: string, recipientIds: string[], kind: "audio" | "video") => {
      if (!user || !orgId) return;

      const { data: call, error } = await supabase
        .from("calls")
        .insert({
          org_id: orgId,
          channel_id: channelId,
          initiator_id: user.id,
          kind,
          status: "active",
        })
        .select()
        .single();

      if (error || !call) throw new Error(error?.message ?? "Failed to initiate call");

      // Build target invitees list: if recipientIds empty, invite all org members
      let targetIds = recipientIds.filter((id) => id !== user.id);
      if (targetIds.length === 0) {
        targetIds = Object.keys(members).filter((id) => id !== user.id);
      }

      const rows = [
        {
          call_id: call.id,
          user_id: user.id,
          state: "joined",
          joined_at: new Date().toISOString(),
        },
        ...targetIds.map((id) => ({
          call_id: call.id,
          user_id: id,
          state: "invited",
        })),
      ];

      await supabase
        .from("call_participants")
        .insert(rows as Database["public"]["Tables"]["call_participants"]["Insert"][]);

      setActiveCalls((prev) => ({
        ...prev,
        [channelId]: {
          id: call.id,
          channel_id: channelId,
          kind,
          initiator_id: user.id,
          created_at: call.created_at,
          status: "active",
        },
      }));

      setActive({ id: call.id, kind });
    },
    [user, orgId, members],
  );

  const accept = useCallback(async () => {
    if (!incoming || !user) return;
    ringtone.current.stop();

    await supabase.from("call_participants").upsert(
      {
        call_id: incoming.id,
        user_id: user.id,
        state: "joined",
        joined_at: new Date().toISOString(),
      } as Database["public"]["Tables"]["call_participants"]["Insert"],
      { onConflict: "call_id,user_id" },
    );

    await supabase.from("calls").update({ status: "active" }).eq("id", incoming.id);
    setActive({ id: incoming.id, kind: incoming.kind });
    setIncoming(null);
  }, [incoming, user]);

  const decline = useCallback(async () => {
    if (!incoming || !user) return;
    ringtone.current.stop();

    await supabase
      .from("call_participants")
      .update({ state: "declined" })
      .eq("call_id", incoming.id)
      .eq("user_id", user.id);

    await supabase.from("calls").update({ status: "declined" }).eq("id", incoming.id);

    setIncoming(null);
  }, [incoming, user]);

  const joinCall = useCallback(
    async (callId: string, kind: "audio" | "video") => {
      if (!user) return;
      await supabase.from("call_participants").upsert(
        {
          call_id: callId,
          user_id: user.id,
          state: "joined",
          joined_at: new Date().toISOString(),
        } as Database["public"]["Tables"]["call_participants"]["Insert"],
        { onConflict: "call_id,user_id" },
      );

      await supabase.from("calls").update({ status: "active" }).eq("id", callId);
      setActive({ id: callId, kind });
    },
    [user],
  );

  const handleLeaveCall = useCallback(async () => {
    if (!active || !user) return;

    await supabase
      .from("call_participants")
      .update({ state: "left" })
      .eq("call_id", active.id)
      .eq("user_id", user.id);

    // Check if any joined participants remain
    const { data: parts } = await supabase
      .from("call_participants")
      .select("id")
      .eq("call_id", active.id)
      .eq("state", "joined");

    if (!parts || parts.length === 0) {
      await supabase.from("calls").update({ status: "ended" }).eq("id", active.id);
    }

    setActive(null);
  }, [active, user]);

  const value = useMemo(
    () => ({
      startCall,
      joinCall,
      leaveCall: handleLeaveCall,
      activeCallId: active?.id ?? null,
      activeCalls,
    }),
    [startCall, joinCall, handleLeaveCall, active, activeCalls],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {incoming &&
        user &&
        createPortal(
          <IncomingOverlay
            name={members[incoming.initiator_id]?.full_name ?? "Workspace Member"}
            kind={incoming.kind}
            onAccept={accept}
            onDecline={decline}
          />,
          document.body,
        )}
      {active &&
        user &&
        createPortal(
          <CallRoom
            callId={active.id}
            selfId={user.id}
            video={active.kind === "video"}
            kind={active.kind}
            peers={members}
            onLeave={handleLeaveCall}
          />,
          document.body,
        )}
    </Ctx.Provider>
  );
}

function IncomingOverlay({
  name,
  kind,
  onAccept,
  onDecline,
}: {
  name: string;
  kind: "audio" | "video";
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="fixed inset-x-0 top-4 z-[110] mx-auto flex max-w-md items-center gap-4 rounded-2xl border border-accent/40 bg-card/95 p-4 shadow-2xl backdrop-blur-xl animate-fade-up">
      <span className="grid size-12 place-items-center rounded-full bg-frequency text-primary-foreground resonance-glow animate-pulse">
        {kind === "video" ? <Video className="size-5" /> : <Phone className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm font-semibold text-foreground">{name}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-accent font-bold">
          Incoming {kind} call session
        </div>
      </div>
      <button
        onClick={onDecline}
        className="grid size-10 place-items-center rounded-full bg-destructive text-destructive-foreground hover:brightness-110 transition-transform active:scale-95 shadow-md"
        aria-label="Decline"
      >
        <PhoneOff className="size-4" />
      </button>
      <button
        onClick={onAccept}
        className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground hover:brightness-110 transition-transform active:scale-95 shadow-md"
        aria-label="Accept"
      >
        <Phone className="size-4" />
      </button>
    </div>
  );
}
