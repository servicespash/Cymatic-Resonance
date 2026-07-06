// Server-side call orchestration — validation, logging, and state management.
// This is a server file (marked .server.ts) and is never sent to the client.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type Call = Database["public"]["Tables"]["calls"]["Row"];
type CallInsert = Database["public"]["Tables"]["calls"]["Insert"];
type CallParticipant = Database["public"]["Tables"]["call_participants"]["Row"];

export interface CreateCallInput {
  initiatorId: string;
  participantIds: string[];
  channelId: string;
  kind: "audio" | "video";
  orgId: string;
}

export interface CreateCallResult {
  success: boolean;
  call?: Call;
  error?: string;
}

// Validate that all participants belong to the same org
async function validateParticipants(
  orgId: string,
  userIds: string[],
): Promise<{ valid: boolean; error?: string }> {
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, org_id")
    .in("id", userIds);

  if (error) {
    return { valid: false, error: error.message };
  }

  const invalidUsers = profiles?.filter((p) => p.org_id !== orgId);
  if (invalidUsers && invalidUsers.length > 0) {
    return {
      valid: false,
      error: `Users ${invalidUsers.map((u) => u.id).join(", ")} do not belong to org ${orgId}`,
    };
  }

  return { valid: true };
}

// Create a new call with validation
export async function createCall(input: CreateCallInput): Promise<CreateCallResult> {
  try {
    // Validate participants
    const validation = await validateParticipants(input.orgId, [
      input.initiatorId,
      ...input.participantIds,
    ]);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Create call record
    const callData: CallInsert = {
      org_id: input.orgId,
      channel_id: input.channelId,
      initiator_id: input.initiatorId,
      kind: input.kind,
      status: "ringing",
      started_at: null,
      ended_at: null,
      duration_seconds: null,
    };

    const { data: call, error: callError } = await supabaseAdmin
      .from("calls")
      .insert(callData)
      .select()
      .single();

    if (callError || !call) {
      return { success: false, error: callError?.message ?? "Failed to create call" };
    }

    // Create participant records
    const participants = [
      {
        call_id: call.id,
        user_id: input.initiatorId,
        state: "joined" as const,
        joined_at: new Date().toISOString(),
      },
      ...input.participantIds
        .filter((id) => id !== input.initiatorId)
        .map((id) => ({
          call_id: call.id,
          user_id: id,
          state: "invited" as const,
          joined_at: null,
        })),
    ];

    const { error: participantError } = await supabaseAdmin
      .from("call_participants")
      .insert(participants as any);

    if (participantError) {
      // Clean up call record if participant creation fails
      await supabaseAdmin.from("calls").delete().eq("id", call.id);
      return { success: false, error: "Failed to create call participants" };
    }

    return { success: true, call };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Unexpected error: ${msg}` };
  }
}

// Accept a call
export async function acceptCall(callId: string, userId: string): Promise<CreateCallResult> {
  try {
    // Update participant state
    const { error } = await supabaseAdmin
      .from("call_participants")
      .update({
        state: "joined",
        joined_at: new Date().toISOString(),
      })
      .eq("call_id", callId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Update call status to active
    const { data: call, error: callError } = await supabaseAdmin
      .from("calls")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", callId)
      .select()
      .single();

    if (callError) {
      return { success: false, error: callError.message };
    }

    return { success: true, call };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Unexpected error: ${msg}` };
  }
}

// Decline a call
export async function declineCall(callId: string, userId: string): Promise<CreateCallResult> {
  try {
    const { error } = await supabaseAdmin
      .from("call_participants")
      .update({ state: "declined" })
      .eq("call_id", callId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Unexpected error: ${msg}` };
  }
}

// End a call and record metrics
export async function endCall(
  callId: string,
  userId: string,
  durationSeconds: number,
): Promise<CreateCallResult> {
  try {
    // Update participant state
    await supabaseAdmin
      .from("call_participants")
      .update({ state: "left" })
      .eq("call_id", callId)
      .eq("user_id", userId);

    // Check if all participants have left
    const { data: participants } = await supabaseAdmin
      .from("call_participants")
      .select("id")
      .eq("call_id", callId)
      .neq("state", "left");

    // If no one is left, mark call as ended
    if (!participants || participants.length === 0) {
      const { data: call, error } = await supabaseAdmin
        .from("calls")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq("id", callId)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, call };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Unexpected error: ${msg}` };
  }
}

// Get call details
export async function getCallDetails(callId: string): Promise<Call | null> {
  const { data } = await supabaseAdmin.from("calls").select("*").eq("id", callId).single();
  return data ?? null;
}

// Get call participants
export async function getCallParticipants(callId: string): Promise<CallParticipant[]> {
  const { data } = await supabaseAdmin
    .from("call_participants")
    .select("*")
    .eq("call_id", callId);
  return data ?? [];
}
