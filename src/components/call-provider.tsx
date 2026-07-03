// Global call state: ringing overlay for incoming calls, mounted active call,
// API for the rest of the app to start a call.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Phone, PhoneOff, Video } from "lucide-react";
import { createRingtone, ensureNotificationPermission, notify } from "@/lib/notifications";
import { CallRoom } from "@/components/call-room";

type Sender = { id: string; full_name: string | null };
type Call = {
  id: string; org_id: string; channel_id: string; initiator_id: string;
  kind: "audio" | "video"; status: "ringing" | "active" | "ended" | "missed" | "declined";
};

type CallCtx = {
  startCall: (channelId: string, recipientIds: string[], kind: "audio" | "video") => Promise<void>;
  joinCall: (callId: string, kind: "audio" | "video") => Promise<void>;
  activeCallId: string | null;
};

const Ctx = createContext<CallCtx>({ startCall: async () => {}, joinCall: async () => {}, activeCallId: null });
export const useCallController = () => useContext(Ctx);

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Sender>>({});
  const [incoming, setIncoming] = useState<Call | null>(null);
  const [active, setActive] = useState<{ id: string; kind: "audio" | "video" } | null>(null);
  const ringtone = useRef(createRingtone());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
      if (!p?.org_id) return;
      setOrgId(p.org_id);
      const { data: m } = await supabase.from("profiles").select("id, full_name").eq("org_id", p.org_id);
      const map: Record<string, Sender> = {};
      for (const s of (m ?? []) as Sender[]) map[s.id] = s;
      setMembers(map);
      ensureNotificationPermission();
    })();
  }, [user]);

  // Subscribe to incoming call invitations
  useEffect(() => {
    if (!user || !orgId) return;
    const channel = supabase
      .channel(`org-calls-${orgId}-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_participants", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const part = payload.new as any;
          if (part.state !== "invited") return;
          const { data: c } = await (supabase as any).from("calls").select("*").eq("id", part.call_id).maybeSingle();
          if (!c || c.status !== "ringing") return;
          if (c.initiator_id === user.id) return;
          setIncoming(c as Call);
          ringtone.current.start();
          const who = members[c.initiator_id]?.full_name ?? "Someone";
          notify(`Incoming ${c.kind} call`, {
            body: `${who} is calling`,
            tag: `call-${c.id}`,
            requireInteraction: true,
          });
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls" }, (payload) => {
        const c = payload.new as any;
        if (incoming?.id === c.id && (c.status === "ended" || c.status === "declined")) {
          setIncoming(null);
          ringtone.current.stop();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); ringtone.current.stop(); };
  }, [user, orgId, members, incoming?.id]);

  const startCall = useCallback(async (channelId: string, recipientIds: string[], kind: "audio" | "video") => {
    if (!user || !orgId) return;
    const { data: call, error } = await (supabase as any).from("calls").insert({
      org_id: orgId, channel_id: channelId, initiator_id: user.id, kind, status: "ringing",
    }).select().single();
    if (error || !call) return;
    const rows = [
      { call_id: call.id, user_id: user.id, state: "joined", joined_at: new Date().toISOString() },
      ...recipientIds.filter((id) => id !== user.id).map((id) => ({ call_id: call.id, user_id: id, state: "invited" })),
    ];
    await (supabase as any).from("call_participants").insert(rows);
    setActive({ id: call.id, kind });
  }, [user, orgId]);

  const accept = useCallback(async () => {
    if (!incoming || !user) return;
    ringtone.current.stop();
    await (supabase as any).from("call_participants").update({
      state: "joined", joined_at: new Date().toISOString(),
    }).eq("call_id", incoming.id).eq("user_id", user.id);
    await (supabase as any).from("calls").update({ status: "active" }).eq("id", incoming.id);
    setActive({ id: incoming.id, kind: incoming.kind });
    setIncoming(null);
  }, [incoming, user]);

  const decline = useCallback(async () => {
    if (!incoming || !user) return;
    ringtone.current.stop();
    await (supabase as any).from("call_participants").update({ state: "declined" })
      .eq("call_id", incoming.id).eq("user_id", user.id);
    setIncoming(null);
  }, [incoming, user]);

  const joinCall = useCallback(async (callId: string, kind: "audio" | "video") => {
    if (!user) return;
    await (supabase as any).from("call_participants").upsert({
      call_id: callId, user_id: user.id, state: "joined", joined_at: new Date().toISOString(),
    }, { onConflict: "call_id,user_id" });
    await (supabase as any).from("calls").update({ status: "active" }).eq("id", callId);
    setActive({ id: callId, kind });
  }, [user]);

  const value = useMemo(() => ({ startCall, joinCall, activeCallId: active?.id ?? null }), [startCall, joinCall, active]);

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
          onLeave={() => setActive(null)}
        />
      )}
    </Ctx.Provider>
  );
}

function IncomingOverlay({ name, kind, onAccept, onDecline }: { name: string; kind: "audio" | "video"; onAccept: () => void; onDecline: () => void }) {
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
      <button onClick={onDecline} className="grid size-10 place-items-center rounded-full bg-destructive text-destructive-foreground hover:brightness-110" aria-label="Decline">
        <PhoneOff className="size-4" />
      </button>
      <button onClick={onAccept} className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground hover:brightness-110" aria-label="Accept">
        <Phone className="size-4" />
      </button>
    </div>
  );
}
