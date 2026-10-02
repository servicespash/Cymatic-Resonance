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
  requested_plan: Exclude<EntitlementPlan, "FREE">;
  status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED";
  created_at: string;
};

export interface TrialViewState {
  hasUsedTrial: boolean;
  active: boolean;
  plan: EntitlementPlan | null;
  startedAt: string | null;
  expiresAt: string | null;
  serverNow: string | null;
  daysRemaining: number;
}

const EMPTY_TRIAL: TrialViewState = {
  hasUsedTrial: false,
  active: false,
  plan: null,
  startedAt: null,
  expiresAt: null,
  serverNow: null,
  daysRemaining: 0,
};

export function useEntitlements(organizationId: string | null, userId: string | null) {
  const [plan, setPlan] = useState<EntitlementPlan>("FREE");
  const [basePlan, setBasePlan] = useState<EntitlementPlan>("FREE");
  const [rows, setRows] = useState<EntitlementRow[]>([]);
  const [trial, setTrial] = useState<TrialViewState>(EMPTY_TRIAL);
  const [pendingRequest, setPendingRequest] = useState<UpgradeRequest | null>(null);
  const [pendingRequests, setPendingRequests] = useState<UpgradeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!organizationId || !userId) {
      setPlan("FREE");
      setBasePlan("FREE");
      setRows([]);
      setTrial(EMPTY_TRIAL);
      setPendingRequest(null);
      setPendingRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [effectiveResult, entitlementResult, requestResult] = await Promise.all([
      supabase.rpc("get_effective_entitlement", { _organization_id: organizationId }),
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

    const effective = effectiveResult.data?.[0];
    const requests = (requestResult.data as UpgradeRequest[] | null) ?? [];

    if (effective) {
      setPlan((effective.effective_plan as EntitlementPlan) ?? "FREE");
      setBasePlan((effective.base_plan as EntitlementPlan) ?? "FREE");
      setTrial({
        hasUsedTrial: Boolean(effective.trial_plan),
        active: Boolean(effective.trial_active),
        plan: (effective.trial_plan as EntitlementPlan | null) ?? null,
        startedAt: null,
        expiresAt: effective.trial_expires_at ?? null,
        serverNow: new Date().toISOString(),
        daysRemaining:
          effective.trial_active && effective.trial_expires_at
            ? Math.max(
                0,
                Math.ceil(
                  (new Date(effective.trial_expires_at).getTime() - Date.now()) / 86_400_000,
                ),
              )
            : 0,
      });
    } else {
      setPlan("FREE");
      setBasePlan("FREE");
    }

    setRows((entitlementResult.data as EntitlementRow[] | null) ?? []);
    setPendingRequests(requests);
    setPendingRequest(requests.find((request) => request.requested_by === userId) ?? null);
    setLoading(false);
  }, [organizationId, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startTrial = useCallback(
    async (trialPlan: "SILVER" | "GOLD", durationDays: number) => {
      try {
        const { data, error } = await supabase.rpc("start_entitlement_trial", {
          _plan: trialPlan,
          _duration_days: durationDays,
        });
        if (error) throw error;
        await refresh();
        return data?.[0] ?? data;
      } catch (err) {
        console.warn(
          "[Entitlements] RPC start_entitlement_trial failed, applying direct fallback trial activation:",
          err,
        );
        if (organizationId) {
          const expiresAt = new Date(Date.now() + durationDays * 86400000).toISOString();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: directError } = await (supabase.from("organizations") as any)
            .update({
              has_used_trial: true,
              trial_plan: trialPlan,
              trial_started_at: new Date().toISOString(),
              trial_expires_at: expiresAt,
            })
            .eq("id", organizationId);
          if (directError) throw directError;
        } else {
          throw err;
        }
        await refresh();
        return { effective_plan: trialPlan, trial_plan: trialPlan };
      }
    },
    [refresh, organizationId],
  );

  const hasFeature = useCallback(
    (feature: EntitlementFeature) => {
      const direct = rows.find((row) => row.user_id === userId && row.feature === feature);
      if (direct) return direct.enabled;

      const planGrant = rows.find((row) => row.user_id === null && row.feature === feature);
      if (planGrant) return planGrant.enabled;

      const definition = ENTITLEMENT_FEATURES.find((item) => item.key === feature);
      if (!definition || definition.availability !== "available") return false;

      return planIncludes(plan, definition);
    },
    [plan, rows, userId],
  );

  return {
    plan,
    basePlan,
    rows,
    trial,
    pendingRequest,
    pendingRequests,
    loading,
    hasFeature,
    startTrial,
    refresh,
  };
}
