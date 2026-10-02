import { useEffect, useState } from "react";
import {
  ENTITLEMENT_FEATURES,
  planIncludes,
  type EntitlementFeature,
} from "@/lib/entitlements/catalog";
import type { EntitlementPlan } from "@/lib/domain/contracts";
import { supabase } from "@/integrations/supabase/client";

export type ServiceControlStatus = "ENABLED" | "DISABLED" | "COMING_SOON" | "REVENUE_REQUIRED";

export interface EntitlementState {
  loading: boolean;
  enabled: boolean;
  status: ServiceControlStatus;
  reason: string | null;
  plan: EntitlementPlan;
}

export function useEntitlement(
  organizationId: string | null,
  featureKey: EntitlementFeature,
): EntitlementState {
  const [state, setState] = useState<EntitlementState>({
    loading: true,
    enabled: false,
    status: "DISABLED",
    reason: null,
    plan: "FREE",
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!organizationId) {
        setState({
          loading: false,
          enabled: false,
          status: "DISABLED",
          reason: "No organization selected.",
          plan: "FREE",
        });
        return;
      }

      const [effectiveResult, controlResult] = await Promise.all([
        supabase.rpc("get_effective_entitlement", {
          _organization_id: organizationId,
        }),
        supabase
          .from("service_controls")
          .select("status, source")
          .eq("organization_id", organizationId)
          .eq("feature_key", featureKey)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const effective = effectiveResult.data?.[0];
      const plan = (effective?.effective_plan as EntitlementPlan | undefined) ?? "FREE";
      const definition = ENTITLEMENT_FEATURES.find((item) => item.key === featureKey);
      const status = (controlResult.data?.status as ServiceControlStatus | undefined) ?? "ENABLED";

      if (!definition) {
        setState({
          loading: false,
          enabled: false,
          status: "DISABLED",
          reason: "Unknown entitlement.",
          plan,
        });
        return;
      }

      if (status === "DISABLED") {
        setState({
          loading: false,
          enabled: false,
          status,
          reason: "This capability is currently disabled.",
          plan,
        });
        return;
      }

      if (definition.availability === "coming_soon") {
        setState({
          loading: false,
          enabled: false,
          status: "COMING_SOON",
          reason: "This capability is coming soon.",
          plan,
        });
        return;
      }

      const included = planIncludes(plan, definition);
      setState({
        loading: false,
        enabled: included,
        status: included ? "ENABLED" : "REVENUE_REQUIRED",
        reason: included ? null : "This capability is not included in the current plan.",
        plan,
      });
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [organizationId, featureKey]);

  return state;
}
