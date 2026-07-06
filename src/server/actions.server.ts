// Server actions for call operations (TanStack Start Server Functions)

import { createServerFn } from "@tanstack/start";
import {
  createCall,
  acceptCall,
  declineCall,
  endCall,
  getCallDetails,
  getCallParticipants,
  type CreateCallInput,
} from "./call-orchestration.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Create a new call
export const serverCreateCall = createServerFn(
  {
    method: "POST",
  },
  async (input: CreateCallInput & { userId: string; orgId: string }) => {
    // Verify user belongs to the org
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("org_id")
      .eq("id", input.userId)
      .single();

    if (!profile || profile.org_id !== input.orgId) {
      return { success: false, error: "User not authorized for this organization" };
    }

    return createCall({
      ...input,
      initiatorId: input.userId,
    });
  },
);

// Accept an incoming call
export const serverAcceptCall = createServerFn(
  {
    method: "POST",
  },
  async (input: { callId: string; userId: string }) => {
    return acceptCall(input.callId, input.userId);
  },
);

// Decline an incoming call
export const serverDeclineCall = createServerFn(
  {
    method: "POST",
  },
  async (input: { callId: string; userId: string }) => {
    return declineCall(input.callId, input.userId);
  },
);

// End a call
export const serverEndCall = createServerFn(
  {
    method: "POST",
  },
  async (input: { callId: string; userId: string; durationSeconds: number }) => {
    return endCall(input.callId, input.userId, input.durationSeconds);
  },
);

// Get call details
export const serverGetCallDetails = createServerFn(
  {
    method: "GET",
  },
  async (input: { callId: string }) => {
    const call = await getCallDetails(input.callId);
    return call;
  },
);

// Get call participants
export const serverGetCallParticipants = createServerFn(
  {
    method: "GET",
  },
  async (input: { callId: string }) => {
    const participants = await getCallParticipants(input.callId);
    return participants;
  },
);
