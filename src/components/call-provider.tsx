// Global call state: ringing overlay for incoming calls, mounted active call,
// API for the rest of the app to start a call.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Phone, PhoneOff, Video } from "lucide-react";
import { createRingtone, ensureNotificationPermission, notify } from "@/lib/notifications";
import { CallRoom } from "@/components/call-room";
import { Ctx } from "@/hooks/use-call-controller";
import type { Database } from "@/integrations/supabase/types";

type Sender = { id: string; full_name: string | null };
type Call = Database["public"]["Tables"]["calls"]["Row"];

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Sender>>({});
  const [incoming, setIncoming] = useState<Call | null>(null);
  const [active, setActive] = useState<{ id: string; kind: "audio" | "video" } | null>(null);
  const ringtone = useRef(createRingtone());
  const activeCallRef = useRef<string | null>(null);

  useEffect(() => {
    activeCallRef.current = active?.id ?? null;
  }, [active]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    console.log("CallProvider: Fetching org/members");

    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!p?.org_id || !isMounted) return;
      setOrgId(p.org_id);
      console.log("CallProvider: Org found", p.org_id);

      const { data: m } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("org_id", p.org_id);

      if (!isMounted) return;
      const map: Record<string, Sender> = {};
      for (const s of (m ?? []) as Sender[]) map[s.id] = s;
      setMembers(map);
      console.log("CallProvider: Members fetched", Object.keys(map).length);
      ensureNotificationPermission();
    })();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !orgId) return;
    const ringtoneRef = ringtone.current;

    const channel = supabase
      .channel(`org-calls-${orgId}-${user.id}`)
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

          if (!c || c.status !== "ringing") return;
          if (c.initiator_id === user.id) return;

          setIncoming(c);
          ringtoneRef.start();
          const who = members[c.initiator_id]?.full_name ?? "Someone";
          notify(`Incoming ${c.kind} call`, {
            body: `${who} is calling`,
            tag: `call-${c.id}`,
            requireInteraction: true,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
        },
        (payload) => {
          const c = payload.new as Database["public"]["Tables"]["calls"]["Row"];

          if (incoming?.id === c.id && (c.status === "ended" || c.status === "declined")) {
            setIncoming(null);
            ringtoneRef.stop();
          }

          if (activeCallRef.current === c.id && c.status === "ended") {
            setActive(null);
            ringtoneRef.stop();
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
          status: "ringing",
        })
        .select()
        .single();

      if (error || !call) return;

      const rows = [
        {
          call_id: call.id,
          user_id: user.id,
          state: "joined",
          joined_at: new Date().toISOString(),
        },
        ...recipientIds
          .filter((id) => id !== user.id)
          .map((id) => ({ call_id: call.id, user_id: id, state: "invited" })),
      ];

      await supabase
        .from("call_participants")
        .insert(rows as Database["public"]["Tables"]["call_participants"]["Insert"][]);

      setActive({ id: call.id, kind });
    },
    [user, orgId],
  );

  const accept = useCallback(async () => {
    if (!incoming || !user) return;
    ringtone.current.stop();

    await supabase
      .from("call_participants")
      .update({
        state: "joined",
        joined_at: new Date().toISOString(),
      })
      .eq("call_id", incoming.id)
      .eq("user_id", user.id);

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

    setActive(null);
  }, [active, user]);

  const value = useMemo(
    () => ({ startCall, joinCall, activeCallId: active?.id ?? null }),
    [startCall, joinCall, active],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {incoming && user && (
        <IncomingOverlay
          name={members[incoming.initiator_id]?.full_name ?? "Member"}
          kind={incoming.kind}
          onAccept={accept}
          onDecline={decline}
        />
      )}
      {active && user && (
        <CallRoom
          callId={active.id}
          selfId={user.id}
          video={active.kind === "video"}
          kind={active.kind}
          peers={members}
          onLeave={handleLeaveCall}
        />
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
    <div className="fixed inset-x-0 top-4 z-[60] mx-auto flex max-w-md items-center gap-4 rounded-2xl border border-accent/30 bg-card/95 p-4 shadow-2xl backdrop-blur-xl animate-fade-up">
      <span className="grid size-12 place-items-center rounded-full bg-frequency text-primary-foreground resonance-glow animate-pulse-ring">
        {kind === "video" ? <Video className="size-5" /> : <Phone className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm font-semibold">{name}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Incoming {kind} call
        </div>
      </div>
      <button
        onClick={onDecline}
        className="grid size-10 place-items-center rounded-full bg-destructive text-destructive-foreground hover:brightness-110 transition-transform active:scale-95"
        aria-label="Decline"
      >
        <PhoneOff className="size-4" />
      </button>
      <button
        onClick={onAccept}
        className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground hover:brightness-110 transition-transform active:scale-95"
        aria-label="Accept"
      >
        <Phone className="size-4" />
      </button>
    </div>
  );
}
