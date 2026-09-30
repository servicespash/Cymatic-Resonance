import { useCallback, useEffect, useState } from "react";
import type { EntitlementPlan } from "@/lib/domain/contracts";
import {
  ENTITLEMENT_FEATURES,
  planIncludes,
  type EntitlementFeature,
} from "@/lib/entitlements/catalog";
import { supabase } from "@/integrations/supabase/client";

type EntitlementRow = {
  feature: EntitlementFeature;
  enabled: boolean;
  limit_value: number | null;
  plan: EntitlementPlan;
  user_id: string | null;
};

export type UpgradeRequest = {
  id: string;
  requested_by: string;
  requested_plan: EntitlementPlan;
  status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED";
  created_at: string;
};

export function useEntitlements(organizationId: string | null, userId: string | null) {
  const [plan, setPlan] = useState<EntitlementPlan>("FREE");
  const [rows, setRows] = useState<EntitlementRow[]>([]);
  const [pendingRequest, setPendingRequest] = useState<UpgradeRequest | null>(null);
  const [pendingRequests, setPendingRequests] = useState<UpgradeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!organizationId || !userId) {
      setPlan("FREE");
      setRows([]);
      setPendingRequest(null);
      setPendingRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [orgResult, entitlementResult, requestResult] = await Promise.all([
      supabase.from("organizations").select("plan").eq("id", organizationId).maybeSingle(),
      supabase
        .from("entitlements")
        .select("feature, enabled, limit_value, plan, user_id")
        .eq("organization_id", organizationId)
        .or("user_id.is.null,user_id.eq." + userId),
      supabase
        .from("entitlement_upgrade_requests")
        .select("id, requested_by, requested_plan, status, created_at")
        .eq("organization_id", organizationId)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false }),
    ]);

    if (orgResult.error) console.error("[Entitlements] organization plan:", orgResult.error);
    if (entitlementResult.error) console.error("[Entitlements] grants:", entitlementResult.error);
    if (requestResult.error) console.error("[Entitlements] upgrade request:", requestResult.error);

    const requests = (requestResult.data as UpgradeRequest[] | null) ?? [];
    setPlan((orgResult.data?.plan as EntitlementPlan | undefined) ?? "FREE");
    setRows((entitlementResult.data as EntitlementRow[] | null) ?? []);
    setPendingRequests(requests);
    setPendingRequest(requests.find((request) => request.requested_by === userId) ?? null);
    setLoading(false);
  }, [organizationId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasFeature = useCallback(
    (feature: EntitlementFeature) => {
      const direct = rows.find((row) => row.user_id === userId && row.feature === feature);
      if (direct) return direct.enabled;
      const planGrant = rows.find((row) => row.user_id === null && row.feature === feature);
      if (planGrant) return planGrant.enabled;
      const definition = ENTITLEMENT_FEATURES.find((item) => item.key === feature);
      return definition ? planIncludes(plan, definition) : false;
    },
    [rows, userId],
  );

  return { plan, rows, pendingRequest, pendingRequests, loading, hasFeature, refresh };
}
