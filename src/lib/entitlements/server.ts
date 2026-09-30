import { createClient } from "@supabase/supabase-js";
import {
  ENTITLEMENT_FEATURES,
  planIncludes,
  type EntitlementFeature,
} from "@/lib/entitlements/catalog";
import type { EntitlementPlan } from "@/lib/domain/contracts";

export type EntitlementDecision =
  | { allowed: true; status: "ENABLED" }
  | {
      allowed: false;
      status: "DISABLED" | "COMING_SOON" | "REVENUE_REQUIRED";
      reason: string;
    };

function adminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Server-side Supabase credentials are not configured");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function checkEntitlement(
  tenantId: string,
  featureKey: EntitlementFeature,
): Promise<EntitlementDecision> {
  const definition = ENTITLEMENT_FEATURES.find(
    (feature) => feature.key === featureKey,
  );

  if (!definition) {
    return {
      allowed: false,
      status: "DISABLED",
      reason: "Unknown entitlement.",
    };
  }

  const supabase = adminClient();

  const { data: control, error: controlError } = await supabase
    .from("service_controls")
    .select("status")
    .eq("organization_id", tenantId)
    .eq("feature_key", featureKey)
    .maybeSingle();

  if (controlError) throw controlError;

  if (control?.status === "ENABLED") {
    return { allowed: true, status: "ENABLED" };
  }

  if (control?.status) {
    return {
      allowed: false,
      status: control.status as EntitlementDecision["status"],
      reason:
        control.status === "COMING_SOON"
          ? "This capability is coming soon."
          : control.status === "REVENUE_REQUIRED"
            ? "A paid subscription is required."
            : "This capability is disabled.",
    };
  }

  if (definition.availability !== "available") {
    return {
      allowed: false,
      status:
        definition.availability === "revenue_required"
          ? "REVENUE_REQUIRED"
          : "COMING_SOON",
      reason:
        definition.availability === "revenue_required"
          ? "A paid subscription is required."
          : "This capability is coming soon.",
    };
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", tenantId)
    .single();

  if (organizationError) throw organizationError;

  const plan = organization.plan as EntitlementPlan;
  return planIncludes(plan, definition)
    ? { allowed: true, status: "ENABLED" }
    : {
        allowed: false,
        status: "REVENUE_REQUIRED",
        reason: "A paid subscription is required.",
      };
}
