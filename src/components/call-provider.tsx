// Global call state: ringing overlay for incoming calls, mounted active call,
// API for the rest of the app to start a call.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Phone, PhoneOff, Video } from "lucide-react";
import { createRingtone, ensureNotificationPermission, notify } from "@/lib/notifications";
import { CallRoom } from "@/components/call-room";
import { Ctx } from "@/hooks/use-call-controller";
import { useCallManager } from "@/hooks/use-call-manager";
import { CallInitiationModal } from "@/components/call-initiation-modal";
import type { Database } from "@/integrations/supabase/types";

type Sender = { id: string; full_name: string | null };
type Call = Database["public"]["Tables"]["calls"]["Row"];

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Sender>>({});
  const [incoming, setIncoming] = useState<Call | null>(null);
  const ringtone = useRef(createRingtone(localStorage.getItem("cym.ringtone") || "default"));
  const membersRef = useRef(members);
  membersRef.current = members;

  const {
    activeCall,
    isJoining,
    startCall,
    joinCall,
    leaveCall,
    declineCall,
    setActiveCall,
  } = useCallManager();

  // Initiation Modal State
  const [initiationModal, setInitiationModal] = useState<{
    isOpen: boolean;
    channelId: string;
    recipientIds: string[];
    targetName: string;
  }>({
    isOpen: false,
    channelId: "",
    recipientIds: [],
    targetName: "",
  });

  const openInitiationModal = useCallback(
    (channelId: string, recipientIds: string[], targetName: string) => {
      setInitiationModal({
        isOpen: true,
        channelId,
        recipientIds,
        targetName,
      });
    },
    [],
  );

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!p?.org_id) return;
      setOrgId(p.org_id);

      const { data: m } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("org_id", p.org_id);

      const map: Record<string, Sender> = {};
      for (const s of (m ?? []) as Sender[]) map[s.id] = s;
      setMembers(map);
      ensureNotificationPermission();
    })();
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
          if (activeCall) return;

          const { data: c } = await supabase
            .from("calls")
            .select("*")
            .eq("id", part.call_id)
            .maybeSingle();

          if (!c || c.status !== "ringing") return;
          if (c.initiator_id === user.id) return;

          setIncoming(c);
          ringtoneRef.start();
          const who = membersRef.current[c.initiator_id]?.full_name ?? "Someone";
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
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      ringtoneRef.stop();
    };
  }, [user, orgId, incoming, activeCall]);

  const accept = useCallback(async () => {
    if (!incoming || !user) return;
    ringtone.current.stop();
    await joinCall(incoming.id);
    setIncoming(null);
  }, [incoming, user, joinCall]);

  const decline = useCallback(async () => {
    if (!incoming || !user) return;
    ringtone.current.stop();
    await declineCall(incoming.id);
    setIncoming(null);
  }, [incoming, user, declineCall]);

  const value = useMemo(
    () => ({
      startCall,
      joinCall: (id: string, kind: "audio" | "video") => joinCall(id),
      leaveCall,
      activeCallId: activeCall?.id ?? null,
      isJoining,
      openInitiationModal,
    }),
    [startCall, joinCall, leaveCall, activeCall, isJoining, openInitiationModal],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <CallInitiationModal
        isOpen={initiationModal.isOpen}
        onClose={() => setInitiationModal((prev) => ({ ...prev, isOpen: false }))}
        targetName={initiationModal.targetName}
        onInitiate={(kind) => {
          startCall(initiationModal.channelId, initiationModal.recipientIds, kind);
          setInitiationModal((prev) => ({ ...prev, isOpen: false }));
        }}
      />
      {incoming && user && (
        <IncomingOverlay
          name={members[incoming.initiator_id]?.full_name ?? "Member"}
          kind={incoming.kind}
          onAccept={accept}
          onDecline={decline}
        />
      )}
      {activeCall && user && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <CallRoom
            callId={activeCall.id}
            selfId={user.id}
            video={activeCall.kind === "video"}
            kind={activeCall.kind}
            peers={members}
            onLeave={leaveCall}
            initiatorId={activeCall.initiator_id}
          />
        </div>
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
