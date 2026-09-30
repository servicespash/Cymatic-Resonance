import { useCallback, useEffect, useState } from "react";
import type { EntitlementPlan } from "@/lib/domain/contracts";
import type { EntitlementFeature } from "@/lib/entitlements/catalog";
import { supabase } from "@/integrations/supabase/client";

type EntitlementRow = {
  feature: EntitlementFeature;
  enabled: boolean;
  limit_value: number | null;
  plan: EntitlementPlan;
  user_id: string | null;
};

type UpgradeRequest = {
  requested_plan: EntitlementPlan;
  status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED";
};

export function useEntitlements(organizationId: string | null, userId: string | null) {
  const [plan, setPlan] = useState<EntitlementPlan>("FREE");
  const [rows, setRows] = useState<EntitlementRow[]>([]);
  const [pendingRequest, setPendingRequest] = useState<UpgradeRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!organizationId || !userId) {
      setPlan("FREE");
      setRows([]);
      setPendingRequest(null);
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
        .select("requested_plan, status")
        .eq("organization_id", organizationId)
        .eq("requested_by", userId)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (orgResult.error) console.error("[Entitlements] organization plan:", orgResult.error);
    if (entitlementResult.error) console.error("[Entitlements] grants:", entitlementResult.error);
    if (requestResult.error) console.error("[Entitlements] upgrade request:", requestResult.error);

    setPlan((orgResult.data?.plan as EntitlementPlan | undefined) ?? "FREE");
    setRows((entitlementResult.data as EntitlementRow[] | null) ?? []);
    setPendingRequest((requestResult.data as UpgradeRequest | null) ?? null);
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
      return false;
    },
    [rows, userId],
  );

  return { plan, rows, pendingRequest, loading, hasFeature, refresh };
}
