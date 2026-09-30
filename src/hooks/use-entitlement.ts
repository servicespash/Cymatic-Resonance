import { useEffect, useState } from "react";
import type { EntitlementFeature } from "@/lib/entitlements/catalog";
import { supabase } from "@/integrations/supabase/client";

export type ServiceControlStatus =
  | "ENABLED"
  | "DISABLED"
  | "COMING_SOON"
  | "REVENUE_REQUIRED";

export interface EntitlementState {
  loading: boolean;
  enabled: boolean;
  status: ServiceControlStatus;
  reason: string | null;
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
        });
        return;
      }

      const { data, error } = await supabase
        .from("service_controls")
        .select("status")
        .eq("organization_id", organizationId)
        .eq("feature_key", featureKey)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setState({
          loading: false,
          enabled: false,
          status: "DISABLED",
          reason: "Entitlement status unavailable.",
        });
        return;
      }

      const status =
        (data?.status as ServiceControlStatus | undefined) ??
        "COMING_SOON";

      setState({
        loading: false,
        enabled: status === "ENABLED",
        status,
        reason:
          status === "COMING_SOON"
            ? "This capability is coming soon."
            : status === "REVENUE_REQUIRED"
              ? "A paid subscription is required."
              : status === "DISABLED"
                ? "This capability is currently disabled."
                : null,
      });
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [organizationId, featureKey]);

  return state;
}
