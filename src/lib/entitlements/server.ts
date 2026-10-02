import { createClient } from "@supabase/supabase-js";
import {
  ENTITLEMENT_FEATURES,
  getCallParticipantLimit,
  planIncludes,
  type CallMode,
  type EntitlementFeature,
} from "@/lib/entitlements/catalog";
import type { EntitlementPlan } from "@/lib/domain/contracts";

export type EntitlementDecision =
  | { allowed: true; status: "ENABLED"; plan: EntitlementPlan }
  | {
      allowed: false;
      status: "DISABLED" | "COMING_SOON" | "REVENUE_REQUIRED";
      reason: string;
      plan: EntitlementPlan;
    };

export interface EffectiveEntitlementState {
  plan: EntitlementPlan;
  basePlan: EntitlementPlan;
  trialActive: boolean;
  trialPlan: EntitlementPlan | null;
  trialExpiresAt: string | null;
}

function adminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server-side Supabase credentials are not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function getEffectiveEntitlementState(
  tenantId: string,
): Promise<EffectiveEntitlementState> {
  const { data, error } = await adminClient().rpc("get_effective_entitlement", {
    _organization_id: tenantId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Effective entitlement state was not returned");
  return {
    plan: row.effective_plan as EntitlementPlan,
    basePlan: row.base_plan as EntitlementPlan,
    trialActive: Boolean(row.trial_active),
    trialPlan: (row.trial_plan as EntitlementPlan | null) ?? null,
    trialExpiresAt: row.trial_expires_at ?? null,
  };
}

export async function checkEntitlement(
  tenantId: string,
  featureKey: EntitlementFeature,
): Promise<EntitlementDecision> {
  const definition = ENTITLEMENT_FEATURES.find((feature) => feature.key === featureKey);
  if (!definition)
    return { allowed: false, status: "DISABLED", reason: "Unknown entitlement.", plan: "FREE" };

  const state = await getEffectiveEntitlementState(tenantId);
  if (definition.availability !== "available") {
    return {
      allowed: false,
      status: definition.availability === "revenue_required" ? "REVENUE_REQUIRED" : "COMING_SOON",
      reason:
        definition.availability === "revenue_required"
          ? "This capability requires an eligible plan."
          : "This capability is coming soon.",
      plan: state.plan,
    };
  }
  if (planIncludes(state.plan, definition)) {
    return { allowed: true, status: "ENABLED", plan: state.plan };
  }
  return {
    allowed: false,
    status: "REVENUE_REQUIRED",
    reason: "This capability is not included in the current plan.",
    plan: state.plan,
  };
}

export async function checkCallCapacity(
  tenantId: string,
  mode: CallMode,
  requestedParticipants: number,
): Promise<EntitlementDecision & { maxParticipants: number }> {
  const entitlement = await checkEntitlement(tenantId, "group_calls");
  const state = await getEffectiveEntitlementState(tenantId);
  const maxParticipants = getCallParticipantLimit(state.plan, mode);

  if (!entitlement.allowed) {
    return {
      allowed: false,
      status: entitlement.status,
      reason: entitlement.reason,
      plan: state.plan,
      maxParticipants,
    };
  }
  if (!Number.isInteger(requestedParticipants) || requestedParticipants < 1) {
    return {
      allowed: false,
      status: "DISABLED",
      reason: "Participant count is invalid.",
      plan: state.plan,
      maxParticipants,
    };
  }
  if (requestedParticipants <= maxParticipants) {
    return { allowed: true, status: "ENABLED", plan: state.plan, maxParticipants };
  }
  return {
    allowed: false,
    status: "REVENUE_REQUIRED",
    reason: `The ${state.plan} ${mode.toLowerCase()} call limit is ${maxParticipants} participants.`,
    plan: state.plan,
    maxParticipants,
  };
}
